import { type Hex, hexDistance, hexesInRange, hexSub, ringPosition, hexEq } from './hex';
import { COVER_PERCENT, FACING_KNOTS } from './data/tuning';
import { kindOf } from './kinds';
import { mapHexAt, surfaceOf, unitAt } from './terrain';
import { alignmentPercent } from './time';
import type { Element, MagicAbility, MatchState, Unit } from './types';
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
  unitId: number;
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
  defender: Unit,
  hit: HitKind,
  power: number,
): Effect {
  const ak = kindOf(attacker.kind);
  const dk = kindOf(defender.kind);
  const aPct = alignmentPercent(ak.alignment, state.clock);
  const dPct = alignmentPercent(dk.alignment, state.clock);
  const aStat = (hit === 'physical' ? ak.stats.atk : ak.stats.mp) * aPct;
  const dStat = (hit === 'physical' ? dk.stats.def : dk.stats.mdf) * dPct;
  const el = elementModifier(ak.element, dk.element);
  const fac = facingModifier(defender.pos, defender.facing, attackerPos);
  const cover = coverPercent(state, defender.pos);
  const num = power * aStat * el.num * fac.num * (100 - cover);
  const den = Math.max(1, dStat) * el.den * fac.den * 100;
  const amount = Math.min(defender.hp, roundRatio(num, den));
  return {
    unitId: defender.id,
    kind: 'damage',
    amount,
    hpBefore: defender.hp,
    lethal: amount >= defender.hp,
    breakdown: {
      base: (power * aStat) / Math.max(1, dStat),
      element: el.num / el.den,
      facing: fac.num / fac.den,
      facingAngle: facingAngleDegrees(defender.pos, defender.facing, attackerPos),
      cover,
      attackerAlign: aPct,
      defenderAlign: dPct,
    },
  };
}

export function computeHeal(state: MatchState, caster: Unit, target: Unit, power: number): Effect {
  const ck = kindOf(caster.kind);
  const pct = alignmentPercent(ck.alignment, state.clock);
  const raw = roundRatio(power * ck.stats.mp * pct, 1000);
  const amount = Math.min(raw, 10 - target.hp);
  return { unitId: target.id, kind: 'heal', amount, hpBefore: target.hp, lethal: false };
}

// ---------- Targeting ----------

export function attackTargets(state: MatchState, unit: Unit, from: Hex): Unit[] {
  const a = kindOf(unit.kind).attack;
  return state.units.filter((u) => {
    if (u.hp <= 0 || u.side === unit.side) return false;
    const d = hexDistance(from, u.pos);
    return d >= a.minRange && d <= a.maxRange;
  });
}

type AreaAbility = Extract<MagicAbility, { kind: 'damage' | 'heal' }>;

function matchesTargets(ability: AreaAbility, caster: Unit, u: Unit): boolean {
  if (ability.targets === 'any') return true;
  if (ability.targets === 'ally') return u.side === caster.side;
  return u.side !== caster.side;
}

/** Units affected by an area/single ability centred on `target`. */
export function affectedUnits(state: MatchState, caster: Unit, ability: AreaAbility, target: Hex): Unit[] {
  if (ability.radius === 0) {
    const u = unitAt(state, target);
    return u && matchesTargets(ability, caster, u) ? [u] : [];
  }
  const area = hexesInRange(target, ability.radius);
  return state.units.filter((u) => u.hp > 0 && area.some((h) => hexEq(h, u.pos)) && matchesTargets(ability, caster, u));
}

/** Valid target hexes for a targeted Magic Ability cast from `from`. */
export function magicTargetHexes(state: MatchState, caster: Unit, ability: AreaAbility, from: Hex): Hex[] {
  // The caster will be standing at `from` when casting.
  const moved: Unit = { ...caster, pos: from };
  const view: MatchState = { ...state, units: state.units.map((u) => (u.id === caster.id ? moved : u)) };
  const out: Hex[] = [];
  for (const h of hexesInRange(from, ability.maxRange)) {
    const d = hexDistance(from, h);
    if (d < ability.minRange) continue;
    if (!mapHexAt(state.map, h)) continue;
    if (affectedUnits(view, moved, ability, h).length > 0) out.push(h);
  }
  return out;
}
