// Random map generator: fair (point-symmetric) maps for any seed.
//
// - 16–21 columns × 13–21 rows (odd-r offset). With an odd number of rows the last
//   hex of each odd row is dropped, so the 180° turn through the centre maps the map
//   onto itself exactly. Everything (terrain, Stones, Obstacles) is mirrored through
//   the centre, so both Sides get the same map.
// - The Masters start at opposite corners.
// - Hills, Rough, low ground; always some water, all Shallow, in varying amounts and
//   shapes: one large lake, a few lakes, many small pools, a thin river through the
//   middle with fords, or thin streams; sometimes a second, smaller kind as well.
// - Pits bite into the edges (and sometimes the middle), so each map has its own shape.
// - Heights run from 1 (Shallow Water) to 4. Plateaus at 4 with part of the ground
//   around them dropped to 2, so most edges are 2-Height cliffs and the rest steps:
//   a walking Unit can reach every dry hex but a pillar. About a quarter of maps have
//   a pair of pillars (1–2 hexes) that only Fly reaches.
// - At least half of every body of water's shore is Wade Entries (beaches).
// - 7–12 Magic Stones, mostly 4–7 hexes apart (rarely 2–3), never on the map's edge (every
//   neighbour is a hex that isn't a Pit). About 2/3 of maps have an odd count; those
//   have 1, 3 or 5 Stones exactly on the symmetry line (the hexes as far from one
//   Master as from the other): one on the centre hex, the rest in mirrored pairs.
//   At least a third of all Stones are on or near the line.
// - 3–10 Obstacles per Side, mirrored.
// - Every map is checked: valid (validateMap), and a walking Unit can get from one
//   Master to the other and onto every Stone.

import type { HexTerrain, MapDef, MapHex, MapObstacle, ObstacleDefense, UnitKind } from '../types';
import type { Dir, Hex } from '../hex';
import { facingToward, hexDistance, hexKey, offsetToAxial, DIRS, neighbor } from '../hex';
import { mapHexAt, stepCost } from '../terrain';
import { validateMap } from './validate';

export const RANDOM_MAP_MIN_WIDTH = 16;
export const RANDOM_MAP_MAX_WIDTH = 21;
export const RANDOM_MAP_MIN_ROWS = 13;
export const RANDOM_MAP_MAX_ROWS = 21;
/** Share of maps with an odd number of Magic Stones. */
export const RANDOM_MAP_ODD_STONES = 2 / 3;
/** Theme ids (visual only; the render layer owns their looks). */
export const RANDOM_MAP_THEMES = ['meadow', 'desert', 'ruins', 'tundra', 'volcanic'];

const WATER_LEVEL = 2;
const PLAIN = 3;
const SHALLOW = 1;
const LOW = 2;
/** The highest ground: hilltops, plateaus and pillars. */
const HIGH = 4;
/** Most of the map Pits may take. */
const MAX_PIT_SHARE = 0.18;

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Cell {
  col: number;
  row: number;
  hex: Hex;
  height: number;
  terrain: HexTerrain;
}

class Board {
  readonly cells: Cell[] = [];
  private byKey = new Map<string, Cell>();
  private byOffset = new Map<string, Cell>();
  constructor(
    readonly width: number,
    readonly rows: number,
  ) {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < width; col++) {
        // odd row count: the last hex of each odd row has no mirror
        if (rows % 2 === 1 && row % 2 === 1 && col === width - 1) continue;
        const c: Cell = { col, row, hex: offsetToAxial(col, row), height: PLAIN, terrain: 'plain' };
        this.cells.push(c);
        this.byKey.set(hexKey(c.hex), c);
        this.byOffset.set(`${col},${row}`, c);
      }
    }
  }
  at(h: Hex): Cell | undefined {
    return this.byKey.get(hexKey(h));
  }
  /** The cell the 180° turn through the centre puts this one on. */
  mirror(c: Cell): Cell {
    const row = this.rows - 1 - c.row;
    const centre = this.rows % 2 === 1 ? this.width - 1 : this.width - 0.5;
    const x = centre - (c.col + 0.5 * (c.row & 1));
    const col = x - 0.5 * (row & 1);
    const m = this.byOffset.get(`${col},${row}`);
    if (!m) throw new Error(`no mirror for ${c.col},${c.row}`);
    return m;
  }
  /** The hex the turn maps onto itself, if there is one (odd rows, and the width to match). */
  centre(): Cell | undefined {
    return this.cells.find((c) => this.mirror(c) === c);
  }
  /** Is this cell on the map's edge: next to a hex off the map or a Pit? */
  edge(c: Cell): boolean {
    return DIRS.some((d) => {
      const n = this.at(neighbor(c.hex, d));
      return !n || n.terrain === 'pit';
    });
  }
  /** Apply `f` to every cell within `radius` of `centre`, and copy the result to their mirrors. */
  blob(centre: Cell, radius: number, f: (c: Cell, d: number) => void) {
    for (const c of this.cells) {
      const d = hexDistance(c.hex, centre.hex);
      if (d <= radius) {
        f(c, d);
        const m = this.mirror(c);
        m.height = c.height;
        m.terrain = c.terrain;
      }
    }
  }
}

