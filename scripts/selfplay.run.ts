// Headless AI-vs-AI self-play with per-game statistics, for tuning the AI.
//   npx vitest run --config scripts/vitest.config.ts
// Env: GAMES (default 10), MAX_TURNS (default 600), OUT (JSON path),
//      AI=baseline to play the frozen arena baseline instead (for comparing the plan metrics).

import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import {
  SCAFFOLD_MAP,
  randomLoadout,
  MASTERS,
  applyTurn,
  createMatch,
  hexDistance,
  kindOf,
  manaIncome,
  type GameEvent,
  type MatchState,
  type SideId,
} from '../src/rules';
import { autoLoadout, chooseAction as currentAI } from '../src/ai/ai';
import { chooseAction as baselineAI } from './baseline/ai';
import { makePlan } from '../src/ai/plan';
import { hexEq, hexKey, neighbor } from '../src/rules';

const chooseAction = process.env.AI === 'baseline' ? baselineAI : currentAI;

/** The Plan metrics (docs/ai-plan.md §7), summed over a game per Side. */
interface PlanStats {
  masterFrontDist: number;
  masterTurns: number;
  summonObjDist: number;
  summons: number;
  idleOnSafeOwnStone: number;
  familiarTurns: number;
  firstCaptureHour: number | null;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface SideStats {
  master: string;
  loadout: string;
  familiars: string[];
  waits: number;
  idleWaits: number; // Wait without moving
  attacks: number;
  magics: number;
  waterSpells: number;
  summonTurns: number;
  damageDealt: number;
  damageTaken: number;
  kills: number;
  masterDamageTaken: number;
  masterHpMin: number;
  captures: number;
  manaWastedAtCap: number;
  manaSpentSummons: number;
  manaSpentMagic: number;
  stoneHours: number;
  turnsWithEnemyInReachButWaited: number;
  masterActedOffensively: number;
  avgDistMasterToEnemyMaster: number;
  turns: number;
  zeroDamageHits: number;
  friendlyDamage: number;
  strandedTurns: number;
  deaths: { kind: string; byKind: string; atTurn: number }[];
  msPerTurn: number;
}

function blank(master: string, loadout: string): SideStats {
  return {
    master, loadout, familiars: [], waits: 0, idleWaits: 0, attacks: 0, magics: 0, waterSpells: 0, summonTurns: 0,
    damageDealt: 0, damageTaken: 0, kills: 0, masterDamageTaken: 0, masterHpMin: 10, captures: 0, manaWastedAtCap: 0,
    manaSpentSummons: 0, manaSpentMagic: 0, stoneHours: 0, turnsWithEnemyInReachButWaited: 0, masterActedOffensively: 0,
    avgDistMasterToEnemyMaster: 0, turns: 0, zeroDamageHits: 0, friendlyDamage: 0, strandedTurns: 0, deaths: [], msPerTurn: 0,
  };
}

it('self-play', () => {
  const games = Number(process.env.GAMES ?? 10);
  const maxTurns = Number(process.env.MAX_TURNS ?? 600);
  const results: unknown[] = [];
  for (let g = 0; g < games; g++) {
    const r = rng(1000 + g * 7919);
    const masters: [string, string] = [MASTERS[Math.floor(r() * MASTERS.length)].id, MASTERS[Math.floor(r() * MASTERS.length)].id];
    const lo = (i: number) => {
      const x = r();
      if (x < 0.4) return { name: 'auto', familiars: autoLoadout(masters[i], r) };
      return { name: 'random', familiars: randomLoadout(r) };
    };
    const l0 = lo(0);
    const l1 = lo(1);
    let st: MatchState = createMatch(SCAFFOLD_MAP, { ai: [true, true], seed: 42 + g, masters, rosters: [l0.familiars, l1.familiars] });
    const stats: [SideStats, SideStats] = [blank(masters[0], l0.name), blank(masters[1], l1.name)];
    const timeline: { turn: number; clock: number; units: [number, number]; mana: [number, number]; hp: [number, number]; stones: [number, number] }[] = [];
    const kindById = new Map<number, { kind: string; side: SideId }>();
    for (const u of st.units) kindById.set(u.id, { kind: u.kind, side: u.side });
    let turns = 0;
    const t0 = Date.now();
    let distSum: [number, number] = [0, 0];
    const blank2 = (): PlanStats => ({ masterFrontDist: 0, masterTurns: 0, summonObjDist: 0, summons: 0, idleOnSafeOwnStone: 0, familiarTurns: 0, firstCaptureHour: null });
    const planStats: [PlanStats, PlanStats] = [blank2(), blank2()];
    const log: string[] = [];
    const logThis = (process.env.LOG ?? '').split(',').includes(String(g));
    while (st.winner === null && turns < maxTurns) {
      const me = st.units.find((u) => u.id === st.activeUnitId)!;
      const side = me.side;
      const S = stats[side];
      S.turns++;
      if (me.stranded) S.strandedTurns++;
      const tA = Date.now();
      const a = chooseAction(st);
      {
        // Plan metrics, measured with the Plan's own definitions (also when the baseline plays)
        const P = planStats[side];
        const plan = makePlan(st, side);
        if (kindOf(me.kind).isMaster) {
          P.masterTurns++;
          if (plan.front) P.masterFrontDist += hexDistance(a.to, plan.front);
          if (a.command.type === 'summon') {
            const h = neighbor(a.to, a.command.dir);
            const objs = [...st.stones.filter((x) => x.owner !== side).map((x) => x.hex), ...st.units.filter((u) => u.side !== side).map((u) => u.pos)];
            if (objs.length) {
              P.summonObjDist += Math.min(...objs.map((o) => hexDistance(o, h)));
              P.summons++;
            }
          }
        } else {
          P.familiarTurns++;
          const onOwn = st.stones.find((x) => x.owner === side && hexEq(x.hex, me.pos));
          if (onOwn && hexEq(a.to, me.pos) && a.command.type === 'wait' && !plan.threatenedStones.has(hexKey(onOwn.hex))) P.idleOnSafeOwnStone++;
        }
      }
      S.msPerTurn += Date.now() - tA;
      const moved = a.to.q !== me.pos.q || a.to.r !== me.pos.r;
      const isMaster = kindOf(me.kind).isMaster;
      const es = st.units.find((u) => u.side !== side && kindOf(u.kind).isMaster);
      const ms = st.units.find((u) => u.side === side && kindOf(u.kind).isMaster);
      if (es && ms) distSum[side] += hexDistance(es.pos, ms.pos);
      switch (a.command.type) {
        case 'wait':
          S.waits++;
          if (!moved) S.idleWaits++;
          break;
        case 'attack':
          S.attacks++;
          if (isMaster) S.masterActedOffensively++;
          break;
        case 'magic': {
          const ab = kindOf(me.kind).magic.find((m) => m.id === (a.command as { ability: string }).ability)!;
          if (ab.kind === 'water') S.waterSpells++;
          else S.magics++;
          if (isMaster && ab.kind === 'damage') S.masterActedOffensively++;
          S.manaSpentMagic += ab.manaCost;
          break;
        }
        case 'summon': {
          S.summonTurns++;
          S.familiars.push(a.command.kind);
          S.manaSpentSummons += kindOf(a.command.kind).cost;
          break;
        }
      }
      const before = st;
      const res = applyTurn(st, a);
      if (logThis) {
        const dmg = res.events.filter((e) => e.type === 'damage' || e.type === 'death' || e.type === 'summon' || e.type === 'capture').map((e) => {
          if (e.type === 'damage') return `dmg ${kindById.get(e.unitId)?.kind ?? 'obstacle'}#${e.unitId}-${e.amount}`;
          if (e.type === 'death') return `DEATH ${kindById.get(e.unitId)?.kind ?? 'obstacle'}`;
          if (e.type === 'summon') return `summoned ${e.kind}`;
          return `capture`;
        });
        const hpS = (s: SideId) => st.units.find((u) => u.side === s && kindOf(u.kind).isMaster)?.hp;
        log.push(`t${turns} ${Math.floor(st.clock / 60)}:${String(st.clock % 60).padStart(2, '0')} S${side} ${me.kind}#${me.id} hp${me.hp} (${me.pos.q},${me.pos.r})→(${a.to.q},${a.to.r}) ${JSON.stringify(a.command)} mana ${st.sides[side].mana} | ${dmg.join(', ')} | masterHP ${hpS(0)}/${hpS(1)}`);
      }
      st = res.state;
      for (const u of st.units) if (!kindById.has(u.id)) kindById.set(u.id, { kind: u.kind, side: u.side });
      analyseEvents(res.events, before, st, side, stats, kindById, turns, me.kind);
      for (const e of res.events) if (e.type === 'capture' && planStats[e.side].firstCaptureHour === null) planStats[e.side].firstCaptureHour = +((st.clock - 360) / 60).toFixed(1);
      turns++;
      if (turns % 10 === 0) {
        const count = (s: SideId) => st.units.filter((u) => u.side === s).length;
        const hp = (s: SideId) => st.units.find((u) => u.side === s && kindOf(u.kind).isMaster)?.hp ?? 0;
        const stones = (s: SideId) => st.stones.filter((x) => x.owner === s).length;
        timeline.push({ turn: turns, clock: st.clock, units: [count(0), count(1)], mana: [st.sides[0].mana, st.sides[1].mana], hp: [hp(0), hp(1)], stones: [stones(0), stones(1)] });
      }
    }
    for (const s of [0, 1] as SideId[]) {
      stats[s].msPerTurn = Math.round(stats[s].msPerTurn / Math.max(1, stats[s].turns));
      stats[s].avgDistMasterToEnemyMaster = +(distSum[s] / Math.max(1, stats[s].turns)).toFixed(1);
    }
    results.push({ planStats, game: g, winner: st.winner, turns, clock: st.clock, hours: +((st.clock - 360) / 60).toFixed(1), seconds: (Date.now() - t0) / 1000, stats, timeline, log, finalIncome: [manaIncome(st, 0), manaIncome(st, 1)] });
    console.log(`game ${g}: ${masters[0]}(${l0.name}) vs ${masters[1]}(${l1.name}) → winner ${st.winner} in ${turns} turns, ${((st.clock - 360) / 60).toFixed(1)} h`);
  }
  writeFileSync(process.env.OUT ?? 'selfplay.json', JSON.stringify(results, null, 1));
});

function analyseEvents(
  events: GameEvent[],
  before: MatchState,
  after: MatchState,
  actorSide: SideId,
  stats: [SideStats, SideStats],
  kindById: Map<number, { kind: string; side: SideId }>,
  turn: number,
  actorKind: string,
) {
  for (const e of events) {
    if (e.type === 'damage') {
      const t = kindById.get(e.unitId);
      if (!t) continue; // obstacle
      if (e.source === e.unitId) continue; // stranded
      const src = kindById.get(e.source);
      if (!src) continue;
      if (src.side === t.side) stats[src.side].friendlyDamage += e.amount;
      else {
        stats[src.side].damageDealt += e.amount;
        stats[t.side].damageTaken += e.amount;
        if (e.amount === 0) stats[src.side].zeroDamageHits++;
        if (kindOf(t.kind).isMaster) {
          stats[t.side].masterDamageTaken += e.amount;
          const u = after.units.find((x) => x.id === e.unitId);
          stats[t.side].masterHpMin = Math.min(stats[t.side].masterHpMin, u?.hp ?? 0);
        }
      }
    } else if (e.type === 'death') {
      const t = kindById.get(e.unitId);
      if (!t) continue;
      stats[1 - t.side].kills++;
      stats[t.side].deaths.push({ kind: t.kind, byKind: actorKind, atTurn: turn });
    } else if (e.type === 'capture') {
      stats[e.side].captures++;
    } else if (e.type === 'mana') {
      const s = after.sides[e.side];
      const income = manaIncome(before, e.side);
      if (s.mana >= 120 && income > e.amount) stats[e.side].manaWastedAtCap += income - e.amount;
      stats[e.side].stoneHours += before.stones.filter((x) => x.owner === e.side).length;
    }
  }
  void actorSide;
}
