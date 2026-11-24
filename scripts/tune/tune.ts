// Automatic tuning of the AI's weights by self-play (SPSA), and validation of the result.
// See docs/tuning.md for how to run it and what to send back.
//
//   npm run tune -- [tune|validate] [options]
//
// This one file is both the coordinator (main thread) and the game workers (worker threads).

import { isMainThread, parentPort, workerData, Worker } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCAFFOLD_MAP, MASTERS, randomLoadout, applyTurn, createMatch, applyTemporaryBalance, normalizeBalance, type MatchState, type Balance } from '../../src/rules';
import { AI_WEIGHTS, autoLoadout, chooseAction } from '../../src/ai/ai';
import { PARAMS } from './params';

type Weights = typeof AI_WEIGHTS;
type Overrides = Partial<Record<keyof Weights, number>>;
interface Setup {
  masters: [string, string];
  rosters: [string[], string[]];
  seed: number;
}
interface Job {
  id: number;
  setup: Setup;
  /** Weight overrides for side 0 and side 1. */
  w: [Overrides, Overrides];
}
type Winner = 0 | 1 | 'draw';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random matchup, as in the arena: random Masters, Loadouts half auto, half random. */
function makeSetup(r: () => number): Setup {
  const masters: [string, string] = [MASTERS[Math.floor(r() * MASTERS.length)].id, MASTERS[Math.floor(r() * MASTERS.length)].id];
  const lo = (m: string) => (r() < 0.5 ? autoLoadout(m, r) : randomLoadout(r));
  return { masters, rosters: [lo(masters[0]), lo(masters[1])], seed: Math.floor(r() * 1e9) };
}

function play(setup: Setup, w: [Overrides, Overrides], maxTurns: number): Winner {
  const weights: [Weights, Weights] = [{ ...AI_WEIGHTS, ...w[0] }, { ...AI_WEIGHTS, ...w[1] }];
  let st: MatchState = createMatch(SCAFFOLD_MAP, { ai: [true, true], seed: setup.seed, masters: setup.masters, rosters: setup.rosters });
  for (let t = 0; t < maxTurns && st.winner === null; t++) {
    const side = st.units.find((u) => u.id === st.activeUnitId)!.side;
    st = applyTurn(st, chooseAction(st, weights[side], 'normal')).state;
  }
  return st.winner === 0 || st.winner === 1 ? st.winner : 'draw';
}

// ---------------------------------------------------------------- worker
if (!isMainThread) {
  const { balance, maxTurns } = workerData as { balance: Balance | null; maxTurns: number };
  if (balance) applyTemporaryBalance(balance);
  parentPort!.on('message', (job: Job) => {
    parentPort!.postMessage({ id: job.id, winner: play(job.setup, job.w, maxTurns) });
  });
}

// ---------------------------------------------------------------- coordinator
class Pool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: Job[] = [];
  private pending = new Map<number, (w: Winner) => void>();
  constructor(n: number, data: unknown) {
    const file = fileURLToPath(import.meta.url);
    for (let i = 0; i < n; i++) {
      const wk = new Worker(file, { workerData: data });
      wk.on('message', (m: { id: number; winner: Winner }) => {
        this.pending.get(m.id)!(m.winner);
        this.pending.delete(m.id);
        this.idle.push(wk);
        this.pump();
      });
      wk.on('error', (e) => {
        console.error('worker failed:', e);
        process.exit(1);
      });
      this.workers.push(wk);
      this.idle.push(wk);
    }
  }
  private pump() {
    while (this.idle.length && this.queue.length) this.idle.pop()!.postMessage(this.queue.shift()!);
  }
  run(jobs: Job[]): Promise<Winner[]> {
    const out = jobs.map((j) => new Promise<Winner>((res) => this.pending.set(j.id, res)));
    this.queue.push(...jobs);
    this.pump();
    return Promise.all(out);
  }
  close() {
    for (const w of this.workers) void w.terminate();
  }
}

