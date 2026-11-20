// Shared body-part helpers for the sprite designs.

import { Model, type EyeStyle, type Mat, type Pose, type V3, add, mx } from './model';

/** A point (and its normal) on a sphere at yaw/pitch from the forward axis. */
export function onSphere(c: V3, r: number, yaw: number, pitch: number): [V3, V3] {
  const n: V3 = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  return [add(c, [n[0] * r, n[1] * r, n[2] * r]), n];
}

/** Two eyes on a head sphere. */
export function eyes(m: Model, c: V3, r: number, style: EyeStyle, color: Mat = 'iris', spread = 0.42, pitch = -0.12) {
  for (const s of [-1, 1]) {
    const [p, n] = onSphere(c, r, s * spread, pitch);
    m.eye(p, n, style, color);
  }
}

export function mouthAt(m: Model, c: V3, r: number, pitch = -0.45, kind: 'mouth' | 'fang' = 'mouth', yaw = 0) {
  const [p, n] = onSphere(c, r, yaw, pitch);
  m.mouth(p, n, kind);
}

/** Breathing offsets: chest swell and a small rise of everything above it. */
export function breathe(p: Pose) {
  const b = p.breath;
  return { swell: 1 + 0.045 * b, lift: 0.014 * b, b };
}

/** Wobble for flames / smoke, varying per idle frame. */
export function flick(p: Pose, i: number, amt = 1): number {
  return Math.sin(p.frame * 2.1 + i * 1.7) * amt;
}

/** A licking flame: stacked spheres rising and tapering. */
export function flame(m: Model, base: V3, height: number, radius: number, p: Pose, seed = 0, mat: Mat = 'flame*') {
  const g = m.group();
  const n = 6;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const wob = flick(p, seed + i, 0.18 * radius * t);
    m.ball(add(base, [wob, t * height, wob * 0.5]), radius * (1 - t * 0.82), mat, g);
  }
  return g;
}

/** Chibi legs from hips to feet. */
export function legs(m: Model, hipY: number, spread: number, r: number, mat: Mat, footMat: Mat = mat, stance = 0) {
  for (const s of [-1, 1]) {
    const g = m.group();
    m.tube([[s * spread, hipY, 0], [s * (spread + 0.01), hipY * 0.45, s * stance], [s * (spread + 0.015), r * 0.8, s * stance]], [r, r * 0.9, r * 0.85], mat, g);
    m.ell([s * (spread + 0.015), r * 0.55, s * stance + r * 0.6], [r * 1.05, r * 0.7, r * 1.5], footMat);
  }
}

/** An arm from shoulder through elbow to hand, with a round hand. */
export function arm(m: Model, shoulder: V3, elbow: V3, hand: V3, r: number, mat: Mat, handMat: Mat, handR = r * 1.15) {
  const g = m.group();
  m.tube([shoulder, elbow, hand], [r * 1.1, r, r * 0.9], mat, g);
  m.ball(hand, handR, handMat);
}

/** A flat wing/fin membrane from a root along a fan of points. */
export function membrane(m: Model, root: V3, pts: V3[], mat: Mat, g = m.group()) {
  for (let i = 0; i < pts.length - 1; i++) m.poly([root, pts[i], pts[i + 1]], mat, g);
  return g;
}

/** Mirror helper: call `f` for the right (+1) and left (−1) sides. */
export function both(f: (s: number) => void) {
  f(1);
  f(-1);
}

export { mx };
