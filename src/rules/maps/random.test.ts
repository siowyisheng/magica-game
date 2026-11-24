import { describe, expect, it } from 'vitest';
import { generateRandomMap, RANDOM_MAP_THEMES } from './random';
import { validateMap } from './validate';
import { hexDistance, hexKey, axialToOffset } from '../hex';
import { surfaceOf } from '../terrain';

const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 13);

describe('random maps', () => {
  const maps = SEEDS.map((s) => ({ seed: s, map: generateRandomMap(s) }));

  it('are the same for the same seed', () => {
    expect(JSON.stringify(generateRandomMap(42))).toBe(JSON.stringify(generateRandomMap(42)));
  });

  it('are valid, 18 wide and 13–18 tall, with a known Theme', () => {
    for (const { seed, map } of maps) {
      expect(validateMap(map), `seed ${seed}`).toEqual([]);
      const rows = new Set(map.hexes.map((h) => h.hex.r));
      expect(rows.size).toBeGreaterThanOrEqual(13);
      expect(rows.size).toBeLessThanOrEqual(18);
      const cols = map.hexes.map((h) => axialToOffset(h.hex).col);
      expect(Math.min(...cols)).toBe(0);
      expect(Math.max(...cols)).toBe(17);
      expect(RANDOM_MAP_THEMES).toContain(map.theme);
    }
  });

  it('start the Masters at opposite corners', () => {
    for (const { map } of maps) {
      const rows = new Set(map.hexes.map((h) => h.hex.r)).size;
      const a = axialToOffset(map.spawns[0]);
      const b = axialToOffset(map.spawns[1]);
      expect(a.col).toBeLessThanOrEqual(1);
      expect(a.row).toBeGreaterThanOrEqual(rows - 2);
      expect(b.col).toBeGreaterThanOrEqual(15);
      expect(b.row).toBeLessThanOrEqual(1);
    }
  });

  it('always have water, with some Deep', () => {
    for (const { map } of maps) {
      const surf = map.hexes.map((h) => surfaceOf(h, map.waterLevel));
      expect(surf.some((s) => s !== 'land')).toBe(true);
      expect(map.hexes.some((h) => map.waterLevel - 1 - h.height >= 2)).toBe(true);
    }
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
        if (h.terrain !== 'stone' && m!.terrain !== 'stone') {
          expect(m!.height).toBe(h.height);
          expect(m!.terrain).toBe(h.terrain);
        }
      }
      const obsKeys = new Set(obs.map((o) => hexKey(o.hex)));
      for (const o of obs) expect(obsKeys.has(hexKey({ q: sum.q - o.hex.q, r: sum.r - o.hex.r }))).toBe(true);
    }
  });

  it('vary: rows, Themes, Stone counts and water styles all differ across seeds', () => {
    const rows = new Set(maps.map(({ map }) => new Set(map.hexes.map((h) => h.hex.r)).size));
    const themes = new Set(maps.map(({ map }) => map.theme));
    const counts = new Set(maps.map(({ map }) => map.hexes.filter((h) => h.terrain === 'stone').length));
    expect(rows.size).toBe(6);
    expect(themes.size).toBe(RANDOM_MAP_THEMES.length);
    expect(counts.size).toBeGreaterThanOrEqual(5);
  });
});
