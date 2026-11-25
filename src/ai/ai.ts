// One-ply, timeline-aware AI. Enumerates every reachable hex × Command ×
// target and scores the outcome, including how much damage enemies who act
// before this Unit's next turn could deal to it. Pure and deterministic.

import {
  type Dir,
  type Hex,
  type MatchState,
  type TurnAction,
  type Unit,
  type Command,
  DIRS,
  canStandOn,
  canCastWater,
  computeDamage,
  computeHeal,
  delayForAction,
  facingToward,
  hexDistance,
  hexEq,
  hexKey,
  kindOf,
  magicTargetHexes,
  manaIncome,
  manaAfter,
  compareTurnOrder,
  mapHexAt,
  neighbor,
  previewEffects,
  reachable,
  FAMILIARS,
  validateTurn,
  attackTargets,
  activeUnit,
  alignmentBonus,
  ALIGN_STAT,
  resultingFacing,
  canPlace,
  inRoster,
  planAttack,
  shotAllowed,
  trajectoryOf,
  turnDelay,
  MANA_MAX,
  applyTurn,
  LOADOUT_SIZE,
  MAX_HP,
} from '../rules';
import { arriveTurns, ENEMY_STONE_SHARE, GUARD_SHARE, hitReach, makePlan } from './plan';

/** Defend: the hold-out estimate (6 enemy turns) is priced at this × the Master's safety steepness (masterRisk). */
const HOLD_OUT = 1.6;
/** A hurt Familiar's hold-out estimate, priced at this × its own HP worth (ownHp). */
const FAMILIAR_HOLD_OUT = 0.67;
/** The Hard AI's position value counts a Stone at this × capture. */
const EVAL_STONE = 0.375;

export const AI_WEIGHTS = {
  damage: 10.5,
  /** Killing a Familiar, on top of the damage itself (× its value): it removes its future turns. */
  kill: 75.4,
  /** What one HP of my own side is worth: lost to enemies (as danger), to my own area Magic, or healed. */
  ownHp: 6.77,
  killMaster: 100000,
  /** Value of an Empower (× its ATK × damage): the extra damage it should add to the target's next Attack. */
  empower: 1.21,
  /** Share of that value when no enemy is within the target's reach next turn. */
  empowerIdle: 0.3,
  deathRisk: 56.1,
  masterDeathRisk: 5000,
  capture: 116,
  approach: 3,
  /** Master: cost per HP it may lose this round and the next, while its margin stays comfortable (M1). */
  masterHpCost: 2.09,
  /** Master: cost per (HP short of comfort)², once the hits could leave it near killable (M1). */
  masterRisk: 25.8,
  /** Master: HP margin kept after the next two enemy rounds (worst case); Posture moves it (M5). */
  masterComfort: 2.33,
  /** Share of `capture` for killing a unit that holds a Stone my Side doesn't own. */
  stoneReopen: 0.395,
  /** Share of the death penalty for a hit that would kill but isn't sure (the round after, or a fast enemy that might walk over). */
  unsureDeath: 0.439,
  /** Least share of an enemy's damage a Familiar is charged with, however many other targets it has. */
  threatShareMin: 0.25,
  /** Bonus (× kill) for damage that leaves a target finishable by allies before it acts. */
  setupKill: 0.308,
  /** How strongly a lead (≈ −1..1) raises the push: pull toward objectives up, fear of damage down. */
  leadPush: 3.12,
  /** Most the push multiplies the pull (and divides the fear) by. */
  maxPush: 2.5,
  /** Value of hitting a healer, per point of its heal × the best patient it can reach (÷ 4). */
  support: 0.497,
  /** Worth of damage the enemy will heal back before the next hits land (× normal damage). */
  healedDamage: 0.15,
  /** A Master's own hits on enemies count this many times over (it should use its ATK, not only summon). */
  masterHit: 1.95,
  /** Value of any extra Familiar on the board, before what it's for. */
  summonBase: 12.7,
  /** Value of a Familiar's fit for the Plan's Needs (docs/ai-plan.md §5). */
  needScale: 55.2,
  /** Pull of the Master toward the Plan's Front (× approach): it summons where the action is. */
  masterStage: 1.86,
  /** Pull of a summon hex toward the Front, per hex. */
  summonFront: 1.15,
  /** A Familiar's pull toward its Job, and toward its nearest objective (× approach). */
  jobPull: 1.23,
  nearPull: 0.268,
  /** Hours ahead over which an aligned Familiar's Time of Day is judged, and the most it moves the Familiar's value. */
  alignmentHours: 8,
  alignmentValue: 0.15,
  summonNegativeIncome: 35,
  manaSpend: 0.294,
  /** Save for an unaffordable Familiar whose value is at least this × the best affordable one… */
  saveMargin: 1.25,
  /** …and that income will pay for within this many hours. */
  saveHours: 2,
  /** Extra cost per point of Mana spent out of that reserve. */
  reserveSpend: 0.652,
  strandEnemy: 30,
  strandAlly: 35,
  delay: 0.134,
  /** Value of threat removed from allies by standing in enemies' way (× threat). */
  screen: 0.558,
  /** How many of the best destinations are re-scored for screening. */
  screenTop: 8,
  /** Per enemy that breaking an Obstacle would bring into this Unit's Attack Reach. */
  obstacleOpening: 25,
};

type W = typeof AI_WEIGHTS;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function unitValue(u: Unit): number {
  const k = kindOf(u.kind);
  return k.isMaster ? 6 : 1 + k.cost / 48;
}

interface EnemyReach {
  unit: Unit;
  positions: Hex[];
}

function enemyReaches(state: MatchState, me: Unit): EnemyReach[] {
  return state.units
    .filter((u) => u.side !== me.side)
    .map((u) => {
      // For a Master, its own Familiars that act before this enemy may walk away:
      // they don't count as blocking it (a screen that leaves first is no screen).
      // The moving Unit is lifted off the board: the hex it leaves is free for the enemy
      // (where it ends, enemies stop next to it anyway, so its own body there hardly matters).
      // For a Master, its own Familiars that act before this enemy may walk away too:
      // they don't count as blocking it (a screen that leaves first is no screen).
      const view = { ...state, units: state.units.filter((a) => a.id !== me.id && (a.side !== me.side || !kindOf(me.kind).isMaster || a.av >= u.av)) };
      const nodes = reachable(view, u);
      const positions: Hex[] = [];
      for (const n of nodes.values()) if (n.canEnd || hexEq(n.hex, u.pos)) positions.push(n.hex);
      return { unit: u, positions };
    });
}