interface Options {
  command: 'tune' | 'validate' | 'report';
  iterations: number;
  pairs: number;
  workers: number;
  out: string;
  seed: number;
  c: number;
  a: number;
  maxTurns: number;
  balance: string | null;
  resume: boolean;
  weights: string | null;
}

/**
 * npm on Windows escapes script arguments for cmd.exe (a caret before spaces and
 * quotes) and the escapes can reach us intact: "^C:\\x^ y.json^". Undo that.
 */
const unmangle = (arg: string) => (process.platform === 'win32' && arg.includes('^') ? arg.replace(/\^(.)/g, '$1').replace(/\^$/, '').replace(/^"(.*)"$/, '$1') : arg);

function parseArgs(argv: string[]): Options {
  const o: Options = { command: 'tune', iterations: 1000, pairs: 4, workers: Math.max(1, availableParallelism() - 1), out: 'tune-out', seed: 1, c: 0.15, a: 0.03, maxTurns: 1000, balance: null, resume: false, weights: null };
  const args = argv.map(unmangle);
  if (args[0] === 'tune' || args[0] === 'validate' || args[0] === 'report') o.command = args.shift() as Options['command'];
  if (o.command === 'validate') o.pairs = 200;
  while (args.length) {
    const k = args.shift()!;
    const v = () => {
      const x = args.shift();
      if (x === undefined) throw new Error(`${k} needs a value`);
      return x;
    };
    switch (k) {
      case '--iterations': o.iterations = Number(v()); break;
      case '--pairs': o.pairs = Number(v()); break;
      case '--workers': o.workers = Number(v()); break;
      case '--out': o.out = v(); break;
      case '--seed': o.seed = Number(v()); break;
      case '--c': o.c = Number(v()); break;
      case '--a': o.a = Number(v()); break;
      case '--max-turns': o.maxTurns = Number(v()); break;
      case '--balance': o.balance = v(); break;
      case '--resume': o.resume = true; break;
      case '--weights': o.weights = v(); break;
      case '--help': case '-h':
        console.log(readmeHint);
        process.exit(0);
        break;
      default:
        throw new Error(`unknown option ${k} (try --help)`);
    }
  }
  return o;
}

const readmeHint = `Usage: npm run tune -- [tune|validate] [options]   (see docs/tuning.md)
  tune      SPSA self-play tuning; writes <out>/checkpoint.json, log.jsonl, tuned-weights.json
  validate  tuned weights (--weights) against the defaults; prints the score and its 95% range
  report    every tuned weight: default, tuned value and change, biggest change first
Options: --iterations N (1000)  --pairs N per iteration (4; validate: 200)  --workers N (cores - 1)
         --out DIR (tune-out)  --seed N (1)  --c F (0.15)  --a F (0.03)  --max-turns N (1000)
         --balance FILE (a replay .json or a balance .json, to tune on your local stats)
         --resume (continue from <out>/checkpoint.json)  --weights FILE (validate)`;

function loadBalance(path: string | null): Balance | null {
  if (!path) return null;
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const b = raw?.replay?.balance ?? raw?.balance ?? raw;
  return normalizeBalance(b);
}

const valueOf = (name: keyof Weights, x: number, max?: number) => {
  const v = (AI_WEIGHTS[name] as number) * Math.exp(x);
  return max !== undefined ? Math.min(max, v) : v;
};
const overridesOf = (x: number[]): Overrides => {
  const o: Overrides = {};
  PARAMS.forEach((p, i) => (o[p.name as keyof Weights] = valueOf(p.name as keyof Weights, x[i], p.max)));
  return o;
};
const round3 = (v: number) => Number(v.toPrecision(3));
const LIMIT = Math.log(4);

/** Score from side A's point of view: 1 win, 0.5 draw, 0 loss. */
const scoreFor = (winner: Winner, sideA: 0 | 1) => (winner === 'draw' ? 0.5 : winner === sideA ? 1 : 0);

