// Random map generator: fair (point-symmetric) maps for any seed.
//
// - 18 columns × 13–18 rows (odd-r offset). With an odd number of rows the last
//   hex of each odd row is dropped, so the 180° turn maps the map onto itself exactly.
// - The Masters start at opposite corners; everything else is mirrored through the
//   centre, so both Sides get the same map.
// - Hills, Rough, low ground; always some water (lakes, a river along the
//   symmetry line with fords, or both), with varying amounts of Shallow and Deep.
// - 7–12 Magic Stones, mostly 4–7 hexes apart; at least a third on or near the
//   symmetry line (the hexes about as far from one Master as from the other).
//   Stones come in mirrored pairs; an odd one sits exactly on the line.
// - 3–10 Obstacles per Side, mirrored.
// - Every map is checked: valid (validateMap), and a walking Unit can get from one
//   Master to the other and onto every Stone.

import type { HexTerrain, MapDef, MapHex, MapObstacle, ObstacleDefense, UnitKind } from '../types';
import type { Dir, Hex } from '../hex';
import { facingToward, hexDistance, hexKey, offsetToAxial, DIRS, neighbor } from '../hex';
import { mapHexAt, stepCost } from '../terrain';
import { validateMap } from './validate';

export const RANDOM_MAP_WIDTH = 18;
export const RANDOM_MAP_MIN_ROWS = 13;
export const RANDOM_MAP_MAX_ROWS = 18;
/** Theme ids (visual only; the render layer owns their looks). */
export const RANDOM_MAP_THEMES = ['meadow', 'desert', 'ruins', 'tundra', 'volcanic'];