/** Max damage `e` could deal to a virtual copy of `me` standing at `h` facing `f`. */
function maxDamageFrom(state: MatchState, e: EnemyReach, me: Unit, h: Hex, f: Dir): number {
  const ek = kindOf(e.unit.kind);
  const target: Unit = { ...me, pos: h, facing: f };
  // judged when it acts: the Mana it will have (Income may land first) and the
  // time of day then (Alignment may turn at an hour mark)
  const mana = manaAfter(state, e.unit.side, e.unit.av);
  const then: MatchState = { ...state, clock: state.clock + e.unit.av };
  let best = 0;
  const spells = ek.magic.filter((m) => m.kind === 'damage' && m.manaCost <= mana);
  const view: MatchState = { ...state, units: state.units.map((u) => (u.id === me.id ? target : u)) };
  const atkTraj = trajectoryOf(ek.attack);
  for (const p of e.positions) {
    if (hexEq(p, h)) continue;
    const d = hexDistance(p, h);
    if (d >= 1 && d <= ek.attack.range && shotAllowed(view, e.unit.id, atkTraj, p, h)) {
      best = Math.max(best, computeDamage(then, e.unit, p, target, 'physical').amount);
    }
    for (const m of spells) {
      if (m.kind !== 'damage') continue;
      if (d <= m.range + m.radius && (m.radius > 0 || shotAllowed(view, e.unit.id, trajectoryOf(m), p, h))) {
        best = Math.max(best, computeDamage(then, e.unit, p, target, 'magic').amount);
      }
    }
  }
  return best;
}

/**
 * Value of hitting an Obstacle: how many enemies breaking it would bring
 * into this Unit's Attack Reach (from where it ends the turn), scaled by how
 * much of its HP this hit takes.
 */
function obstacleValue(state: MatchState, me: Unit, dest: Hex, id: number, amount: number, lethal: boolean, w: W): number {
  const o = state.obstacles.find((x) => x.id === id);
  if (!o) return 0;
  const meAfter: Unit = { ...me, pos: dest };
  const now: MatchState = { ...state, units: state.units.map((u) => (u.id === me.id ? meAfter : u)) };
  const without: MatchState = { ...now, obstacles: state.obstacles.filter((x) => x.id !== id) };
  let opened = 0;
  for (const e of state.units) {
    if (e.side === me.side || hexDistance(e.pos, o.pos) > 4) continue;
    if (!planAttack(now, meAfter, e) && planAttack(without, meAfter, e)) opened++;
  }
  const share = lethal ? 1 : amount / Math.max(1, o.hp) / 2;
  return opened * w.obstacleOpening * share;
}

/** Rough best damage `e` could deal to `me` at `h` from somewhere near, ignoring reach and Clear Angles. */
function approxDamage(state: MatchState, e: Unit, me: Unit, h: Hex, f: Dir): number {
  const ek = kindOf(e.kind);
  const target: Unit = { ...me, pos: h, facing: f };
  // it arrives from its own direction: use the hex next to `h` toward it
  const dir = facingToward(h, e.pos);
  const from = neighbor(h, dir);
  const then: MatchState = { ...state, clock: state.clock + e.av };
  let best = computeDamage(then, e, from, target, 'physical').amount;
  const mana = manaAfter(state, e.side, e.av);
  if (ek.magic.some((m) => m.kind === 'damage' && m.manaCost <= mana)) best = Math.max(best, computeDamage(then, e, from, target, 'magic').amount);
  return best;
}

interface Candidate {
  action: TurnAction;
  score: number;
  /** What its threat and death risk cost (already in `score`). */
  safety?: number;
  /** A Master surely killed before its next turn there. */
  doomed?: boolean;
}

/**
 * Options for the move scorer. `light`: a cheaper scorer for the moves played inside
 * Hard's look-ahead (never for the move actually chosen). It skips what costs most and
 * matters least for guessing a reply: the less-sure danger (straight-line guesses, the
 * round after, enemy summons, a hit that can't be outrun), checking every Facing (it
 * faces the most dangerous enemy), allies' follow-up damage, summon blocking, Obstacle
 * openings and screening.
 */
export interface ScoreOptions {
  light?: boolean;
}

