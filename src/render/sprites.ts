// Unit sprites and projectile textures, all generated at runtime (no assets).
// Unit sprites are cel-shaded renders of small 3D part models (spritegen/),
// drawn from three angles and mirrored for the other three facings.

import * as THREE from 'three';
import { kindOf, type Element, type SideId } from '../rules';
import { renderSprite, WINDOW_SIZE, FEET_FRACTION, type FrameIndex, type ViewIndex } from './spritegen';

export const SIDE_COLORS: Record<SideId, string> = { 0: '#3fbf4f', 1: '#d23a3a' };
export const ELEMENT_COLORS: Record<Element, string> = {
  fire: '#e8622c',
  air: '#a8e0ee',
  earth: '#b48a3a',
  water: '#3a78d8',
};

function shade(hex: string, f: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l * f)));
  return `#${c.getHexString()}`;
}

// ---------- unit sprites (rendered from 3D part models; see spritegen/) ----------

/** Idle frames: four breathing poses (0–3) and a blink (4). */
export type IdleFrame = FrameIndex;
/** Breathe in, hold, breathe out, rest; blink every third breath. */
const BREATH: IdleFrame[] = [0, 0, 1, 2, 3, 3, 3, 2, 1, 0];
const IDLE_CYCLE: IdleFrame[] = [...BREATH.map((f, i) => (i === 1 ? 4 : f)), ...BREATH, ...BREATH];
const IDLE_FPS = 5;

export function idleFrameAt(nowMs: number, phase: number): IdleFrame {
  const i = Math.floor((nowMs / 1000) * IDLE_FPS + phase * 7) % IDLE_CYCLE.length;
  return IDLE_CYCLE[(i + IDLE_CYCLE.length) % IDLE_CYCLE.length];
}

/** Which drawn view a facing uses, and whether it is mirrored. */
export function viewForFacing(facing: number): { view: ViewIndex; mirror: boolean } {
  switch (((facing % 6) + 6) % 6) {
    case 5:
      return { view: 0, mirror: false }; // SE: front three-quarter
    case 0:
      return { view: 1, mirror: false }; // E: profile
    case 1:
      return { view: 2, mirror: false }; // NE: back three-quarter
    case 4:
      return { view: 0, mirror: true }; // SW
    case 3:
      return { view: 1, mirror: true }; // W
    default:
      return { view: 2, mirror: true }; // NW
  }
}

/** The facing closest to a world heading (radians, atan2(x, z)). */
export function facingForHeading(heading: number): number {
  // facing d points at world angle atan2(x, z) of its hex vector
  const angles = [Math.PI / 2, (5 * Math.PI) / 6, -(5 * Math.PI) / 6, -Math.PI / 2, -Math.PI / 6, Math.PI / 6];
  let best = 0;
  let bestDiff = Infinity;
  angles.forEach((a, d) => {
    let diff = Math.abs(heading - a) % (2 * Math.PI);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff < bestDiff) {
      bestDiff = diff;
      best = d;
    }
  });
  return best;
}

/** The board renders at pixel size 1: one sprite texel per screen pixel at the default zoom. */
const pixelSize = 1;
const DEFAULT_ZOOM = 38;

/** World size (square) of a kind's sprite. */
export function spriteWorldSize(kindId: string): number {
  return spriteScale(kindId) * 0.95 * WINDOW_SIZE;
}
/** World height of the feet above the sprite's bottom edge. */
export function spriteFeetOffset(kindId: string): number {
  return spriteWorldSize(kindId) * FEET_FRACTION;
}

const topCache = new Map<string, number>();
/** World height of the top of a kind's figure above its feet (front view, at rest). */
export function spriteTopHeight(kindId: string): number {
  let h = topCache.get(kindId);
  if (h !== undefined) return h;
  const cv = baseCanvas(kindId, 0, 0, 0, 2);
  const data = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
  let top = cv.height;
  for (let y = 0; y < cv.height && top === cv.height; y++)
    for (let x = 0; x < cv.width; x++)
      if (data[(y * cv.width + x) * 4 + 3] > 0) {
        top = y;
        break;
      }
  h = (1 - top / cv.height) * spriteWorldSize(kindId) - spriteFeetOffset(kindId);
  topCache.set(kindId, h);
  return h;
}

function texelSize(kindId: string, ps: number): number {
  return Math.max(16, Math.round((spriteWorldSize(kindId) * DEFAULT_ZOOM) / ps));
}

const baseCache = new Map<string, HTMLCanvasElement>();
function baseCanvas(kindId: string, side: SideId, view: ViewIndex, frame: IdleFrame, ps: number): HTMLCanvasElement {
  const key = `${kindId}|${side}|${view}|${frame}|${ps}`;
  let cv = baseCache.get(key);
  if (cv) return cv;
  const k = kindOf(kindId);
  const px = renderSprite(kindId, side, k.element, view, frame, texelSize(kindId, ps));
  cv = document.createElement('canvas');
  cv.width = px.w;
  cv.height = px.h;
  const img = new ImageData(px.w, px.h);
  img.data.set(px.data);
  cv.getContext('2d')!.putImageData(img, 0, 0);
  baseCache.set(key, cv);
  return cv;
}

const cache = new Map<string, HTMLCanvasElement>();
export function unitFrameCanvas(kindId: string, side: SideId, frame: IdleFrame, facing = 5, ps = pixelSize): HTMLCanvasElement {
  const { view, mirror } = viewForFacing(facing);
  if (!mirror) return baseCanvas(kindId, side, view, frame, ps);
  const key = `${kindId}|${side}|${view}|${frame}|${ps}|m`;
  let cv = cache.get(key);
  if (cv) return cv;
  const src = baseCanvas(kindId, side, view, frame, ps);
  cv = document.createElement('canvas');
  cv.width = src.width;
  cv.height = src.height;
  const ctx = cv.getContext('2d')!;
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  cache.set(key, cv);
  return cv;
}