async function tune(o: Options, pool: Pool) {
  mkdirSync(o.out, { recursive: true });
  const ckPath = join(o.out, 'checkpoint.json');
  const logPath = join(o.out, 'log.jsonl');
  let x = PARAMS.map(() => 0);
  let start = 0;
  if (o.resume && existsSync(ckPath)) {
    const ck = JSON.parse(readFileSync(ckPath, 'utf8'));
    x = PARAMS.map((p) => ck.x?.[p.name] ?? 0);
    start = ck.iteration;
    console.log(`resuming at iteration ${start}`);
  }
  // SPSA gains (Spall): a_k = a / (k + 1 + A)^0.602, c_k = c / (k + 1)^0.101, A = 10% of the run
  const A = Math.max(1, Math.round(o.iterations * 0.1));
  const aNorm = o.a * Math.pow(A + 1, 0.602);
  console.log(`SPSA: ${PARAMS.length} weights · ${o.iterations} iterations · ${o.pairs * 2} games each · ${o.workers} workers`);
  const t0 = Date.now();
  for (let k = start; k < o.iterations; k++) {
    const ck = o.c / Math.pow(k + 1, 0.101);
    const ak = aNorm / Math.pow(k + 1 + A, 0.602);
    const r = rng(o.seed * 1_000_003 + k * 7919);
    const delta = PARAMS.map(() => (r() < 0.5 ? -1 : 1));
    const plus = overridesOf(x.map((v, i) => v + ck * delta[i]));
    const minus = overridesOf(x.map((v, i) => v - ck * delta[i]));
    // the same setups for both, each played twice with sides swapped (common random numbers)
    const jobs: Job[] = [];
    for (let p = 0; p < o.pairs; p++) {
      const setup = makeSetup(r);
      jobs.push({ id: k * 1000 + p * 2, setup, w: [plus, minus] });
      jobs.push({ id: k * 1000 + p * 2 + 1, setup, w: [minus, plus] });
    }
    const t = Date.now();
    const winners = await pool.run(jobs);
    let plusScore = 0;
    let wins = 0, losses = 0, draws = 0;
    winners.forEach((wnr, j) => {
      const s = scoreFor(wnr, (j % 2 === 0 ? 0 : 1) as 0 | 1);
      plusScore += s;
      if (s === 1) wins++;
      else if (s === 0) losses++;
      else draws++;
    });
    // result in [-1, 1]: how much better "+" did than "−"
    const result = (2 * plusScore) / winners.length - 1;
    for (let i = 0; i < x.length; i++) {
      // step toward the side that won: "+" won (result > 0) → move along Δ, else against it
      x[i] += ak * result * delta[i];
      x[i] = Math.max(-LIMIT, Math.min(LIMIT, x[i]));
    }
    const weights = Object.fromEntries(PARAMS.map((p, i) => [p.name, round3(valueOf(p.name as keyof Weights, x[i], p.max))]));
    writeFileSync(ckPath, JSON.stringify({ iteration: k + 1, options: o, x: Object.fromEntries(PARAMS.map((p, i) => [p.name, x[i]])), weights }, null, 1));
    writeFileSync(join(o.out, 'tuned-weights.json'), JSON.stringify(weights, null, 1));
    appendFileSync(logPath, JSON.stringify({ k: k + 1, plus: wins, minus: losses, draws, result: round3(result), ak: round3(ak), ck: round3(ck), sec: (Date.now() - t) / 1000, ...(k % 25 === 24 ? { weights } : {}) }) + '\n');
    const done = k + 1 - start;
    const eta = ((Date.now() - t0) / done) * (o.iterations - k - 1);
    const moved = PARAMS.map((p, i) => ({ n: p.name, m: Math.exp(x[i]) })).sort((u, v) => Math.abs(Math.log(v.m)) - Math.abs(Math.log(u.m))).slice(0, 3);
    console.log(`iter ${k + 1}/${o.iterations}  +${wins} −${losses} =${draws}  result ${result >= 0 ? '+' : ''}${result.toFixed(2)}  ${((Date.now() - t) / 1000).toFixed(1)} s  ETA ${(eta / 3.6e6).toFixed(1)} h  most moved: ${moved.map((u) => `${u.n} ×${u.m.toFixed(2)}`).join(', ')}`);
  }
  console.log(`done: ${join(o.out, 'tuned-weights.json')}`);
}