export function rankCandidates(state: MatchState, weights: W, opts: ScoreOptions = {}): { me: Unit; candidates: Candidate[] } {
  const light = opts.light === true;
  const me = activeUnit(state);
  if (!me) throw new Error('no active unit');
  const kind = kindOf(me.kind);
  const w = weights;
  const reaches = enemyReaches(state, me);
  // the Side's Plan: Posture, Front, Needs, Reserve, Jobs (docs/ai-plan.md)
  const plan = makePlan(state, me.side);
  const posture = plan.posture;
  const dmgCache = new Map<string, number>();
  const maxDamage = (e: EnemyReach, target: Unit, h: Hex, f: Dir) => {
    const key = `${e.unit.id}>${target.id}@${hexKey(h)}|${f}`;
    let v = dmgCache.get(key);
    if (v === undefined) dmgCache.set(key, (v = maxDamageFrom(state, e, target, h, f)));
    return v;
  };
  const allies = state.units.filter((u) => u.side === me.side && u.id !== me.id);

  // How each enemy's attack would split across my other units: it hits one
  // target, most likely where it does the most damage (weights: damage²).
  const otherSq = new Map<number, number>();
  for (const e of reaches) {
    let sq = 0;
    for (const a of allies) sq += maxDamage(e, a, a.pos, a.facing) ** 2;
    otherSq.set(e.unit.id, sq);
  }
  // The Master also looks one enemy round further ahead.
  const secondWindow = kind.isMaster ? turnDelay(kind, true, true) : 0;
  /** Whether a unit acting at `at` (from now) goes before this Unit's next turn at `next`: a tie goes by the real turn order (Speed, then Side, then creation). */
  const goesBefore = (u: { kind: string; side: number; id: number }, at: number, next: number) =>
    at < next || (at === next && compareTurnOrder({ av: 0, spd: kindOf(u.kind).stats.spd, side: u.side, id: u.id }, { av: 0, spd: kind.stats.spd, side: me.side, id: me.id }) < 0);
  /** How many turns a unit with first turn at `av` and repeat `rep` gets before this Unit's next turn at `next`. */
  const turnsBeforeOf = (u: { kind: string; side: number; id: number }, av: number, rep: number, next: number) => {
    if (!goesBefore(u, av, next)) return 0;
    let n = 1 + Math.floor(Math.max(0, next - av) / Math.max(1, rep));
    if (!goesBefore(u, av + (n - 1) * rep, next)) n--;
    return n;
  };

  /**
   * How surely an enemy gets a hit in that only a straight-line estimate says it can,
   * from its slack (hexes of reach to spare): ⅓ at the very edge, full 2 hexes inside.
   * The edge of a straight-line reach is where terrain, blockers and ZOC most often stop it.
   */
  const reachOdds = (slack: number) => (slack < 0 ? 0 : Math.min(1, (slack + 1) / 3));
  // Familiars the enemy Master could summon in time (for the Master's danger): the 6
  // hardest-hitting it can afford, placed next to it after it walks.
  const enemyMasterU = state.units.find((u) => u.side !== me.side && kindOf(u.kind).isMaster);
  const enemyBudget = enemyMasterU ? manaAfter(state, enemyMasterU.side, enemyMasterU.av) : 0;
  const summonables = kind.isMaster && enemyMasterU
    ? FAMILIARS.filter((k) => k.cost <= enemyBudget && inRoster(state, enemyMasterU.side, k.id))
        .sort((a, b) => Math.max(b.stats.atk, b.stats.mp) - Math.max(a.stats.atk, a.stats.mp) || a.id.localeCompare(b.id))
        .slice(0, 6)
    : [];

  /**
   * The danger to this Unit at `h` facing `f` before its next turn (and, for a Master,
   * the round after): one estimate, in two parts.
   * - sure: enemies acting first that reach it by their real path this turn;
   * - total: that, plus the less sure, each weighted by how surely it lands: a fast enemy
   *   closing in over several turns (straight line), the round after, a hit the Master
   *   can't outrun landing twice, a Familiar the enemy Master could summon in time.
   * Enemies in `gone` (killed by this move, or finished by allies before they act) are no threat.
   */
  const dangerCache = new Map<string, { total: number; sure: number }>();
  const danger = (h: Hex, f: Dir, delay: number, gone: Set<number>): { total: number; sure: number } => {
    const key = `${hexKey(h)}|${f}|${delay}|${[...gone].join(',')}`;
    const hit = dangerCache.get(key);
    if (hit) return hit;
    let total = 0;
    let sure = 0;
    for (const e of reaches) {
      if (gone.has(e.unit.id) || finishedFirst(e.unit, 0)) continue;
      const ek = kindOf(e.unit.kind);
      const first = goesBefore(e.unit, e.unit.av, delay);
      const second = !light && !first && kind.isMaster && goesBefore(e.unit, e.unit.av, delay + secondWindow);
      if (!first && !second) continue; // acts after the window
      let d = maxDamage(e, me, h, f);
      // its real path reaches this hex in time: as sure as anything (the round after too, just later)
      const byPath = d > 0;
      let odds = 1;
      if (!light && first && d === 0) {
        // a fast enemy may get several turns before mine: it can close in first (straight line)
        const turns = turnsBeforeOf(e.unit, e.unit.av, turnDelay(ek, true, false), delay);
        if (turns >= 2) {
          odds = reachOdds(ek.stats.mov * turns + hitReach(ek) - hexDistance(e.unit.pos, h));
          if (odds > 0) d = approxDamage(state, e.unit, me, h, f);
        }
      }
      if (d <= 0) continue;
      // enemies go for the Master; a Familiar bears only its share of an enemy with other
      // targets (not of a hit that would kill it: an enemy that can take a kill usually does)
      if (!kind.isMaster && d < me.hp) d *= Math.max(w.threatShareMin, (d * d) / (d * d + (otherSq.get(e.unit.id) ?? 0)));
      if (first && byPath) sure += d;
      total += d * odds;
      // it hits the Master now and again before its turn after next, and the Master can't
      // outrun it (no more Move than it): if the two hits kill, the second counts too, from
      // the front (it can turn to face it in between), after a Stone's heal
      if (!light && kind.isMaster && first && byPath && ek.stats.mov >= kind.stats.mov && goesBefore(e.unit, e.unit.av + turnDelay(ek, true, true), delay + secondWindow)) {
        const again = Math.min(d, approxDamage(state, e.unit, me, h, facingToward(h, e.unit.pos)));
        if (d + again >= me.hp + (stoneAt(h) ? 1 : 0)) total += again;
      }
    }
    // a Familiar the enemy Master could summon next to itself and act with in time
    if (!light && summonables.length && enemyMasterU && !gone.has(enemyMasterU.id) && goesBefore(enemyMasterU, enemyMasterU.av, delay)) {
      const fromSpawn = hexDistance(enemyMasterU.pos, h) - kindOf(enemyMasterU.kind).stats.mov - 1;
      let best = 0;
      for (const k of summonables) {
        if (!goesBefore({ kind: k.id, side: enemyMasterU.side, id: state.nextUnitId }, enemyMasterU.av + turnDelay(k, true, true), delay)) continue;
        const odds = reachOdds(k.stats.mov + hitReach(k) - fromSpawn);
        if (odds <= 0) continue;
        const v: Unit = { id: -99, kind: k.id, side: enemyMasterU.side, pos: neighbor(h, facingToward(h, enemyMasterU.pos)), facing: 0, hp: MAX_HP, av: 0, stranded: false };
        best = Math.max(best, odds * approxDamage(state, v, me, h, f));
      }
      total += best;
    }
    const out = { total, sure };
    dangerCache.set(key, out);
    return out;
  };
  const threatAt = (h: Hex, f: Dir, delay: number, gone: Set<number>): number => danger(h, f, delay, gone).total;

  // Focus fire: how much allies could deal to each enemy before that enemy acts again.
  const allyReaches = (light ? [] : allies).map((u) => {
    const nodes = reachable(state, u);
    const positions: Hex[] = [];
    for (const n of nodes.values()) if (n.canEnd || hexEq(n.hex, u.pos)) positions.push(n.hex);
    return { unit: u, positions };
  });
  const followUp = new Map<number, number>();
  /** The most a single ally can deal it before it acts. */
  const followUpBest = new Map<number, number>();
  for (const e of state.units) {
    if (e.side === me.side) continue;
    let sum = 0;
    let best = 0;
    for (const a of allyReaches) {
      if (a.unit.av >= e.av) continue;
      const d = maxDamageFrom(state, a, e, e.pos, e.facing);
      sum += d;
      best = Math.max(best, d);
    }
    followUp.set(e.id, sum);
    followUpBest.set(e.id, best);
  }

  // Enemy healing (1, 3): how much each enemy can be healed before my side's next
  // hits land, and how much a healer's work is worth (its support value).
  const healWindow = turnDelay(kind, true, true);
  /** Heal a healer would give, ignoring the target's missing HP. */
  const rawHeal = (h: Unit) => computeHeal(state, h, { ...h, hp: 1 }).amount;
  const healers = reaches.filter((e) => {
    const k = kindOf(e.unit.kind);
    return e.unit.av < healWindow && k.magic.some((m) => m.kind === 'heal' && m.manaCost <= manaAfter(state, e.unit.side, e.unit.av));
  });
  const healReach = (e: EnemyReach, at: Hex) => {
    const m = kindOf(e.unit.kind).magic.find((x) => x.kind === 'heal')!;
    if (m.kind === 'water') return false;
    return e.positions.some((p) => hexDistance(p, at) <= m.range + m.radius) || hexDistance(e.unit.pos, at) <= m.range + m.radius;
  };
  const incomingHealFrom = (hs: EnemyReach[], t: Unit) => hs.reduce((a, h) => a + (healReach(h, t.pos) ? rawHeal(h.unit) : 0), 0);
  const healIn = new Map<number, number>();
  const support = new Map<number, number>();
  for (const t of state.units) if (t.side !== me.side) healIn.set(t.id, incomingHealFrom(healers, t));
  for (const h of healers) {
    let best = 0;
    for (const p of state.units) if (p.side === h.unit.side && p.id !== h.unit.id && healReach(h, p.pos)) best = Math.max(best, unitValue(p));
    support.set(h.unit.id, (w.support * rawHeal(h.unit) * best) / 4);
  }
  /**
   * Whether enemy `e` dies to my side before it acts, healing included (one estimate for
   * the value of setting up a kill and for whether that enemy is still a threat). With
   * `dealt` > 0 (this move's hit), allies together finish it; with nothing dealt, one ally
   * must manage it alone, so two enemies are never both written off on the same ally.
   */
  const finishedFirst = (e: Unit, dealt: number): boolean => {
    const left = e.hp - dealt + (healIn.get(e.id) ?? 0);
    return dealt > 0 ? left <= (followUp.get(e.id) ?? 0) : left <= (followUpBest.get(e.id) ?? 0);
  };
  /** What hitting an enemy is worth: its own value plus the healing it keeps doing. */
  const targetValue = (t: Unit) => unitValue(t) + (support.get(t.id) ?? 0);

  // Push from a lead (the Plan's one measure of being ahead): pulls toward objectives up, fear of damage down.
  const pressure = Math.max(1, Math.min(w.maxPush, 1 + w.leadPush * plan.lead));
  /** Holding an own Stone an enemy could take next turn: the same income as taking one, a little more (it's yours now). */
  const guardWeight = w.capture * GUARD_SHARE * (1 + 0.5 * posture.squeeze);
  /** Boldness: how much less a Familiar minds taking damage when its side is ahead. */
  const boldness = 1 / pressure;

  const bestFacing = (h: Hex, delay: number, killed: Set<number>): { facing: Dir; threat: number } => {
    let bestF: Dir = me.facing;
    let bestT = Infinity;
    // On a tie, face the most dangerous enemy close by (its hit from the front, over the hexes to it).
    let pref: Dir = me.facing;
    let worst = -1;
    for (const e of state.units) {
      if (e.side === me.side || killed.has(e.id) || hexEq(e.pos, h)) continue;
      const danger = approxDamage(state, e, me, h, facingToward(h, e.pos)) / (1 + hexDistance(e.pos, h));
      if (danger > worst) {
        worst = danger;
        pref = facingToward(h, e.pos);
      }
    }
    const order: Dir[] = light ? [pref] : [pref, ...DIRS.filter((d) => d !== pref)];
    for (const f of order) {
      const t = threatAt(h, f, delay, killed);
      if (t < bestT) {
        bestT = t;
        bestF = f;
      }
    }
    return { facing: bestF, threat: bestT };
  };

  // Own Stones an enemy could really end its next move on (R1): whoever stands on one keeps it.
  const stoneAt = (h: Hex) => state.stones.find((st) => hexEq(st.hex, h));
  const guardedBy = (h: Hex) => state.units.find((u) => u.id !== me.id && hexEq(u.pos, h));
  const needsGuard = (h: Hex) => plan.threatenedStones.has(hexKey(h)) && !guardedBy(h);

  const objectives = (): Hex[] => {
    const out: Hex[] = state.stones.filter((s) => s.owner !== me.side || needsGuard(s.hex)).map((s) => s.hex);
    for (const u of state.units) if (u.side !== me.side) out.push(u.pos);
    return out;
  };
  const objs = objectives();
  /**
   * The Master's comfort margin (M1, M5): HP it wants left after the next two
   * enemy rounds. Kill and Squeeze accept less. (A fragile Master needs no extra:
   * the hits it fears are already bigger in its danger.)
   */
  const comfort = w.masterComfort - Math.max(posture.kill, posture.squeeze);
  /** HP a Master at `h` gets back before the next round's hits: a Stone, a friendly healer in reach (M4). Cover is in the damage. */
  const recovery = (h: Hex): number => {
    let r = stoneAt(h) ? 1 : 0;
    const mana = state.sides[me.side].mana;
    for (const a of allies) {
      const m = kindOf(a.kind).magic.find((x) => x.kind === 'heal');
      if (!m || m.kind !== 'heal' || m.manaCost > mana) continue;
      if (hexDistance(a.pos, h) <= kindOf(a.kind).stats.mov + m.range + m.radius) r += computeHeal(state, a, { ...me, hp: 1 }).amount;
    }
    return r;
  };

  /**
   * How long this Unit holds out standing at `h`, in turns (0–6): its HP left
   * after each of the next 6 enemy turns, as a share of its HP now, summed.
   * Each enemy closes in, then hits every turn (damage formula, so cover
   * counts), while a Stone heals it 1 at the start of each of its own turns.
   * HP-turns rather than whole turns, so every point of cover or healing shows.
   */
  const survivalCache = new Map<string, number>();
  const survivalTurns = (h: Hex): number => {
    const key = hexKey(h);
    const hit = survivalCache.get(key);
    if (hit !== undefined) return hit;
    const parts: { dmg: number; arrive: number }[] = [];
    for (const e of state.units) {
      if (e.side === me.side) continue;
      const arrive = arriveTurns(e, h);
      if (arrive > 5) continue;
      const dmg = approxDamage(state, e, me, h, me.facing);
      if (dmg > 0) parts.push({ dmg, arrive });
    }
    const heal = stoneAt(h) ? 1 : 0;
    let v = 0;
    let hp = me.hp;
    for (let t = 1; t <= 6 && hp > 0; t++) {
      hp -= parts.reduce((a, p) => a + (t > p.arrive ? p.dmg : 0), 0);
      if (hp <= 0) break;
      v += hp / me.hp;
      hp = Math.min(MAX_HP, hp + heal); // its own turn starts on the Stone
    }
    survivalCache.set(key, v);
    return v;
  };

  // Stones decide the Time Limit: they matter more over the last day, most when not ahead.
  // Stones are worth their Mana, the same at any hour.
  const stoneUrgency = 1;
  const positionalScore = (h: Hex): number => {
    let s = 0;
    const stone = stoneAt(h);
    if (stone) {
      if (stone.owner !== me.side) s += w.capture * stoneUrgency * (stone.owner === null ? 1 : ENEMY_STONE_SHARE);
      else if (needsGuard(h)) s += guardWeight;
    }
    if (kind.isMaster) {
      // No keep-away: how dangerous a hex is comes from the margin cost (M1, M2).
      // Defend: where it survives longest, not just furthest away: a Stone's cover and heal count
      // (the same steepness as its safety curve, over 6 enemy turns instead of 2)
      if (posture.defend > 0) s += w.masterRisk * HOLD_OUT * posture.defend * survivalTurns(h);
      // Advance toward the Front, so the Familiars it summons appear near the objectives (M3)
      // (never toward a threat it is defending against: its Familiars go there)
      // toward the objective (a Stone or the enemy Master), never toward a threat
      if (plan.objective) s -= w.approach * w.masterStage * pressure * (1 - posture.defend) * hexDistance(plan.objective, h);
    } else if (objs.length) {
      // its Job, plus a little for whatever objective is nearest (opportunities)
      let minD = 99;
      for (const o of objs) minD = Math.min(minD, hexDistance(o, h));
      const job = plan.jobs.get(me.id)?.hex ?? plan.front;
      // a hurt Familiar likes where it holds out longer (cover, a Stone's heal), priced as its own HP
      if (me.hp < MAX_HP) s += w.ownHp * FAMILIAR_HOLD_OUT * (1 - me.hp / MAX_HP) * survivalTurns(h);
      s -= w.approach * pressure * (w.nearPull * minD + (job ? w.jobPull * hexDistance(job, h) : 0));
    }
    return s;
  };

  // the threat a Defend summon answers (F2, F3)
  const mainThreat = kind.isMaster && plan.threats[0] && plan.threats[0].urgency > 0 ? plan.threats[0] : null;

  const nodes = reachable(state, me);
  const dests: Hex[] = [];
  for (const n of nodes.values()) if (n.canEnd) dests.push(n.hex);

  const candidates: Candidate[] = [];
  const myMana = state.sides[me.side].mana;
  const income = manaIncome(state, me.side);

  // Rank summon kinds once (placement-independent), affordable or not: by how well
  // they fit the Plan's Needs, never by Cost for its own sake (docs/ai-plan.md §5).
  const rankedKinds = kind.isMaster
    ? FAMILIARS.filter((s) => inRoster(state, me.side, s.id))
        .map((s) => {
          let v = w.summonBase + w.needScale * plan.fit(s);
          if (s.alignment !== 'none') {
            // how its Alignment will treat it over its working life: +1 all aligned, −1 all opposed
            let sum = 0;
            for (let hr = 0; hr < w.alignmentHours; hr++) sum += alignmentBonus(s.alignment, state.clock + hr * 60) / ALIGN_STAT;
            v *= 1 + w.alignmentValue * Math.max(-1, Math.min(1, sum / w.alignmentHours));
          }
          if (income - s.cost / 8 < 0) v -= w.summonNegativeIncome;
          return { kind: s, value: v };
        })
        .sort((a, b) => b.value - a.value || a.kind.cost - b.kind.cost)
    : [];
  const summonKinds = rankedKinds.filter((k) => k.kind.cost <= myMana).slice(0, 4);
  // Saving up: a clearly better Familiar that income will soon pay for reserves its Cost
  // (not while defending: F4). The Plan's Reserve keeps an answer affordable.
  const overflow = myMana + Math.max(0, income) >= MANA_MAX;
  let reserve = plan.reserve;
  if (posture.defend < 0.5) {
    const bestNow = summonKinds[0]?.value ?? 0;
    const saveFor = rankedKinds.find((k) => k.kind.cost > myMana);
    if (saveFor && income > 0 && saveFor.value >= Math.max(1, bestNow) * w.saveMargin && (saveFor.kind.cost - myMana) / income <= w.saveHours) reserve = Math.max(reserve, saveFor.kind.cost);
  }
  /** Cost of spending `amount` Mana: what it's worth, plus eating into a reserve (none when it buys the answer itself). */
  const spendCost = (amount: number, isAnswer = false) => {
    if (overflow) return 0;
    const intoReserve = isAnswer ? 0 : Math.max(0, Math.min(amount, reserve - (myMana - amount)));
    return amount * w.manaSpend + intoReserve * w.reserveSpend;
  };

  /**
   * Damage the first-round enemies would no longer deal the Master at `dest` once a
   * Familiar of `kindId` stands at `h`: its body blocks Direct shots (Clear Angle) and
   * paths (it occupies a hex and exerts ZOC). Only enemies that act before it can move.
   */
  const blockCache = new Map<string, number>();
  const blockedBy = (dest: Hex, f: Dir, delay: number, gone: Set<number>, kindId: string, h: Hex): number => {
    const key = `${hexKey(dest)}|${f}|${hexKey(h)}|${delay}|${[...gone].join(',')}`;
    const hit = blockCache.get(key);
    if (hit !== undefined) return hit;
    const sk = kindOf(kindId);
    const placed: Unit = { id: -98, kind: kindId, side: me.side, pos: h, facing: f, hp: MAX_HP, av: turnDelay(sk, true, true), stranded: false };
    const view: MatchState = { ...state, units: [...state.units.map((u) => (u.id === me.id ? { ...u, pos: dest, facing: f } : u)), placed] };
    let saved = 0;
    for (const e of reaches) {
      if (gone.has(e.unit.id) || !goesBefore(e.unit, e.unit.av, delay) || placed.av < e.unit.av) continue;
      const before = maxDamage(e, me, dest, f);
      if (before <= 0) continue;
      const v2: MatchState = { ...view, units: view.units.filter((a) => a.side !== me.side || a.id === me.id || a.id === placed.id || a.av >= e.unit.av) };
      const positions: Hex[] = [];
      for (const n of reachable(v2, e.unit).values()) if (n.canEnd || hexEq(n.hex, e.unit.pos)) positions.push(n.hex);
      saved += before - maxDamageFrom(v2, { unit: e.unit, positions }, me, dest, f);
    }
    blockCache.set(key, saved);
    return saved;
  };

  for (const dest of dests) {
    const pos = positionalScore(dest);
    const commands: Command[] = [{ type: 'wait' }];
    if (!me.stranded || !hexEq(dest, me.pos)) {
      const view: MatchState = { ...state, units: state.units.map((u) => (u.id === me.id ? { ...u, pos: dest } : u)) };
      const moved = { ...me, pos: dest };
      for (const t of attackTargets(view, moved, dest)) commands.push({ type: 'attack', target: t.pos });
      for (const ab of kind.magic) {
        if (ab.manaCost > myMana) continue;
        if (ab.kind === 'water') {
          if (canCastWater(state, ab.delta)) commands.push({ type: 'magic', ability: ab.id, target: dest });
          continue;
        }
        for (const h of magicTargetHexes(state, me, ab, dest)) commands.push({ type: 'magic', ability: ab.id, target: h });
      }
      for (const sk of summonKinds) {
        for (const d of DIRS) {
          const h = neighbor(dest, d);
          if (!canPlace(view, sk.kind, h, me.id)) continue;
          commands.push({ type: 'summon', kind: sk.kind.id, dir: d });
        }
      }
    }

    for (const command of commands) {
      const draft: TurnAction = { unitId: me.id, to: dest, facing: me.facing, command };
      const delay = delayForAction(state, draft);
      let score = pos - w.delay * delay;
      const killed = new Set<number>();
      /** Enemies hurt so that allies finish them before they act (fix 1): no threat to the Master. */
      const finished = new Set<number>();

      if (command.type === 'attack' || command.type === 'magic') {
        const ab = command.type === 'magic' ? kind.magic.find((m) => m.id === command.ability)! : null;
        // Mana that would overflow the cap is free to spend.
        if (ab) score -= spendCost(ab.manaCost);
        if (ab && ab.kind === 'water') {
          const level = state.waterLevel + ab.delta;
          for (const u of state.units) {
            const mh = mapHexAt(state.map, u.id === me.id ? dest : u.pos);
            if (!mh) continue;
            const strandedNow = !canStandOn(kindOf(u.kind), mh, state.waterLevel);
            const strandedAfter = !canStandOn(kindOf(u.kind), mh, level);
            if (strandedAfter && !strandedNow) score += u.side === me.side ? -w.strandAlly : w.strandEnemy * unitValue(u);
            if (!strandedAfter && strandedNow) score += u.side === me.side ? w.strandAlly : -w.strandEnemy;
          }
        } else {
          const effects = previewEffects(state, draft);
          if (effects.length === 0) continue;
          // never Attack or cast damage for nothing: it must hurt an enemy or an Obstacle
          const isDamage = !ab || ab.kind === 'damage';
          if (isDamage && !effects.some((e) => e.kind === 'damage' && e.amount > 0 && (e.obstacle || state.units.find((u) => u.id === e.unitId)?.side !== me.side))) continue;
          for (const e of effects) {
            if (e.obstacle) {
              if (!light) score += obstacleValue(state, me, dest, e.unitId, Math.min(e.amount, e.hpBefore), e.lethal, w);
              continue;
            }
            const t = state.units.find((u) => u.id === e.unitId)!;
            const v = t.side === me.side ? unitValue(t) : targetValue(t);
            if (e.kind === 'damage') {
              // only the HP it can actually take counts: overkill is worth nothing
              const dealt = Math.min(e.amount, t.hp);
              if (t.side === me.side) score -= dealt * w.ownHp * v;
              else {
                const heal = healIn.get(t.id) ?? 0;
                // only damage that outlasts the healing coming its way counts in full
                const net = e.lethal ? dealt : Math.max(0, dealt - heal);
                const canFinish = !e.lethal && finishedFirst(t, dealt);
                score += (net + (dealt - net) * w.healedDamage) * w.damage * v * (kind.isMaster ? w.masterHit : 1);
                if (e.lethal) {
                  killed.add(t.id);
                  score += kindOf(t.kind).isMaster ? w.killMaster : w.kill * v;
                  // it was holding a Stone my Side doesn't own: that Stone is open to take again
                  if (state.stones.some((st) => hexEq(st.hex, t.pos) && st.owner !== me.side)) score += w.capture * w.stoneReopen;
                } else if (canFinish) {
                  // allies finish it before it acts, healing included: worth part of a kill, and no threat
                  score += w.kill * v * w.setupKill;
                  finished.add(t.id);
                }
              }
            } else if (e.kind === 'empower') {
              // worth the extra damage on its next Attack; nothing if it already has it
              if (t.side === me.side && (t.empowered ?? 0) < e.amount) {
                const tk = kindOf(t.kind);
                const pos = t.id === me.id ? dest : t.pos;
                const reach = tk.stats.mov + tk.attack.range + 1;
                const soon = state.units.some((u) => u.side !== me.side && hexDistance(u.pos, pos) <= reach);
                score += w.empower * e.amount * w.damage * (soon ? 1 : w.empowerIdle);
              }
            } else {
              // an HP healed on my side is worth what one lost costs; on theirs, as much against me
              score += (t.side === me.side ? 1 : -1) * e.amount * w.ownHp * v;
            }
          }
        }
      } else if (command.type === 'summon') {
        const sk = summonKinds.find((s) => s.kind.id === command.kind)!;
        const isAnswer = sk.kind.name === plan.reserveAnswer || (mainThreat !== null && plan.answerFit(sk.kind, mainThreat.unit) >= 0.6);
        score += sk.value - spendCost(sk.kind.cost, isAnswer);
        const h = neighbor(dest, command.dir);
        // toward where it's needed: the threat it answers under Defend, else the Front (R3);
        // and onto or next to a Stone the Side doesn't hold
        const place = mainThreat ? mainThreat.unit.pos : plan.front;
        if (place) score -= w.summonFront * hexDistance(h, place);
        const stone = state.stones.find((s) => hexEq(s.hex, h));
        if (stone && stone.owner !== me.side) score += w.capture * 0.4;
        else if (state.stones.some((s) => s.owner !== me.side && hexDistance(s.hex, h) === 1)) score += w.capture * 0.15;
      }

      const gone = finished.size ? new Set([...killed, ...finished]) : killed;
      let facing: Dir;
      let threat: number;
      /** First-round damage the new Familiar would block (its body in the way of a path or a Direct shot). */
      let blocked = 0;
      if (command.type === 'summon') {
        facing = command.dir;
        threat = threatAt(dest, facing, delay, gone);
        // a Master in danger: the Familiar it summons stands in the way too
        if (!light && kind.isMaster && threat >= me.hp) blocked = blockedBy(dest, facing, delay, gone, command.kind, neighbor(dest, command.dir));
        threat = Math.max(0, threat - blocked);
      } else {
        ({ facing, threat } = bestFacing(dest, delay, gone));
        if (command.type !== 'wait') {
          // Attack / Magic force Facing toward the target.
          const forced = resultingFacing(state, { ...draft, facing });
          if (forced !== facing) {
            facing = forced;
            threat = threatAt(dest, facing, delay, gone);
          }
        }
      }
      const v = unitValue(me);
      // One safety curve for every Unit: each HP it may lose costs a little, losses that leave it
      // near death cost steeply, and death ends the curve (graded by how sure it is). A Master
      // prices HP as a budget (masterHpCost, cheap) against a comfort margin; a Familiar prices it
      // as its own worth (ownHp × value, less when its side is ahead), convex over its whole HP.
      const lost = Math.min(threat, me.hp);
      let safety = 0;
      let deathCost: number;
      if (kind.isMaster) {
        const margin = me.hp + recovery(dest) - lost;
        safety += w.masterHpCost * lost + w.masterRisk * Math.max(0, comfort - margin) ** 2;
        deathCost = w.masterDeathRisk;
      } else {
        const x = lost / me.hp;
        safety += w.ownHp * v * boldness * me.hp * (x + x * x) / 2;
        deathCost = w.deathRisk * v;
      }
      let doomed = false;
      if (threat >= me.hp) {
        // full when enemies acting first kill it by their real path this turn; less when it needs
        // the round after, a straight-line guess or a summon
        const sure = Math.max(0, danger(dest, facing, delay, gone).sure - blocked);
        doomed = sure >= me.hp;
        safety += deathCost * (doomed ? 1 : w.unsureDeath + (1 - w.unsureDeath) * (sure / me.hp));
      }
      score -= safety;

      candidates.push({ action: { ...draft, facing }, score, safety, doomed });
    }
  }

  // Doomed anyway (fix 4): when every move leaves the Master surely killed, safety
  // no longer tells them apart; do the most useful thing instead (a hit, a kill set
  // up, a Familiar for Mana that would go to waste).
  if (kind.isMaster && candidates.length && candidates.every((c) => c.doomed)) for (const c of candidates) c.score += c.safety ?? 0;

  candidates.sort((a, b) => b.score - a.score);

  // Screening: ground enemies must stop in this Unit's ZOC, so where it ends can
  // shield allies (or, by leaving, expose them). Re-score the best destinations
  // with enemy reach recomputed around this Unit's new position.
  if (!light && w.screen > 0 && allies.length) {
    const ev = (a: Unit, rs: EnemyReach[]) => {
      let t = 0;
      for (const e of rs) if (e.unit.av < a.av) t += maxDamage(e, a, a.pos, a.facing);
      return Math.min(t, a.hp) * unitValue(a);
    };
    const baseThreat = allies.reduce((acc, a) => acc + ev(a, reaches), 0);
    const near = (e: Unit, h: Hex) => hexDistance(e.pos, h) <= kindOf(e.kind).stats.mov + 2;
    const done = new Map<string, number>();
    const screened = new Set<Candidate>();
    const screenBonus = (dest: Hex) => {
      const key = hexKey(dest);
      let v = done.get(key);
      if (v !== undefined) return v;
      const view: MatchState = { ...state, units: state.units.map((u) => (u.id === me.id ? { ...u, pos: dest } : u)) };
      const rs = reaches.map((e) => {
        if (!near(e.unit, dest) && !near(e.unit, me.pos)) return e;
        const positions: Hex[] = [];
        for (const n of reachable(view, e.unit).values()) if (n.canEnd || hexEq(n.hex, e.unit.pos)) positions.push(n.hex);
        return { unit: e.unit, positions };
      });
      let after = 0;
      for (const a of allies) {
        let t = 0;
        for (const e of rs) if (e.unit.av < a.av) t += maxDamageFrom(view, e, a, a.pos, a.facing);
        after += Math.min(t, a.hp) * unitValue(a);
      }
      v = (baseThreat - after) * w.ownHp * w.screen;
      // cutting the heal line: healing the enemy Master (or a hurt enemy) can no longer receive
      if (healers.length) {
        const hs = rs.filter((e) => healers.some((h) => h.unit.id === e.unit.id));
        for (const t of state.units) {
          if (t.side === me.side || (t.hp >= 10 && !kindOf(t.kind).isMaster)) continue;
          const lost = (healIn.get(t.id) ?? 0) - incomingHealFrom(hs, t);
          if (lost > 0) v += lost * w.damage * unitValue(t) * w.screen;
        }
      }
      done.set(key, v);
      return v;
    };
    for (let round = 0; round < 3; round++) {
      const dests: Hex[] = [];
      for (const c of candidates) {
        if (dests.length >= w.screenTop) break;
        if (!done.has(hexKey(c.action.to)) && !dests.some((d) => hexEq(d, c.action.to))) dests.push(c.action.to);
      }
      if (!dests.length) break;
      for (const d of dests) screenBonus(d);
      for (const c of candidates) {
        const b = done.get(hexKey(c.action.to));
        if (b !== undefined && !screened.has(c)) {
          c.score += b;
          screened.add(c);
        }
      }
      candidates.sort((a, b) => b.score - a.score);
      if (done.has(hexKey(candidates[0].action.to))) break;
    }
  }
  return { me, candidates };
}

