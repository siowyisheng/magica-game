// The Stat Budget and a generator of power-balanced Master stat spreads.
//
// The reference table below is treated as balanced. Fitting it shows that a
// Master's stats sum to a hidden constant once each stat is priced in MP
// (the stat that pays for everything, because it sets Mana Income):
//
//   MP + w_spd·SPD + w_mov·MOV + w_def·DEF + w_mdf·MDF + w_atk·ATK·reach ≈ total
//
// ATK is priced by its reach: Move + Attack range, beyond FREE_REACH. ATK
// that can't get anywhere is worth little: a melee Master with Move 3
// pays nothing for it, one with Move 5 pays twice what Move 4 pays, and a
// ranged Master pays for every hex of range. This one rule fits the
// references about as well as separate melee and ranged prices, and it
// prices Move-and-ATK fighters correctly. The generator samples ATK, DEF, MDF, SPD and MOV with the
// references' correlations (casters are frail and slow; fighters are tough
// and fast), solves for the MP that meets the budget, and keeps the spreads
// that are most unlike each other. Names come from a catalogue of words
// tagged with the stat profile they suit.

import type { Alignment, Element, Stats, Trajectory } from './types';

export interface ReferenceSpread {
  stats: Stats;
  range: number;
  trajectory?: Trajectory;
}

type Row = [atk: number, def: number, mp: number, mdf: number, spd: number, mov: number, range: number, trajectory?: Trajectory];

/** The reference Masters the Stat Budget is fitted to (treated as balanced). */
const REFERENCE_ROWS: Row[] = [
  [8, 6, 5, 5, 15, 5, 1],
  [5, 3, 6, 4, 15, 3, 1],
  [6, 3, 6, 5, 14, 4, 1],
  [9, 7, 5, 7, 13, 4, 1],
  [7, 5, 7, 4, 11, 4, 1],
  [6, 3, 5, 4, 15, 5, 4, 'direct'],
  [5, 4, 6, 4, 14, 4, 6, 'high'],
  [7, 7, 4, 5, 16, 5, 4, 'direct'],
  [4, 4, 5, 5, 17, 6, 4, 'direct'],
  [3, 1, 7, 2, 14, 4, 1],
  [2, 4, 7, 5, 11, 4, 1],
  [1, 1, 8, 4, 12, 3, 1],
  [2, 2, 7, 3, 12, 4, 1],
  [6, 5, 6, 5, 14, 4, 1],
  [1, 1, 6, 3, 14, 6, 1],
  [6, 4, 6, 3, 13, 5, 1],
  [5, 2, 6, 7, 14, 4, 1],
  [3, 3, 6, 5, 15, 4, 1],
  [2, 2, 7, 4, 11, 4, 1],
  [8, 6, 6, 4, 14, 4, 1],
  [8, 5, 5, 5, 15, 5, 1],
  [8, 6, 5, 5, 17, 5, 1],
  [4, 2, 6, 3, 16, 3, 1],
  [9, 3, 7, 4, 12, 4, 1],
  [9, 7, 5, 6, 15, 4, 1],
  [1, 2, 8, 3, 11, 4, 1],
];

export const REFERENCE_SPREADS: readonly ReferenceSpread[] = REFERENCE_ROWS.map(([atk, def, mp, mdf, spd, mov, range, trajectory]) => ({
  stats: { atk, def, mp, mdf, spd, mov },
  range,
  ...(trajectory ? { trajectory } : {}),
}));

/** MP-equivalent prices of each stat, and the total every Master sums to. */
export interface StatBudget {
  spd: number;
  mov: number;
  def: number;
  mdf: number;
  /** Price of a point of ATK per hex of reach beyond FREE_REACH. */
  atkPerReach: number;
  total: number;
}

/** Reach (Move + Attack range) that ATK gets for free. */
export const FREE_REACH = 4;

/** How far beyond FREE_REACH a Master's ATK reaches: Move + Attack range − FREE_REACH, at least 0. */
export function atkReach(s: Stats, range: number): number {
  return Math.max(0, s.mov + range - FREE_REACH);
}

