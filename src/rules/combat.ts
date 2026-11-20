import { type Hex, hexDistance, hexesInRange, hexSub, ringPosition, hexEq } from './hex';
import { COVER_PERCENT, DAMAGE_K, FACING_KNOTS, HEAL_DIVISOR } from './data/tuning';
import { kindOf } from './kinds';
import { mapHexAt, surfaceOf, targetAt } from './terrain';
import { alignmentPercent } from './time';
import { isObstacle, type Element, type MagicAbility, type MatchState, type Target, type Trajectory, type Unit } from './types';
import type { Dir } from './hex';

/** A rational number with integer parts. */
export interface Ratio {
  num: number;
  den: number;
}

/** Integer floor division that is exact for safe integers. */
function idiv(num: number, den: number): number {
  let q = Math.floor(num / den);
  while (q * den > num) q--;
  while ((q + 1) * den <= num) q++;
  return q;
}

/** Round half up of num/den, both non-negative integers. */
export function roundRatio(num: number, den: number): number {
  return idiv(2 * num + den, 2 * den);
}

// ---------- Element ----------

const COUNTERS: Record<Element, Element> = { fire: 'air', air: 'earth', earth: 'water', water: 'fire' };

export function elementModifier(attacker: Element | null, defender: Element | null): Ratio {
  if (!attacker || !defender) return { num: 1, den: 1 };
  if (COUNTERS[attacker] === defender) return { num: 2, den: 1 };
  if (COUNTERS[defender] === attacker) return { num: 1, den: 2 };
  return { num: 1, den: 1 };
}

// ---------- Facing ----------

/**
 * Facing Modifier for a hit on a defender at `defPos` facing `facing`,
 * coming from `fromPos`. Uses the hex-ring angle (ADR 0001).
 * Returned as a ratio with denominator 1000·d.
 */
export function facingModifier(defPos: Hex, facing: Dir, fromPos: Hex): Ratio {
  const v = hexSub(fromPos, defPos);
  if (v.q === 0 && v.r === 0) return { num: 1, den: 1 };
  const { p, d } = ringPosition(v);
  let m = (((p - facing * d) % (6 * d)) + 6 * d) % (6 * d);
  if (m > 3 * d) m = 6 * d - m;
  const seg = Math.floor(m / d);
  if (seg >= 3) return { num: FACING_KNOTS[3], den: 1000 };
  const rem = m - seg * d;
  const num = FACING_KNOTS[seg] * d + (FACING_KNOTS[seg + 1] - FACING_KNOTS[seg]) * rem;
  return { num, den: 1000 * d };
}

/** Angle in degrees on the hex ring (for UI display only). */
export function facingAngleDegrees(defPos: Hex, facing: Dir, fromPos: Hex): number {
  const v = hexSub(fromPos, defPos);
  if (v.q === 0 && v.r === 0) return 0;
  const { p, d } = ringPosition(v);
  let m = (((p - facing * d) % (6 * d)) + 6 * d) % (6 * d);
  if (m > 3 * d) m = 6 * d - m;
  return (m * 60) / d;
}

// ---------- Cover ----------

export function coverPercent(state: MatchState, h: Hex): number {
  const mh = mapHexAt(state.map, h);
  if (!mh) return 0;
  if (mh.terrain === 'stone') return COVER_PERCENT.stone;
  if (surfaceOf(mh, state.waterLevel) !== 'land') return 0;
  return COVER_PERCENT[mh.terrain];
}

// ---------- Damage / heal ----------

export interface Breakdown {
  base: number; // power × ratio as a float, display only
  element: number;
  facing: number;
  facingAngle: number;
  cover: number; // percent
  attackerAlign: number; // percent
  defenderAlign: number; // percent
}

export interface Effect {
  /** The Unit's or Obstacle's id. */
  unitId: number;
  /** True when the target is an Obstacle. */
  obstacle?: boolean;
  kind: 'damage' | 'heal';
  amount: number;
  hpBefore: number;
  lethal: boolean;
  breakdown?: Breakdown;
}

export type HitKind = 'physical' | 'magic';

