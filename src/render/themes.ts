// Map Themes: the look of Plain (2 variants), Rough (2 variants), Pit and the
// three Obstacles (DEF 5 / 10 / 15). Visual only — never rules.
//
// Readability conventions shared by every Theme:
// - Plain is a flat, calm top: colour and flat detail only, nothing raised.
// - Rough is clearly bumpy: a darker top with raised clumps, rocks or shards.
// - A Pit is a hole: the top is open with a rim, its inside dark or glowing.
// - Obstacles grow bigger and heavier with their Defense.

export type DecoShape = 'sphere' | 'box' | 'cone' | 'cyl' | 'rock';

/** One primitive, relative to the tile's top centre (y up). */
export interface Deco {
  shape: DecoShape;
  p: [number, number, number];
  s: [number, number, number];
  color: string;
  rot?: [number, number, number];
  emissive?: number;
  opacity?: number;
}

export type TopPattern = (put: (x: number, y: number, c: string) => void, rnd: () => number, n: number) => void;

export interface TileLook {
  /** Base colour of the top. */
  top: string;
  /** Flat pixel detail painted on the top texture. */
  pattern?: TopPattern;
  /** Raised clutter (Rough only), from a per-hex random source. */
  deco?: (rnd: () => number) => Deco[];
}

export interface PitLook {
  wall: string;
  floor: string;
  /** Floor glows (lava). */
  glow?: number;
  /** How far down the floor is (world units). */
  depth: number;
  deco?: (rnd: () => number) => Deco[];
}

export interface Theme {
  id: string;
  name: string;
  /** Colour of column sides (the ground under the top). */
  side: string;
  background: string;
  plain: [TileLook, TileLook];
  rough: [TileLook, TileLook];
  pit: PitLook;
  obstacles: Record<5 | 10 | 15, (rnd: () => number) => Deco[]>;
}

// ---------- helpers ----------

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Points spread over the hex top (radius ~0.7), away from the centre a little. */
function spots(rnd: () => number, n: number, rMin = 0.2, rMax = 0.62): [number, number][] {
  const out: [number, number][] = [];
  const a0 = rnd() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.8;
    const r = rMin + rnd() * (rMax - rMin);
    out.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return out;
}

const speckle =
  (colors: string[], density: number): TopPattern =>
  (put, rnd, n) => {
    for (let i = 0; i < n * n * density; i++) put(Math.floor(rnd() * n), Math.floor(rnd() * n), colors[Math.floor(rnd() * colors.length)]);
  };

const both =
  (...ps: TopPattern[]): TopPattern =>
  (put, rnd, n) =>
    ps.forEach((p) => p(put, rnd, n));

/** Little 2-pixel flowers. */
const flowers =
  (colors: string[], count: number): TopPattern =>
  (put, rnd, n) => {
    for (let i = 0; i < count; i++) {
      const x = 2 + Math.floor(rnd() * (n - 4));
      const y = 2 + Math.floor(rnd() * (n - 4));
      const c = colors[Math.floor(rnd() * colors.length)];
      put(x, y, c);
      put(x + 1, y, c);
      put(x, y + 1, c);
      put(x + 1, y + 1, '#f8f0a0');
    }
  };

/** Wavy horizontal lines (sand ripples). */
const ripples =
  (color: string): TopPattern =>
  (put, rnd, n) => {
    const ph = rnd() * 6;
    for (let row = 3; row < n; row += 5)
      for (let x = 0; x < n; x++) put(x, row + Math.round(Math.sin(x * 0.5 + ph + row) * 1.2), color);
  };

/** A grid of flagstones. */
const flagstones =
  (line: string, cracks: number): TopPattern =>
  (put, rnd, n) => {
    for (let i = 0; i < n; i++) {
      for (const k of [0, 10, 21]) {
        put(i, k, line);
      }
      const off = Math.floor(i / 10.5) % 2 ? 5 : 0;
      for (const k of [8, 19, 30]) put((k + off) % n, i, line);
    }
    for (let c = 0; c < cracks; c++) {
      let x = Math.floor(rnd() * n);
      let y = Math.floor(rnd() * n);
      for (let s = 0; s < 6; s++) {
        put(x, y, line);
        x += rnd() < 0.5 ? 1 : 0;
        y += 1;
      }
    }
  };

