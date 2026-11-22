// Move Range, Attack Reach, Magic Reach and targeting plans (pure).

import { type Hex, hexDistance, hexEq, hexKey, hexesInRange } from './hex';
import { affectedUnits, facingBonusX2, minAimDistance, shotAllowed, trajectoryOf } from './combat';
import { kindOf } from './kinds';
import { mapHexAt, reachable } from './terrain';
import { isObstacle, type MagicAbility, type MatchState, type Target, type Trajectory, type Unit } from './types';

type TargetedMagic = Extract<MagicAbility, { kind: 'damage' | 'heal' }>;

/** The targeted Magic Ability used for Magic Reach and quick actions (first one; Bolt for Summoners). */
export function primaryMagic(unit: Unit): TargetedMagic | null {
  for (const m of kindOf(unit.kind).magic) if (m.kind !== 'water') return m;
  return null;
}

/** Hexes the Unit can end its move on (including staying put), in deterministic order. */
export function moveRange(state: MatchState, unit: Unit): Hex[] {
  const out: Hex[] = [];
  for (const n of reachable(state, unit).values()) if (n.canEnd) out.push(n.hex);
  return out;
}

/** Hexes the Unit could Attack or cast Magic from: a Stranded unit must move first. */
function actionSources(state: MatchState, unit: Unit): Hex[] {
  const dests = moveRange(state, unit);
  return unit.stranded ? dests.filter((h) => !hexEq(h, unit.pos)) : dests;
}

function reachFrom(
  state: MatchState,
  unit: Unit,
  dests: Hex[],
  min: number,
  max: number,
  radius: number,
  trajectory: Trajectory | null,
): Map<string, Hex> {
  const out = new Map<string, Hex>();
  for (const d of dests) {
    const view = withUnitAt(state, unit.id, d);
    for (const h of hexesInRange(d, max + radius)) {
      const k = hexKey(h);
      if (out.has(k) || !mapHexAt(state.map, h)) continue;
      // some aim hex within [min,max] of d covers h within `radius`
      const dist = hexDistance(d, h);
      if (dist > max + radius) continue;
      if (radius === 0) {
        if (dist >= min && shotAllowed(view, unit.id, trajectory, d, h)) out.set(k, h);
      } else if (dist >= Math.max(0, min - radius)) {
        // an aim hex in range, with a clear shot if Direct, whose area covers h
        const ok = hexesInRange(h, radius).some((a) => {
          const da = hexDistance(d, a);
          return da >= min && da <= max && !!mapHexAt(state.map, a) && shotAllowed(view, unit.id, trajectory, d, a);
        });
        if (ok) out.set(k, h);
      }
    }
  }
  return out;
}

export interface Reach {
  move: Map<string, Hex>;
  attack: Map<string, Hex>;
  magic: Map<string, Hex>;
}

export function unitReach(state: MatchState, unit: Unit): Reach {
  const dests = moveRange(state, unit);
  const k = kindOf(unit.kind);
  const move = new Map(dests.map((h) => [hexKey(h), h] as const));
  const sources = actionSources(state, unit);
  const attack = reachFrom(state, unit, sources, 1, k.attack.range, 0, trajectoryOf(k.attack));
  const m = primaryMagic(unit);
  const magic = m ? reachFrom(state, unit, sources, minAimDistance(m), m.range, m.radius, trajectoryOf(m)) : new Map<string, Hex>();
  return { move, attack, magic };
}

export interface TargetPlan {
  /** Chosen destination hex. */
  dest: Hex;
  /** Every Move Range hex from which the target can be hit. */
  sources: Hex[];
}

/**
 * Best destination from which `unit` can hit `target`: highest Facing
 * Modifier, then farther from the target, then not moving, then the first in
 * deterministic order.
 */
function bestSource(unit: Unit, target: Target, sources: Hex[], useFacing: boolean): Hex {
  let best = sources[0];
  let bestScore: [number, number, number] = [-1, -1, -1];
  for (const h of sources) {
    const f = useFacing && !isObstacle(target) ? facingBonusX2(target.pos, target.facing, h) : 0;
    const score: [number, number, number] = [f, hexDistance(h, target.pos), hexEq(h, unit.pos) ? 1 : 0];
    const better =
      score[0] > bestScore[0] + 1e-12 ||
      (Math.abs(score[0] - bestScore[0]) <= 1e-12 &&
        (score[1] > bestScore[1] || (score[1] === bestScore[1] && score[2] > bestScore[2])));
    if (better) {
      best = h;
      bestScore = score;
    }
  }
  return best;
}

function withUnitAt(state: MatchState, id: number, pos: Hex): MatchState {
  return { ...state, units: state.units.map((u) => (u.id === id ? { ...u, pos } : u)) };
}

/** `ignoreClearAngle` plans as if nothing blocked Direct shots (to tell "out of reach" from "no clear shot"). */
export function planAttack(state: MatchState, unit: Unit, target: Target, ignoreClearAngle = false): TargetPlan | null {
  if (target.id === unit.id || (!isObstacle(target) && target.side === unit.side)) return null;
  const a = kindOf(unit.kind).attack;
  const traj = ignoreClearAngle ? null : trajectoryOf(a);
  const sources = actionSources(state, unit).filter((h) => {
    const d = hexDistance(h, target.pos);
    return d >= 1 && d <= a.range && shotAllowed(withUnitAt(state, unit.id, h), unit.id, traj, h, target.pos);
  });
  if (!sources.length) return null;
  return { dest: bestSource(unit, target, sources, true), sources };
}

export interface MagicPlan extends TargetPlan {
  ability: TargetedMagic;
  affordable: boolean;
}

/** Plan a quick Magic aimed at the target's hex. */
export function planMagic(state: MatchState, unit: Unit, target: Target, ignoreClearAngle = false): MagicPlan | null {
  const ab = primaryMagic(unit);
  if (!ab || target.id === unit.id) return null;
  const traj = ignoreClearAngle ? null : trajectoryOf(ab);
  const sources = actionSources(state, unit).filter((h) => {
    const d = hexDistance(h, target.pos);
    if (d < minAimDistance(ab) || d > ab.range) return false;
    const view = withUnitAt(state, unit.id, h);
    if (!shotAllowed(view, unit.id, traj, h, target.pos)) return false;
    const caster = view.units.find((u) => u.id === unit.id)!;
    return affectedUnits(view, caster, ab, target.pos).some((u) => u.id === target.id);
  });
  if (!sources.length) return null;
  return {
    dest: bestSource(unit, target, sources, ab.kind === 'damage'),
    sources,
    ability: ab,
    affordable: state.sides[unit.side].mana >= ab.manaCost,
  };
}