const WATER_LEVEL = 2;
const PLAIN = 3;
const DEEP = -1;
const SHALLOW = 1;
const LOW = 2;

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
  constructor(readonly rows: number) {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < RANDOM_MAP_WIDTH; col++) {
        // odd row count: the last hex of each odd row has no mirror
        if (rows % 2 === 1 && row % 2 === 1 && col === RANDOM_MAP_WIDTH - 1) continue;
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
    const centre = this.rows % 2 === 1 ? RANDOM_MAP_WIDTH - 1 : RANDOM_MAP_WIDTH - 0.5;
    const x = centre - (c.col + 0.5 * (c.row & 1));
    const col = x - 0.5 * (row & 1);
    const m = this.byOffset.get(`${col},${row}`);
    if (!m) throw new Error(`no mirror for ${c.col},${c.row}`);
    return m;
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

function attempt(r: () => number, seed: number, themes: string[]): MapDef | null {
  const rows = RANDOM_MAP_MIN_ROWS + Math.floor(r() * (RANDOM_MAP_MAX_ROWS - RANDOM_MAP_MIN_ROWS + 1));
  const b = new Board(rows);
  const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const anyCell = () => pick(b.cells);
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

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
    const peak = r() < 0.5;
    b.blob(anyCell(), radius, (c, d) => {
      c.height = Math.max(c.height, d === 0 && peak ? 5 : 4);
    });
  }
  for (let i = int(1, 3); i > 0; i--) b.blob(anyCell(), 1, (c) => c.height === PLAIN && (c.height = LOW));
  for (let i = int(3, 7); i > 0; i--) b.blob(anyCell(), int(0, 1), (c) => (c.terrain = 'rough'));

  // ---- water: always some; lakes, a river along the symmetry line, or both
  const style = pick(['lakes', 'river', 'both']);
  const deepShare = 0.25 + r() * 0.6;
  if (style !== 'river') {
    for (let i = int(1, 3); i > 0; i--) {
      const radius = int(1, 2);
      b.blob(anyCell(), radius, (c, d) => {
        const h = d === 0 ? (r() < deepShare ? DEEP : SHALLOW) : d < radius ? (r() < deepShare / 2 ? DEEP : SHALLOW) : LOW;
        c.height = Math.min(c.height, h);
        c.terrain = c.terrain === 'rough' && h < WATER_LEVEL ? 'plain' : c.terrain;
      });
    }
  }
  if (style !== 'lakes') {
    const band = style === 'river' ? 1 : 0;
    for (const c of b.cells) {
      const o = offLine(c);
      if (o > band) continue;
      c.height = Math.min(c.height, o === 0 && r() < deepShare ? DEEP : SHALLOW);
      c.terrain = 'plain';
      const m = b.mirror(c);
      m.height = c.height;
      m.terrain = 'plain';
    }
    // fords: low land across the river, in mirrored pairs
    const line = b.cells.filter((c) => offLine(c) <= band);
    for (let i = int(1, 2); i > 0 && line.length; i--) b.blob(pick(line), 1, (c) => c.height < WATER_LEVEL && (c.height = LOW));
  }

  // ---- the Masters' corners: dry, level, clear
  for (const s of [spawn0, spawn1]) for (const c of b.cells) if (hexDistance(c.hex, s.hex) <= 2) ((c.height = PLAIN), (c.terrain = 'plain'));

  // water rules: some Deep, and not too much low ground (the map validator checks the rest)
  if (!b.cells.some((c) => c.height <= DEEP)) {
    const shallow = b.cells.filter((c) => c.height === SHALLOW);
    if (!shallow.length) return null;
    const c = pick(shallow);
    c.height = DEEP;
    b.mirror(c).height = DEEP;
  }

  // ---- Magic Stones
  const n = int(7, 12);
  const stones: Cell[] = [];
  const spaced = (c: Cell) => stones.every((s) => hexDistance(s.hex, c.hex) >= 4);
  const nearest = (c: Cell) => Math.min(...stones.map((s) => hexDistance(s.hex, c.hex)));
  const free = (c: Cell) => isLand(c) && c.terrain !== 'stone' && d0(c) >= 3 && d1(c) >= 3;
  /** Prefer spots 4–7 hexes from the nearest Stone so far. */
  const place = (cands: Cell[], paired: boolean): boolean => {
    const ok = cands.filter((c) => free(c) && spaced(c) && (!paired || (hexDistance(c.hex, b.mirror(c).hex) >= 4 && free(b.mirror(c)) && spaced(b.mirror(c)))));
    if (!ok.length) return false;
    const good = stones.length ? ok.filter((c) => nearest(c) <= 7) : ok;
    const c = pick(good.length ? good : ok);
    c.terrain = 'stone';
    stones.push(c);
    if (paired) {
      const m = b.mirror(c);
      m.terrain = 'stone';
      stones.push(m);
    }
    return true;
  };
  // an odd count: one Stone exactly on the line, nearest the centre (made into an island if it's water)
  if (n % 2 === 1) {
    const onLine = b.cells.filter((c) => offLine(c) === 0 && d0(c) >= 3).sort((a, c) => Math.abs(d0(a) - rows / 2) - Math.abs(d0(c) - rows / 2) || hexDistance(a.hex, spawn0.hex) - hexDistance(c.hex, spawn0.hex));
    const c = onLine[Math.floor(r() * Math.min(3, onLine.length))];
    if (!c) return null;
    if (c.height < LOW) c.height = LOW;
    c.terrain = 'stone';
    stones.push(c);
  }
  // at least a third on or near the line (within a hex of it), the rest anywhere
  const nearLine = Math.ceil(n / 3);
  while (stones.length < nearLine) if (!place(b.cells.filter((c) => offLine(c) <= 1), true)) return null;
  while (stones.length < n) if (!place(b.cells, true)) return null;
  if (stones.length !== n) return null;
  // mostly 4–7 apart
  const inBand = stones.filter((s) => {
    const others = stones.filter((t) => t !== s).map((t) => hexDistance(t.hex, s.hex));
    const m = Math.min(...others);
    return m >= 4 && m <= 7;
  }).length;
  if (inBand < stones.length * 0.75) return null;

  // ---- Obstacles: 3–10 per Side, mirrored, on dry Plain or Rough
  const obstacles: MapObstacle[] = [];
  const taken = new Set<string>();
  const defs: ObstacleDefense[] = [2, 4, 6];
  const spots = b.cells.filter((c) => isLand(c) && c.terrain !== 'stone' && d0(c) >= 3 && d1(c) >= 3 && offLine(c) > 0);
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

  const hexes: MapHex[] = b.cells.map((c) => ({ hex: c.hex, height: c.height, terrain: c.terrain }));
  const centre = b.cells.reduce((a, c) => ({ q: a.q + c.hex.q / b.cells.length, r: a.r + c.hex.r / b.cells.length }), { q: 0, r: 0 });
  const toward = (s: Cell): Dir => facingToward(s.hex, { q: Math.round(centre.q), r: Math.round(centre.r) });
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
  return map;
}

/** A random, valid, point-symmetric map. The same seed always gives the same map. */
export function generateRandomMap(seed: number, themes: string[] = RANDOM_MAP_THEMES): MapDef {
  const r = mulberry(seed);
  for (let i = 0; i < 500; i++) {
    const map = attempt(r, seed, themes);
    if (map) return map;
  }
  throw new Error(`no valid random map for seed ${seed}`);
}
