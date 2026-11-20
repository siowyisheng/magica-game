// A tiny modelling kit for unit sprites: creatures are built from spheres,
// ellipsoids, tubes (sphere chains) and flat polygons in model space, plus
// face decals (eyes, mouths). Model space: x right, y up, z forward (the way
// the creature faces). Feet stand at y = 0; models fill roughly y ∈ [0, 1].

export type V3 = [number, number, number];

/** Material keys; colours come from the kind's palette (see palette.ts). */
export type Mat = string;

export interface Sphere {
  kind: 'sph';
  c: V3;
  r: number;
  mat: Mat;
  g: number;
}

export interface Ellipsoid {
  kind: 'ell';
  c: V3;
  r: V3;
  /** Euler rotation (x, then y, then z), radians. */
  rot: V3;
  mat: Mat;
  g: number;
}

export interface Poly {
  kind: 'poly';
  pts: V3[];
  mat: Mat;
  g: number;
}

export type Part = Sphere | Ellipsoid | Poly;

export type EyeStyle = 'anime' | 'beast' | 'slit' | 'glow' | 'dot';

export interface Decal {
  kind: 'eye' | 'mouth' | 'fang' | 'blush';
  p: V3;
  /** Outward surface normal at p. */
  n: V3;
  style?: EyeStyle;
  /** Iris / glow colour key. */
  color?: Mat;
}

export interface Pose {
  /** 0 = exhaled, 1 = fully inhaled. */
  breath: number;
  /** Idle frame index (for flicker). */
  frame: number;
  blink: boolean;
}

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm3 = (a: V3): V3 => {
  const l = len3(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
/** Mirror a point across x = 0. */
export const mx = (a: V3, s: number): V3 => [a[0] * s, a[1], a[2]];

export class Model {
  parts: Part[] = [];
  decals: Decal[] = [];
  private gid = 0;

  /** A new line group: parts in different groups get ink lines between them. */
  group(): number {
    return ++this.gid;
  }

  ball(c: V3, r: number, mat: Mat, g = this.group()): number {
    this.parts.push({ kind: 'sph', c, r, mat, g });
    return g;
  }

  ell(c: V3, r: V3, mat: Mat, rot: V3 = [0, 0, 0], g = this.group()): number {
    this.parts.push({ kind: 'ell', c, r, rot, mat, g });
    return g;
  }

  /** A tapering tube through `pts` with a radius per point. */
  tube(pts: V3[], radii: number[], mat: Mat, g = this.group()): number {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const ra = radii[i];
      const rb = radii[i + 1];
      const l = len3(sub(b, a));
      const n = Math.max(1, Math.ceil(l / (Math.max(0.006, Math.min(ra, rb)) * 0.55)));
      for (let k = i === 0 ? 0 : 1; k <= n; k++) {
        const t = k / n;
        this.parts.push({ kind: 'sph', c: lerp3(a, b, t), r: Math.max(0.004, ra + (rb - ra) * t), mat, g });
      }
    }
    return g;
  }

  /** A pointed cone-like spike from base `a` (radius r) to tip `b`. */
  spike(a: V3, b: V3, r: number, mat: Mat, g = this.group()): number {
    return this.tube([a, b], [r, 0.004], mat, g);
  }

  poly(pts: V3[], mat: Mat, g = this.group()): number {
    this.parts.push({ kind: 'poly', pts, mat, g });
    return g;
  }

  eye(p: V3, n: V3, style: EyeStyle, color: Mat = 'iris'): void {
    this.decals.push({ kind: 'eye', p, n: norm3(n), style, color });
  }

  mouth(p: V3, n: V3, kind: 'mouth' | 'fang' | 'blush' = 'mouth'): void {
    this.decals.push({ kind, p, n: norm3(n) });
  }
}