const isLand = (c: Cell) => c.terrain !== 'pit' && c.height >= WATER_LEVEL;

/** A walking Unit, for the connectivity check. */
const WALKER = { moveTypes: ['walk'] } as unknown as UnitKind;

function walkable(map: MapDef, from: Hex, blocked: Set<string>): Set<string> {
  const seen = new Set<string>([hexKey(from)]);
  const queue: Hex[] = [from];
  while (queue.length) {
    const h = queue.shift()!;
    const mh = mapHexAt(map, h)!;
    for (const d of DIRS) {
      const n = neighbor(h, d);
      const k = hexKey(n);
      if (seen.has(k) || blocked.has(k)) continue;
      const nh = mapHexAt(map, n);
      if (!nh) continue;
      const step = stepCost(WALKER, mh, nh, map.waterLevel);
      if (!step || !step.canStand) continue;
      seen.add(k);
      queue.push(n);
    }
  }
  return seen;
}

function attempt(r: () => number, seed: number, themes: string[], oddStones: boolean, width: number, rows: number): MapDef | null {
  const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const b = new Board(width, rows);
  const anyCell = () => pick(b.cells);
  const centre = b.centre();
  if (oddStones && !centre) throw new Error(`no centre hex on a ${width}×${rows} map`);

  // Masters at opposite corners (one hex in, so they have room)
  const spawn0 = b.at(offsetToAxial(1, rows - 2))!;
  const spawn1 = b.mirror(spawn0);
  const d0 = (c: Cell) => hexDistance(c.hex, spawn0.hex);
  const d1 = (c: Cell) => hexDistance(c.hex, spawn1.hex);
  /** How far off the symmetry line (0: as far from one Master as from the other). */
  const offLine = (c: Cell) => Math.abs(d0(c) - d1(c));

  // ---- relief: hills, low ground, Rough
  for (let i = int(2, 5); i > 0; i--) {
    const radius = int(1, 2);
    b.blob(anyCell(), radius, (c) => {
      c.height = Math.max(c.height, HIGH);
    });
  }
  for (let i = int(0, 2); i > 0; i--) b.blob(anyCell(), 1, (c) => c.height === PLAIN && (c.height = LOW));
  for (let i = int(3, 7); i > 0; i--) b.blob(anyCell(), int(0, 1), (c) => (c.terrain = 'rough'));

  // ---- water: always some, all Shallow, in one of several shapes (sometimes two)
  const water = new Set<Cell>();
  const fords = new Set<Cell>();
  const nbrs = (c: Cell) => DIRS.map((d) => b.at(neighbor(c.hex, d))).filter((n): n is Cell => !!n);
  /** A random connected patch of `size` cells grown from `start`. */
  const grow = (start: Cell, size: number): Cell[] => {
    const got = [start];
    const has = new Set([start]);
    for (let tries = 0; got.length < size && tries < size * 20; tries++) {
      const n = pick(nbrs(pick(got)));
      if (n && !has.has(n)) (got.push(n), has.add(n));
    }
    return got;
  };
  /** A wandering line from `start`, heading for `target` (or keeping its heading), `width` 1 or 2. */
  const wander = (start: Cell, steps: number, target: Cell | null, width: number, stop: (c: Cell) => boolean): Cell[] => {
    const got = [start];
    let cur = start;
    let heading = pick([...DIRS]);
    for (let i = 0; i < steps && !stop(cur); i++) {
      const opts = DIRS.map((d) => ({ d, c: b.at(neighbor(cur.hex, d)) })).filter((o): o is { d: Dir; c: Cell } => !!o.c && !got.includes(o.c));
      if (!opts.length) break;
      const w = (o: { d: Dir; c: Cell }) => {
        if (target) {
          const gain = hexDistance(cur.hex, target.hex) - hexDistance(o.c.hex, target.hex);
          return gain > 0 ? 4 : gain === 0 ? 1 : 0.1;
        }
        return o.d === heading ? 5 : Math.abs(((o.d - heading + 9) % 6) - 3) === 2 ? 1.5 : 0.1;
      };
      let x = r() * opts.reduce((a, o) => a + w(o), 0);
      const next = opts.find((o) => (x -= w(o)) <= 0) ?? opts[opts.length - 1];
      heading = next.d;
      cur = next.c;
      got.push(cur);
      if (width > 1) {
        const side = pick(nbrs(cur));
        if (side && !got.includes(side)) got.push(side);
      }
    }
    return got;
  };
  const away = (c: Cell, k: number) => d0(c) > k && d1(c) > k;
  /** Cells next to (or on) their own mirror: a patch grown from one of these joins its mirror. */
  const middle = centre ? [centre] : b.cells.filter((c) => hexDistance(c.hex, b.mirror(c).hex) <= 1);
  /** Add cells and their mirrors to the water; `apart`: only if nothing touches water already. */
  const flood = (cells: Cell[], apart = false): boolean => {
    const all = cells.flatMap((c) => [c, b.mirror(c)]).filter((c) => away(c, 2));
    if (apart && all.some((c) => water.has(c) || nbrs(c).some((n) => water.has(n) && !all.includes(n)))) return false;
    for (const c of all) water.add(c);
    return true;
  };
  const shapes = ['lake', 'lakes', 'pools', 'river', 'streams'] as const;
  type Shape = (typeof shapes)[number];
  const make = (shape: Shape, scale: number) => {
    const area = b.cells.length;
    switch (shape) {
      case 'lake': // one large body across the middle
        flood(grow(pick(middle), Math.round(area * (0.06 + r() * 0.2) * scale)));
        break;
      case 'lakes': // a few medium bodies
        for (let i = int(1, 3); i > 0; i--) flood(grow(pick(b.cells.filter((c) => away(c, 4))), Math.round(int(5, 24) * scale)), true);
        break;
      case 'pools': // many small, separate pools
        for (let i = int(3, 7); i > 0; i--) flood(grow(pick(b.cells.filter((c) => away(c, 3))), int(1, 4)), true);
        break;
      case 'river': {
        // a thin river through the middle to two opposite edges, with fords
        const ends = b.cells.filter((c) => b.edge(c) && away(c, 5));
        if (!ends.length) break;
        const width = r() < 0.3 && scale === 1 ? 2 : 1;
        const course = wander(pick(middle), 60, pick(ends), width, (c) => b.edge(c));
        flood(course);
        for (let i = int(1, 3); i > 0; i--) {
          const f = pick(course);
          for (const c of [f, ...(width > 1 ? nbrs(f) : [])]) for (const x of [c, b.mirror(c)]) if (water.delete(x)) fords.add(x);
        }
        break;
      }
      case 'streams': // a few thin, wandering streams
        for (let i = int(1, 3); i > 0; i--) flood(wander(pick(b.cells.filter((c) => away(c, 3))), int(4, 10), null, 1, () => false), true);
        break;
    }
  };
  make(pick([...shapes]), 1);
  if (r() < 0.35) make(pick(['lakes', 'pools', 'streams'] as Shape[]), 0.5);
  if (!water.size) return null;
  for (const c of water) ((c.height = SHALLOW), (c.terrain = 'plain'));
  for (const c of fords) ((c.height = LOW), (c.terrain = 'plain'));

  // ---- Pits: bites out of the edges, so every map has its own outline; sometimes a
  // chasm inside. Never near the Masters' corners or the centre.
  const rim = b.cells.filter((c) => b.edge(c) && d0(c) > 4 && d1(c) > 4);
  const pits = () => b.cells.filter((c) => c.terrain === 'pit').length / b.cells.length;
  /** Carve a mirrored blob of Pit, undone if it would make too much of the map Pit. */
  const carve = (at: Cell, radius: number) => {
    const before = b.cells.map((c) => c.terrain);
    b.blob(at, radius, (c, d) => {
      if (d0(c) > 3 && d1(c) > 3 && (d < radius || radius === 0 || r() < 0.6)) c.terrain = 'pit';
    });
    if (pits() > MAX_PIT_SHARE) b.cells.forEach((c, j) => (c.terrain = before[j]));
  };
  for (let i = int(2, 6); i > 0 && rim.length; i--) carve(pick(rim), int(1, 3));
  if (r() < 0.35) {
    const inner = b.cells.filter((c) => !b.edge(c) && d0(c) > 4 && d1(c) > 4 && (!centre || hexDistance(c.hex, centre.hex) > 2));
    if (inner.length) carve(pick(inner), int(0, 1));
  }
  for (const c of b.cells) if (c.terrain === 'pit') c.height = PLAIN;

  // ---- cliffs: plateaus at the top Height (4) with part of the ground around them
  // dropped to low ground (2), so most of the edge is a 2-Height cliff and the rest a
  // step a walking Unit climbs; rarely a pillar (1–2 hexes) with all the ground around
  // it dropped, which only Fly reaches. All mirrored; never touching water, Pits or the
  // Masters' corners.
  const pillars = new Set<Cell>();
  const raised = new Set<Cell>();
  const solid = (c: Cell) => c.terrain !== 'pit' && c.height >= WATER_LEVEL && nbrs(c).every((n) => n.terrain !== 'pit' && n.height >= WATER_LEVEL);
  const setH = (c: Cell, h: number) => (c.height = b.mirror(c).height = h);
  const raise = (cells: Cell[]) => {
    for (const c of cells) for (const x of [c, b.mirror(c)]) ((x.height = HIGH), raised.add(x));
  };
  /** The ground around `cells`, outside them. */
  const ringOf = (cells: Cell[]) => [...new Set(cells.flatMap((c) => nbrs(c)).filter((n) => !cells.includes(n)))];
  const droppable = (c: Cell) => solid(c) && !raised.has(c) && away(c, 3);
  for (let i = int(1, 3); i > 0; i--) {
    const roots = b.cells.filter((c) => solid(c) && away(c, 5) && !raised.has(c) && hexDistance(c.hex, b.mirror(c).hex) > 6);
    if (!roots.length) break;
    const plateau = grow(pick(roots), int(3, 10)).filter((c) => solid(c) && away(c, 4) && !raised.has(c) && hexDistance(c.hex, b.mirror(c).hex) > 3);
    if (plateau.length < 2) continue;
    const ring = ringOf(plateau).filter(droppable);
    raise(plateau);
    // one or two ways up stay at Plain; most of the rest drops to a cliff
    const ways = new Set(Array.from({ length: r() < 0.4 ? 2 : 1 }, () => pick(ring)));
    const cliff = 0.5 + r() * 0.4;
    for (const c of ring) {
      if (ways.has(c)) setH(c, PLAIN);
      else if (r() < cliff) setH(c, LOW);
      raised.add(c);
      raised.add(b.mirror(c));
    }
  }
  if (r() < 0.25) {
    const roots = b.cells.filter((c) => solid(c) && away(c, 4) && !raised.has(c) && nbrs(c).every((n) => !raised.has(n) && droppable(n)) && hexDistance(c.hex, b.mirror(c).hex) > 4);
    if (roots.length) {
      const c = pick(roots);
      const cells = r() < 0.5 ? [c] : [c, ...nbrs(c).filter((n) => roots.includes(n)).slice(0, 1)];
      const ring = ringOf(cells);
      if (ring.every(droppable)) {
        raise(cells);
        for (const n of ring) setH(n, LOW);
        for (const x of cells) (pillars.add(x), pillars.add(b.mirror(x)));
      }
    }
  }

  // ---- the Masters' corners: dry, level, clear
  for (const s of [spawn0, spawn1]) for (const c of b.cells) if (hexDistance(c.hex, s.hex) <= 2) ((c.height = PLAIN), (c.terrain = 'plain'));

  // ---- Magic Stones
  const n = oddStones ? pick([7, 9, 11]) : pick([8, 10, 12]);
  const stones: Cell[] = [];
  /** Stones are kept this far apart as a rule; now and then (or when nothing else fits) only CLOSE_STONES. */
  const SPACING = 4;
  const CLOSE_STONES = 2;
  const spaced = (c: Cell, min: number) => stones.every((s) => hexDistance(s.hex, c.hex) >= min);
  const nearest = (c: Cell) => Math.min(...stones.map((s) => hexDistance(s.hex, c.hex)));
  const free = (c: Cell) => isLand(c) && c.terrain !== 'stone' && !b.edge(c) && d0(c) >= 3 && d1(c) >= 3;
  /**
   * Place a mirrored pair, preferring spots 4–7 hexes from the nearest Stone so far. The
   * spacing is a guideline: about one pair in 12 (or one that fits nowhere else) may sit
   * 2–3 hexes from another Stone.
   */
  const place = (cands: Cell[]): boolean => {
    const fits = (min: number) =>
      cands.filter((c) => {
        const m = b.mirror(c);
        return free(c) && spaced(c, min) && hexDistance(c.hex, m.hex) >= min && free(m) && spaced(m, min);
      });
    let ok = r() < 1 / 12 ? fits(CLOSE_STONES).filter((c) => nearest(c) < SPACING) : [];
    if (!ok.length) ok = fits(SPACING);
    if (!ok.length) ok = fits(CLOSE_STONES);
    if (!ok.length) return false;
    const good = stones.length ? ok.filter((c) => nearest(c) <= 7) : ok;
    const c = pick(good.length ? good : ok);
    const m = b.mirror(c);
    c.terrain = m.terrain = 'stone';
    stones.push(c, m);
    return true;
  };
  if (oddStones) {
    // 1, 3 or 5 exactly on the line: the centre hex (an island if it's water), then pairs
    const c = centre!;
    if (b.edge(c)) return null;
    c.height = c.terrain === 'pit' ? PLAIN : Math.max(c.height, LOW);
    c.terrain = 'stone';
    stones.push(c);
    const onLine = Math.min(pick([1, 3, 5]), n);
    while (stones.length < onLine) if (!place(b.cells.filter((c) => offLine(c) === 0))) return null;
  }
  // at least a third on or near the line (within a hex of it), the rest anywhere;
  // with an odd count, no more exactly on the line
  const offExact = (c: Cell) => !oddStones || offLine(c) > 0;
  const nearLine = Math.ceil(n / 3);
  while (stones.length < nearLine) if (!place(b.cells.filter((c) => offLine(c) <= 1 && offExact(c)))) return null;
  while (stones.length < n) if (!place(b.cells.filter(offExact))) return null;
  if (stones.length !== n) return null;
  // mostly 4–7 apart
  const inBand = stones.filter((s) => {
    const others = stones.filter((t) => t !== s).map((t) => hexDistance(t.hex, s.hex));
    const m = Math.min(...others);
    return m >= 4 && m <= 7;
  }).length;
  if (inBand < stones.length * 0.75) return null;

  // ---- Wade Entries: in every body of water, at least half (50–90%) of the edges to the
  // land around it are beaches, land exactly 1 above the water hex, where wading Units
  // step in and out. Land is lowered to make them, in mirrored pairs.
  const wet = (c: Cell) => c.terrain !== 'pit' && c.height < WATER_LEVEL;
  const dry = (c: Cell) => c.terrain !== 'pit' && c.height >= WATER_LEVEL;
  const seenWet = new Set<Cell>();
  for (const start of b.cells) {
    if (!wet(start) || seenWet.has(start)) continue;
    const body: Cell[] = [start];
    seenWet.add(start);
    for (let i = 0; i < body.length; i++) for (const n of nbrs(body[i])) if (wet(n) && !seenWet.has(n)) (seenWet.add(n), body.push(n));
    const shore = body.flatMap((w) => nbrs(w).filter(dry).map((l) => ({ w, l })));
    if (!shore.length) continue;
    const share = 0.5 + r() * 0.4;
    const entry = (e: { w: Cell; l: Cell }) => e.l.height - e.w.height === 1;
    for (let guard = 0; shore.filter(entry).length < share * shore.length && guard < shore.length; guard++) {
      const bad = shore.filter((e) => !entry(e));
      // grow beaches: prefer land next to an existing one
      const nearBeach = bad.filter((e) => nbrs(e.l).some((n) => dry(n) && n.height === e.w.height + 1 && nbrs(n).some(wet)));
      const { w, l } = pick(nearBeach.length && r() < 0.7 ? nearBeach : bad);
      if (l === spawn0 || l === spawn1) continue;
      l.height = b.mirror(l).height = w.height + 1;
    }
  }

  // ---- Obstacles: 3–10 per Side, mirrored, on dry Plain or Rough
  const obstacles: MapObstacle[] = [];
  const taken = new Set<string>();
  const defs: ObstacleDefense[] = [2, 4, 6];
  const spots = b.cells.filter((c) => isLand(c) && c.terrain !== 'stone' && !pillars.has(c) && d0(c) >= 3 && d1(c) >= 3 && offLine(c) > 0);
  for (let i = int(3, 10); i > 0 && spots.length; ) {
    const c = pick(spots);
    const m = b.mirror(c);
    if (taken.has(hexKey(c.hex)) || taken.has(hexKey(m.hex)) || c === m) continue;
    const def = pick(defs);
    obstacles.push({ hex: c.hex, def }, { hex: m.hex, def });
    taken.add(hexKey(c.hex));
    taken.add(hexKey(m.hex));
    i--;
  }

  // still some water after the corners, Pits and Stones took their share
  if (!b.cells.some((c) => c.terrain !== 'pit' && c.height < WATER_LEVEL)) return null;

  const hexes: MapHex[] = b.cells.map((c) => ({ hex: c.hex, height: c.height, terrain: c.terrain }));
  const mid = b.cells.reduce((a, c) => ({ q: a.q + c.hex.q / b.cells.length, r: a.r + c.hex.r / b.cells.length }), { q: 0, r: 0 });
  const toward = (s: Cell): Dir => facingToward(s.hex, { q: Math.round(mid.q), r: Math.round(mid.r) });
  const map: MapDef = {
    name: `Random ${seed}`,
    theme: pick(themes),
    hexes,
    obstacles,
    waterLevel: WATER_LEVEL,
    startClock: 6 * 60,
    spawns: [spawn0.hex, spawn1.hex],
    spawnFacing: [toward(spawn0), toward(spawn1)],
  };
  if (validateMap(map).length) return null;
  // a walking Unit gets from one Master to the other and onto every Stone
  const reach = walkable(map, spawn0.hex, taken);
  if (!reach.has(hexKey(spawn1.hex)) || !stones.every((s) => reach.has(hexKey(s.hex)))) return null;
  // and onto every dry hex but the pillars (Obstacles aside: they can be broken)
  const open = walkable(map, spawn0.hex, new Set());
  if (b.cells.some((c) => isLand(c) && !pillars.has(c) && !open.has(hexKey(c.hex)))) return null;
  // a pillar is out of a walker's reach
  if ([...pillars].some((c) => open.has(hexKey(c.hex)))) return null;
  return map;
}

