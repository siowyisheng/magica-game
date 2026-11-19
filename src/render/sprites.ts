// Procedural placeholder unit sprites (no external assets).
// Primary colour = Side Colour, secondary = a shade of the Element colour,
// tertiary = an accent unique to the Unit kind.

import * as THREE from 'three';
import { kindOf, type Element, type SideId } from '../rules';

export const SIDE_COLORS: Record<SideId, string> = { 0: '#3fbf4f', 1: '#d23a3a' };
export const ELEMENT_COLORS: Record<Element, string> = {
  fire: '#e8622c',
  air: '#a8e0ee',
  earth: '#b48a3a',
  water: '#3a78d8',
};
const NEUTRAL_SECONDARY = '#c9b8f0';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade(hex: string, f: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l * f)));
  return `#${c.getHexString()}`;
}

export const W = 16;
export const H = 20;

/** Cell grid: 0 empty, 1 primary, 2 secondary, 3 tertiary. */
function pattern(kindId: string): number[][] {
  const k = kindOf(kindId);
  const r = rng(hash(kindId));
  const g: number[][] = Array.from({ length: H }, () => Array(W).fill(0));
  const half = W / 2;
  const flies = k.moveTypes.includes('fly');
  const swims = k.moveTypes.includes('swim') && !k.moveTypes.includes('walk');
  const big = k.role === 'dragon' || k.role === 'tank';
  const bodyW = big ? 5.5 : k.role === 'scout' ? 3.2 : 4.3;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < half; x++) {
      const dx = half - 0.5 - x; // distance from centre column
      let p = 0;
      if (k.isSummoner) {
        // hat, head, widening robe
        if (y < 4) p = dx < 1.5 + y * 0.6 ? 0.95 : 0;
        else if (y < 7) p = dx < 2.2 ? 0.95 : 0;
        else p = dx < 2 + (y - 7) * 0.35 ? 0.97 : 0;
      } else {
        const cy = swims ? 12 : 10;
        const ry = swims ? 5 : 7.5;
        const e = (dx / bodyW) ** 2 + ((y - cy) / ry) ** 2;
        p = e < 1 ? 0.92 - e * 0.35 : 0;
        if (flies && y >= 5 && y <= 11 && dx < 8) p = Math.max(p, dx > 3 ? 0.75 - Math.abs(y - 7) * 0.12 : p);
        if (!flies && !swims && y >= 16 && (dx > 1 && dx < 3.2)) p = 0.85; // legs
        if (swims && y >= 15) p = dx < 6 - (y - 15) ? 0.7 : 0; // tail fin / wake
      }
      if (r() < p) {
        const t = r();
        let c = 1;
        if (t < 0.28) c = 2;
        g[y][x] = c;
        g[y][W - 1 - x] = c;
      }
    }
  }
  // eyes / gem in tertiary
  const eyeY = k.isSummoner ? 5 : swims ? 10 : 7;
  for (const ex of [half - 2, half + 1]) if (g[eyeY][ex]) g[eyeY][ex] = 3;
  if (k.isSummoner) {
    g[1][half - 1] = 3;
    g[1][half] = 3;
  }
  return g;
}

const cache = new Map<string, HTMLCanvasElement>();

export function unitCanvas(kindId: string, side: SideId): HTMLCanvasElement {
  const key = `${kindId}|${side}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const k = kindOf(kindId);
  const g = pattern(kindId);
  const primary = SIDE_COLORS[side];
  const secondary = k.element ? shade(ELEMENT_COLORS[k.element], 0.7 + (hash(kindId) % 50) / 100) : NEUTRAL_SECONDARY;
  const tertiary = `hsl(${hash(kindId + 'accent') % 360}, 90%, 62%)`;
  const colors = ['', primary, secondary, tertiary];

  const pad = 1;
  const cv = document.createElement('canvas');
  cv.width = W + pad * 2;
  cv.height = H + pad * 2;
  const ctx = cv.getContext('2d')!;
  // outline pass
  ctx.fillStyle = '#10121a';
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (g[y][x])
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.fillRect(x + pad + ox, y + pad + oy, 1, 1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = g[y][x];
      if (!c) continue;
      // simple top-light shading on primary
      ctx.fillStyle = c === 1 && y > H * 0.6 ? shade(primary, 0.75) : colors[c];
      ctx.fillRect(x + pad, y + pad, 1, 1);
    }
  cache.set(key, cv);
  return cv;
}

const texCache = new Map<string, THREE.Texture>();

export function unitTexture(kindId: string, side: SideId): THREE.Texture {
  const key = `${kindId}|${side}`;
  let t = texCache.get(key);
  if (!t) {
    t = new THREE.CanvasTexture(unitCanvas(kindId, side));
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(key, t);
  }
  return t;
}

const urlCache = new Map<string, string>();
export function unitIconUrl(kindId: string, side: SideId): string {
  const key = `${kindId}|${side}`;
  let u = urlCache.get(key);
  if (!u) {
    u = unitCanvas(kindId, side).toDataURL();
    urlCache.set(key, u);
  }
  return u;
}