export function computeDamage(
  state: MatchState,
  attacker: Unit,
  attackerPos: Hex,
  defender: Target,
  hit: HitKind,
): Effect {
  const ak = kindOf(attacker.kind);
  const aPct = alignmentPercent(ak.alignment, state.clock);
  const aStat = (hit === 'physical' ? ak.stats.atk : ak.stats.mp) * aPct;
  let dStat: number;
  let dPct = 100;
  let el: Ratio = { num: 1, den: 1 };
  let fac: Ratio = { num: 1, den: 1 };
  let facingAngle = 0;
  let cover = 0;
  if (isObstacle(defender)) {
    // Obstacles: no Element, no Facing, no cover; DEF = MDF.
    dStat = defender.def * 100;
  } else {
    const dk = kindOf(defender.kind);
    dPct = alignmentPercent(dk.alignment, state.clock);
    dStat = (hit === 'physical' ? dk.stats.def : dk.stats.mdf) * dPct;
    el = elementModifier(ak.element, dk.element);
    fac = facingModifier(defender.pos, defender.facing, attackerPos);
    facingAngle = facingAngleDegrees(defender.pos, defender.facing, attackerPos);
    cover = coverPercent(state, defender.pos);
  }
  const num = DAMAGE_K * aStat * el.num * fac.num * (100 - cover);
  const den = Math.max(1, dStat) * el.den * fac.den * 100;
  const amount = Math.min(defender.hp, roundRatio(num, den));
  return {
    unitId: defender.id,
    obstacle: isObstacle(defender),
    kind: 'damage',
    amount,
    hpBefore: defender.hp,
    lethal: amount >= defender.hp,
    breakdown: {
      base: (DAMAGE_K * aStat) / Math.max(1, dStat),
      element: el.num / el.den,
      facing: fac.num / fac.den,
      facingAngle,
      cover,
      attackerAlign: aPct,
      defenderAlign: dPct,
    },
  };
}

export function computeHeal(state: MatchState, caster: Unit, target: Unit): Effect {
  const ck = kindOf(caster.kind);
  const pct = alignmentPercent(ck.alignment, state.clock);
  const raw = roundRatio(ck.stats.mp * pct, 100 * HEAL_DIVISOR);
  const amount = Math.min(raw, 10 - target.hp);
  return { unitId: target.id, kind: 'heal', amount, hpBefore: target.hp, lethal: false };
}

// ---------- Clear Angle ----------

const SQRT3 = Math.sqrt(3);
/** Radius of the standard body of a Unit or Obstacle, in world units (hex width = √3). */
export const BODY_RADIUS = 0.3 * SQRT3;
/** Radius of a standard projectile. */
export const SHOT_RADIUS = 0.08 * SQRT3;
/** Aim points sampled across the target's body. */
const AIM_SAMPLES = 8;

function centre(h: Hex): [number, number] {
  return [SQRT3 * (h.q + h.r / 2), 1.5 * h.r];
}

function segmentDistance2(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 === 0 ? 0 : ((px - ax) * dx + (pz - az) * dz) / l2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + dx * t - px;
  const cz = az + dz * t - pz;
  return cx * cx + cz * cz;
}

/**
 * Clear Angle: whether a Direct shot from `from` can reach the body at
 * `target`. Seen from above, every other Unit and Obstacle is a circle of
 * BODY_RADIUS at its hex centre; the shot is clear when some straight line
 * from the shooter's centre to a point across the target's body passes every
 * other body with room for a SHOT_RADIUS projectile. Height, Pits and water
 * never block. Uses only + − × ÷ and √ (deterministic).
 */