/** A random, valid, point-symmetric map. The same seed always gives the same map. */
export function generateRandomMap(seed: number, themes: string[] = RANDOM_MAP_THEMES): MapDef {
  const r = mulberry(seed);
  const oddStones = r() < RANDOM_MAP_ODD_STONES;
  // the size is picked once, so every size turns up as often as it should; only a size
  // that keeps failing (wide and short: no room for the Stones near the line) is re-picked
  const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  let rows = 0;
  let width = 0;
  for (let i = 0; i < 500; i++) {
    if (i % 100 === 0) {
      // An odd Stone count needs a centre hex: an odd number of rows, and a width that puts
      // a hex's centre on the middle of the middle row.
      rows = oddStones ? pick(range(RANDOM_MAP_MIN_ROWS, RANDOM_MAP_MAX_ROWS).filter((n) => n % 2 === 1)) : int(RANDOM_MAP_MIN_ROWS, RANDOM_MAP_MAX_ROWS);
      const midRowOdd = ((rows - 1) / 2) % 2 === 1;
      width = oddStones ? pick(range(RANDOM_MAP_MIN_WIDTH, RANDOM_MAP_MAX_WIDTH).filter((n) => (n % 2 === 0) === midRowOdd)) : int(RANDOM_MAP_MIN_WIDTH, RANDOM_MAP_MAX_WIDTH);
    }
    const map = attempt(r, seed, themes, oddStones, width, rows);
    if (map) return map;
  }
  throw new Error(`no valid random map for seed ${seed}`);
}
