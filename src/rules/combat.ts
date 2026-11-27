import { type Hex, hexDistance, hexesInRange, hexSub, ringPosition, hexEq } from './hex';
import { COVER, ELEMENT_BONUS, FACING_BONUS, MAX_HP } from './data/tuning';
import { kindOf } from './kinds';
import { atkHidden, isHostile, statusesOf } from './ability';
import { mapHexAt, surfaceHeight, surfaceOf, targetAt } from './terrain';
import { alignmentBonus } from './time';
import { isObstacle, type Element, type UnitKind, type Ability, type MatchState, type Target, type Trajectory, type Unit } from './types';
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
  // Masters and Familiars alike, by their Elements; no Element (or an Obstacle) is neutral
  return ELEMENT_BONUS[elementRelation(attacker.element, defender?.element ?? null)];
}

// ---------- Facing ----------

/**
 * Facing Bonus for a hit on a defender at `defPos` facing `facing`, coming
 * from `fromPos`, by the hex-ring angle (ADR 0001): under 90° Front +0,
 * 90° up to 150° Flank +1, 150° and more Back +2.
 */
export function facingBonus(defPos: Hex, facing: Dir, fromPos: Hex): number {
  const v = hexSub(fromPos, defPos);
  if (v.q === 0 && v.r === 0) return FACING_BONUS[0];
  const { p, d } = ringPosition(v);
  let m = (((p - facing * d) % (6 * d)) + 6 * d) % (6 * d);
  if (m > 3 * d) m = 6 * d - m;
  // angle = 60·m/d degrees; compare 2m against 3d (90°) and 5d (150°)
  const band = 2 * m < 3 * d ? 0 : 2 * m < 5 * d ? 1 : 2;
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
  /** hex / entangle: a standalone Hex or Entangle (amount: the MDF a Hex takes away, else 0). */
  kind: 'damage' | 'heal' | 'empower' | 'hex' | 'entangle';
  amount: number;
  hpBefore: number;
  lethal: boolean;
  breakdown?: Breakdown;
  /** The Hex this puts on the Unit (standalone, or riding on damage). */
  hex?: { amount: number; minutes: number };
  /** It Entangles the Unit (standalone, or riding on damage). */
  entangle?: boolean;
}

export type HitKind = 'physical' | 'magic';

/**
 * Damage = ATK − DEF + Element Bonus + Facing Bonus − terrain cover, MP and
 * MDF for a magical hit; never below 0, at most the defender's HP. Alignment adds or subtracts ALIGN_STAT to the stats first.
 */