/**
 * Choose the active Unit's turn. Normal: the best-scoring candidate. Hard:
 * the top candidates are each played out — every Unit then plays Normal
 * until this Unit's next turn — and the resulting positions are compared.
 */
export interface ChooseOptions {
  /** Hard: enemy replies tried at the first enemy turn (LOOKAHEAD.replies). */
  replies?: number;
  /** Hard: play the look-ahead's moves with the light scorer (LOOKAHEAD.light). */
  lightPlayouts?: boolean;
  /** Score this move with the light scorer (used inside playouts). */
  light?: boolean;
}

export function chooseAction(state: MatchState, weights: W = AI_WEIGHTS, level?: 'normal' | 'hard', opts?: ChooseOptions): TurnAction {
  const { me, candidates } = rankCandidates(state, weights, { light: opts?.light });
  const lvl = level ?? state.sides[me.side].aiLevel ?? 'normal';
  if (lvl === 'hard') {
    const pick = lookahead(state, me, candidates, weights, opts?.replies, opts?.lightPlayouts);
    if (pick) return pick;
  }
  // Validate best-first (validation re-runs path-finding, so only check what could be chosen).
  let best = -Infinity;
  const top: Candidate[] = [];
  for (const c of candidates) {
    if (top.length && c.score < best - 1e-9) break;
    if (validateTurn(state, c.action) !== null) continue;
    if (!top.length) best = c.score;
    top.push(c);
  }
  if (top.length === 0) return { unitId: me.id, to: me.pos, facing: me.facing, command: { type: 'wait' } };
  // stable order for the tie-break, independent of sort internals
  top.sort((a, b) => JSON.stringify(a.action) < JSON.stringify(b.action) ? -1 : 1);
  const rng = mulberry32(state.rngState ^ (state.turnNumber * 2654435761));
  return top[Math.floor(rng() * top.length)].action;
}

