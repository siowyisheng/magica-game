// Hex-region boundary lines: outer edges only (holes filled), drawn as thin
// flat ribbons on the tile tops, optionally dashed.

import * as THREE from 'three';
import { DIRS, DIR_VECTORS, type Hex, hexKey, mapHexAt, neighbor, surfaceHeight, type MatchState } from '../rules';

const SQRT3 = Math.sqrt(3);
const STEP = 0.5;

function world(h: Hex): [number, number] {
  return [SQRT3 * (h.q + h.r / 2), 1.5 * h.r];
}

function topY(match: MatchState, h: Hex): number {
  const mh = mapHexAt(match.map, h);
  return mh ? surfaceHeight(mh, match.waterLevel) * STEP : 0;
}

/** Corner k of a pointy-top hex (corner 0 points to +z), unit circumradius. */
const CORNERS: [number, number][] = [0, 1, 2, 3, 4, 5].map((k) => {
  const a = (Math.PI / 3) * k;
  return [Math.sin(a), Math.cos(a)];
});

/** For each direction, the pair of corner indices on the edge facing it. */
const EDGE_FOR_DIR: [number, number][] = DIRS.map((d) => {
  const [vx, vz] = world(DIR_VECTORS[d]);
  const target = Math.atan2(vx, vz);
  let best: [number, number] = [0, 1];
  let bestDiff = Infinity;
  for (let k = 0; k < 6; k++) {
    const a = CORNERS[k];
    const b = CORNERS[(k + 1) % 6];
    const m = Math.atan2(a[0] + b[0], a[1] + b[1]);
    let diff = Math.abs(m - target);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff < bestDiff) {
      bestDiff = diff;
      best = [k, (k + 1) % 6];
    }
  }
  return best;
});

/** Add enclosed holes to a region so only its outer boundary remains. */
export function fillHoles(match: MatchState, region: Map<string, Hex>): Map<string, Hex> {
  const outside = new Set<string>();
  const queue: Hex[] = [];
  for (const mh of match.map.hexes) {
    const k = hexKey(mh.hex);
    if (region.has(k)) continue;
    // touches the map edge → connected to the outside
    if (DIRS.some((d) => !mapHexAt(match.map, neighbor(mh.hex, d)))) {
      outside.add(k);
      queue.push(mh.hex);
    }
  }
  while (queue.length) {
    const h = queue.pop()!;
    for (const d of DIRS) {
      const n = neighbor(h, d);
      const k = hexKey(n);
      if (outside.has(k) || region.has(k) || !mapHexAt(match.map, n)) continue;
      outside.add(k);
      queue.push(n);
    }
  }
  const out = new Map(region);
  for (const mh of match.map.hexes) {
    const k = hexKey(mh.hex);
    if (!region.has(k) && !outside.has(k)) out.set(k, mh.hex);
  }
  return out;
}

export interface Segment {
  a: THREE.Vector3;
  b: THREE.Vector3;
  /** Unit vector pointing into the region (for insetting the ribbon). */
  inward: THREE.Vector3;
}

/** Outer boundary segments of a hex region, on each inside hex's top surface. */
export function regionSegments(match: MatchState, region: Map<string, Hex>, inset = 0.06): Segment[] {
  const filled = fillHoles(match, region);
  const segs: Segment[] = [];
  for (const h of filled.values()) {
    const [cx, cz] = world(h);
    const y = topY(match, h) + 0.035;
    for (const d of DIRS) {
      if (filled.has(hexKey(neighbor(h, d)))) continue;
      const [i, j] = EDGE_FOR_DIR[d];
      const r = 1 - inset;
      const a = new THREE.Vector3(cx + CORNERS[i][0] * r, y, cz + CORNERS[i][1] * r);
      const b = new THREE.Vector3(cx + CORNERS[j][0] * r, y, cz + CORNERS[j][1] * r);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const inward = new THREE.Vector3(cx - mid.x, 0, cz - mid.z).normalize();
      segs.push({ a, b, inward });
    }
  }
  return segs;
}

export interface LineStyle {
  color: string;
  width: number;
  opacity?: number;
  /** Dash period in world units, and phase in [0,1) of that period. Solid when absent. */
  dash?: { period: number; phase: number };
}

/** Build one ribbon mesh geometry for many segments in one style. */
export function ribbonGeometry(segs: Segment[], style: LineStyle): THREE.BufferGeometry {
  const pos: number[] = [];
  const push = (p: THREE.Vector3) => pos.push(p.x, p.y, p.z);
  const quad = (a: THREE.Vector3, b: THREE.Vector3, inward: THREE.Vector3) => {
    const off = inward.clone().multiplyScalar(style.width);
    const a2 = a.clone().add(off);
    const b2 = b.clone().add(off);
    push(a); push(b); push(b2);
    push(a); push(b2); push(a2);
  };
  for (const s of segs) {
    if (!style.dash) {
      quad(s.a, s.b, s.inward);
      continue;
    }
    const len = s.a.distanceTo(s.b);
    const { period, phase } = style.dash;
    const dir = s.b.clone().sub(s.a).normalize();
    // dash on for the first half of each period, shifted by phase
    for (let t = -phase * period; t < len; t += period) {
      const t0 = Math.max(0, t);
      const t1 = Math.min(len, t + period / 2);
      if (t1 <= t0) continue;
      quad(s.a.clone().addScaledVector(dir, t0), s.a.clone().addScaledVector(dir, t1), s.inward);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/** World height of the outline fences: about 1.1 Height levels. */
export const FENCE_HEIGHT = 1.1 * STEP;

/**
 * Vertical strips standing on each boundary edge, from `y0` to `y1` above the
 * tile top (solid or dashed along the edge). Seen from the camera they read
 * as bands rather than hairlines, and rise above neighbouring columns.
 */
export function fenceGeometry(segs: Segment[], style: LineStyle, y0: number, y1: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const quad = (a: THREE.Vector3, b: THREE.Vector3) => {
    const a0 = a.clone().setY(a.y + y0);
    const b0 = b.clone().setY(b.y + y0);
    const a1 = a.clone().setY(a.y + y1);
    const b1 = b.clone().setY(b.y + y1);
    pos.push(a0.x, a0.y, a0.z, b0.x, b0.y, b0.z, b1.x, b1.y, b1.z);
    pos.push(a0.x, a0.y, a0.z, b1.x, b1.y, b1.z, a1.x, a1.y, a1.z);
  };
  for (const s of segs) {
    if (!style.dash) {
      quad(s.a, s.b);
      continue;
    }
    const len = s.a.distanceTo(s.b);
    const { period, phase } = style.dash;
    const dir = s.b.clone().sub(s.a).normalize();
    for (let t = -phase * period; t < len; t += period) {
      const t0 = Math.max(0, t);
      const t1 = Math.min(len, t + period / 2);
      if (t1 <= t0) continue;
      quad(s.a.clone().addScaledVector(dir, t0), s.a.clone().addScaledVector(dir, t1));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}
