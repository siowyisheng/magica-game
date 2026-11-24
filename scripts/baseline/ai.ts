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
} from '../../src/rules';
import { hitReach, makePlan } from './plan';

export const AI_WEIGHTS = {
  damage: 10,
  kill: 60,
  killMaster: 100000,
  heal: 7,
  /** Value of an Empower (× its ATK × damage): the extra damage it should add to the target's next Attack. */
  empower: 1.2,
  /** Share of that value when no enemy is within the target's reach next turn. */
  empowerIdle: 0.3,
  friendlyFire: 14,
  threat: 9,
  deathRisk: 70,
  masterDeathRisk: 5000,
  capture: 80,
  onStone: 6,
  /** Holding an own Stone that an enemy could take next turn (standing on it blocks the capture). */
  guard: 90,
  approach: 3,
  /** Master: cost per HP it may lose this round and the next, while its margin stays comfortable (M1). */
  masterHpCost: 2,
  /** Master: cost per (HP short of comfort)², once the hits could leave it near killable (M1). */
  masterRisk: 25,
  /** Master: HP margin kept after the next two enemy rounds (worst case); Posture moves it (M5). */
  masterComfort: 3,
  /** Master: share of the death penalty for a hex where enemies that may arrive or be summoned could kill it (an estimate, so less than certain death). */
  masterMaybeDeath: 0.3,
  /** Share of the death penalty for a hit that would kill but isn't sure (the round after, or a fast enemy that might walk over). */
  unsureDeath: 0.4,
  /** Hits-to-kill at which a Master keeps the standard distance (fewer: more careful, more: bolder). */
  postureHits: 4,
  /** Least share of an enemy's damage a Familiar is charged with, however many other targets it has. */
  threatShareMin: 0.25,
  /** Weight of second-round threat to the Master (enemies acting before its turn after next). */
  masterSecondRound: 1,
  /** Bonus (× kill) for damage that leaves a target finishable by allies before it acts. */
  setupKill: 0.3,
  /** How much a material / Stone lead raises the pull toward the enemy. */
  pressure: 0,
  /** How strongly a lead (≈ −1..1) raises the push: pull toward objectives up, fear of damage down. */
  leadPush: 3,
  /** Most the push multiplies the pull (and divides the fear) by. */
  maxPush: 2.5,
  /** Share of an enemy's threat cancelled when my side can finish it before it acts again. */
  tradeCredit: 0.5,
  /** 0: damage penalty linear in HP lost; 1: quadratic (scrapes cheap, near-deaths dear). */
  hurtCurve: 0.5,
  /** Share of a Familiar's pull that goes to the side's shared target (the rest to its nearest objective). */
  focus: 0.5,
  /** Value of hitting a healer, per point of its heal × the best patient it can reach (÷ 4). */
  support: 0.5,
  /** Worth of damage the enemy will heal back before the next hits land (× normal damage). */
  healedDamage: 0.15,
  /** Damage to an enemy Master that healing is reaching and that can't be finished this round (× normal). */
  pokeMaster: 0.35,
  /** Value of heal blocked by standing in a healer's way (× damage of the same amount). */
  healBlock: 0.5,
  /** Lead above which the shared target is the enemy Master. */
  focusLead: 0.15,
  /** A Master's own hits on enemies count this many times over (it should use its ATK, not only summon). */
  masterHit: 1.5,
  /** Value of any extra Familiar on the board, before what it's for. */
  summonBase: 10,
  /** Value of a Familiar's fit for the Plan's Needs (docs/ai-plan.md §5). */
  needScale: 45,
  /** Pull of the Master toward the Plan's Front (× approach): it summons where the action is. */
  masterStage: 1.5,
  /** Pull of a summon hex toward the Front, per hex. */
  summonFront: 1,
  /** Under Defend: a summon hex from which the answer reaches the threat next turn (× urgency × fit). */
  answerPlace: 30,
  /** Under Defend: a summon hex between a non-flying threat and the Master (× urgency). */
  blockPlace: 12,
  /** Share of the main threat a new answering Familiar takes off the Master (× urgency × fit). */
  drawAttention: 0.35,
  /** Defend: value per turn the Master would hold out where it ends (HP-turns over 6 enemy turns; cover and Stone Heal counted). */
  refuge: 40,
  /** The same for a hurt Familiar, × its share of HP lost. */
  refugeFamiliar: 6,
  /** A Familiar's pull toward its Job, and toward its nearest objective (× approach). */
  jobPull: 1,
  nearPull: 0.25,
  /** Hours ahead over which an aligned Familiar's Time of Day is judged, and the most it moves the Familiar's value. */
  alignmentHours: 8,
  alignmentValue: 0.15,
  summonNegativeIncome: 35,
  manaSpend: 0.25,
  /** Save for an unaffordable Familiar whose value is at least this × the best affordable one… */
  saveMargin: 1.25,
  /** …and that income will pay for within this many hours. */
  saveHours: 2,
  /** Extra cost per point of Mana spent out of that reserve. */
  reserveSpend: 0.6,
  strandEnemy: 30,
  strandAlly: 35,
  delay: 0.15,
  /** Value of threat removed from allies by standing in enemies' way (× threat). */
  screen: 0.6,
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
      const view = kindOf(me.kind).isMaster
        ? { ...state, units: state.units.filter((a) => a.side !== me.side || a.id === me.id || a.av >= u.av) }
        : state;
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

export function rankCandidates(state: MatchState, weights: W): { me: Unit; candidates: Candidate[] } {
  const me = activeUnit(state);
  if (!me) throw new Error('no active unit');
  const kind = kindOf(me.kind);
  const w = weights;
  const reaches = enemyReaches(state, me);
  // the Side's Plan: Posture, Front, Needs, Reserve, Jobs (docs/ai-plan.md)
  const plan = makePlan(state, me.side);
  const posture = plan.posture;
  const threatCache = new Map<string, number>();
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

  /**
   * The part of the threat that is sure (fix 3): enemies that act before this
   * Unit's next turn and hit it by their real path this turn. Not the second
   * round, nor a fast enemy that only might walk over in time.
   */
  const sureCache = new Map<string, number>();
  const threatAt = (h: Hex, f: Dir, delay: number, killed: Set<number>): number => {
    const key = `${hexKey(h)}|${f}|${delay}|${[...killed].join(',')}`;
    const hit = threatCache.get(key);
    if (hit !== undefined) return hit;
    let total = 0;
    let sure = 0;
    for (const e of reaches) {
      if (killed.has(e.unit.id)) continue;
      // a tie with this Unit's next turn goes by Speed: count it as before (the safe side)
      const first = e.unit.av <= delay;
      const second = !first && kind.isMaster && e.unit.av < delay + secondWindow;
      if (!first && !second) continue; // acts after the window
      let d = maxDamage(e, me, h, f);
      if (first && kind.isMaster) sure += d;
      // a fast enemy may act more than once before my next turn: it can close in first
      const ek = kindOf(e.unit.kind);
      const rep = turnDelay(ek, true, false); // closing in: Move + Wait, the quickest repeat
      const turnsBefore = first ? 1 + Math.floor(Math.max(0, delay - e.unit.av) / rep) : 1;
      if (turnsBefore >= 2 && d === 0) {
        const reach = ek.stats.mov * turnsBefore + Math.max(ek.attack.range, ...ek.magic.map((m) => (m.kind === 'water' ? 0 : m.range + m.radius)));
        if (hexDistance(e.unit.pos, h) <= reach) d = approxDamage(state, e.unit, me, h, f);
      }
      // enemies go for the Master; a Familiar only bears its share of an enemy that has other targets
      // (not a hit that would kill it: an enemy that can take a kill usually does)
      const lethal = d >= me.hp;
      if (!kind.isMaster && d > 0 && !lethal) d *= Math.max(w.threatShareMin, (d * d) / (d * d + (otherSq.get(e.unit.id) ?? 0)));
      // a trade, not just a loss: an enemy my side can finish before it acts again pays for its hit
      if (!kind.isMaster && d > 0 && !lethal) d *= 1 - w.tradeCredit * Math.min(1, (followUp.get(e.unit.id) ?? 0) / Math.max(1, e.unit.hp));
      total += second ? d * w.masterSecondRound : d;
    }
    threatCache.set(key, total);
    sureCache.set(key, sure);
    return total;
  };
  const sureThreatAt = (h: Hex, f: Dir, delay: number, killed: Set<number>): number => {
    threatAt(h, f, delay, killed);
    return sureCache.get(`${hexKey(h)}|${f}|${delay}|${[...killed].join(',')}`)!;
  };

  // Focus fire: how much allies could deal to each enemy before that enemy acts again.
  const allyReaches = allies.map((u) => {
    const nodes = reachable(state, u);
    const positions: Hex[] = [];
    for (const n of nodes.values()) if (n.canEnd || hexEq(n.hex, u.pos)) positions.push(n.hex);
    return { unit: u, positions };
  });
  const followUp = new Map<number, number>();
  for (const e of state.units) {
    if (e.side === me.side) continue;
    let sum = 0;
    for (const a of allyReaches) if (a.unit.av < e.av) sum += maxDamageFrom(state, a, e, e.pos, e.facing);
    followUp.set(e.id, sum);
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
  /** What hitting an enemy is worth: its own value plus the healing it keeps doing. */
  const targetValue = (t: Unit) => unitValue(t) + (support.get(t.id) ?? 0);

  // Pressure: a lead in material and Stones (and the clock running out while behind) pulls units forward.
  const sideValue = (s: number) => state.units.filter((u) => u.side === s).reduce((a, u) => a + unitValue(u) * u.hp, 0);
  const myStones = state.stones.filter((x) => x.owner === me.side).length;
  const theirStones = state.stones.filter((x) => x.owner !== null && x.owner !== me.side).length;
  // The AI never plays for the Time Limit: a lead (material, Stones, Mana) is a reason to attack.
  const manaLead = (state.sides[me.side].mana - state.sides[1 - me.side].mana) / MANA_MAX;
  const lead = (sideValue(me.side) - sideValue(1 - me.side)) / Math.max(10, sideValue(me.side) + sideValue(1 - me.side)) + 0.08 * (myStones - theirStones) + 0.2 * manaLead;
  // Posture: Kill pushes harder; Squeeze is patient
  const pressure = Math.max(1, Math.min(w.maxPush, (1 + w.leadPush * lead) * (1 + 0.6 * posture.kill) * (1 - 0.3 * posture.squeeze)));
  const guardWeight = w.guard * (1 + 0.5 * posture.squeeze);
  /** Boldness: how much less a Familiar minds taking damage when its side is ahead. */
  const boldness = 1 / pressure;

  const bestFacing = (h: Hex, delay: number, killed: Set<number>): { facing: Dir; threat: number } => {
    let bestF: Dir = me.facing;
    let bestT = Infinity;
    // Prefer facing toward the nearest enemy on ties.
    const nearest = [...state.units]
      .filter((u) => u.side !== me.side && !killed.has(u.id))
      .sort((a, b) => hexDistance(a.pos, h) - hexDistance(b.pos, h) || a.id - b.id)[0];
    const pref = nearest && !hexEq(nearest.pos, h) ? facingToward(h, nearest.pos) : me.facing;
    const order: Dir[] = [pref, ...DIRS.filter((d) => d !== pref)];
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
  const enemyMaster = state.units.find((u) => u.side !== me.side && kindOf(u.kind).isMaster);
  // One shared target for the whole side: the enemy Master when ahead or when it's within
  // reach of our army, otherwise the enemy-held (or free) Stone nearest our Familiars.
  const myFamiliars = state.units.filter((u) => u.side === me.side && !kindOf(u.kind).isMaster);
  const focusTarget: Hex | null = (() => {
    if (!enemyMaster) return null;
    const near = myFamiliars.some((u) => hexDistance(u.pos, enemyMaster.pos) <= kindOf(u.kind).stats.mov * 2 + kindOf(u.kind).attack.range);
    // peel: while a healer keeps the enemy Master up, the healer is the target
    const medic = healers
      .filter((h) => healReach(h, enemyMaster.pos))
      .sort((a, b) => hexDistance(a.unit.pos, enemyMaster.pos) - hexDistance(b.unit.pos, enemyMaster.pos) || a.unit.id - b.unit.id)[0];
    if (medic && (lead > w.focusLead || near)) return medic.unit.pos;
    if (lead > w.focusLead || near) return enemyMaster.pos;
    return plan.front ?? enemyMaster.pos;
  })();

  // Master posture from the matchup: how many hits the strongest enemies need
  // to kill it (fragile ones keep away), and how hard it hits back (durable
  // hitters move up to threaten).
  let fragility = 1;
  if (kind.isMaster) {
    const enemies = state.units.filter((u) => u.side !== me.side);
    const incoming = enemies.map((e) => approxDamage(state, e, me, me.pos, me.facing)).sort((a, b) => b - a).slice(0, 3);
    const perHit = incoming.length ? incoming.reduce((a, b) => a + b, 0) / incoming.length : 0;
    const hitsToKill = me.hp / Math.max(0.5, perHit);
    fragility = Math.max(0.35, Math.min(1.5, w.postureHits / hitsToKill));
  }
  /**
   * The Master's comfort margin (M1, M5): HP it wants left after the next two
   * enemy rounds. Kill and Squeeze accept less; a Master that dies in few
   * hits wants a little more.
   */
  // (Defend doesn't raise it: its hold-out estimate already weighs cover and healing over several turns)
  const comfort = w.masterComfort - Math.max(posture.kill, posture.squeeze) + 2 * Math.max(0, fragility - 1);
  /**
   * Straight-line worst case for the Master at `h` (M1): every enemy that could
   * reach it within the actions it gets before the Master's next turn (fast
   * enemies act more than once), or before the one after, hits it once. Terrain
   * is ignored, so it errs toward caution; it only feeds the margin, so it only
   * matters when the hits could leave the Master near killable.
   */
  /**
   * How surely an enemy gets its hit in, from its slack (hexes of reach to spare,
   * straight-line): ⅓ at the very edge of its reach, full 2 hexes inside it. The edge
   * of a straight-line reach is where terrain, blockers and ZOC most often stop it.
   */
  const reachOdds = (slack: number) => (slack < 0 ? 0 : Math.min(1, (slack + 1) / 3));
  const potentialCache = new Map<string, number>();
  // Familiars the enemy could summon before the Master's next turn: a summoned Familiar
  // can act almost at once, so the enemy Master's reach grows by theirs (cheap: the 6
  // hardest-hitting it can afford, placed next to it).
  const enemyMasterU = state.units.find((u) => u.side !== me.side && kindOf(u.kind).isMaster);
  const enemyBudget = enemyMasterU ? manaAfter(state, enemyMasterU.side, enemyMasterU.av) : 0;
  const summonables = kind.isMaster && enemyMasterU
    ? FAMILIARS.filter((k) => k.cost <= enemyBudget && inRoster(state, enemyMasterU.side, k.id))
        .sort((a, b) => Math.max(b.stats.atk, b.stats.mp) - Math.max(a.stats.atk, a.stats.mp) || a.id.localeCompare(b.id))
        .slice(0, 6)
    : [];
  const summonThreat = (h: Hex, delay: number, f: Dir): number => {
    if (!enemyMasterU || enemyMasterU.av > delay || !summonables.length) return 0;
    const em = kindOf(enemyMasterU.kind);
    // it may walk first, then summon next to where it stops
    const fromSpawn = hexDistance(enemyMasterU.pos, h) - em.stats.mov - 1;
    let best = 0;
    for (const k of summonables) {
      // a new Familiar first acts a summoned turn's delay after its Master's turn
      if (enemyMasterU.av + turnDelay(k, true, true) > delay) continue;
      const odds = reachOdds(k.stats.mov + hitReach(k) - fromSpawn);
      if (odds <= 0) continue;
      const v: Unit = { id: -99, kind: k.id, side: enemyMasterU.side, pos: neighbor(h, facingToward(h, enemyMasterU.pos)), facing: 0, hp: MAX_HP, av: 0, stranded: false };
      best = Math.max(best, odds * approxDamage(state, v, me, h, f));
    }
    return best;
  };
  const potentialThreat = (h: Hex, delay: number, f: Dir, killed: Set<number>): number => {
    const key = `${hexKey(h)}|${delay}|${f}|${[...killed].join(',')}`;
    const hit = potentialCache.get(key);
    if (hit !== undefined) return hit;
    let total = 0;
    for (const e of state.units) {
      if (e.side === me.side || killed.has(e.id)) continue;
      const ek = kindOf(e.kind);
      const rep = turnDelay(ek, true, false);
      // only what can get there before the Master's next turn (the round after is in the threat check)
      const window = delay;
      if (e.av >= window) continue;
      const actions = 1 + Math.floor(Math.max(0, window - e.av) / Math.max(1, rep));
      // one action: its real path is already in the threat check, which is exact for it
      if (actions < 2) continue;
      total += reachOdds(ek.stats.mov * actions + hitReach(ek) - hexDistance(e.pos, h)) * approxDamage(state, e, me, h, f);
    }
    total += summonThreat(h, delay, f);
    potentialCache.set(key, total);
    return total;
  };
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
      const ek = kindOf(e.kind);
      const reach = ek.stats.mov + hitReach(ek);
      const d = hexDistance(e.pos, h);
      const arrive = d <= reach ? 0 : Math.ceil((d - reach) / Math.max(1, ek.stats.mov));
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
      if (stone.owner !== me.side) s += w.capture * stoneUrgency * (stone.owner === null ? 1 : 1.5);
      else if (needsGuard(h)) s += guardWeight;
      s += w.onStone * (10 - me.hp + 1) * 0.3;
    }
    if (kind.isMaster) {
      // No keep-away: how dangerous a hex is comes from the margin cost (M1, M2).
      // Defend: where it survives longest, not just furthest away: a Stone's cover and heal count
      if (posture.defend > 0) s += w.refuge * posture.defend * survivalTurns(h);
      // Advance toward the Front, so the Familiars it summons appear near the objectives (M3)
      // (never toward a threat it is defending against: its Familiars go there)
      // toward the objective (a Stone or the enemy Master), never toward a threat
      if (plan.objective) s -= w.approach * w.masterStage * pressure * (1 - posture.defend) * hexDistance(plan.objective, h);
    } else if (objs.length) {
      // its Job, plus a little for whatever objective is nearest (opportunities)
      let minD = 99;
      for (const o of objs) minD = Math.min(minD, hexDistance(o, h));
      const job = plan.jobs.get(me.id)?.hex ?? focusTarget;
      if (me.hp < MAX_HP) s += w.refugeFamiliar * (1 - me.hp / MAX_HP) * survivalTurns(h);
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
              score += obstacleValue(state, me, dest, e.unitId, Math.min(e.amount, e.hpBefore), e.lethal, w);
              continue;
            }
            const t = state.units.find((u) => u.id === e.unitId)!;
            const v = t.side === me.side ? unitValue(t) : targetValue(t);
            if (e.kind === 'damage') {
              // only the HP it can actually take counts: overkill is worth nothing
              const dealt = Math.min(e.amount, t.hp);
              if (t.side === me.side) score -= dealt * w.friendlyFire * v;
              else {
                const heal = healIn.get(t.id) ?? 0;
                // only damage that outlasts the healing coming its way counts in full
                const net = e.lethal ? dealt : Math.max(0, dealt - heal);
                const canFinish = !e.lethal && t.hp - dealt + heal <= (followUp.get(t.id) ?? 0);
                let dmgValue = (net + (dealt - net) * w.healedDamage) * w.damage * v * (kind.isMaster ? w.masterHit : 1);
                // a Master that can't be finished this round just gets healed up: don't pour the lead into it
                if (kindOf(t.kind).isMaster && !e.lethal && !canFinish && heal > 0) dmgValue *= w.pokeMaster;
                score += dmgValue;
                if (e.lethal) {
                  killed.add(t.id);
                  score += kindOf(t.kind).isMaster ? w.killMaster : w.kill * v;
                } else if (canFinish) {
                  // allies can finish it before it acts, healing included
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
              score += (t.side === me.side ? 1 : -1) * e.amount * w.heal * v;
            }
          }
        }
      } else if (command.type === 'summon') {
        const sk = summonKinds.find((s) => s.kind.id === command.kind)!;
        const isAnswer = sk.kind.name === plan.reserveAnswer || (mainThreat !== null && plan.answerFit(sk.kind, mainThreat.unit) >= 0.6);
        score += sk.value - spendCost(sk.kind.cost, isAnswer);
        const h = neighbor(dest, command.dir);
        // toward the Front (R3), and onto or next to a Stone the Side doesn't hold
        if (plan.front) score -= w.summonFront * hexDistance(h, plan.front);
        const stone = state.stones.find((s) => hexEq(s.hex, h));
        if (stone && stone.owner !== me.side) score += w.capture * 0.4;
        else if (state.stones.some((s) => s.owner !== me.side && hexDistance(s.hex, h) === 1)) score += w.capture * 0.15;
        // Defend (F2): where the answer reaches the threat next turn, and in its way
        if (mainThreat) {
          const tk = kindOf(mainThreat.unit.kind);
          const fitA = plan.answerFit(sk.kind, mainThreat.unit);
          if (hexDistance(h, mainThreat.unit.pos) <= sk.kind.stats.mov + hitReach(sk.kind)) score += w.answerPlace * mainThreat.urgency * fitA;
          if (!tk.moveTypes.includes('fly') && hexDistance(h, mainThreat.unit.pos) < hexDistance(dest, mainThreat.unit.pos)) score += w.blockPlace * mainThreat.urgency;
        }
      }

      const gone = kind.isMaster && finished.size ? new Set([...killed, ...finished]) : killed;
      let facing: Dir;
      let threat: number;
      /** The threat before F3's discount: a decoy doesn't make a hit that could kill the Master any less lethal. */
      let rawThreat: number;
      if (command.type === 'summon') {
        facing = command.dir;
        threat = threatAt(dest, facing, delay, gone);
        rawThreat = threat;
        // F3: a new Familiar that answers the main threat and can reach it draws part of it off the Master
        if (mainThreat) {
          const sk = kindOf(command.kind);
          const h = neighbor(dest, command.dir);
          if (hexDistance(h, mainThreat.unit.pos) <= sk.stats.mov + hitReach(sk)) threat *= 1 - w.drawAttention * mainThreat.urgency * Math.min(1, plan.answerFit(sk, mainThreat.unit));
        }
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
        rawThreat = threat;
      }
      const v = unitValue(me);
      let safety = 0;
      let doomed = false;
      if (kind.isMaster) {
        // HP is a budget (M1): scrapes are cheap; what costs is being left near killable
        const potential = potentialThreat(dest, delay, facing, gone);
        // hits past its HP change nothing (fix 2): death is priced on its own below
        const margin = me.hp + recovery(dest) - Math.min(me.hp, Math.max(threat, potential));
        safety += w.masterHpCost * Math.min(threat, me.hp) + w.masterRisk * Math.max(0, comfort - margin) ** 2;
        if (rawThreat >= me.hp) {
          // graded by how sure it is (fix 3): full when enemies that act first can reach and kill it by their
          // real path this turn; less when it also takes the round after, or a fast enemy that might walk over
          const sure = sureThreatAt(dest, facing, delay, gone);
          doomed = sure >= me.hp;
          safety += w.masterDeathRisk * (doomed ? 1 : w.unsureDeath + (1 - w.unsureDeath) * (sure / me.hp));
        } else if (potential >= me.hp) {
          // could be killed by enemies that may get there (or be summoned) first: nearly a veto
          // (Stone Heal and healers come after the hits, so they don't count here)
          safety += w.masterDeathRisk * w.masterMaybeDeath;
        }
      } else {
        // scrapes a Unit can absorb cost little; damage that nearly kills it costs the most
        const x = Math.min(threat, me.hp) / me.hp;
        const hurt = (1 - w.hurtCurve) * x + w.hurtCurve * x * x;
        safety += hurt * me.hp * w.threat * v * boldness;
        if (threat >= me.hp) safety += w.deathRisk * v;
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
  if (w.screen > 0 && allies.length) {
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
      v = (baseThreat - after) * w.threat * w.screen;
      // cutting the heal line: healing the enemy Master (or a hurt enemy) can no longer receive
      if (healers.length) {
        const hs = rs.filter((e) => healers.some((h) => h.unit.id === e.unit.id));
        for (const t of state.units) {
          if (t.side === me.side || (t.hp >= 10 && !kindOf(t.kind).isMaster)) continue;
          const lost = (healIn.get(t.id) ?? 0) - incomingHealFrom(hs, t);
          if (lost > 0) v += lost * w.damage * unitValue(t) * w.healBlock;
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
export function chooseAction(state: MatchState, weights: W = AI_WEIGHTS, level?: 'normal' | 'hard'): TurnAction {
  const { me, candidates } = rankCandidates(state, weights);
  const lvl = level ?? state.sides[me.side].aiLevel ?? 'normal';
  if (lvl === 'hard') {
    const pick = lookahead(state, me, candidates, weights);
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

export const LOOKAHEAD = { candidates: 5, maxTurns: 6 };

function lookahead(state: MatchState, me: Unit, ranked: Candidate[], w: W): TurnAction | null {
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
  for (const c of picks) {
    let st = applyTurn(state, c.action).state;
    for (let t = 0; t < LOOKAHEAD.maxTurns && st.winner === null && st.activeUnitId !== me.id; t++) {
      st = applyTurn(st, chooseAction(st, rollout, 'normal')).state;
    }
    // position value, with the candidate's own score as a small tie-breaker
    const value = evaluate(st, me.side) + c.score * 0.01;
    if (!best || value > best.value + 1e-9) best = { action: c.action, value };
  }
  return best?.action ?? null;
}

/** Static value of a position for `side`: material and HP, Masters, Stones, Mana. */
export function evaluate(st: MatchState, side: number): number {
  if (st.winner === side) return 1e6;
  if (st.winner !== null && st.winner !== 'draw') return -1e6;
  let v = 0;
  for (const u of st.units) {
    const k = kindOf(u.kind);
    const worth = k.isMaster ? 40 + u.hp * 12 : unitValue(u) * (8 + u.hp * 4);
    v += u.side === side ? worth : -worth;
  }
  // Stones count for their Mana, not for the Time Limit: the AI never plays for time.
  const stoneWeight = 30;
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
