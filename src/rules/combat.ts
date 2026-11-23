import { type Hex, hexDistance, hexesInRange, hexSub, ringPosition, hexEq } from './hex';
import { COVER, ELEMENT_BONUS, FACING_BONUS, MAX_HP } from './data/tuning';
import { kindOf } from './kinds';
import { mapHexAt, surfaceOf, targetAt } from './terrain';
import { alignmentBonus } from './time';
import { isObstacle, type Element, type UnitKind, type MagicAbility, type MatchState, type Target, type Trajectory, type Unit } from './types';
import type { Dir } from './hex';

// ---------- Element ----------

const COUNTERS: Record<Element, Element> = { fire: 'air', air: 'earth', earth: 'water', water: 'fire' };

export type ElementRelation = keyof typeof ELEMENT_BONUS;

/** How an attacking Element stands against a defending one. No Element on either side is neutral. */
export function elementRelation(attacker: Element | null, defender: Element | null): ElementRelation {
  if (!attacker || !defender) return 'neutral';
  if (attacker === defender) return 'same';
  if (COUNTERS[attacker] === defender) return 'counter';
  if (COUNTERS[defender] === attacker) return 'countered';
  return 'neutral';
}

/** Element Bonus for a hit, by the two Elements (Obstacles, `defender` null, have none). */
export function elementBonus(attacker: UnitKind, defender: UnitKind | null): number {
  // Summoners and Summons alike, by their Elements; no Element (or an Obstacle) is neutral
  return ELEMENT_BONUS[elementRelation(attacker.element, defender?.element ?? null)];
}

// ---------- Facing ----------

/**
 * Facing Bonus for a hit on a defender at `defPos` facing `facing`, coming
 * from `fromPos`, by the hex-ring angle (ADR 0001): under 90° Front +0,
 * 90° up to 120° Flank +1, 120° and more Back +2.
 */
export function facingBonus(defPos: Hex, facing: Dir, fromPos: Hex): number {
  const v = hexSub(fromPos, defPos);
  if (v.q === 0 && v.r === 0) return FACING_BONUS[0];
  const { p, d } = ringPosition(v);
  let m = (((p - facing * d) % (6 * d)) + 6 * d) % (6 * d);
  if (m > 3 * d) m = 6 * d - m;
  // angle = 60·m/d degrees; compare 2m against 3d (90°) and m against 2d (120°)
  const band = 2 * m < 3 * d ? 0 : m < 2 * d ? 1 : 2;
  return FACING_BONUS[band];
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

/** Damage a hex's terrain takes off every hit. */
export function coverAt(state: MatchState, h: Hex): number {
  const mh = mapHexAt(state.map, h);
  if (!mh) return 0;
  if (mh.terrain === 'stone') return COVER.stone;
  if (surfaceOf(mh, state.waterLevel) !== 'land') return 0;
  return COVER[mh.terrain];
}

// ---------- Damage / heal ----------

export interface Breakdown {
  base: number; // ATK − DEF after Alignment
  element: number; // Element Bonus
  facing: number; // Facing Bonus
  facingAngle: number;
  cover: number; // damage taken off by terrain
  attackerAlign: number; // added to the attacker's stat
  defenderAlign: number; // added to the defender's stat
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

/**
 * Damage = ATK − DEF + Element Bonus + Facing Bonus − terrain cover, MP and
 * MDF for Magic; never below 0, at most the defender's HP. Alignment adds or subtracts ALIGN_STAT to the stats first.
 */
export function computeDamage(
  state: MatchState,
  attacker: Unit,
  attackerPos: Hex,
  defender: Target,
  hit: HitKind,
): Effect {
  const ak = kindOf(attacker.kind);
  const aAlign = alignmentBonus(ak.alignment, state.clock);
  const aStat = (hit === 'physical' ? ak.stats.atk : ak.stats.mp) + aAlign;
  let dStat: number;
  let dAlign = 0;
  let element: number;
  let facing = 0;
  let facingAngle = 0;
  let cover = 0;
  if (isObstacle(defender)) {
    // Obstacles: no Element (hit as neutral), no Facing, no cover; DEF = MDF.
    dStat = defender.def;
    element = elementBonus(ak, null);
  } else {
    const dk = kindOf(defender.kind);
    dAlign = alignmentBonus(dk.alignment, state.clock);
    dStat = (hit === 'physical' ? dk.stats.def : dk.stats.mdf) + dAlign;
    element = elementBonus(ak, dk);
    facing = facingBonus(defender.pos, defender.facing, attackerPos);
    facingAngle = facingAngleDegrees(defender.pos, defender.facing, attackerPos);
    cover = coverAt(state, defender.pos);
  }
  // the full damage, even past the defender's remaining HP (HP itself stops at 0)
  const amount = Math.max(0, aStat - dStat + element + facing - cover);
  return {
    unitId: defender.id,
    obstacle: isObstacle(defender),
    kind: 'damage',
    amount,
    hpBefore: defender.hp,
    lethal: amount >= defender.hp,
    breakdown: {
      base: aStat - dStat,
      element,
      facing,
      facingAngle,
      cover,
      attackerAlign: aAlign,
      defenderAlign: dAlign,
    },
  };
}

export function computeHeal(state: MatchState, caster: Unit, target: Unit): Effect {
  const ck = kindOf(caster.kind);
  const mp = Math.max(0, ck.stats.mp + alignmentBonus(ck.alignment, state.clock));
  const amount = Math.min(mp, MAX_HP - target.hp);
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
  if (ability.kind === 'damage' && ability.burst) return t.id !== caster.id; // a Burst spares only its caster
  return ability.kind === 'heal' ? t.side === caster.side : t.side !== caster.side;
}

/** Closest hex a Magic Ability may be aimed at: damage never at the caster's own hex. */
export function minAimDistance(ability: AreaAbility): number {
  return ability.kind === 'damage' && !ability.burst ? 1 : 0;
}

/**
 * Where a Magic hit on `t` comes from, for Facing: the caster's hex, except
 * that a High area spell's splash comes from the hex it landed on.
 */
export function magicHitOrigin(ability: AreaAbility, casterPos: Hex, aim: Hex, t: Target): Hex {
  if (ability.radius > 0 && !ability.burst && trajectoryOf(ability) === 'high' && !hexEq(t.pos, aim)) return aim;
  return casterPos;
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
