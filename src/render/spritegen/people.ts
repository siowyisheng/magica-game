// Helpers for humanoid heads: hair and faces.

import { type Model, type Pose, type V3, add } from './model';
import { eyes, flick, mouthAt } from './kit';

/** Short hair: a cap over the skull and a fringe. */
export function hairCap(m: Model, hc: V3, r: number, mat = 'hair', fringe = true) {
  const g = m.group();
  m.ell(add(hc, [0, 0.03, -0.035]), [r * 1.06, r * 0.9, r * 0.97], mat, [0, 0, 0], g);
  if (fringe) m.ell(add(hc, [0, 0.055, 0.065]), [r * 0.88, r * 0.3, r * 0.42], mat, [0.45, 0, 0], g);
  return g;
}

/** Long hair falling down the back in `n` locks. */
export function longHair(m: Model, hc: V3, r: number, p: Pose, mat = 'hair', len = 0.28, n = 3, lift = 0) {
  const g = hairCap(m, hc, r, mat);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.055;
    const w = flick(p, i * 3 + 1, 0.012);
    m.tube([add(hc, [x, -0.02, -0.08]), add(hc, [x * 1.3 + w, -len * 0.5 + lift, -0.11]), add(hc, [x - w, -len + lift * 2, -0.09])], [0.042, 0.032, 0.01], mat, g);
  }
  return g;
}

/** A standard face: anime eyes and a small mouth. */
export function face(m: Model, hc: V3, r: number, iris = 'iris', pitch = -0.18) {
  eyes(m, hc, r, 'anime', iris, 0.4, pitch);
  mouthAt(m, hc, r, -0.55);
}