/**
 * Hard's look-ahead: the top `candidates` moves, each played out until this Unit's
 * next turn (at most `maxTurns`). With `replies` > 1, the first enemy turn after the
 * move tries that enemy's top `replies` moves and keeps the worst result for me,
 * instead of assuming it plays exactly what the Normal AI would.
 */
// light: the playouts use the light scorer: as strong in the arena (47%, 32 games) at ~⅓ the time
export const LOOKAHEAD = { candidates: 5, maxTurns: 6, replies: 1, light: true };

/** The top `n` distinct, legal moves of the active Unit. */
function topMoves(st: MatchState, w: W, n: number, light = false): TurnAction[] {
  const out: TurnAction[] = [];
  const seen = new Set<string>();
  for (const c of rankCandidates(st, w, { light }).candidates) {
    if (out.length >= n) break;
    const key = JSON.stringify(c.action);
    if (seen.has(key) || validateTurn(st, c.action) !== null) continue;
    seen.add(key);
    out.push(c.action);
  }
  return out;
}

function lookahead(state: MatchState, me: Unit, ranked: Candidate[], w: W, replies = LOOKAHEAD.replies, light = LOOKAHEAD.light): TurnAction | null {
  const picks: Candidate[] = [];
  const seen = new Set<string>();
  for (const c of ranked) {
    if (picks.length >= LOOKAHEAD.candidates) break;
    const key = JSON.stringify(c.action);
    if (seen.has(key) || validateTurn(state, c.action) !== null) continue;
    seen.add(key);
    picks.push(c);
  }
  if (picks.length < 2) return picks[0]?.action ?? null;
  let best: { action: TurnAction; value: number } | null = null;
  const rollout: W = { ...w, screen: 0 }; // playouts skip the screening re-score to stay in budget
  /** Play on until this Unit's turn; branch once, at the first enemy turn, over its top replies (worst for me). */
  const playout = (start: MatchState, from: number, branched: boolean): number => {
    let st = start;
    for (let t = from; t < LOOKAHEAD.maxTurns && st.winner === null && st.activeUnitId !== me.id; t++) {
      const u = activeUnit(st)!;
      if (!branched && replies > 1 && u.side !== me.side) {
        const options = topMoves(st, rollout, replies, light);
        if (options.length > 1) return Math.min(...options.map((a) => playout(applyTurn(st, a).state, t + 1, true)));
        branched = true;
      }
      st = applyTurn(st, chooseAction(st, rollout, 'normal', { light })).state;
    }
    return evaluate(st, me.side, w);
  };
  for (const c of picks) {
    // position value, with the candidate's own score as a small tie-breaker
    const value = playout(applyTurn(state, c.action).state, 0, false) + c.score * 0.01;
    if (!best || value > best.value + 1e-9) best = { action: c.action, value };
  }
  return best?.action ?? null;
}

