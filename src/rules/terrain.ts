import { type Hex, hexKey, neighbors, hexEq } from './hex';
import type { MapDef, MapHex, MatchState, MoveType, Obstacle, Target, Unit, UnitKind } from './types';
import { kindOf } from './kinds';

export type Surface = 'land' | 'shallow' | 'deep';

const indexCache = new WeakMap<MapDef, Map<string, MapHex>>();

export function mapIndex(map: MapDef): Map<string, MapHex> {
  let idx = indexCache.get(map);
  if (!idx) {
    idx = new Map();
    for (const h of map.hexes) idx.set(hexKey(h.hex), h);
    indexCache.set(map, idx);
  }
  return idx;
}

export function mapHexAt(map: MapDef, h: Hex): MapHex | undefined {
  return mapIndex(map).get(hexKey(h));
}

export function surfaceOf(mh: MapHex, waterLevel: number): Surface {
  if (mh.terrain === 'pit') return 'land'; // Pits never fill with water
  const depth = waterLevel - mh.height;
  if (depth >= 2) return 'deep';
  if (depth === 1) return 'shallow';
  return 'land';
}

/** Height used for climbing: water hexes count as being at the Water Level. */
export function surfaceHeight(mh: MapHex, waterLevel: number): number {
  if (mh.terrain === 'pit') return mh.height;
  return Math.max(mh.height, waterLevel);
}

function typeCost(t: MoveType, mh: MapHex, surface: Surface): { cost: number; stand: boolean } | null {
  // Pits: only Fly can cross, and nobody can stand there.
  if (mh.terrain === 'pit') return t === 'fly' ? { cost: 1, stand: false } : null;
  switch (t) {
    case 'fly':
      return { cost: 1, stand: surface === 'land' };
    case 'walk':
      if (surface !== 'land') return null;
      return { cost: mh.terrain === 'rough' ? 2 : 1, stand: true };
    case 'slow':
      if (surface !== 'land') return null;
      return { cost: mh.terrain === 'rough' ? 3 : 2, stand: true };
    case 'swim':
      if (surface === 'land') return null;
      return { cost: 1, stand: true };
    case 'wade':
      if (surface !== 'shallow') return null;
      return { cost: 2, stand: true };
  }
}

/**
 * A Wade Entry: the edge between a land hex and a Shallow Water hex exactly 1
 * below it, where a wading Unit can step in or out.
 */
export function isWadeEntry(land: MapHex, water: MapHex): boolean {
  return land.terrain !== 'pit' && land.height - water.height === 1;
}

/**
 * Cost for a Unit of `kind` to step from `from` into `to`, using the cheapest
 * applicable Move Type. `canStand` is true when any of its Move Types may end
 * there. Returns null when impassable.
 */
export function stepCost(
  kind: UnitKind,
  from: MapHex,
  to: MapHex,
  waterLevel: number,
): { cost: number; canStand: boolean } | null {
  const surface = surfaceOf(to, waterLevel);
  const fromSurface = surfaceOf(from, waterLevel);
  const swims = kind.moveTypes.includes('swim');
  /** A step between land and Shallow Water. */
  const shoreStep =
    fromSurface === 'land' && surface === 'shallow' ? { land: from, water: to } : fromSurface === 'shallow' && surface === 'land' && to.terrain !== 'pit' ? { land: to, water: from } : null;
  const dh = surfaceHeight(to, waterLevel) - surfaceHeight(from, waterLevel);
  let best: number | null = null;
  let canStand = false;
  for (const t of kind.moveTypes) {
    const c = typeCost(t, to, surface);
    if (!c) continue;
    let cost = c.cost;
    // Wading in (Wade) and out (Walk / Slow) of Shallow Water only at a Wade Entry; swimmers are free
    if (shoreStep && t !== 'fly' && !swims && !isWadeEntry(shoreStep.land, shoreStep.water)) continue;
    if (t !== 'fly') {
      if (dh > 1 || dh < -1) continue;
      if (dh === 1) cost += 1;
    }
    if (best === null || cost < best) best = cost;
    if (c.stand) canStand = true;
  }
  return best === null ? null : { cost: best, canStand };
}

export function canStandOn(kind: UnitKind, mh: MapHex, waterLevel: number): boolean {
  const surface = surfaceOf(mh, waterLevel);
  return kind.moveTypes.some((t) => typeCost(t, mh, surface)?.stand ?? false);
}

export function isStranded(state: MatchState, unit: Unit): boolean {
  const mh = mapHexAt(state.map, unit.pos);
  return !mh || !canStandOn(kindOf(unit.kind), mh, state.waterLevel);
}

export function unitAt(state: MatchState, h: Hex): Unit | undefined {
  return state.units.find((u) => u.hp > 0 && hexEq(u.pos, h));
}

