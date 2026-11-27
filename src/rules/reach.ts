// Move Range, Reach (where a Unit's Ability could hit) and targeting plans (pure).

import { type Hex, hexDistance, hexEq, hexKey, hexesInRange } from './hex';
import { affectedUnits, facingBonus, minAimDistance, shotAllowed, trajectoryOf } from './combat';
import { kindOf } from './kinds';
import { mapHexAt, reachable } from './terrain';
import { isObstacle, type MatchState, type Target, type Trajectory, type Unit } from './types';
import type { AreaAbility } from './combat';

/** The Unit's Ability when it is aimed at hexes (every one but Rise and Ebb). */
export function targetedAbility(unit: Unit): AreaAbility | null {
  const a = kindOf(unit).ability;
  return a.kind === 'water' ? null : a;
}

/** Hexes the Unit can end its move on (including staying put), in deterministic order. */
export function moveRange(state: MatchState, unit: Unit): Hex[] {
  const out: Hex[] = [];
  for (const n of reachable(state, unit).values()) if (n.canEnd) out.push(n.hex);
  return out;
}

/** Hexes the Unit could Act from: a Stranded unit must move first. */
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
      const mh = mapHexAt(state.map, h);
      if (out.has(k) || !mh || mh.terrain === 'pit') continue; // nothing ever stands on a Pit
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
  /** Every hex its Ability could hit from somewhere in its Move Range. */
  act: Map<string, Hex>;
}

export function unitReach(state: MatchState, unit: Unit): Reach {
  const dests = moveRange(state, unit);
  const move = new Map(dests.map((h) => [hexKey(h), h] as const));
  const sources = actionSources(state, unit);
  const ab = targetedAbility(unit);
  const act = ab ? reachFrom(state, unit, sources, minAimDistance(ab), ab.range, ab.radius, trajectoryOf(ab)) : new Map<string, Hex>();
  return { move, act };
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
    const f = useFacing && !isObstacle(target) ? facingBonus(target.pos, target.facing, h) : 0;
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

/** A quick Act on a target: where to stand and where to aim. */
export interface ActPlan extends TargetPlan {
  ability: AreaAbility;
  /** Where to aim from `dest`: the target's hex, or `dest` itself for a Burst. */
  aim: Hex;
}

/**
 * Plan a quick Act on `target`: hit it (damage), or help it (heal, Empower).
 * `ignoreClearAngle` plans as if nothing blocked shots, Height included (to
 * tell "out of reach" from "no clear shot").
 */
export function planAct(state: MatchState, unit: Unit, target: Target, ignoreClearAngle = false): ActPlan | null {
  const ab = targetedAbility(unit);
  if (!ab) return null;
  const traj = ignoreClearAngle ? 'high' : trajectoryOf(ab);
  // a Burst (or a help aimed at itself) is aimed at where the Unit stands
  const aimFrom = (h: Hex) => (ab.burst || target.id === unit.id ? h : target.pos);
  const sources = actionSources(state, unit).filter((h) => {
    const aim = aimFrom(h);
    if (!mapHexAt(state.map, aim)) return false;
    const d = hexDistance(h, aim);
    if (d < minAimDistance(ab) || d > ab.range) return false;
    const view = withUnitAt(state, unit.id, h);
    if (!shotAllowed(view, unit.id, traj, h, aim)) return false;
    const caster = view.units.find((u) => u.id === unit.id)!;
    return affectedUnits(view, caster, ab, aim).some((u) => u.id === target.id);
  });
  if (!sources.length) return null;
  const dest = bestSource(unit, target, sources, ab.kind === 'damage');
  return { dest, sources, ability: ab, aim: aimFrom(dest) };
}
