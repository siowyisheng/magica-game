// Software rasterizer for sprite models: orthographic view from the game
// camera's elevation, at a given yaw, into a small G-buffer (material, line
// group, depth, normal) with 2×2 supersampling, plus projected face decals.

import type { Decal, Model, Part, V3 } from './model';

export interface View {
  /** Model yaw in radians: 0 faces the camera, +π/2 faces screen right. */
  yaw: number;
  /** Camera elevation in radians. */
  elevation: number;
  /** Output size in pixels. */
  w: number;
  h: number;
  /** Pixels per model unit. */
  px: number;
  /** Pixel position of the model origin (feet). */
  ox: number;
  oy: number;
}

export interface GBuffer {
  w: number;
  h: number;
  /** Material index into `mats`, -1 = empty. */
  mat: Int16Array;
  group: Int32Array;
  depth: Float32Array;
  nx: Float32Array;
  ny: Float32Array;
  nz: Float32Array;
  mats: string[];
  decals: ScreenDecal[];
  /** 1 where the pixel shows a flat polygon. */
  flatPart?: Uint8Array;
}

export interface ScreenDecal extends Decal {
  x: number;
  y: number;
  /** View-space normal. */
  vn: V3;
}

type M3 = number[]; // row-major 3×3

const mul = (a: M3, b: M3): M3 => {
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
};
const apply = (m: M3, v: V3): V3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];
function inv(m: M3): M3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  const s = 1 / det;
  return [A * s, -(b * i - c * h) * s, (b * f - c * e) * s, B * s, (a * i - c * g) * s, -(a * f - c * d) * s, C * s, -(a * h - b * g) * s, (a * e - b * d) * s];
}
const rotX = (t: number): M3 => [1, 0, 0, 0, Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t)];
const rotY = (t: number): M3 => [Math.cos(t), 0, Math.sin(t), 0, 1, 0, -Math.sin(t), 0, Math.cos(t)];
const rotZ = (t: number): M3 => [Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t), 0, 0, 0, 1];

/** Model → view rotation: yaw about y, then tilt so the camera looks down at `elevation`. */
function viewMatrix(yaw: number, el: number): M3 {
  // view: x right, y up on screen, z toward the camera
  const tilt: M3 = [1, 0, 0, 0, Math.cos(el), -Math.sin(el), 0, Math.sin(el), Math.cos(el)];
  return mul(tilt, rotY(yaw));
}

