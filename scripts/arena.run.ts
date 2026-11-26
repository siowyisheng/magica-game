// Arena: the current AI (candidate) against the frozen baseline AI.
// Each pair plays the same setup twice with sides swapped.
//   npx vitest run --config scripts/vitest.config.ts scripts/arena.run.ts
// Env: PAIRS (default 8), SEED (default 1), LEVEL (candidate level: normal|hard), OPP (baseline|normal),
//      REPLIES (candidate Hard: enemy replies tried, default 1), OPP_LEVEL / OPP_REPLIES (OPP=normal: the current
//      AI at that level and replies, e.g. Hard with 3 replies against Hard with 1).
//      LIGHT=1: the candidate Hard plays its look-ahead with the light scorer.
//      BALANCE=path: a replay (or balance) .json whose stats to play with. W (candidate only; OPP=normal always
//      plays the default weights): W='{"capture":116}' or W=@file.json.

import { it } from 'vitest';
import { SCAFFOLD_MAP, MASTERS, randomLoadout, applyTurn, createMatch, type MatchState, type TurnAction } from '../src/rules';
import { AI_WEIGHTS, autoLoadout, chooseAction as chooseRaw } from '../src/ai/ai';
import { readFileSync } from 'node:fs';
import { applyTemporaryBalance, normalizeBalance } from '../src/rules';
// BALANCE=path: play with the stats saved in a replay (or balance) file, e.g. the player's local edits
if (process.env.BALANCE) {
  const raw = JSON.parse(readFileSync(process.env.BALANCE, 'utf8'));
  applyTemporaryBalance(normalizeBalance(raw?.replay?.balance ?? raw?.balance ?? raw));
}

const wRaw = process.env.W ?? '{}';
const W = { ...AI_WEIGHTS, ...JSON.parse(wRaw.startsWith('@') ? readFileSync(wRaw.slice(1), 'utf8') : wRaw) };
const levelOf = (v: string | undefined) => (v === 'hard' ? 'hard' : 'normal') as 'normal' | 'hard';
const candidatePolicy = (s: MatchState) => chooseRaw(s, W, levelOf(process.env.LEVEL), { replies: Number(process.env.REPLIES ?? 1), lightPlayouts: process.env.LIGHT === '1' });
const currentOpp = (s: MatchState) => chooseRaw(s, AI_WEIGHTS, levelOf(process.env.OPP_LEVEL), { replies: Number(process.env.OPP_REPLIES ?? 1) });
import { chooseAction as baselineChoose } from './baseline/ai';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Policy = (s: MatchState) => TurnAction;

function play(setup: { masters: [string, string]; rosters: [string[], string[]]; seed: number }, p0: Policy, p1: Policy, levels: ['normal' | 'hard', 'normal' | 'hard'], log = false) {
  let st = createMatch(SCAFFOLD_MAP, { ai: [true, true], seed: setup.seed, masters: setup.masters, rosters: setup.rosters, signatures: [setup.rosters[0][setup.seed % setup.rosters[0].length], setup.rosters[1][(setup.seed + 7) % setup.rosters[1].length]], aiLevels: levels });
  let turns = 0;
  const ms: [number, number] = [0, 0];
  const n: [number, number] = [0, 0];
  while (st.winner === null && turns < 3000) {
    const side = st.units.find((u) => u.id === st.activeUnitId)!.side;
    const t = Date.now();
    const a = (side === 0 ? p0 : p1)(st);
    ms[side] += Date.now() - t;
    n[side]++;
    const res = applyTurn(st, a);
    if (log) {
      const me = st.units.find((u) => u.id === a.unitId)!;
      const ev = res.events.filter((e) => e.type === 'damage' || e.type === 'death' || e.type === 'summon').map((e) => JSON.stringify(e)).join(' ');
      process.stdout.write(`  t${turns} ${Math.floor(st.clock / 60)}:${String(st.clock % 60).padStart(2, '0')} S${side} ${me.kind}#${me.id} hp${me.hp} (${me.pos.q},${me.pos.r})→(${a.to.q},${a.to.r}) f${a.facing} ${JSON.stringify(a.command)} | ${ev}\n`);
    }
    st = res.state;
    turns++;
  }
  const stones = [0, 1].map((x) => st.stones.filter((s) => s.owner === x).length);
  const units = [0, 1].map((x) => st.units.filter((u) => u.side === x).length);
  return { stones, units, winner: st.winner, turns, hours: (st.clock - SCAFFOLD_MAP.startClock) / 60, byTime: st.clock >= st.timeLimit, ms: [ms[0] / Math.max(1, n[0]), ms[1] / Math.max(1, n[1])] };
}

it('arena', () => {
  const pairs = Number(process.env.PAIRS ?? 8);
  const level = (process.env.LEVEL ?? 'normal') as 'normal' | 'hard';
  const opp: Policy = process.env.OPP === 'normal' ? currentOpp : baselineChoose;
  const r = rng(Number(process.env.SEED ?? 1) * 7919);
  let w = 0, d = 0, l = 0, byTime = 0, turns = 0, candMs = 0, games = 0, masterKills = 0;
  for (let i = 0; i < pairs; i++) {
    const masters: [string, string] = [MASTERS[Math.floor(r() * MASTERS.length)].id, MASTERS[Math.floor(r() * MASTERS.length)].id];
    const lo = (s: string) => (r() < 0.5 ? autoLoadout(s, r) : randomLoadout(r));
    const setup = { masters, rosters: [lo(masters[0]), lo(masters[1])] as [string[], string[]], seed: Math.floor(r() * 1e6) };
    for (const candSide of [0, 1] as const) {
      const dbg = process.env.DEBUG === `${i}:${candSide}`;
      if (process.env.DEBUG && !dbg) continue;
      const res = play(setup, candSide === 0 ? candidatePolicy : opp, candSide === 1 ? candidatePolicy : opp, candSide === 0 ? [level, 'normal'] : ['normal', level], dbg);
      games++;
      turns += res.turns;
      candMs += res.ms[candSide];
      if (res.byTime) byTime++;
      else masterKills++;
      if (res.winner === 'draw') d++;
      else if (res.winner === candSide) w++;
      else l++;
      process.stdout.write(`pair ${i} cand=S${candSide} ${masters.join(' v ')} → ${res.winner === candSide ? 'WIN' : res.winner === 'draw' ? 'draw' : 'loss'} ${res.byTime ? 'on time' : 'kill'} ${res.turns}t ${res.hours.toFixed(1)}h stones ${res.stones.join('-')} units ${res.units.join('-')}\n`);
    }
  }
  const line = `ARENA level=${level} vs ${process.env.OPP ?? 'baseline'}: W ${w} D ${d} L ${l} (score ${((w + d / 2) / games * 100).toFixed(0)}%) · kills ${masterKills} time ${byTime} · avg ${(turns / games).toFixed(0)} turns · cand ${(candMs / games).toFixed(0)} ms/turn`;
  console.log(line);
  process.stdout.write(line + '\n');
});
