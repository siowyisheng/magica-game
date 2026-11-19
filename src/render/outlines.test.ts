import { describe, expect, it } from 'vitest';
import { createMatch, hex, hexKey, neighbors, type MapDef, type MapHex } from '../rules';
import { fillHoles, regionSegments, ribbonGeometry } from './outlines';

function flat(w: number, h: number): MapDef {
  const hexes: MapHex[] = [];
  for (let r = 0; r < h; r++) for (let q = 0; q < w; q++) hexes.push({ hex: hex(q, r), height: 1, terrain: 'plain' });
  return { name: 't', hexes, waterLevel: 0, startClock: 360, spawns: [hex(0, h - 1), hex(w - 1, 0)], spawnFacing: [0, 3] };
}

describe('region outlines', () => {
  const s = createMatch(flat(8, 8));
  it('draws 6 edges around a single hex', () => {
    expect(regionSegments(s, new Map([[hexKey(hex(3, 3)), hex(3, 3)]]))).toHaveLength(6);
  });
  it('fills holes so only the outer boundary shows', () => {
    const ring = new Map(neighbors(hex(3, 3)).map((h) => [hexKey(h), h] as const));
    expect(fillHoles(s, ring).has(hexKey(hex(3, 3)))).toBe(true);
    expect(regionSegments(s, ring)).toHaveLength(18); // 6 outer hexes × 3 outer edges; no inner ring
  });
  it('dashes alternate when phases differ by half a period', () => {
    const one = new Map([[hexKey(hex(3, 3)), hex(3, 3)]]);
    const segs = regionSegments(s, one);
    const red = ribbonGeometry(segs, { color: 'r', width: 0.07, dash: { period: 0.3, phase: 0 } });
    const solid = ribbonGeometry(segs, { color: 'w', width: 0.07 });
    expect(red.getAttribute('position').count).toBeGreaterThan(solid.getAttribute('position').count);
  });
});
