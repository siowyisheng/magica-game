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

export interface BeastOpts {
  fur: Mat;
  /** Chest, muzzle and paw colour. */
  light: Mat;
  pawMat?: Mat;
  iris?: Mat;
  /** Overall body scale. */
  size?: number;
}

/**
 * A four-legged beast (dog, wolf): deep chest, tucked waist, jointed legs with
 * bent hind hocks, a neck rising to a head with a tapering muzzle.
 * Returns anchor points for extra features.
 */
export function beast(m: Model, p: Pose, o: BeastOpts) {
  const k = o.size ?? 1;
  const S = (v: V3): V3 => [v[0] * k, v[1] * k, v[2] * k];
  const { swell, lift } = breathe(p);
  const body = m.group();
  // chest deeper than the hips, back sloping down to the rump
  m.ell(S([0, 0.37, 0.12]), S([0.12 * swell, 0.14 * swell, 0.13]), o.fur, [0.25, 0, 0], body);
  m.tube([S([0, 0.37, 0.08]), S([0, 0.35, -0.06]), S([0, 0.36, -0.16])], [0.11 * k * swell, 0.085 * k, 0.1 * k], o.fur, body);
  m.ell(S([0, 0.35, 0.19]), S([0.075, 0.1, 0.05]), o.light, [0.3, 0, 0]); // chest ruff
  const pawMat = o.pawMat ?? o.light;
  // front legs: straight, slim, slightly forward
  both((s) => {
    const g = m.group();
    m.tube([S([s * 0.075, 0.32, 0.15]), S([s * 0.078, 0.17, 0.17]), S([s * 0.078, 0.05, 0.18])], [0.048 * k, 0.032 * k, 0.028 * k], o.fur, g);
    m.ell(S([s * 0.078, 0.025, 0.205]), S([0.033, 0.024, 0.045]), pawMat);
  });
  // hind legs: thick thigh, bent hock
  both((s) => {
    const g = m.group();
    m.tube([S([s * 0.08, 0.34, -0.15]), S([s * 0.085, 0.22, -0.11]), S([s * 0.085, 0.13, -0.21]), S([s * 0.083, 0.05, -0.18])], [0.068 * k, 0.05 * k, 0.03 * k, 0.027 * k], o.fur, g);
    m.ell(S([s * 0.083, 0.025, -0.155]), S([0.033, 0.024, 0.045]), pawMat);
  });
  // neck and head
  const neck0 = S([0, 0.44, 0.17]);
  const hc = S([0, 0.585 + lift / k, 0.27]);
  m.tube([neck0, S([0, 0.52 + lift / k, 0.23]), add(hc, S([0, -0.03, -0.03]))], [0.085 * k, 0.07 * k, 0.065 * k], o.fur, body);
  m.ball(hc, 0.095 * k, o.fur);
  m.ell(add(hc, S([0, -0.03, 0.02])), S([0.085, 0.045, 0.07]), o.fur, [0, 0, 0]); // cheek fluff
  const muz = m.group();
  m.tube([add(hc, S([0, -0.02, 0.05])), add(hc, S([0, -0.035, 0.12])), add(hc, S([0, -0.04, 0.16]))], [0.05 * k, 0.036 * k, 0.026 * k], o.light, muz);
  m.ball(add(hc, S([0, -0.025, 0.175])), 0.02 * k, 'dark');
  // ears
  both((s) => {
    const g = m.group();
    m.spike(add(hc, S([s * 0.05, 0.05, -0.02])), add(hc, S([s * 0.075, 0.15, -0.04])), 0.032 * k, o.fur, g);
    m.spike(add(hc, S([s * 0.05, 0.06, -0.012])), add(hc, S([s * 0.07, 0.13, -0.03])), 0.016 * k, 'pink', g);
  });
  // eyes on the front of the skull
  for (const s of [-1, 1]) {
    const [pt, n] = onSphere(hc, 0.095 * k, s * 0.5, 0.15);
    m.eye(pt, n, 'beast', o.iris ?? 'iris');
  }
  // tail, rising then curling
  const sw = flick(p, 3, 0.02);
  const tail = [S([0, 0.38, -0.2]), S([0.02 + sw, 0.44, -0.29]), S([0.04 + sw, 0.52, -0.31])];
  return { hc, neck0, tail, body };
}