const FEATURES = (s: Stats, range: number): number[] => [s.spd, s.mov, s.def, s.mdf, s.atk * atkReach(s, range)];

/** Solve the least-squares problem A·x ≈ b (normal equations, Gaussian elimination). */
export function leastSquares(A: number[][], b: number[]): number[] {
  const n = A[0].length;
  const M = Array.from({ length: n }, (_, i) => [...Array.from({ length: n }, (_, j) => A.reduce((s, row) => s + row[i] * row[j], 0)), A.reduce((s, row, k) => s + row[i] * b[k], 0)]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** Fit the Stat Budget to reference spreads: MP = total − Σ price·stat. */
export function fitStatBudget(refs: readonly ReferenceSpread[] = REFERENCE_SPREADS): StatBudget {
  const A = refs.map((r) => [...FEATURES(r.stats, r.range).map((v) => -v), 1]);
  const x = leastSquares(A, refs.map((r) => r.stats.mp));
  return { spd: x[0], mov: x[1], def: x[2], mdf: x[3], atkPerReach: x[4], total: x[5] };
}

export const STAT_BUDGET: StatBudget = fitStatBudget();

/** A spread's value in MP: equals the budget's total when balanced. */
export function budgetValue(s: Stats, range: number, b: StatBudget = STAT_BUDGET): number {
  const f = FEATURES(s, range);
  return s.mp + b.spd * f[0] + b.mov * f[1] + b.def * f[2] + b.mdf * f[3] + b.atkPerReach * f[4];
}

/** How far a spread is from the budget, in MP (positive: stronger than balanced). */
export function budgetError(s: Stats, range: number, b: StatBudget = STAT_BUDGET): number {
  return budgetValue(s, range, b) - b.total;
}

// ---------- sampling ----------

const KEYS = ['atk', 'def', 'mdf', 'spd', 'mov'] as const;
const ALL_KEYS = ['atk', 'def', 'mp', 'mdf', 'spd', 'mov'] as const;

/**
 * Magic Defense floor for Masters. Magic reaches further than most
 * Attacks, so a Master with very low MDF would die before it could act:
 * generated spreads stay at 7 or above (soft), and no Master may go below
 * 6 (hard), with at most one at 6.
 */
export const MDF_FLOOR = { soft: 3, hard: 2, atHardFloor: 1 } as const;

/** Bounds of the references, widened by one point on each side (MOV kept to 3–6; MDF from the soft floor). */
export const STAT_BOUNDS: Record<keyof Stats, [number, number]> = {
  atk: [1, 9],
  def: [1, 8],
  mp: [4, 8],
  mdf: [3, 8], // MDF_FLOOR.soft
  spd: [10, 18],
  mov: [3, 6],
};

function meanCov(refs: readonly ReferenceSpread[]) {
  const X = refs.map((r) => KEYS.map((k) => r.stats[k]));
  const n = X.length;
  const mean = KEYS.map((_, j) => X.reduce((s, x) => s + x[j], 0) / n);
  const cov = KEYS.map((_, i) => KEYS.map((_, j) => X.reduce((s, x) => s + (x[i] - mean[i]) * (x[j] - mean[j]), 0) / (n - 1)));
  return { mean, cov };
}

function cholesky(A: number[][]): number[][] {
  const n = A.length;
  const L = A.map(() => new Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-9)) : s / L[j][j];
    }
  return L;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rng: () => number): number {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

const MELEE_REFS = REFERENCE_SPREADS.filter((r) => r.range === 1);
const DIST = meanCov(MELEE_REFS);
const CHOL = cholesky(DIST.cov);
const SD = ALL_KEYS.map((k) => {
  const v = REFERENCE_SPREADS.map((r) => r.stats[k]);
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return { k, mean: m, sd: Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1)) };
});

/** A spread in units of the references' spread (z-scores), in ALL_KEYS order. */
export function zScores(s: Stats): number[] {
  return SD.map(({ k, mean, sd }) => (s[k] - mean) / sd);
}