export function computeDamage(
  state: MatchState,
  attacker: Unit,
  attackerPos: Hex,
  defender: Target,
  hit: HitKind,
): Effect {
  const ak = kindOf(attacker);
  const aAlign = alignmentBonus(ak.alignment, state.clock);
  // Empower adds to ATK (physical hits only) until the next physical hit
  const aStat = (hit === 'physical' ? ak.stats.atk + (attacker.empowered ?? 0) : ak.stats.mp) + aAlign;
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
    const dk = kindOf(defender);
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

/** Empower: the target's next physical hit gets +`amount` ATK. It doesn't stack: a second one only refreshes it. */
export function computeEmpower(ability: { amount?: number }, target: Unit): Effect {
  return { unitId: target.id, kind: 'empower', amount: ability.amount ?? EMPOWER_DEFAULT, hpBefore: target.hp, lethal: false };
}

/** ATK an Empower gives when its ability names no amount. */
export const EMPOWER_DEFAULT = 3;

export function computeHeal(state: MatchState, caster: Unit, target: Unit): Effect {
  const ck = kindOf(caster);
  const mp = Math.max(0, ck.stats.mp + alignmentBonus(ck.alignment, state.clock));
  const amount = Math.min(mp, MAX_HP - target.hp);
  return { unitId: target.id, kind: 'heal', amount, hpBefore: target.hp, lethal: false };
}

// ---------- Clear Angle ----------

const SQRT3 = Math.sqrt(3);
/** Radius of the standard body of a Unit or Obstacle, in world units (hex width = √3). */
export const BODY_RADIUS = 0.3 * SQRT3;
/**
 * Radius a Unit blocks Direct shots with: much wider than its standard body
 * (84% of a hex width against 60%), so Units screen what stands behind them.
 * Obstacles keep the standard body.
 */
export const UNIT_BLOCK_RADIUS = 0.42 * SQRT3;
/** Radius of a standard projectile. */
export const SHOT_RADIUS = 0.08 * SQRT3;
/** Hexes at least this much higher than the shooter's block a Direct shot. */
export const TERRAIN_BLOCK_STEP = 2;
/** Radius a high hex blocks Direct shots with: its whole width (the inner radius of the hex). */
const HEX_BLOCK_RADIUS = SQRT3 / 2;
/** Aim points sampled across the target's body. */
const AIM_SAMPLES = 8;

/** Every non-Pit hex with its shown top (water at the Water Level), highest first; cached per map and Water Level. */
const topsCache = new WeakMap<object, Map<number, { hex: Hex; top: number; x: number; z: number }[]>>();
function terrainTops(state: MatchState) {
  let byLevel = topsCache.get(state.map);
  if (!byLevel) topsCache.set(state.map, (byLevel = new Map()));
  let tops = byLevel.get(state.waterLevel);
  if (!tops) {
    tops = state.map.hexes
      .filter((mh) => mh.terrain !== 'pit')
      .map((mh) => {
        const [x, z] = centre(mh.hex);
        return { hex: mh.hex, top: surfaceHeight(mh, state.waterLevel), x, z };
      })
      .sort((a, b) => b.top - a.top);
    byLevel.set(state.waterLevel, tops);
  }
  return tops;
}

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
 * `target`. Seen from above, every other Unit is a circle of UNIT_BLOCK_RADIUS
 * and every Obstacle one of BODY_RADIUS at its hex centre; the shot is clear when some straight line
 * from the shooter's centre to a point across the target's body passes every
 * other body with room for a SHOT_RADIUS projectile. Terrain blocks too: every
 * hex 2+ Heights above the shooter's (water counts at the Water Level) is a
 * circle filling the hex. Pits never block. Uses only + − × ÷ and √ (deterministic).
 */
export function clearShot(state: MatchState, shooterId: number, from: Hex, target: Hex): boolean {
  if (hexEq(from, target)) return true;
  const { sx, sz, tx, tz, px, pz, blockers } = shotGeometry(state, shooterId, from, target);
  for (let k = 0; k <= 2 * AIM_SAMPLES; k++) {
    // centre first, then outward alternately
    const i = k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2);
    const off = (BODY_RADIUS * i) / AIM_SAMPLES;
    const ax = tx + px * off;
    const az = tz + pz * off;
    if (blockers.every(({ x, z, room }) => segmentDistance2(x, z, sx, sz, ax, az) >= room - 1e-9)) return true;
  }
  return false;
}

/** What stands in a Direct shot's way: a Unit, an Obstacle or high ground (a hex 2+ Heights up). */
export type ShotBlocker = { kind: 'unit' | 'obstacle'; id: number; hex: Hex } | { kind: 'terrain'; hex: Hex };

type Body = { x: number; z: number; room: number; blocker: ShotBlocker };

function shotGeometry(state: MatchState, shooterId: number, from: Hex, target: Hex) {
  const [sx, sz] = centre(from);
  const [tx, tz] = centre(target);
  const dx = tx - sx;
  const dz = tz - sz;
  const len = Math.sqrt(dx * dx + dz * dz);
  const px = -dz / len;
  const pz = dx / len;
  const blockers: Body[] = [];
  const unitRoom = (UNIT_BLOCK_RADIUS + SHOT_RADIUS) ** 2;
  const obstacleRoom = (BODY_RADIUS + SHOT_RADIUS) ** 2;
  for (const u of state.units)
    if (u.hp > 0 && u.id !== shooterId && !hexEq(u.pos, target) && !hexEq(u.pos, from)) {
      const [x, z] = centre(u.pos);
      blockers.push({ x, z, room: unitRoom, blocker: { kind: 'unit', id: u.id, hex: u.pos } });
    }
  for (const o of state.obstacles)
    if (o.hp > 0 && !hexEq(o.pos, target)) {
      const [x, z] = centre(o.pos);
      blockers.push({ x, z, room: obstacleRoom, blocker: { kind: 'obstacle', id: o.id, hex: o.pos } });
    }
  // terrain: hexes 2+ Heights above the shooter's (water at the Water Level; Pits are empty)
  const fromHex = mapHexAt(state.map, from);
  if (fromHex) {
    const wall = surfaceHeight(fromHex, state.waterLevel) + TERRAIN_BLOCK_STEP;
    const hexRoom = (HEX_BLOCK_RADIUS + SHOT_RADIUS) ** 2;
    const reach = len + 2;
    for (const t of terrainTops(state)) {
      if (t.top < wall) break; // highest first
      if (Math.abs(t.x - sx) > reach || Math.abs(t.z - sz) > reach || hexEq(t.hex, target) || hexEq(t.hex, from)) continue;
      blockers.push({ x: t.x, z: t.z, room: hexRoom, blocker: { kind: 'terrain', hex: t.hex } });
    }
  }
  return { sx, sz, tx, tz, px, pz, blockers };
}

