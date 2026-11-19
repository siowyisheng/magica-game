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

/** Cell codes: 0 empty, 1 primary, 2 secondary, 3 tertiary, 4 eye. */
interface Pattern {
  cells: number[][];
  wing: boolean[][];
}

function pattern(kindId: string): Pattern {
  const k = kindOf(kindId);
  const r = rng(hash(kindId));
  const cells: number[][] = Array.from({ length: H }, () => Array(W).fill(0));
  const wing: boolean[][] = Array.from({ length: H }, () => Array(W).fill(false));
  const half = W / 2;
  const flies = k.moveTypes.includes('fly');
  const swims = k.moveTypes.includes('swim') && !k.moveTypes.includes('walk');
  const big = k.role === 'dragon' || k.role === 'tank';
  const bodyW = big ? 5.5 : k.role === 'scout' ? 3.2 : 4.3;
  // a couple of horizontal trim bands in the accent colour
  const bandA = 6 + Math.floor(r() * 5);
  const bandB = bandA + 3 + Math.floor(r() * 4);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < half; x++) {
      const dx = half - 0.5 - x;
      let p = 0;
      let isWing = false;
      if (k.isSummoner) {
        if (y < 4) p = dx < 1.5 + y * 0.6 ? 0.95 : 0;
        else if (y < 7) p = dx < 2.2 ? 0.95 : 0;
        else p = dx < 2 + (y - 7) * 0.35 ? 0.97 : 0;
      } else {
        const cy = swims ? 12 : 10;
        const ry = swims ? 5 : 7.5;
        const e = (dx / bodyW) ** 2 + ((y - cy) / ry) ** 2;
        p = e < 1 ? 0.92 - e * 0.35 : 0;
        if (flies && y >= 5 && y <= 11 && dx > 3 && dx < 8) {
          const wp = 0.75 - Math.abs(y - 7) * 0.12;
          if (wp > p) {
            p = wp;
            isWing = true;
          }
        }
        if (!flies && !swims && y >= 16 && dx > 1 && dx < 3.2) p = 0.85; // legs
        if (swims && y >= 15) p = dx < 6 - (y - 15) ? 0.7 : 0; // tail fin / wake
      }
      if (r() < p) {
        const t = r();
        let c = 1;
        if (t < 0.22) c = 2;
        else if (t < 0.36 || y === bandA || (y === bandB && dx < 2.5)) c = 3;
        if (isWing && t < 0.5) c = 2;
        cells[y][x] = c;
        cells[y][W - 1 - x] = c;
        wing[y][x] = wing[y][W - 1 - x] = isWing;
      }
    }
  }
  const eyeY = k.isSummoner ? 5 : swims ? 10 : 7;
  for (const ex of [half - 2, half + 1]) if (cells[eyeY][ex]) cells[eyeY][ex] = 4;
  if (k.isSummoner) {
    cells[1][half - 1] = 3;
    cells[1][half] = 3;
  }
  return { cells, wing };
}

/** Idle keyframes: 0 base, 1 breath (body dips / wings lift), 2 blink + accent flicker. */
export type IdleFrame = 0 | 1 | 2;
const IDLE_CYCLE: IdleFrame[] = [0, 1, 0, 2];
const IDLE_FPS = 3;

export function idleFrameAt(nowMs: number, phase: number): IdleFrame {
  const i = Math.floor((nowMs / 1000) * IDLE_FPS + phase) % IDLE_CYCLE.length;
  return IDLE_CYCLE[(i + IDLE_CYCLE.length) % IDLE_CYCLE.length];
}

function frameCells(pat: Pattern, frame: IdleFrame, flies: boolean): number[][] {
  const { cells, wing } = pat;
  if (frame === 0 || frame === 2) return cells;
  const out: number[][] = Array.from({ length: H }, () => Array(W).fill(0));
  const legsFrom = H - 4;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = cells[y][x];
      if (!c) continue;
      if (flies && wing[y][x]) {
        if (y - 2 >= 0) out[y - 2][x] = c; // wings lift
      } else if (y < legsFrom && y + 1 < H) {
        if (!out[y + 1][x]) out[y + 1][x] = c; // body dips a pixel
      } else out[y][x] = c;
    }
  return out;
}

/** HSL tone ramp around the Side hue: varied, muted tones rather than a flat colour. */
function primaryRamp(side: SideId, kindId: string): string[] {
  const baseHue = side === 0 ? 125 : 2;
  const hue = baseHue + ((hash(kindId + 'hue') % 31) - 15);
  const c = new THREE.Color();
  const tones: [number, number, number][] = [
    [hue - 8, 0.38, 0.2],
    [hue - 3, 0.42, 0.33],
    [hue + 2, 0.45, 0.46],
    [hue + 7, 0.4, 0.62],
  ];
  return tones.map(([h, s, l]) => `#${c.setHSL((((h % 360) + 360) % 360) / 360, s, l).getHexString()}`);
}

const cache = new Map<string, HTMLCanvasElement>();

