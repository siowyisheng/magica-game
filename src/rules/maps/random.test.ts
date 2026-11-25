import { describe, expect, it } from 'vitest';
import { generateRandomMap, RANDOM_MAP_THEMES } from './random';
import { DIRS, neighbor } from '../hex';
import { validateMap } from './validate';
import { hexDistance, hexKey, axialToOffset } from '../hex';
import { surfaceOf } from '../terrain';

const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 13);

describe('random maps', () => {
  const maps = SEEDS.map((s) => ({ seed: s, map: generateRandomMap(s) }));

  it('are the same for the same seed', () => {
    expect(JSON.stringify(generateRandomMap(42))).toBe(JSON.stringify(generateRandomMap(42)));
  });

  const size = (map: (typeof maps)[number]['map']) => ({
    rows: new Set(map.hexes.map((h) => h.hex.r)).size,
    width: Math.max(...map.hexes.map((h) => axialToOffset(h.hex).col)) + 1,
  });

  it('are valid, 16–21 wide and 13–21 tall, with a known Theme', () => {
    for (const { seed, map } of maps) {
      expect(validateMap(map), `seed ${seed}`).toEqual([]);
      const { rows, width } = size(map);
      expect(rows).toBeGreaterThanOrEqual(13);
      expect(rows).toBeLessThanOrEqual(21);
      expect(width).toBeGreaterThanOrEqual(16);
      expect(width).toBeLessThanOrEqual(21);
      expect(Math.min(...map.hexes.map((h) => axialToOffset(h.hex).col))).toBe(0);
      expect(RANDOM_MAP_THEMES).toContain(map.theme);
    }
  });

  it('start the Masters at opposite corners', () => {
    for (const { map } of maps) {
      const { rows, width } = size(map);
      const a = axialToOffset(map.spawns[0]);
      const b = axialToOffset(map.spawns[1]);
      expect(a.col).toBeLessThanOrEqual(1);
      expect(a.row).toBeGreaterThanOrEqual(rows - 2);
      expect(b.col).toBeGreaterThanOrEqual(width - 3);
      expect(b.row).toBeLessThanOrEqual(1);
    }
  });

  /** Water hexes, and how many separate bodies they form. */
  const waterOf = (map: (typeof maps)[number]['map']) => {
    const wet = map.hexes.filter((h) => surfaceOf(h, map.waterLevel) !== 'land');
    const keys = new Set(wet.map((h) => hexKey(h.hex)));
    const seen = new Set<string>();
    let bodies = 0;
    let thin = 0; // water hexes with at most 2 water neighbours: rivers, streams
    for (const h of wet) {
      const around = DIRS.filter((d) => keys.has(hexKey(neighbor(h.hex, d)))).length;
      if (around <= 2) thin++;
      if (seen.has(hexKey(h.hex))) continue;
      bodies++;
      const queue = [h.hex];
      seen.add(hexKey(h.hex));
      while (queue.length) {
        const x = queue.pop()!;
        for (const d of DIRS) {
          const k = hexKey(neighbor(x, d));
          if (keys.has(k) && !seen.has(k)) (seen.add(k), queue.push(neighbor(x, d)));
        }
      }
    }
    const ground = map.hexes.filter((h) => h.terrain !== 'pit').length;
    return { share: wet.length / ground, bodies, thinShare: wet.length ? thin / wet.length : 0, wet };
  };

  it('always have water, all of it Shallow', () => {
    for (const { seed, map } of maps) {
      const { wet } = waterOf(map);
      expect(wet.length, `seed ${seed}`).toBeGreaterThan(0);
      for (const h of wet) expect(surfaceOf(h, map.waterLevel), `seed ${seed}`).toBe('shallow');
    }
  });

  it('give every body of water Wade Entries on at least half its shore', () => {
    for (const { seed, map } of maps) {
      const byKey = new Map(map.hexes.map((h) => [hexKey(h.hex), h]));
      const isWet = (h: (typeof map.hexes)[number]) => h.terrain !== 'pit' && surfaceOf(h, map.waterLevel) !== 'land';
      const seen = new Set<string>();
      for (const start of map.hexes) {
        if (!isWet(start) || seen.has(hexKey(start.hex))) continue;
        const body = [start];
        seen.add(hexKey(start.hex));
        let edges = 0;
        let entries = 0;
        for (let i = 0; i < body.length; i++) {
          for (const d of DIRS) {
            const n = byKey.get(hexKey(neighbor(body[i].hex, d)));
            if (!n || n.terrain === 'pit') continue;
            if (isWet(n)) {
              if (!seen.has(hexKey(n.hex))) (seen.add(hexKey(n.hex)), body.push(n));
            } else {
              edges++;
              if (n.height - body[i].height === 1) entries++;
            }
          }
        }
        if (!edges) continue;
        expect(entries, `seed ${seed}: body at ${hexKey(start.hex)}`).toBeGreaterThanOrEqual(1);
        expect(entries / edges, `seed ${seed}: body at ${hexKey(start.hex)}`).toBeGreaterThanOrEqual(0.5);
      }
    }
  });

  it('vary the amount and shape of water: one body or many, broad or thin', () => {
    const ws = maps.map(({ map }) => waterOf(map));
    const shares = ws.map((w) => w.share);
    expect(Math.min(...shares)).toBeLessThan(0.04);
    expect(Math.max(...shares)).toBeGreaterThan(0.15);
    expect(ws.filter((w) => w.bodies <= 2).length).toBeGreaterThan(20); // one large body (or a river split by fords)
    expect(ws.filter((w) => w.bodies >= 6).length).toBeGreaterThan(20); // scattered pools
    expect(ws.filter((w) => w.thinShare > 0.7).length).toBeGreaterThan(20); // thin rivers and streams
    expect(ws.filter((w) => w.thinShare < 0.3).length).toBeGreaterThan(20); // broad lakes
  });

  it('have 7–12 Stones, mostly 4–7 apart, at least a third on or near the symmetry line', () => {
    let inBand = 0;
    let total = 0;
    for (const { seed, map } of maps) {
      const stones = map.hexes.filter((h) => h.terrain === 'stone').map((h) => h.hex);
      expect(stones.length, `seed ${seed}`).toBeGreaterThanOrEqual(7);
      expect(stones.length).toBeLessThanOrEqual(12);
      for (const s of stones) {
        const nearest = Math.min(...stones.filter((t) => t !== s).map((t) => hexDistance(s, t)));
        expect(nearest).toBeGreaterThanOrEqual(4);
        if (nearest <= 7) inBand++;
        total++;
      }
      const nearLine = stones.filter((s) => Math.abs(hexDistance(s, map.spawns[0]) - hexDistance(s, map.spawns[1])) <= 1).length;
      expect(nearLine, `seed ${seed}`).toBeGreaterThanOrEqual(Math.ceil(stones.length / 3));
    }
    expect(inBand / total).toBeGreaterThan(0.75);
  });

  it('have 3–10 Obstacles per Side, mirrored, and are point-symmetric', () => {
    for (const { seed, map } of maps) {
      const obs = map.obstacles ?? [];
      expect(obs.length % 2).toBe(0);
      expect(obs.length / 2).toBeGreaterThanOrEqual(3);
      expect(obs.length / 2).toBeLessThanOrEqual(10);
      // the turn through the centre: the hex as far from Green as its mirror is from Red
      const byKey = new Map(map.hexes.map((h) => [hexKey(h.hex), h]));
      const sum = { q: map.spawns[0].q + map.spawns[1].q, r: map.spawns[0].r + map.spawns[1].r };
      for (const h of map.hexes) {
        const m = byKey.get(hexKey({ q: sum.q - h.hex.q, r: sum.r - h.hex.r }));
        expect(m, `seed ${seed}: mirror of ${hexKey(h.hex)}`).toBeDefined();
        expect(m!.height, `seed ${seed}: height at ${hexKey(h.hex)}`).toBe(h.height);
        expect(m!.terrain, `seed ${seed}: terrain at ${hexKey(h.hex)}`).toBe(h.terrain);
      }
      const obsKeys = new Set(obs.map((o) => hexKey(o.hex)));
      for (const o of obs) expect(obsKeys.has(hexKey({ q: sum.q - o.hex.q, r: sum.r - o.hex.r }))).toBe(true);
    }
  });

  it('have an odd Stone count about 2/3 of the time, with 1, 3 or 5 exactly on the symmetry line', () => {
    let odd = 0;
    const onLineCounts = new Set<number>();
    for (const { seed, map } of maps) {
      const stones = map.hexes.filter((h) => h.terrain === 'stone').map((h) => h.hex);
      if (stones.length % 2 === 0) continue;
      odd++;
      // the odd one is on the centre hex, the one the turn maps onto itself
      const sum = { q: map.spawns[0].q + map.spawns[1].q, r: map.spawns[0].r + map.spawns[1].r };
      expect(stones.some((s) => 2 * s.q === sum.q && 2 * s.r === sum.r), `seed ${seed}`).toBe(true);
      const onLine = stones.filter((s) => hexDistance(s, map.spawns[0]) === hexDistance(s, map.spawns[1])).length;
      expect([1, 3, 5], `seed ${seed}`).toContain(onLine);
      onLineCounts.add(onLine);
    }
    expect(odd / maps.length).toBeGreaterThan(0.55);
    expect(odd / maps.length).toBeLessThan(0.78);
    expect(onLineCounts.size).toBe(3);
  });

  it('never put a Stone on the edge (next to a missing hex or a Pit)', () => {
    for (const { seed, map } of maps) {
      const byKey = new Map(map.hexes.map((h) => [hexKey(h.hex), h]));
      for (const s of map.hexes.filter((h) => h.terrain === 'stone')) {
        for (const d of DIRS) {
          const n = byKey.get(hexKey(neighbor(s.hex, d)));
          expect(n && n.terrain !== 'pit', `seed ${seed}: Stone at ${hexKey(s.hex)}`).toBeTruthy();
        }
      }
    }
  });

  it('usually have Pits, mostly on the edges', () => {
    let withPits = 0;
    let pits = 0;
    let onEdge = 0;
    for (const { map } of maps) {
      const byKey = new Map(map.hexes.map((h) => [hexKey(h.hex), h]));
      const ps = map.hexes.filter((h) => h.terrain === 'pit');
      if (ps.length) withPits++;
      pits += ps.length;
      // Pits joined (through other Pits) to the map's outer edge
      const outer = new Set(ps.filter((p) => DIRS.some((d) => !byKey.has(hexKey(neighbor(p.hex, d))))).map((p) => hexKey(p.hex)));
      const queue = [...outer];
      while (queue.length) {
        const k = queue.pop()!;
        for (const d of DIRS) {
          const n = byKey.get(hexKey(neighbor(byKey.get(k)!.hex, d)));
          if (n && n.terrain === 'pit' && !outer.has(hexKey(n.hex))) outer.add(hexKey(n.hex)), queue.push(hexKey(n.hex));
        }
      }
      onEdge += outer.size;
      expect(ps.length / map.hexes.length).toBeLessThanOrEqual(0.2);
    }
    expect(withPits / maps.length).toBeGreaterThan(0.9);
    expect(onEdge / pits).toBeGreaterThan(0.75);
  });

  it('vary: sizes, Themes, Stone counts and water styles all differ across seeds', () => {
    const rows = new Set(maps.map(({ map }) => size(map).rows));
    const widths = new Set(maps.map(({ map }) => size(map).width));
    const themes = new Set(maps.map(({ map }) => map.theme));
    const counts = new Set(maps.map(({ map }) => map.hexes.filter((h) => h.terrain === 'stone').length));
    expect(rows.size).toBe(9);
    expect(widths.size).toBe(6);
    expect(themes.size).toBe(RANDOM_MAP_THEMES.length);
    expect(counts.size).toBeGreaterThanOrEqual(5);
  });
});
