// Cel shading for rasterized sprite models: three flat tones per material
// (hue-shifted shadows and lights, anime style), specular glints on glossy
// materials, flat-bright emissive materials, ink outlines (silhouette and
// between overlapping parts) and face decals.

import type { GBuffer, ScreenDecal } from './render';

// ---------- colour helpers (no DOM, no three) ----------

type RGB = [number, number, number];
type HSL = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function rgbToHsl([r, g, b]: RGB): HSL {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}

function hslToRgb([h, s, l]: HSL): RGB {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export const hsl = (h: number, s: number, l: number): string => {
  const [r, g, b] = hslToRgb([h, Math.max(0, Math.min(1, s)), Math.max(0, Math.min(1, l))]);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
};

/** Move hue `h` toward `target` by up to `amt` degrees. */
function hueToward(h: number, target: number, amt: number): number {
  let d = ((target - h + 540) % 360) - 180;
  if (Math.abs(d) < amt) return target;
  return h + Math.sign(d) * amt;
}

export interface Ramp {
  ink: RGB;
  shadow: RGB;
  base: RGB;
  light: RGB;
  hi: RGB;
  emissive: boolean;
  glossy: boolean;
}

/** Tone ramp for a base colour: shadows cooler, lights warmer. */
export function makeRamp(hex: string, emissive = false, glossy = false): Ramp {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  if (emissive) {
    return {
      ink: hslToRgb([hueToward(h, 0, 25), Math.min(1, s + 0.1), l * 0.45]),
      shadow: hslToRgb([hueToward(h, 0, 15), Math.min(1, s + 0.1), l * 0.78]),
      base: hexToRgb(hex),
      light: hslToRgb([hueToward(h, 55, 18), s, Math.min(0.92, l + (1 - l) * 0.45)]),
      hi: hslToRgb([hueToward(h, 55, 25), s * 0.6, Math.min(0.97, l + (1 - l) * 0.8)]),
      emissive,
      glossy,
    };
  }
  const grey = s < 0.08;
  return {
    ink: hslToRgb([hueToward(h, 265, 30), grey ? 0.18 : Math.min(0.6, s * 0.7 + 0.1), Math.min(0.17, l * 0.32)]),
    shadow: hslToRgb([grey ? h : hueToward(h, 255, 14), grey ? s + 0.05 : Math.min(1, s * 1.05 + 0.04), l * 0.68]),
    base: hexToRgb(hex),
    light: hslToRgb([grey ? h : hueToward(h, 55, 9), s * 0.95, Math.min(0.94, l + (1 - l) * 0.38)]),
    hi: hslToRgb([grey ? h : hueToward(h, 55, 12), s * 0.6, Math.min(0.98, l + (1 - l) * 0.75)]),
    emissive,
    glossy,
  };
}

/** Resolves a material key to a ramp. */
export type Palette = (mat: string) => Ramp;

const LIGHT = (() => {
  const v = [-0.5, 0.72, 0.48];
  const l = Math.hypot(...v);
  return v.map((x) => x / l) as [number, number, number];
})();
const HALF = (() => {
  const v = [LIGHT[0], LIGHT[1], LIGHT[2] + 1];
  const l = Math.hypot(...v);
  return v.map((x) => x / l) as [number, number, number];
})();

const INK: RGB = [27, 20, 38];
const WHITE: RGB = [255, 255, 255];

export interface ShadeOpts {
  blink: boolean;
  /** Pixels per model unit (picks decal size). */
  px: number;
  /** Depth step (model units) that draws an ink line between parts. */
  lineDepth?: number;
}

export function shade(gb: GBuffer, palette: Palette, o: ShadeOpts): Uint8ClampedArray {
  const { w, h } = gb;
  const out = new Uint8ClampedArray(w * h * 4);
  const ramps = gb.mats.map((m) => palette(m));
  const put = (x: number, y: number, c: RGB, a = 255) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const k = (y * w + x) * 4;
    out[k] = c[0];
    out[k + 1] = c[1];
    out[k + 2] = c[2];
    out[k + 3] = a;
  };
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && gb.mat[y * w + x] >= 0;

  // tones
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const m = gb.mat[i];
      if (m < 0) continue;
      const r = ramps[m];
      const n = [gb.nx[i], gb.ny[i], gb.nz[i]];
      let c: RGB;
      if (r.emissive) {
        // flat parts (polygons) glow evenly; round ones are hottest at the core
        const flat = gb.flatPart ? gb.flatPart[i] === 1 : false;
        c = flat ? r.base : n[2] > 0.94 ? r.hi : n[2] > 0.78 ? r.light : n[2] > 0.4 ? r.base : r.shadow;
      } else {
        const d = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
        c = d > 0.7 ? r.light : d > 0.1 ? r.base : r.shadow;
        if (r.glossy) {
          const sp = n[0] * HALF[0] + n[1] * HALF[1] + n[2] * HALF[2];
          if (sp > 0.965) c = r.hi;
        }
      }
      put(x, y, c);
    }

  // ink lines between overlapping parts: drawn on the far side of the edge,
  // in the ink of the nearer part
  const lineDepth = o.lineDepth ?? 0.045;
  const lines: [number, number, RGB][] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (gb.mat[i] < 0) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const qx = x + dx;
        const qy = y + dy;
        if (!filled(qx, qy)) continue;
        const q = qy * w + qx;
        const jump = gb.depth[i] - gb.depth[q];
        const differs = gb.group[i] !== gb.group[q];
        if ((differs && jump > lineDepth) || jump > lineDepth * 4) {
          lines.push([qx, qy, ramps[gb.mat[i]].emissive ? ramps[gb.mat[i]].shadow : ramps[gb.mat[i]].ink]);
        }
      }
    }
  for (const [x, y, c] of lines) put(x, y, c);

  // silhouette ink, outside the shape
  const sil: [number, number, RGB][] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (filled(x, y)) continue;
      let best = -1;
      let bestDepth = -Infinity;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!filled(x + dx, y + dy)) continue;
        const q = (y + dy) * w + x + dx;
        if (gb.depth[q] > bestDepth) {
          bestDepth = gb.depth[q];
          best = q;
        }
      }
      if (best >= 0) {
        const r = ramps[gb.mat[best]];
        sil.push([x, y, r.emissive ? r.shadow : r.ink]);
      }
    }
  for (const [x, y, c] of sil) put(x, y, c);

  // decals
  const big = o.px >= 52;
  for (const d of gb.decals) drawDecal(d, palette, o.blink, big, put);
  return out;
}