/** Thin glowing cracks. */
const cracks =
  (color: string, count: number): TopPattern =>
  (put, rnd, n) => {
    for (let c = 0; c < count; c++) {
      let x = Math.floor(rnd() * n);
      let y = Math.floor(rnd() * n);
      for (let s = 0; s < 10; s++) {
        put(x, y, color);
        const r = rnd();
        if (r < 0.4) x++;
        else if (r < 0.8) y++;
        else x--;
      }
    }
  };

const rocks = (rnd: () => number, n: number, colors: string[], size = 0.13, flat = 0.7): Deco[] =>
  spots(rnd, n).map(([x, z]) => {
    const s = size * (0.75 + rnd() * 0.6);
    return { shape: 'rock', p: [x, s * flat * 0.6, z], s: [s, s * flat, s], color: colors[Math.floor(rnd() * colors.length)], rot: [rnd() * 3, rnd() * 3, rnd() * 3] };
  });

const clumps = (rnd: () => number, n: number, colors: string[], size = 0.16): Deco[] =>
  spots(rnd, n).flatMap(([x, z]) => {
    const s = size * (0.8 + rnd() * 0.5);
    const c = colors[Math.floor(rnd() * colors.length)];
    return [
      { shape: 'sphere', p: [x, s * 0.7, z], s: [s, s * 1.1, s], color: c },
      { shape: 'sphere', p: [x + s * 0.7, s * 0.5, z + s * 0.2], s: [s * 0.7, s * 0.8, s * 0.7], color: c },
    ] as Deco[];
  });

const shards = (rnd: () => number, n: number, colors: string[], h = 0.34): Deco[] =>
  spots(rnd, n).map(([x, z]) => {
    const hh = h * (0.7 + rnd() * 0.6);
    return { shape: 'cone', p: [x, hh / 2, z], s: [0.08, hh, 0.08], color: colors[Math.floor(rnd() * colors.length)], rot: [(rnd() - 0.5) * 0.6, rnd() * 3, (rnd() - 0.5) * 0.6] };
  });

const spikes = (rnd: () => number, color: string): Deco[] =>
  spots(rnd, 9, 0.05, 0.55).map(([x, z]) => ({ shape: 'cone', p: [x, 0.16, z], s: [0.05, 0.32, 0.05], color }));

// ---------- the five Themes ----------