export function unitFrameCanvas(kindId: string, side: SideId, frame: IdleFrame): HTMLCanvasElement {
  const key = `${kindId}|${side}|${frame}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const k = kindOf(kindId);
  const pat = pattern(kindId);
  const g = frameCells(pat, frame, k.moveTypes.includes('fly'));
  const ramp = primaryRamp(side, kindId);
  const secondary = k.element ? shade(ELEMENT_COLORS[k.element], 0.7 + (hash(kindId) % 50) / 100) : NEUTRAL_SECONDARY;
  const accentHue = hash(kindId + 'accent') % 360;
  const tertiary = `hsl(${accentHue}, 85%, ${frame === 2 ? 74 : 60}%)`;
  const tertiaryDark = `hsl(${accentHue}, 70%, 40%)`;
  const eye = frame === 2 ? ramp[0] : '#fff8d0';

  const pad = 1;
  const cv = document.createElement('canvas');
  cv.width = W + pad * 2;
  cv.height = H + pad * 2;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#10121a';
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (g[y][x])
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.fillRect(x + pad + ox, y + pad + oy, 1, 1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = g[y][x];
      if (!c) continue;
      let color: string;
      if (c === 1) {
        // light from top-left; dither between neighbouring tones
        const light = 2.7 - (y / H) * 2.6 - (x / W) * 0.6;
        const lo = Math.max(0, Math.min(3, Math.floor(light)));
        const frac = light - lo;
        const dither = (x + y) % 2 === 0 ? 0.25 : 0.75;
        color = ramp[Math.min(3, frac > dither ? lo + 1 : lo)];
      } else if (c === 2) color = (x + y) % 3 === 0 ? shade(secondary, 0.8) : secondary;
      else if (c === 3) color = y > H * 0.6 ? tertiaryDark : tertiary;
      else color = eye;
      ctx.fillStyle = color;
      ctx.fillRect(x + pad, y + pad, 1, 1);
    }
  cache.set(key, cv);
  return cv;
}

export function unitCanvas(kindId: string, side: SideId): HTMLCanvasElement {
  return unitFrameCanvas(kindId, side, 0);
}

const texCache = new Map<string, THREE.Texture>();

export function unitFrameTexture(kindId: string, side: SideId, frame: IdleFrame): THREE.Texture {
  const key = `${kindId}|${side}|${frame}`;
  let t = texCache.get(key);
  if (!t) {
    t = new THREE.CanvasTexture(unitFrameCanvas(kindId, side, frame));
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(key, t);
  }
  return t;
}

export function unitTexture(kindId: string, side: SideId): THREE.Texture {
  return unitFrameTexture(kindId, side, 0);
}

const urlCache = new Map<string, string>();
export function unitFrameUrl(kindId: string, side: SideId, frame: IdleFrame): string {
  const key = `${kindId}|${side}|${frame}`;
  let u = urlCache.get(key);
  if (!u) {
    u = unitFrameCanvas(kindId, side, frame).toDataURL();
    urlCache.set(key, u);
  }
  return u;
}

export function unitIconUrl(kindId: string, side: SideId): string {
  return unitFrameUrl(kindId, side, 0);
}

/** Sprite world height for a kind: bigger overall, and larger with Cost and average defense. */
export function spriteScale(kindId: string): number {
  const k = kindOf(kindId);
  const cost = k.isSummoner ? 64 : k.cost;
  const avgDef = (k.stats.def + k.stats.mdf) / 2;
  const costT = Math.min(1, Math.max(0, (cost - 16) / 80));
  const defT = Math.min(1, Math.max(0, (avgDef - 8.5) / 8));
  return 1.55 * (1 + 0.3 * costT + 0.2 * defT);
}

// ---------- projectiles ----------

const projCache = new Map<string, THREE.Texture>();

/** Pixel-art projectile: an arrow/shard (physical) or a glowing orb (magic). */
export function projectileTexture(style: 'arrow' | 'orb', element: Element | null, heal: boolean): THREE.Texture {
  const key = `${style}|${element}|${heal}`;
  const hit = projCache.get(key);
  if (hit) return hit;
  const base = heal ? '#7dffa0' : element ? ELEMENT_COLORS[element] : '#c58bff';
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d')!;
  if (style === 'arrow') {
    cv.width = 16;
    cv.height = 8;
    ctx.fillStyle = '#10121a';
    ctx.fillRect(1, 3, 11, 3);
    ctx.fillRect(10, 1, 4, 7);
    ctx.fillStyle = '#d8c8a0';
    ctx.fillRect(2, 4, 9, 1); // shaft
    ctx.fillStyle = base;
    ctx.fillRect(11, 2, 2, 5); // head
    ctx.fillRect(13, 3, 2, 3);
    ctx.fillRect(1, 3, 2, 1); // fletching
    ctx.fillRect(1, 5, 2, 1);
  } else {
    cv.width = 12;
    cv.height = 12;
    const light = shade(base, 1.5);
    for (let y = 0; y < 12; y++)
      for (let x = 0; x < 12; x++) {
        const d = Math.hypot(x - 5.5, y - 5.5);
        if (d > 5.5) continue;
        ctx.fillStyle = d < 2 ? '#ffffff' : d < 3.6 ? light : d < 4.8 ? base : '#10121a';
        ctx.fillRect(x, y, 1, 1);
      }
  }
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  projCache.set(key, t);
  return t;
}