export function clearShot(state: MatchState, shooterId: number, from: Hex, target: Hex): boolean {
  if (hexEq(from, target)) return true;
  const [sx, sz] = centre(from);
  const [tx, tz] = centre(target);
  const dx = tx - sx;
  const dz = tz - sz;
  const len = Math.sqrt(dx * dx + dz * dz);
  const px = -dz / len;
  const pz = dx / len;
  const blockers: [number, number][] = [];
  for (const u of state.units) if (u.hp > 0 && u.id !== shooterId && !hexEq(u.pos, target) && !hexEq(u.pos, from)) blockers.push(centre(u.pos));
  for (const o of state.obstacles) if (o.hp > 0 && !hexEq(o.pos, target)) blockers.push(centre(o.pos));
  const room = (BODY_RADIUS + SHOT_RADIUS) ** 2;
  for (let k = 0; k <= 2 * AIM_SAMPLES; k++) {
    // centre first, then outward alternately
    const i = k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2);
    const off = (BODY_RADIUS * i) / AIM_SAMPLES;
    const ax = tx + px * off;
    const az = tz + pz * off;
    if (blockers.every(([bx, bz]) => segmentDistance2(bx, bz, sx, sz, ax, az) >= room - 1e-9)) return true;
  }
  return false;
}

/** Trajectory of a ranged ability, or null when it needs none (range 1, or not targeted). */
export function trajectoryOf(a: { range: number; trajectory?: Trajectory }): Trajectory | null {
  return a.range > 1 ? (a.trajectory ?? 'high') : null;
}

/** Whether a shot along `trajectory` from `from` can reach `target` (range already checked). */
export function shotAllowed(state: MatchState, shooterId: number, trajectory: Trajectory | null, from: Hex, target: Hex): boolean {
  return trajectory !== 'direct' || hexDistance(from, target) <= 1 || clearShot(state, shooterId, from, target);
}

// ---------- Targeting ----------

/** Enemy Units and Obstacles the Unit could Attack from `from` (in range, with a Clear Angle if Direct). */
export function attackTargets(state: MatchState, unit: Unit, from: Hex): Target[] {
  const a = kindOf(unit.kind).attack;
  const traj = trajectoryOf(a);
  const out: Target[] = [];
  const consider = (t: Target) => {
    const d = hexDistance(from, t.pos);
    if (d >= 1 && d <= a.range && shotAllowed(state, unit.id, traj, from, t.pos)) out.push(t);
  };
  for (const u of state.units) if (u.hp > 0 && u.side !== unit.side) consider(u);
  for (const o of state.obstacles) if (o.hp > 0) consider(o);
  return out;
}

type AreaAbility = Extract<MagicAbility, { kind: 'damage' | 'heal' }>;

/** Damage hits enemies and Obstacles; heals hit allies (the caster included). */
function matchesTargets(ability: AreaAbility, caster: Unit, t: Target): boolean {
  if (isObstacle(t)) return ability.kind === 'damage';
  return ability.kind === 'heal' ? t.side === caster.side : t.side !== caster.side;
}

/** Closest hex a Magic Ability may be aimed at: damage never at the caster's own hex. */
export function minAimDistance(ability: AreaAbility): number {
  return ability.kind === 'damage' ? 1 : 0;
}

/** Units and Obstacles affected by an area/single ability centred on `target`. */
export function affectedUnits(state: MatchState, caster: Unit, ability: AreaAbility, target: Hex): Target[] {
  if (ability.radius === 0) {
    const t = targetAt(state, target);
    return t && matchesTargets(ability, caster, t) ? [t] : [];
  }
  const area = hexesInRange(target, ability.radius);
  const inArea = (t: Target) => t.hp > 0 && area.some((h) => hexEq(h, t.pos)) && matchesTargets(ability, caster, t);
  return [...state.units.filter(inArea), ...state.obstacles.filter(inArea)];
}

/** Valid target hexes for a targeted Magic Ability cast from `from`. */
export function magicTargetHexes(state: MatchState, caster: Unit, ability: AreaAbility, from: Hex): Hex[] {
  // The caster will be standing at `from` when casting.
  const moved: Unit = { ...caster, pos: from };
  const view: MatchState = { ...state, units: state.units.map((u) => (u.id === caster.id ? moved : u)) };
  const traj = trajectoryOf(ability);
  const out: Hex[] = [];
  for (const h of hexesInRange(from, ability.range)) {
    const d = hexDistance(from, h);
    if (d < minAimDistance(ability)) continue;
    if (!mapHexAt(state.map, h)) continue;
    if (!shotAllowed(view, caster.id, traj, from, h)) continue;
    if (affectedUnits(view, moved, ability, h).length > 0) out.push(h);
  }
  return out;
}