export const THEMES: Theme[] = [
  {
    id: 'meadow',
    name: 'Meadow',
    side: '#7a5a3a',
    background: '#1b2233',
    plain: [
      { top: '#8fae52', pattern: speckle(['#9cbb5c', '#83a24a'], 0.08) },
      { top: '#94b257', pattern: both(speckle(['#a0c060'], 0.05), flowers(['#ffffff', '#f2d64a', '#e890c0'], 5)) },
    ],
    rough: [
      { top: '#5f7a36', pattern: speckle(['#526c2c', '#6c8a3e'], 0.25), deco: (r) => clumps(r, 4, ['#3f5a22', '#4a6a28']) },
      { top: '#6c7848', pattern: speckle(['#5c6838', '#7c8858'], 0.2), deco: (r) => rocks(r, 5, ['#8a8a80', '#9a988c', '#76766c']) },
    ],
    pit: { wall: '#3a2a1c', floor: '#06060a', depth: 1.4, deco: (r) => rocks(r, 3, ['#2a2018'], 0.1) },
    obstacles: {
      5: (r) => clumps(r, 1, ['#3c6a28'], 0.3).map((d) => ({ ...d, p: [d.p[0] * 0.2, d.p[1], d.p[2] * 0.2] as [number, number, number] })),
      10: () => [{ shape: 'rock', p: [0, 0.36, 0], s: [0.48, 0.42, 0.44], color: '#8c8a84', rot: [0.3, 0.7, 0.2] }],
      15: () => [
        { shape: 'box', p: [0, 0.72, 0], s: [0.38, 1.44, 0.3], color: '#8a8a94', rot: [0, 0.3, 0.04] },
        { shape: 'box', p: [0, 1.46, 0], s: [0.4, 0.08, 0.32], color: '#5f8a3a', rot: [0, 0.3, 0.04] },
        { shape: 'box', p: [0.02, 0.95, 0.16], s: [0.08, 0.3, 0.02], color: '#9fe0ff', emissive: 0.8, rot: [0, 0.3, 0.04] },
      ],
    },
  },
  {
    id: 'desert',
    name: 'Desert',
    side: '#b08a58',
    background: '#2a2230',
    plain: [
      { top: '#dcc48c', pattern: ripples('#ccb27a') },
      { top: '#d8be86', pattern: both(ripples('#c8ae76'), speckle(['#b89a6a', '#e8d4a0'], 0.03)) },
    ],
    rough: [
      { top: '#b8945c', pattern: speckle(['#a8844c', '#c8a46c'], 0.25), deco: (r) => rocks(r, 5, ['#c07a48', '#a8683c', '#d08a58'], 0.15) },
      {
        top: '#c4a068',
        pattern: speckle(['#b4905a'], 0.2),
        deco: (r) => [
          ...spots(r, 3).map(([x, z]) => ({ shape: 'sphere', p: [x, 0.05, z], s: [0.3, 0.14, 0.24], color: '#c8a46c' }) as Deco),
          ...shards(r, 3, ['#7a6a3a'], 0.26),
        ],
      },
    ],
    pit: { wall: '#a07a48', floor: '#2a1a10', depth: 1.1, deco: (r) => rocks(r, 2, ['#8a6a40'], 0.1) },
    obstacles: {
      5: () => [
        { shape: 'cyl', p: [0, 0.32, 0], s: [0.12, 0.64, 0.12], color: '#4a8a3a' },
        { shape: 'cyl', p: [0.16, 0.42, 0], s: [0.07, 0.24, 0.07], color: '#4a8a3a' },
        { shape: 'cyl', p: [-0.15, 0.36, 0], s: [0.07, 0.2, 0.07], color: '#4a8a3a' },
        { shape: 'sphere', p: [0, 0.66, 0], s: [0.06, 0.05, 0.06], color: '#f070a0' },
      ],
      10: () => [
        { shape: 'rock', p: [0, 0.34, 0], s: [0.5, 0.4, 0.42], color: '#c47a46', rot: [0.2, 0.4, 0.1] },
        { shape: 'rock', p: [0.22, 0.6, 0.05], s: [0.28, 0.24, 0.26], color: '#b06c3c', rot: [0.5, 0.1, 0.3] },
      ],
      15: () => [
        { shape: 'box', p: [0, 0.1, 0], s: [0.56, 0.2, 0.56], color: '#c8a46c' },
        { shape: 'cone', p: [0, 0.9, 0], s: [0.24, 1.4, 0.24], color: '#d8b47c', rot: [0, Math.PI / 4, 0] },
        { shape: 'cone', p: [0, 1.66, 0], s: [0.06, 0.14, 0.06], color: '#ffd84a', emissive: 0.6 },
      ],
    },
  },
  {
    id: 'ruins',
    name: 'Ruins',
    side: '#6f6a62',
    background: '#1c1c26',
    plain: [
      { top: '#aca89c', pattern: flagstones('#8a867a', 0) },
      { top: '#a8a498', pattern: both(flagstones('#86827a', 3), speckle(['#6f8a4a'], 0.03)) },
    ],
    rough: [
      {
        top: '#8a8478',
        pattern: speckle(['#7a7468', '#9a9488'], 0.25),
        deco: (r) =>
          spots(r, 5).map(([x, z]) => {
            const s = 0.12 + r() * 0.08;
            return { shape: 'box', p: [x, s / 2, z], s: [s * 1.4, s, s], color: r() < 0.5 ? '#a09c90' : '#8c887c', rot: [r() * 0.6, r() * 3, r() * 0.6] } as Deco;
          }),
      },
      {
        top: '#7c8070',
        pattern: speckle(['#6c7060', '#6f8a4a'], 0.25),
        deco: (r) => [
          ...spots(r, 3).map(([x, z]) => ({ shape: 'box', p: [x, 0.08, z], s: [0.22, 0.16, 0.16], color: '#9a968a', rot: [0, r() * 3, 0.2] }) as Deco),
          ...clumps(r, 2, ['#4a6a2e'], 0.13),
        ],
      },
    ],
    pit: { wall: '#4a4640', floor: '#141214', depth: 0.9, deco: (r) => spikes(r, '#b8bcc8') },
    obstacles: {
      5: () => [
        { shape: 'box', p: [0, 0.24, 0], s: [0.46, 0.46, 0.46], color: '#9a6a3a', rot: [0, 0.4, 0] },
        { shape: 'box', p: [0, 0.24, 0], s: [0.48, 0.08, 0.48], color: '#6a4422', rot: [0, 0.4, 0] },
      ],
      10: () => [
        { shape: 'cyl', p: [0, 0.4, 0], s: [0.26, 0.8, 0.26], color: '#b8b4a8' },
        { shape: 'rock', p: [0.06, 0.84, 0], s: [0.24, 0.16, 0.22], color: '#a8a498', rot: [0.4, 0.2, 0.6] },
        { shape: 'box', p: [0, 0.04, 0], s: [0.64, 0.08, 0.64], color: '#9a968a' },
      ],
      15: () => [
        { shape: 'box', p: [0, 0.2, 0], s: [0.6, 0.4, 0.6], color: '#9a968a' },
        { shape: 'cyl', p: [0, 0.75, 0], s: [0.2, 0.7, 0.18], color: '#c0bcb0' },
        { shape: 'sphere', p: [0, 1.22, 0], s: [0.17, 0.19, 0.17], color: '#c0bcb0' },
        { shape: 'box', p: [0.22, 0.95, 0], s: [0.07, 0.4, 0.07], color: '#c0bcb0', rot: [0, 0, -0.4] },
        { shape: 'box', p: [-0.22, 0.95, 0], s: [0.07, 0.4, 0.07], color: '#c0bcb0', rot: [0, 0, 0.4] },
      ],
    },
  },
  {
    id: 'tundra',
    name: 'Tundra',
    side: '#7f93a8',
    background: '#182030',
    plain: [
      { top: '#e8eef5', pattern: speckle(['#d8e2ee', '#ffffff', '#c8dcf0'], 0.07) },
      { top: '#dfe8f2', pattern: both(speckle(['#cfdcea'], 0.06), cracks('#bcd4ec', 3)) },
    ],
    rough: [
      { top: '#b8cad8', pattern: speckle(['#a8bccc', '#c8d8e4'], 0.25), deco: (r) => shards(r, 5, ['#a8e4ff', '#c8f0ff', '#88c8f0']) },
      {
        top: '#c8d4e0',
        pattern: speckle(['#b8c4d0'], 0.2),
        deco: (r) => [
          ...spots(r, 3).map(([x, z]) => ({ shape: 'sphere', p: [x, 0.04, z], s: [0.26, 0.16, 0.22], color: '#f4f8fc' }) as Deco),
          ...shards(r, 3, ['#4a3a30'], 0.24).map((d) => ({ ...d, s: [0.03, d.s[1], 0.03] as [number, number, number] })),
        ],
      },
    ],
    pit: { wall: '#2c4a6c', floor: '#040a16', depth: 1.4, deco: (r) => shards(r, 3, ['#6ab0e0'], 0.3) },
    obstacles: {
      5: () => [
        { shape: 'sphere', p: [0, 0.14, 0], s: [0.42, 0.28, 0.38], color: '#f2f6fa' },
        { shape: 'cone', p: [0.08, 0.42, 0], s: [0.03, 0.3, 0.03], color: '#4a3a30', rot: [0, 0, -0.3] },
      ],
      10: () => [{ shape: 'box', p: [0, 0.34, 0], s: [0.6, 0.66, 0.54], color: '#a8dcf4', rot: [0, 0.35, 0], opacity: 0.9 }],
      15: () => [
        { shape: 'cone', p: [0, 0.8, 0], s: [0.34, 1.6, 0.34], color: '#3a6a9a', rot: [0, 0.3, 0] },
        { shape: 'cone', p: [0.2, 0.4, 0.06], s: [0.14, 0.7, 0.14], color: '#5a8ab8', rot: [0, 0, -0.3] },
        { shape: 'cone', p: [-0.18, 0.34, 0.02], s: [0.12, 0.6, 0.12], color: '#5a8ab8', rot: [0, 0, 0.3] },
      ],
    },
  },
  {
    id: 'volcanic',
    name: 'Volcanic',
    side: '#3a3230',
    background: '#1c1418',
    plain: [
      { top: '#6a6260', pattern: speckle(['#5a5250', '#7a7270', '#ff8a3a'], 0.06) },
      { top: '#4e4644', pattern: both(speckle(['#443c3a'], 0.08), cracks('#ff7a2a', 3)) },
    ],
    rough: [
      { top: '#3e3634', pattern: speckle(['#302826', '#4e4644'], 0.3), deco: (r) => rocks(r, 5, ['#1e1a1c', '#2c2628', '#3a3236'], 0.15, 0.95) },
      {
        top: '#463e3c',
        pattern: speckle(['#383032', '#ff8a3a'], 0.15),
        deco: (r) => [
          ...rocks(r, 3, ['#24201f', '#302a2a'], 0.14, 0.9),
          ...spots(r, 2, 0.1, 0.4).map(([x, z]) => ({ shape: 'sphere', p: [x, 0.34, z], s: [0.14, 0.12, 0.14], color: '#d8d0cc', opacity: 0.6 }) as Deco),
        ],
      },
    ],
    pit: {
      wall: '#2a1e1c',
      floor: '#ff5a14',
      glow: 1.2,
      depth: 0.35,
      deco: (r) => spots(r, 3, 0.05, 0.5).map(([x, z]) => ({ shape: 'sphere', p: [x, 0.02, z], s: [0.1, 0.06, 0.1], color: '#ffc04a', emissive: 1.4 }) as Deco),
    },
    obstacles: {
      5: () => [
        { shape: 'cyl', p: [0, 0.26, 0], s: [0.2, 0.52, 0.2], color: '#2a2220' },
        { shape: 'cone', p: [0.04, 0.6, 0], s: [0.12, 0.2, 0.12], color: '#2a2220', rot: [0, 0, 0.3] },
        { shape: 'sphere', p: [0, 0.5, 0.15], s: [0.05, 0.05, 0.03], color: '#ff7a2a', emissive: 1 },
      ],
      10: () => [{ shape: 'rock', p: [0, 0.38, 0], s: [0.5, 0.46, 0.46], color: '#1e1a1e', rot: [0.4, 0.2, 0.5] }],
      15: () => [
        { shape: 'cone', p: [0, 0.84, 0], s: [0.3, 1.68, 0.3], color: '#2a1a3a', rot: [0, 0.4, 0] },
        { shape: 'cone', p: [0.18, 0.4, 0.05], s: [0.13, 0.8, 0.13], color: '#3a2650', rot: [0, 0, -0.35] },
        { shape: 'cone', p: [0, 1.5, 0.08], s: [0.04, 0.2, 0.04], color: '#c08aff', emissive: 0.9 },
      ],
    },
  },
];

export function themeOf(id: string | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Variant of a Plain or Rough hex: the map's choice, else picked from its position. */
export function variantOf(h: { q: number; r: number }, set?: 0 | 1): 0 | 1 {
  if (set !== undefined) return set;
  const x = Math.imul(h.q * 73856093 ^ (h.r * 19349663), 0x9e3779b1) >>> 0;
  return ((x >>> 7) & 1) as 0 | 1;
}

export function hexSeed(h: { q: number; r: number }): number {
  return (Math.imul(h.q + 1000, 73856093) ^ Math.imul(h.r + 1000, 19349663)) >>> 0;
}
