import { describe, expect, it } from 'vitest';
import { renderSprite, hasDesign, type FrameIndex, type ViewIndex } from './index';
import { SUMMONS, SUMMONERS } from '../../rules/kinds';

const opaque = (d: Uint8ClampedArray) => {
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
  return n;
};
const same = (a: Uint8ClampedArray, b: Uint8ClampedArray) => a.length === b.length && a.every((v, i) => v === b[i]);

describe('unit sprite designs', () => {
  const kinds = [...SUMMONERS.map((k) => k.id), ...SUMMONS.map((k) => k.id)];
  const elementOf = (id: string) => [...SUMMONERS, ...SUMMONS].find((s) => s.id === id)?.element ?? null;

  it('has a design for all 30 Summoners and all 28 summons', () => {
    expect(kinds).toHaveLength(58);
    for (const k of kinds) expect(hasDesign(k), k).toBe(true);
  });

  it('renders every kind in all 3 views and 5 idle frames, inside the frame', () => {
    const clipped = new Set<string>();
    for (const k of kinds) {
      const el = elementOf(k);
      for (const view of [0, 1, 2] as ViewIndex[])
        for (const f of [0, 1, 2, 3, 4] as FrameIndex[]) {
          const px = renderSprite(k, 0, el, view, f, 48);
          const n = opaque(px.data);
          expect(n, `${k} view ${view} frame ${f}`).toBeGreaterThan(48 * 48 * 0.06);
          // nothing touches the left/right/top border (no clipping)
          for (let y = 0; y < 48; y++) {
            if (px.data[(y * 48) * 4 + 3]) clipped.add(`${k} v${view} left`);
            if (px.data[(y * 48 + 47) * 4 + 3]) clipped.add(`${k} v${view} right`);
          }
          for (let x = 0; x < 48; x++) {
            if (px.data[x * 4 + 3]) clipped.add(`${k} v${view} top`);
            if (px.data[(47 * 48 + x) * 4 + 3]) clipped.add(`${k} v${view} bottom`);
          }
        }
    }
    expect([...clipped]).toEqual([]);
  });

  it('is deterministic, differs by Side, by view, and breathes between frames', () => {
    for (const k of kinds) {
      const el = elementOf(k);
      const a = renderSprite(k, 0, el, 0, 0, 48).data;
      expect(same(a, renderSprite(k, 0, el, 0, 0, 48).data)).toBe(true);
      expect(same(a, renderSprite(k, 1, el, 0, 0, 48).data), `${k} side colours`).toBe(false);
      expect(same(a, renderSprite(k, 0, el, 1, 0, 48).data), `${k} views`).toBe(false);
      expect(same(a, renderSprite(k, 0, el, 0, 3, 48).data), `${k} breathing`).toBe(false);
    }
  });
});

describe('facing → sprite view', () => {
  it('draws SE, E and NE and mirrors them for SW, W and NW', async () => {
    const { viewForFacing, facingForHeading } = await import('../sprites');
    expect([5, 0, 1, 4, 3, 2].map((f) => viewForFacing(f))).toEqual([
      { view: 0, mirror: false },
      { view: 1, mirror: false },
      { view: 2, mirror: false },
      { view: 0, mirror: true },
      { view: 1, mirror: true },
      { view: 2, mirror: true },
    ]);
    // a heading straight toward each hex direction picks that facing
    const vec = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
    vec.forEach(([q, r], d) => expect(facingForHeading(Math.atan2(Math.sqrt(3) * (q + r / 2), 1.5 * r))).toBe(d));
  });
});