async function validate(o: Options, pool: Pool) {
  if (!o.weights) throw new Error('validate needs --weights FILE (e.g. tune-out/tuned-weights.json)');
  const raw = JSON.parse(readFileSync(o.weights, 'utf8'));
  const tuned: Overrides = raw.weights ?? raw;
  const r = rng(o.seed * 104_729 + 17);
  const jobs: Job[] = [];
  for (let p = 0; p < o.pairs; p++) {
    const setup = makeSetup(r);
    jobs.push({ id: p * 2, setup, w: [tuned, {}] });
    jobs.push({ id: p * 2 + 1, setup, w: [{}, tuned] });
  }
  console.log(`validate: ${o.weights} vs defaults · ${jobs.length} games · ${o.workers} workers`);
  const t0 = Date.now();
  const winners = await pool.run(jobs);
  let w = 0, l = 0, d = 0;
  winners.forEach((wnr, j) => {
    const s = scoreFor(wnr, (j % 2 === 0 ? 0 : 1) as 0 | 1);
    if (s === 1) w++;
    else if (s === 0) l++;
    else d++;
  });
  const n = winners.length;
  const s = (w + d / 2) / n;
  const half = 1.96 * Math.sqrt(Math.max(1e-9, s * (1 - s)) / n);
  const elo = (p: number) => (p <= 0 ? -Infinity : p >= 1 ? Infinity : -400 * Math.log10(1 / p - 1));
  console.log(`VALIDATE tuned vs default: W ${w} D ${d} L ${l} · score ${(s * 100).toFixed(1)}% (95%: ${((s - half) * 100).toFixed(1)}–${((s + half) * 100).toFixed(1)}%) · Elo ${elo(s).toFixed(0)} (${elo(s - half).toFixed(0)} to ${elo(s + half).toFixed(0)}) · ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}

/** Default, tuned value and change of every tuned weight, biggest change first. */
function report(o: Options) {
  const path = o.weights ?? join(o.out, 'tuned-weights.json');
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const tuned: Record<string, number> = raw.weights ?? raw;
  const rows = PARAMS.filter((p) => typeof tuned[p.name] === 'number').map((p) => {
    const def = AI_WEIGHTS[p.name as keyof Weights] as number;
    const val = tuned[p.name];
    return { name: p.name, def, val, ratio: val / def };
  });
  rows.sort((a, b) => Math.abs(Math.log(b.ratio)) - Math.abs(Math.log(a.ratio)));
  const ck = join(o.out, 'checkpoint.json');
  if (!o.weights && existsSync(ck)) console.log(`after ${JSON.parse(readFileSync(ck, 'utf8')).iteration} iterations (${path})`);
  console.log(`${'weight'.padEnd(18)}${'default'.padStart(10)}${'tuned'.padStart(10)}${'change'.padStart(10)}`);
  for (const r of rows) {
    const pct = (r.ratio - 1) * 100;
    console.log(`${r.name.padEnd(18)}${String(r.def).padStart(10)}${String(r.val).padStart(10)}${`${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`.padStart(10)}`);
  }
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.command === 'report') return report(o);
  const balancePath = o.balance ? resolve(o.balance) : null;
  const balance = loadBalance(balancePath);
  if (balance) console.log(`balance: ${balancePath}`);
  const pool = new Pool(o.workers, { balance, maxTurns: o.maxTurns });
  try {
    if (o.command === 'tune') await tune(o, pool);
    else await validate(o, pool);
  } finally {
    pool.close();
  }
}

if (isMainThread) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