export interface FigureOpts {
  /** Top garment (bodice / tunic / robe top). */
  top: Mat;
  /** Skirt or robe; omit for trousers/legs. */
  skirt?: { mat: Mat; len: number; flare: number; hem?: Mat };
  legs?: { mat: Mat; boot: Mat };
  skin?: Mat;
  /** Shoulder half-width. */
  shoulders?: number;
  /** Height of the waist. */
  waistY?: number;
  /** Sleeves cover the upper arms. */
  sleeve?: Mat;
  /** Arm poses: elbow and hand positions per side (+1 right, -1 left), relative to the shoulder. */
  arms?: (s: number) => [V3, V3] | null;
  headR?: number;
  /** Hover height (floating figures). */
  hover?: number;
}

/**
 * A chibi humanoid figure with shoulders, a waist and hips, so it reads as a
 * person rather than a tube. Returns the head centre and key anchors.
 */
export function figure(m: Model, p: Pose, o: FigureOpts) {
  const { swell, lift } = breathe(p);
  const y0 = o.hover ?? 0;
  const skin = o.skin ?? 'skin';
  const sw = o.shoulders ?? 0.1;
  const waistY = y0 + (o.waistY ?? 0.27);
  const torso = m.group();
  // waist and chest
  m.ell([0, waistY + 0.02, 0], [sw * 0.62, 0.06, sw * 0.5], o.top, [0, 0, 0], torso);
  m.ell([0, waistY + 0.11 + lift * 0.5, 0.0], [sw * 0.92 * swell, 0.085, sw * 0.62 * swell], o.top, [0, 0, 0], torso);
  // shoulders
  both((s) => m.ball([s * sw * 0.85, waistY + 0.15 + lift, 0], sw * 0.36, o.sleeve ?? o.top, torso));
  if (o.skirt) {
    const { mat, len, flare } = o.skirt;
    const g = m.group();
    const top = waistY - 0.01;
    const bottom = Math.max(y0 + 0.02, top - len);
    // a bell: stacked flattened discs widening toward a flat hem
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const r = sw * (0.62 + flare * Math.pow(t, 1.4));
      const y = top - (top - bottom) * t;
      m.ell([0, y, -0.005 * t], [r, (top - bottom) / (n - 1) * 0.9 + 0.012, r * 0.86], mat, [0, 0, 0], g);
    }
    if (o.skirt.hem) m.ell([0, bottom + 0.012, -0.005], [sw * (0.62 + flare) * 1.04, 0.016, sw * (0.62 + flare) * 0.9], o.skirt.hem);
  }
  if (o.legs) {
    both((s) => {
      const g = m.group();
      m.tube([[s * sw * 0.4, waistY - 0.02, 0], [s * sw * 0.45, y0 + 0.1, 0.01], [s * sw * 0.47, y0 + 0.04, 0.02]], [0.036, 0.03, 0.028], o.legs!.mat, g);
      m.ell([s * sw * 0.47, y0 + 0.025, 0.04], [0.035, 0.026, 0.05], o.legs!.boot);
    });
  }
  // arms
  both((s) => {
    const sh: V3 = [s * sw * 0.95, waistY + 0.14 + lift, 0];
    const pose = o.arms ? o.arms(s) : ([[s * 0.04, -0.09, 0.03], [s * 0.02, -0.17, 0.06]] as [V3, V3]);
    if (!pose) return;
    const el = add(sh, pose[0]);
    const hand = add(sh, pose[1]);
    const g = m.group();
    m.tube([sh, el], [0.03, 0.027], o.sleeve ?? o.top, g);
    m.tube([el, hand], [0.025, 0.022], o.sleeve ? o.sleeve : skin, g);
    m.ball(hand, 0.026, skin);
  });
  const r = o.headR ?? 0.13;
  const hc: V3 = [0, waistY + 0.2 + r * 0.9 + lift, 0.01];
  m.ball([0, waistY + 0.2 + lift, 0], 0.03, skin); // neck
  m.ball(hc, r, skin);
  return { hc, r, waistY, sw, lift, swell, y0 };
}