/** ATK of ranged Masters: the references' 4–7, widened by one (a ranged Master must be able to hurt). */
export const RANGED_ATK: [number, number] = [3, 8];

/** Largest distance from the budget a generated spread may have (MP; the references sit within about ±0.5). */
export const MAX_BUDGET_ERROR = 0.3;

/**
 * One power-balanced stat spread for a Master with the given Attack range.
 * Returns null if no spread within bounds was found in `tries` attempts.
 */
export function generateSpread(rng: () => number, range = 1, tries = 400): Stats | null {
  for (let t = 0; t < tries; t++) {
    const z = KEYS.map(() => gauss(rng));
    if (Math.hypot(...z) > 2.6) continue; // not too far from the references' shape
    const v = KEYS.map((_, i) => DIST.mean[i] + CHOL[i].reduce((s, l, j) => s + l * z[j], 0));
    const s: Stats = { atk: Math.round(v[0]), def: Math.round(v[1]), mdf: Math.round(v[2]), spd: Math.round(v[3]), mov: Math.round(v[4]), mp: 0 };
    const mpExact = STAT_BUDGET.total - (budgetValue({ ...s, mp: 0 }, range));
    s.mp = Math.round(mpExact);
    if (Math.abs(mpExact - s.mp) > MAX_BUDGET_ERROR) continue;
    if (ALL_KEYS.some((k) => s[k] < STAT_BOUNDS[k][0] || s[k] > STAT_BOUNDS[k][1])) continue;
    if (range > 1 && (s.atk < RANGED_ATK[0] || s.atk > RANGED_ATK[1])) continue;
    return s;
  }
  return null;
}

const dist = (a: number[], b: number[]) => Math.hypot(...a.map((x, i) => x - b[i]));

/**
 * `n` spreads for Masters with the given ranges (one per entry), chosen
 * from a large pool so each is as unlike the others as possible.
 */
export function generateDiverseSpreads(seed: number, ranges: number[], poolPerSpread = 120): Stats[] {
  const rng = mulberry32(seed);
  const chosen: Stats[] = [];
  const chosenZ: number[][] = [];
  // ranged first (their pools are separate), then melee
  const order = ranges.map((r, i) => [r, i] as const).sort((a, b) => b[0] - a[0]);
  const out: Stats[] = new Array(ranges.length);
  for (const [range, i] of order) {
    let best: Stats | null = null;
    let bestD = -1;
    for (let k = 0; k < poolPerSpread; k++) {
      const s = generateSpread(rng, range);
      if (!s) continue;
      const z = zScores(s);
      const d = chosenZ.length ? Math.min(...chosenZ.map((c) => dist(c, z))) : -Math.hypot(...z); // start near the centre
      if (d > bestD || best === null) {
        best = s;
        bestD = d;
      }
    }
    if (!best) throw new Error(`no spread found for range ${range}`);
    chosen.push(best);
    chosenZ.push(zScores(best));
    out[i] = best;
  }
  return out;
}

// ---------- names ----------

/** A name and the stat profile it suits (z-score targets; unlisted stats: anything). */
export interface NameEntry {
  name: string;
  profile: Partial<Record<keyof Stats, number>>;
  /** Only for ranged Masters (with the range it suits), or only for melee ones. */
  ranged?: number;
  element?: Element;
  alignment?: Alignment;
  /** What the Master looks like, and the one item or trait that makes it memorable. */
  look: string;
}

/** How well a name suits a spread: lower is better. */
export function nameFit(entry: NameEntry, s: Stats, range: number): number {
  if ((entry.ranged !== undefined) !== range > 1) return Infinity;
  const z = zScores(s);
  let d = 0;
  ALL_KEYS.forEach((k, i) => {
    const want = entry.profile[k];
    d += want === undefined ? 0.15 * z[i] * z[i] : (z[i] - want) ** 2;
  });
  if (entry.ranged !== undefined) d += 0.5 * (entry.ranged - range) ** 2;
  return d;
}