function drawDecal(d: ScreenDecal, palette: Palette, blink: boolean, big: boolean, put: (x: number, y: number, c: RGB, a?: number) => void) {
  const side = d.vn[2] < 0.5; // seen from the side: narrower
  if (d.kind === 'mouth') {
    put(Math.floor(d.x), Math.floor(d.y), INK);
    if (big && !side) put(Math.floor(d.x) + 1, Math.floor(d.y), INK);
    return;
  }
  if (d.kind === 'fang') {
    put(Math.floor(d.x), Math.floor(d.y), WHITE);
    return;
  }
  if (d.kind === 'blush') {
    put(Math.floor(d.x), Math.floor(d.y), [242, 150, 160]);
    return;
  }
  const iris = palette(d.color ?? 'iris');
  const style = d.style ?? 'anime';
  // patterns: L lash/ink, I iris, D iris dark, H highlight, W light iris, . none
  let rows: string[];
  if (blink && style !== 'glow') {
    rows = style === 'anime' ? (big ? ['...', 'LLL'] : ['..', 'LL']) : style === 'dot' || style === 'slit' ? ['L'] : big ? ['LLL'] : ['LL'];
  } else {
    switch (style) {
      case 'anime':
        rows = big ? ['LLL', 'DHI', 'DIW', '.II'] : ['LL', 'IH', 'DI'];
        break;
      case 'beast':
        rows = big ? ['IHI', 'DIW'] : ['IH', 'DI'];
        break;
      case 'slit':
        rows = big ? ['WL', 'IL', 'IL'] : ['W', 'L'];
        break;
      case 'glow':
        rows = big ? ['HW', 'WI'] : blink ? ['I'] : ['H', 'W'];
        if (!big && !blink && !side) rows = ['HW'];
        break;
      case 'dot':
        rows = big ? ['LH', 'LL'] : ['L'];
        break;
    }
  }
  if (side) rows = rows.map((r) => (r.length > 1 ? r.slice(0, Math.max(1, r.length - 1)) : r));
  const wpx = rows[0].length;
  const x0 = Math.round(d.x - wpx / 2);
  const y0 = Math.round(d.y - rows.length / 2);
  rows.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      const c: RGB | null =
        ch === 'L' ? INK : ch === 'I' ? iris.base : ch === 'D' ? iris.shadow : ch === 'H' ? WHITE : ch === 'W' ? iris.light : null;
      if (c) put(x0 + i, y0 + j, c);
    }),
  );
}