export function obstacleAt(state: MatchState, h: Hex): Obstacle | undefined {
  return state.obstacles.find((o) => o.hp > 0 && hexEq(o.pos, h));
}

export function targetById(state: MatchState, id: number): Target | undefined {
  return state.units.find((u) => u.id === id) ?? state.obstacles.find((o) => o.id === id);
}

/** The Unit or Obstacle on a hex. */
export function targetAt(state: MatchState, h: Hex): Target | undefined {
  return unitAt(state, h) ?? obstacleAt(state, h);
}

/**
 * Whether a Unit of `kind` could be placed on `h` (e.g. summoned): on the map,
 * standable, and free of Units (other than `ignoreId`) and Obstacles.
 */
export function canPlace(state: MatchState, kind: UnitKind, h: Hex, ignoreId?: number): boolean {
  const mh = mapHexAt(state.map, h);
  if (!mh || !canStandOn(kind, mh, state.waterLevel) || obstacleAt(state, h)) return false;
  const occ = unitAt(state, h);
  return !occ || occ.id === ignoreId;
}

/** Hexes in the Zone of Control of `side`'s enemies. */
export function enemyZoc(state: MatchState, side: number): Set<string> {
  const zoc = new Set<string>();
  for (const e of state.units) {
    if (e.side === side || e.hp <= 0) continue;
    const ek = kindOf(e.kind);
    const from = mapHexAt(state.map, e.pos);
    if (!from) continue;
    for (const n of neighbors(e.pos)) {
      const to = mapHexAt(state.map, n);
      if (!to || obstacleAt(state, n)) continue;
      const c = stepCost(ek, from, to, state.waterLevel);
      if (c && c.canStand) zoc.add(hexKey(n));
    }
  }
  return zoc;
}

export interface ReachNode {
  hex: Hex;
  cost: number;
  prev: string | null;
  /** True when the Unit may end its move here. */
  canEnd: boolean;
}

/** All hexes the Unit can reach this turn (Dijkstra, deterministic). */
export function reachable(state: MatchState, unit: Unit): Map<string, ReachNode> {
  const kind = kindOf(unit.kind);
  const out = new Map<string, ReachNode>();
  const startKey = hexKey(unit.pos);
  out.set(startKey, { hex: unit.pos, cost: 0, prev: null, canEnd: true });

  const flies = kind.moveTypes.includes('fly');
  const zoc = flies ? new Set<string>() : enemyZoc(state, unit.side);
  // occupancy, built once (the search looks at every hex's neighbours)
  const occupant = new Map<string, Unit>();
  for (const u of state.units) if (u.hp > 0) occupant.set(hexKey(u.pos), u);
  const blocked = new Set<string>();
  for (const o of state.obstacles) if (o.hp > 0) blocked.add(hexKey(o.pos));
  const mov = kind.stats.mov;
  const done = new Set<string>();
  const frontier: string[] = [startKey];

  while (frontier.length > 0) {
    // pick lowest cost; ties keep insertion order (deterministic)
    let bi = 0;
    for (let i = 1; i < frontier.length; i++) {
      if (out.get(frontier[i])!.cost < out.get(frontier[bi])!.cost) bi = i;
    }
    const curKey = frontier.splice(bi, 1)[0];
    if (done.has(curKey)) continue;
    done.add(curKey);
    const cur = out.get(curKey)!;
    if (curKey !== startKey && zoc.has(curKey)) continue; // must stop here
    const from = mapHexAt(state.map, cur.hex)!;

    for (const n of neighbors(cur.hex)) {
      const nk = hexKey(n);
      if (done.has(nk)) continue;
      const to = mapHexAt(state.map, n);
      if (!to) continue;
      const occ = occupant.get(nk);
      if (occ && occ.side !== unit.side) continue;
      // Obstacles: Fly passes over them, nobody can stop on them.
      const obstacle = blocked.has(nk);
      if (obstacle && !flies) continue;
      const step = stepCost(kind, from, to, state.waterLevel);
      if (!step) continue;
      const cost = cur.cost + step.cost;
      if (cost > mov) continue;
      const prev = out.get(nk);
      if (!prev || cost < prev.cost) {
        out.set(nk, { hex: n, cost, prev: curKey, canEnd: step.canStand && !occ && !obstacle });
        frontier.push(nk);
      }
    }
  }
  return out;
}

export function pathTo(nodes: Map<string, ReachNode>, dest: Hex): Hex[] {
  const path: Hex[] = [];
  let k: string | null = hexKey(dest);
  while (k) {
    const n = nodes.get(k);
    if (!n) break;
    path.unshift(n.hex);
    k = n.prev;
  }
  return path;
}
