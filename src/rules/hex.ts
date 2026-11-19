// Axial hex coordinates, pointy-top. All math is integer.
//
// Direction indices (pointy-top, screen "north" is -r):
//   0 = E, 1 = NE, 2 = NW, 3 = W, 4 = SW, 5 = SE

export interface Hex {
  readonly q: number;
  readonly r: number;
}

export type Dir = 0 | 1 | 2 | 3 | 4 | 5;
export const DIRS: readonly Dir[] = [0, 1, 2, 3, 4, 5];

export const DIR_VECTORS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export const hex = (q: number, r: number): Hex => ({ q, r });
export const hexKey = (h: Hex): string => `${h.q},${h.r}`;
export const hexEq = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;
export const hexAdd = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });
export const hexSub = (a: Hex, b: Hex): Hex => ({ q: a.q - b.q, r: a.r - b.r });
export const hexScale = (a: Hex, k: number): Hex => ({ q: a.q * k, r: a.r * k });
export const neighbor = (h: Hex, d: Dir): Hex => hexAdd(h, DIR_VECTORS[d]);
export const neighbors = (h: Hex): Hex[] => DIRS.map((d) => neighbor(h, d));

export function hexLength(h: Hex): number {
  return (Math.abs(h.q) + Math.abs(h.r) + Math.abs(h.q + h.r)) / 2;
}

export function hexDistance(a: Hex, b: Hex): number {
  return hexLength(hexSub(a, b));
}

/** Direction index of a unit vector, or null when not adjacent. */
export function dirOf(v: Hex): Dir | null {
  for (const d of DIRS) if (hexEq(DIR_VECTORS[d], v)) return d;
  return null;
}

/** Hexes within `radius` of `center` (deterministic order). */
export function hexesInRange(center: Hex, radius: number): Hex[] {
  const out: Hex[] = [];
  for (let dq = -radius; dq <= radius; dq++) {
    const lo = Math.max(-radius, -dq - radius);
    const hi = Math.min(radius, -dq + radius);
    for (let dr = lo; dr <= hi; dr++) out.push({ q: center.q + dq, r: center.r + dr });
  }
  return out;
}

/**
 * Hex-ring angle of a non-zero offset vector. Returns position `p` along its
 * ring of radius `d` (0 <= p < 6d) measured from the direction-0 corner
 * toward direction 1, so the angle is p/d sixths of a turn (60° each).
 * Exact integers, no trig — see docs/adr/0001.
 */
export function ringPosition(v: Hex): { p: number; d: number } {
  const d = hexLength(v);
  if (d === 0) throw new Error('ringPosition of zero vector');
  for (let i = 0; i < 6; i++) {
    const corner = hexScale(DIR_VECTORS[i], d);
    const rem = hexSub(v, corner);
    const step = DIR_VECTORS[(i + 2) % 6];
    // rem must equal k * step for 0 <= k < d
    const k = step.q !== 0 ? rem.q / step.q : rem.r / step.r;
    if (Number.isInteger(k) && k >= 0 && k < d && rem.q === step.q * k && rem.r === step.r * k) {
      return { p: i * d + k, d };
    }
  }
  throw new Error('unreachable: ring position not found');
}

/** Best Facing to look toward `to` from `from` (nearest hex direction). */
export function facingToward(from: Hex, to: Hex): Dir {
  const v = hexSub(to, from);
  if (v.q === 0 && v.r === 0) return 0;
  const { p, d } = ringPosition(v);
  // round p/d to nearest integer sixth, ties go clockwise-lower
  const sixth = Math.floor((2 * p + d) / (2 * d)) % 6;
  return sixth as Dir;
}

// ----- offset (odd-r) helpers for authoring rectangular maps -----

export function offsetToAxial(col: number, row: number): Hex {
  const q = col - (row - (row & 1)) / 2;
  return { q, r: row };
}

export function axialToOffset(h: Hex): { col: number; row: number } {
  const col = h.q + (h.r - (h.r & 1)) / 2;
  return { col, row: h.r };
}