/**
 * Why a Direct shot from `from` has no Clear Angle to `target`: the first thing in the
 * way of the straight line between the hex centres (null when that line is clear).
 */
export function shotBlocker(state: MatchState, shooterId: number, from: Hex, target: Hex): ShotBlocker | null {
  if (hexEq(from, target)) return null;
  const { sx, sz, tx, tz, blockers } = shotGeometry(state, shooterId, from, target);
  const dx = tx - sx;
  const dz = tz - sz;
  const len2 = dx * dx + dz * dz;
  let best: { t: number; b: ShotBlocker } | null = null;
  for (const { x, z, room, blocker } of blockers) {
    if (segmentDistance2(x, z, sx, sz, tx, tz) >= room - 1e-9) continue;
    const t = ((x - sx) * dx + (z - sz) * dz) / len2;
    if (!best || t < best.t) best = { t, b: blocker };
  }
  return best?.b ?? null;
}

/** Trajectory of a ranged ability, or null when it needs none (range 1, or not targeted). */
export function trajectoryOf(a: { range: number; trajectory?: Trajectory }): Trajectory | null {
  return a.range > 1 ? (a.trajectory ?? 'high') : null;
}

/** Most a range-1 Ability's target hex may be above or below the user's. */
export const MELEE_MAX_STEP = 1;

/** Whether a range-1 Ability used from `from` reaches the neighbouring hex `target`: at most 1 Height up or down (water at the Water Level). */
export function meleeReach(state: MatchState, from: Hex, target: Hex): boolean {
  const a = mapHexAt(state.map, from);
  const b = mapHexAt(state.map, target);
  return !a || !b || Math.abs(surfaceHeight(b, state.waterLevel) - surfaceHeight(a, state.waterLevel)) <= MELEE_MAX_STEP;
}

/**
 * Whether a shot along `trajectory` from `from` can reach `target` (range already checked).
 * `null` is a range-1 Ability: it reaches a neighbour only at most 1 Height up or down.
 * Ranged abilities used on a neighbour ignore Height.
 */
export function shotAllowed(state: MatchState, shooterId: number, trajectory: Trajectory | null, from: Hex, target: Hex): boolean {
  if (trajectory === null) return hexDistance(from, target) !== 1 || meleeReach(state, from, target);
  return trajectory !== 'direct' || hexDistance(from, target) <= 1 || clearShot(state, shooterId, from, target);
}

// ---------- Targeting ----------

export type AreaAbility = Exclude<Ability, { kind: 'water' }>;

/** Damage hits enemies and Obstacles; Hex and Entangle enemy Units; heals and Empower allies (the caster included; Empower never one whose ATK is hidden). */
function matchesTargets(ability: AreaAbility, caster: Unit, t: Target): boolean {
  if (isObstacle(t)) return ability.kind === 'damage';
  if (ability.kind === 'damage' && ability.burst) return t.id !== caster.id; // a Burst spares only its caster
  if (ability.kind === 'empower' && atkHidden(kindOf(t))) return false; // Empower only helps a Unit that hits with ATK
  return isHostile(ability) ? t.side !== caster.side : t.side === caster.side;
}

/** Closest hex an Ability may be aimed at: hostile ones never at the user's own hex. */
export function minAimDistance(ability: AreaAbility): number {
  return isHostile(ability) && !ability.burst ? 1 : 0;
}

/** A standalone Hex or Entangle on `target`. */
export function computeStatus(ability: AreaAbility, target: Unit): Effect {
  const st = statusesOf(ability);
  return { unitId: target.id, kind: ability.kind === 'hex' ? 'hex' : 'entangle', amount: st.hex?.amount ?? 0, hpBefore: target.hp, lethal: false, ...st };
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

/** Hexes a Unit's Ability could be aimed at from `from` (each affecting someone); a water Ability is aimed at the user's own hex. */
export function abilityTargetHexes(state: MatchState, caster: Unit, from: Hex, ability: Ability = kindOf(caster).ability): Hex[] {
  if (ability.kind === 'water') return [from];
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