/** Static value of a position for `side`: material and HP, Masters, Stones, Mana. */
export function evaluate(st: MatchState, side: number, w: W = AI_WEIGHTS): number {
  if (st.winner === side) return 1e6;
  if (st.winner !== null && st.winner !== 'draw') return -1e6;
  let v = 0;
  for (const u of st.units) {
    const k = kindOf(u.kind);
    const worth = k.isMaster ? 40 + u.hp * 12 : unitValue(u) * (8 + u.hp * 4);
    v += u.side === side ? worth : -worth;
  }
  // Stones count for their Mana, not for the Time Limit: the AI never plays for time.
  const stoneWeight = w.capture * EVAL_STONE;
  for (const s of st.stones) if (s.owner !== null) v += (s.owner === side ? 1 : -1) * stoneWeight;
  v += 0.15 * (st.sides[side as 0 | 1].mana - st.sides[(1 - side) as 0 | 1].mana);
  return v;
}


/**
 * An AI-built Loadout for a Master: an even share of each Element (5 of each
 * for 20), always including the two cheapest of each so it can summon early,
 * the rest spread over cost. Any share left over goes first to the
 * Master's own Element.
 */
export function autoLoadout(masterId: string, rand: () => number = Math.random): string[] {
  const own = kindOf(masterId).element;
  const elements = ['fire', 'air', 'earth', 'water'] as const;
  const order = [...elements].sort(() => rand() - 0.5);
  if (own) order.sort((a, b) => (a === own ? -1 : b === own ? 1 : 0));
  const share = Math.floor(LOADOUT_SIZE / elements.length);
  const extra = LOADOUT_SIZE - share * elements.length;
  const counts = new Map(order.map((e, i) => [e, share + (i < extra ? 1 : 0)] as const));
  const out: string[] = [];
  for (const e of elements) {
    const byCost = FAMILIARS.filter((s) => s.element === e).sort((a, b) => a.cost - b.cost);
    const picked = byCost.slice(0, 2);
    const rest = byCost.slice(2).sort(() => rand() - 0.5);
    picked.push(...rest.slice(0, counts.get(e)! - 2));
    out.push(...picked.map((k) => k.id));
  }
  return out;
}