/**
 * Give each spread a name from the catalogue: names that must appear (those
 * carrying an Element or Alignment, `required`) go first to the spreads they
 * suit best, then the rest by best fit overall.
 */
export function assignNames(spreads: { stats: Stats; range: number }[], catalogue: NameEntry[], required: (e: NameEntry) => boolean): NameEntry[] {
  const out: (NameEntry | undefined)[] = new Array(spreads.length);
  const pick = (pool: NameEntry[]) => {
    const free = [...pool];
    while (free.length) {
      let best = { fit: Infinity, si: -1, ei: -1 };
      free.forEach((e, ei) =>
        spreads.forEach((s, si) => {
          if (out[si]) return;
          const fit = nameFit(e, s.stats, s.range);
          if (fit < best.fit) best = { fit, si, ei };
        }),
      );
      if (best.si < 0) return;
      const { si, ei } = best;
      out[si] = free[ei];
      free.splice(ei, 1);
    }
  };
  pick(catalogue.filter(required));
  pick(catalogue.filter((e) => !required(e)));
  if (out.some((e) => !e)) throw new Error('not enough names for the spreads');
  const names = out as NameEntry[];
  // improve: swap names between spreads, or trade one for an unused name, while the total fit improves
  const fit = (e: NameEntry, i: number) => nameFit(e, spreads[i].stats, spreads[i].range);
  for (let improved = true, rounds = 0; improved && rounds < 50; rounds++) {
    improved = false;
    for (let i = 0; i < names.length; i++)
      for (let j = i + 1; j < names.length; j++)
        if (fit(names[j], i) + fit(names[i], j) < fit(names[i], i) + fit(names[j], j) - 1e-9) {
          [names[i], names[j]] = [names[j], names[i]];
          improved = true;
        }
    const used = new Set(names);
    for (let i = 0; i < names.length; i++) {
      if (required(names[i])) continue;
      for (const u of catalogue)
        if (!used.has(u) && !required(u) && fit(u, i) < fit(names[i], i) - 1e-9) {
          used.delete(names[i]);
          used.add(u);
          names[i] = u;
          improved = true;
        }
    }
  }
  return names;
}

// ---------- a whole roster ----------

export interface GeneratedMaster {
  name: string;
  stats: Stats;
  range: number;
  trajectory?: Trajectory;
  element: Element | null;
  alignment: Alignment;
  look: string;
}

/** Ranged Masters' Attack ranges; up to 4 fly Direct, longer ones High. */
export const RANGED_RANGES = [3, 4, 4, 5, 6];

/**
 * A roster of `count` Masters: RANGED_RANGES.length of them ranged, the
 * rest melee, each spread power-balanced and named from the catalogue.
 */
export function generateRoster(seed: number, catalogue: NameEntry[], count = 30): GeneratedMaster[] {
  const ranges = [...RANGED_RANGES, ...new Array(count - RANGED_RANGES.length).fill(1)];
  const spreads = generateDiverseSpreads(seed, ranges);
  const named = assignNames(
    spreads.map((stats, i) => ({ stats, range: ranges[i] })),
    catalogue,
    (e) => !!e.element || !!e.alignment || e.ranged !== undefined,
  );
  return spreads.map((stats, i) => ({
    name: named[i].name,
    stats,
    range: ranges[i],
    ...(ranges[i] > 1 ? { trajectory: (ranges[i] <= 4 ? 'direct' : 'high') as Trajectory } : {}),
    element: named[i].element ?? null,
    alignment: named[i].alignment ?? 'none',
    look: named[i].look,
  }));
}

/** Smallest distance between any two spreads (z-scores): higher is more diverse. */
export function rosterSpread(roster: { stats: Stats }[]): number {
  const z = roster.map((r) => zScores(r.stats));
  let min = Infinity;
  for (let i = 0; i < z.length; i++) for (let j = i + 1; j < z.length; j++) min = Math.min(min, dist(z[i], z[j]));
  return min;
}
