// Walking distance for the AI: how many steps a Unit of some kind needs to reach
// a hex over the terrain (cliffs, water, Pits), not the straight-line distance.
// Units and Obstacles are ignored (they move or can be broken). Cached per map,
// Water Level, Move Types and target.

import { DIRS, hexKey, neighbor, type Hex } from '../rules/hex';
import { mapHexAt, stepCost } from '../rules/terrain';
import type { MapDef, MatchState, UnitKind } from '../rules/types';

/** Added to the straight-line distance of a hex the kind can't walk to the target from. */
const UNREACHABLE_PENALTY = 12;

const cache = new WeakMap<MapDef, Map<string, Map<string, number>>>();

/** Steps from every hex the kind can get there from to `target` (or next to it, if it can't stand on it). */
function field(state: MatchState, kind: UnitKind, target: Hex): Map<string, number> {
  let perMap = cache.get(state.map);
  if (!perMap) cache.set(state.map, (perMap = new Map()));
  const key = `${state.waterLevel}|${[...kind.moveTypes].sort().join('+')}|${hexKey(target)}`;
  const hit = perMap.get(key);
  if (hit) return hit;
  // backwards from the target: a hex is one step further than a neighbour it can step to
  const dist = new Map<string, number>();
  const queue: Hex[] = [];
  const seed = (h: Hex, d: number) => {
    if (!mapHexAt(state.map, h) || dist.has(hexKey(h))) return;
    dist.set(hexKey(h), d);
    queue.push(h);
  };
  seed(target, 0);
  // a target nothing can step onto (a pillar, water to a walker): next to it will do
  const into = (h: Hex) => DIRS.some((d) => {
    const from = mapHexAt(state.map, neighbor(h, d));
    const to = mapHexAt(state.map, h);
    return !!from && !!to && !!stepCost(kind, from, to, state.waterLevel);
  });
  if (!into(target)) for (const d of DIRS) seed(neighbor(target, d), 1);
  for (let i = 0; i < queue.length; i++) {
    const h = queue[i];
    const to = mapHexAt(state.map, h)!;
    const d = dist.get(hexKey(h))!;
    for (const dir of DIRS) {
      const p = neighbor(h, dir);
      const from = mapHexAt(state.map, p);
      if (!from || dist.has(hexKey(p))) continue;
      if (!stepCost(kind, from, to, state.waterLevel)) continue;
      dist.set(hexKey(p), d + 1);
      queue.push(p);
    }
  }
  perMap.set(key, dist);
  return dist;
}

/** Steps a Unit of `kind` at `from` needs to reach `target` over the terrain. */
export function pathDistance(state: MatchState, kind: UnitKind, from: Hex, target: Hex, straight: number): number {
  const d = field(state, kind, target).get(hexKey(from));
  return d ?? straight + UNREACHABLE_PENALTY;
}