export function rasterize(model: Model, view: View): GBuffer {
  const S = 2; // supersampling
  const W = view.w * S;
  const H = view.h * S;
  const px = view.px * S;
  const ox = view.ox * S;
  const oy = view.oy * S;
  const n = W * H;
  const depth = new Float32Array(n).fill(-Infinity);
  const mat = new Int16Array(n).fill(-1);
  const group = new Int32Array(n);
  const nx = new Float32Array(n);
  const ny = new Float32Array(n);
  const nz = new Float32Array(n);
  const flat = new Uint8Array(n);
  const mats: string[] = [];
  const matIndex = (m: string) => {
    let i = mats.indexOf(m);
    if (i < 0) i = mats.push(m) - 1;
    return i;
  };
  const V = viewMatrix(view.yaw, view.elevation);
  // pixel centre → view x/y
  const sxOf = (i: number) => (i + 0.5 - ox) / px;
  const syOf = (j: number) => (oy - (j + 0.5)) / px;
  let isFlat = 0;
  const write = (idx: number, z: number, m: number, g: number, a: number, b: number, c: number) => {
    if (z <= depth[idx]) return;
    flat[idx] = isFlat;
    depth[idx] = z;
    mat[idx] = m;
    group[idx] = g;
    nx[idx] = a;
    ny[idx] = b;
    nz[idx] = c;
  };
  const bbox = (cx: number, cy: number, ex: number, ey: number) => ({
    i0: Math.max(0, Math.floor(ox + (cx - ex) * px)),
    i1: Math.min(W - 1, Math.ceil(ox + (cx + ex) * px)),
    j0: Math.max(0, Math.floor(oy - (cy + ey) * px)),
    j1: Math.min(H - 1, Math.ceil(oy - (cy - ey) * px)),
  });

  for (const part of model.parts) {
    const m = matIndex(part.mat);
    if (part.kind === 'sph') {
      const c = apply(V, part.c);
      const r = part.r;
      const { i0, i1, j0, j1 } = bbox(c[0], c[1], r, r);
      for (let j = j0; j <= j1; j++) {
        const dy = syOf(j) - c[1];
        for (let i = i0; i <= i1; i++) {
          const dx = sxOf(i) - c[0];
          const d2 = r * r - dx * dx - dy * dy;
          if (d2 <= 0) continue;
          const dz = Math.sqrt(d2);
          write(j * W + i, c[2] + dz, m, part.g, dx / r, dy / r, dz / r);
        }
      }
    } else if (part.kind === 'ell') {
      const R = mul(rotZ(part.rot[2]), mul(rotY(part.rot[1]), rotX(part.rot[0])));
      const A = mul(R, [part.r[0], 0, 0, 0, part.r[1], 0, 0, 0, part.r[2]]);
      const M = mul(V, A);
      const Q = inv(M);
      const c = apply(V, part.c);
      const ex = Math.hypot(M[0], M[1], M[2]);
      const ey = Math.hypot(M[3], M[4], M[5]);
      const w: V3 = [Q[2], Q[5], Q[8]];
      const ww = w[0] * w[0] + w[1] * w[1] + w[2] * w[2];
      const { i0, i1, j0, j1 } = bbox(c[0], c[1], ex, ey);
      for (let j = j0; j <= j1; j++) {
        const dy = syOf(j) - c[1];
        for (let i = i0; i <= i1; i++) {
          const dx = sxOf(i) - c[0];
          const u0 = Q[0] * dx + Q[1] * dy;
          const u1 = Q[3] * dx + Q[4] * dy;
          const u2 = Q[6] * dx + Q[7] * dy;
          const uw = u0 * w[0] + u1 * w[1] + u2 * w[2];
          const uu = u0 * u0 + u1 * u1 + u2 * u2;
          const disc = uw * uw - ww * (uu - 1);
          if (disc <= 0) continue;
          const s = (-uw + Math.sqrt(disc)) / ww;
          const p0 = u0 + s * w[0];
          const p1 = u1 + s * w[1];
          const p2 = u2 + s * w[2];
          // normal = Q^T p'
          let a = Q[0] * p0 + Q[3] * p1 + Q[6] * p2;
          let b = Q[1] * p0 + Q[4] * p1 + Q[7] * p2;
          let cc = Q[2] * p0 + Q[5] * p1 + Q[8] * p2;
          const l = Math.hypot(a, b, cc) || 1;
          a /= l;
          b /= l;
          cc /= l;
          write(j * W + i, c[2] + s, m, part.g, a, b, cc);
        }
      }
    } else {
      isFlat = 1;
      rasterPoly(part, V, m);
      isFlat = 0;
    }
  }

  function rasterPoly(part: Extract<Part, { kind: 'poly' }>, V: M3, m: number) {
    const pts = part.pts.map((p) => apply(V, p));
    // Newell normal
    let a = 0,
      b = 0,
      c = 0;
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k];
      const q = pts[(k + 1) % pts.length];
      a += (p[1] - q[1]) * (p[2] + q[2]);
      b += (p[2] - q[2]) * (p[0] + q[0]);
      c += (p[0] - q[0]) * (p[1] + q[1]);
    }
    const l = Math.hypot(a, b, c) || 1;
    a /= l;
    b /= l;
    c /= l;
    if (Math.abs(c) < 0.02) return; // edge-on
    if (c < 0) {
      a = -a;
      b = -b;
      c = -c;
    }
    const p0 = pts[0];
    let minx = Infinity,
      maxx = -Infinity,
      miny = Infinity,
      maxy = -Infinity;
    for (const p of pts) {
      minx = Math.min(minx, p[0]);
      maxx = Math.max(maxx, p[0]);
      miny = Math.min(miny, p[1]);
      maxy = Math.max(maxy, p[1]);
    }
    const { i0, i1, j0, j1 } = bbox((minx + maxx) / 2, (miny + maxy) / 2, (maxx - minx) / 2, (maxy - miny) / 2);
    for (let j = j0; j <= j1; j++) {
      const y = syOf(j);
      for (let i = i0; i <= i1; i++) {
        const x = sxOf(i);
        let inside = false;
        for (let k = 0, q = pts.length - 1; k < pts.length; q = k++) {
          const pk = pts[k];
          const pq = pts[q];
          if (pk[1] > y !== pq[1] > y && x < ((pq[0] - pk[0]) * (y - pk[1])) / (pq[1] - pk[1]) + pk[0]) inside = !inside;
        }
        if (!inside) continue;
        const z = p0[2] - (a * (x - p0[0]) + b * (y - p0[1])) / c;
        write(j * W + i, z, m, part.g, a, b, c);
      }
    }
  }

  // ---- downsample 2×2: filled when at least 2 subsamples hit ----
  const w = view.w;
  const h = view.h;
  const out: GBuffer = {
    w,
    h,
    mat: new Int16Array(w * h).fill(-1),
    group: new Int32Array(w * h),
    depth: new Float32Array(w * h).fill(-Infinity),
    nx: new Float32Array(w * h),
    ny: new Float32Array(w * h),
    nz: new Float32Array(w * h),
    mats,
    decals: [],
    flatPart: new Uint8Array(w * h),
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const idx = [(y * S) * W + x * S, (y * S) * W + x * S + 1, (y * S + 1) * W + x * S, (y * S + 1) * W + x * S + 1];
      const hits = idx.filter((k) => mat[k] >= 0);
      if (hits.length < 2) continue;
      // majority material; the nearest sample of it represents the pixel
      let best = hits[0];
      let bestVotes = -1;
      for (const k of hits) {
        const votes = hits.filter((q) => mat[q] === mat[k]).length;
        if (votes > bestVotes || (votes === bestVotes && depth[k] > depth[best])) {
          best = k;
          bestVotes = votes;
        }
      }
      const o = y * w + x;
      out.mat[o] = mat[best];
      out.group[o] = group[best];
      out.depth[o] = depth[best];
      out.flatPart![o] = flat[best];
      // average normal over samples of the same material, for smoother shading
      let a = 0,
        b = 0,
        c = 0;
      for (const k of hits) {
        if (mat[k] !== mat[best]) continue;
        a += nx[k];
        b += ny[k];
        c += nz[k];
      }
      const l = Math.hypot(a, b, c) || 1;
      out.nx[o] = a / l;
      out.ny[o] = b / l;
      out.nz[o] = c / l;
    }

  // ---- decals ----
  for (const d of model.decals) {
    const p = apply(V, d.p);
    const vn = apply(V, d.n);
    if (vn[2] < 0.08) continue; // facing away
    const x = view.ox + p[0] * view.px;
    const y = view.oy - p[1] * view.px;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= w || yi >= h) continue;
    // hidden behind something else nearer to the camera
    if (out.depth[yi * w + xi] > p[2] + 0.035) continue;
    out.decals.push({ ...d, x, y, vn });
  }
  return out;
}