export function unitCanvas(kindId: string, side: SideId): HTMLCanvasElement {
  return unitFrameCanvas(kindId, side, 0);
}

const texCache = new Map<HTMLCanvasElement, THREE.Texture>();
function texOf(cv: HTMLCanvasElement): THREE.Texture {
  let t = texCache.get(cv);
  if (!t) {
    t = new THREE.CanvasTexture(cv);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(cv, t);
  }
  return t;
}

export function unitFrameTexture(kindId: string, side: SideId, frame: IdleFrame, facing = 5): THREE.Texture {
  return texOf(unitFrameCanvas(kindId, side, frame, facing));
}

export function unitTexture(kindId: string, side: SideId): THREE.Texture {
  return unitFrameTexture(kindId, side, 0);
}

// ---------- DOM images: cropped and scaled by a whole number into a fixed box ----------

type Box = { x0: number; y0: number; x1: number; y1: number };
const boundsCache = new Map<string, Box>();
/** Opaque bounds of a view over all idle frames, so animation never shifts the crop. */
function frameBounds(kindId: string, side: SideId, view: ViewIndex, ps: number): Box {
  const key = `${kindId}|${side}|${view}|${ps}`;
  let b = boundsCache.get(key);
  if (b) return b;
  b = { x0: Infinity, y0: Infinity, x1: -1, y1: -1 };
  for (const f of [0, 1, 2, 3, 4] as IdleFrame[]) {
    const cv = baseCanvas(kindId, side, view, f, ps);
    const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
    for (let y = 0; y < cv.height; y++)
      for (let x = 0; x < cv.width; x++)
        if (d[(y * cv.width + x) * 4 + 3] > 0) {
          b.x0 = Math.min(b.x0, x);
          b.y0 = Math.min(b.y0, y);
          b.x1 = Math.max(b.x1, x);
          b.y1 = Math.max(b.y1, y);
        }
  }
  boundsCache.set(key, b);
  return b;
}

const urlCache = new Map<string, string>();
/**
 * A sprite frame as an image of exactly `boxW`×`boxH`: cropped to the figure
 * and drawn at the largest whole-number scale that fits (one sprite
 * resolution per box size, so kinds keep their relative sizes), centred and
 * standing on the bottom edge.
 */
export function unitFrameUrl(kindId: string, side: SideId, frame: IdleFrame, facing = 5, boxW = 88, boxH = 110): string {
  const key = `${kindId}|${side}|${frame}|${facing}|${boxW}|${boxH}`;
  const hit = urlCache.get(key);
  if (hit) return hit;
  const { view, mirror } = viewForFacing(facing);
  // one resolution per box size, so every kind is drawn at the same scale
  const ps = boxH >= 100 ? 1 : 2;
  const b0 = frameBounds(kindId, side, view, ps);
  // scale from the whole sprite canvas (same for kinds of the same size), then shrink only if the crop won't fit
  const full = baseCanvas(kindId, side, view, 0, ps);
  const fit = Math.min((boxW - 2) / (b0.x1 - b0.x0 + 1), (boxH - 2) / (b0.y1 - b0.y0 + 1));
  const kFull = Math.max(1, Math.floor(Math.min(boxW / full.width, boxH / full.height)));
  const k = kFull <= fit ? kFull : fit >= 1 ? Math.floor(fit) : fit;
  const b = b0;
  const cv = document.createElement('canvas');
  cv.width = boxW;
  cv.height = boxH;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const src = baseCanvas(kindId, side, view, frame, ps);
  const w = (b.x1 - b.x0 + 1) * k;
  const h = (b.y1 - b.y0 + 1) * k;
  const dx = Math.round((boxW - w) / 2);
  const dy = boxH - 1 - h;
  if (mirror) {
    ctx.translate(boxW, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(src, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1, dx, dy, w, h);
  const u = cv.toDataURL();
  urlCache.set(key, u);
  return u;
}

/** Small icon (timeline, menus, unit card). */
export const ICON_BOX = [44, 55] as const;
export function unitIconUrl(kindId: string, side: SideId): string {
  return unitFrameUrl(kindId, side, 0, 5, ICON_BOX[0], ICON_BOX[1]);
}

/** Sprite world height for a kind: bigger overall, and larger with Cost and average defense. */
export function spriteScale(kindId: string): number {
  const k = kindOf(kindId);
  const cost = k.isMaster ? 64 : k.cost;
  const avgDef = (k.stats.def + k.stats.mdf) / 2;
  const costT = Math.min(1, Math.max(0, (cost - 16) / 80));
  const defT = Math.min(1, Math.max(0, (avgDef - 3.25) / 4));
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

// ---------- target outline (silhouette dilated by 1px, white; tinted per use) ----------

const outlineCache = new Map<HTMLCanvasElement, THREE.Texture>();

export function unitOutlineTexture(kindId: string, side: SideId, frame: IdleFrame, facing = 5): THREE.Texture {
  const src = unitFrameCanvas(kindId, side, frame, facing);
  const hit = outlineCache.get(src);
  if (hit) return hit;
  const w = src.width;
  const h = src.height;
  const data = src.getContext('2d')!.getImageData(0, 0, w, h).data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] > 0;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) ctx.fillRect(x, y, 1, 1);
    }
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  outlineCache.set(src, t);
  return t;
}
