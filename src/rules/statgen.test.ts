import { describe, expect, it } from 'vitest';
import {
  REFERENCE_SPREADS,
  MDF_FLOOR,
  RANGED_ATK,
  STAT_BOUNDS,
  STAT_BUDGET,
  budgetError,
  budgetValue,
  fitStatBudget,
  generateRoster,
  generateSpread,
  mulberry32,
  nameFit,
  rosterSpread,
} from './statgen';
import { MASTER_NAMES } from './data/masterNames';
import { FAMILIARS } from './kinds';

describe('Stat Budget', () => {
  it('fits the references closely, pricing ATK by its reach', () => {
    const errs = REFERENCE_SPREADS.map((r) => budgetError(r.stats, r.range));
    const sd = Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / errs.length);
    expect(sd).toBeLessThan(0.32);
    expect(Math.max(...errs.map(Math.abs))).toBeLessThan(0.8);
    // ATK costs nothing at Move 3 melee, more with each hex of Move or range
    const base = { atk: 10, def: 10, mp: 10, mdf: 10, spd: 12, mov: 3 };
    const atkCost = (mov: number, range: number) => budgetValue({ ...base, mov, atk: 15 }, range) - budgetValue({ ...base, mov, atk: 5 }, range);
    expect(atkCost(3, 1)).toBe(0);
    expect(atkCost(5, 1)).toBeCloseTo(2 * atkCost(4, 1));
    expect(atkCost(5, 4)).toBeGreaterThan(4 * atkCost(4, 1));
    expect(STAT_BUDGET.atkPerReach).toBeGreaterThan(0);
    expect(STAT_BUDGET.spd).toBeGreaterThan(STAT_BUDGET.def);
    expect(STAT_BUDGET.mov).toBeGreaterThan(STAT_BUDGET.mdf);
    expect(fitStatBudget()).toEqual(STAT_BUDGET);
  });

  it('generates spreads on the budget and within bounds, for melee and ranged', () => {
    const rng = mulberry32(5);
    for (const range of [1, 3, 6]) {
      for (let i = 0; i < 30; i++) {
        const s = generateSpread(rng, range)!;
        expect(s).not.toBeNull();
        expect(Math.abs(budgetError(s, range))).toBeLessThanOrEqual(0.3);
        for (const [k, [lo, hi]] of Object.entries(STAT_BOUNDS)) {
          expect(s[k as keyof typeof s]).toBeGreaterThanOrEqual(lo);
          expect(s[k as keyof typeof s]).toBeLessThanOrEqual(hi);
        }
        if (range > 1) expect(s.atk).toBeGreaterThanOrEqual(RANGED_ATK[0]);
        expect(s.mdf).toBeGreaterThanOrEqual(MDF_FLOOR.soft);
      }
    }
  });

  it('builds a diverse, named roster deterministically', () => {
    const a = generateRoster(248, MASTER_NAMES);
    expect(generateRoster(248, MASTER_NAMES)).toEqual(a);
    expect(a).toHaveLength(30);
    expect(new Set(a.map((r) => r.name)).size).toBe(30);
    expect(rosterSpread(a)).toBeGreaterThan(1.5);
    expect(a.filter((r) => r.range > 1)).toHaveLength(5);
    for (const r of a) expect(nameFit(MASTER_NAMES.find((n) => n.name === r.name)!, r.stats, r.range)).toBeLessThan(Infinity);
  });

  it('has names of at most 7 letters, none shared with a Familiar', () => {
    const familiarNames = new Set(FAMILIARS.map((k) => k.name));
    for (const n of MASTER_NAMES) {
      expect(n.name.length).toBeLessThanOrEqual(7);
      expect(familiarNames.has(n.name)).toBe(false);
    }
  });
});

describe('MDF floor check', () => {
  it('flags a Master below 2, and a second one below 3', async () => {
    const { MASTERS, kindWarnings } = await import('./index');
    const k = MASTERS.find((x) => x.id === 'regent')!;
    expect(kindWarnings({ ...k, stats: { ...k.stats, mdf: 1 } }, MASTERS).join()).toMatch(/MDF 2 or more/);
    const lowered = MASTERS.map((x) => (x.id === 'regent' ? { ...x, stats: { ...x.stats, mdf: 2 } } : x));
    expect(kindWarnings(lowered.find((x) => x.id === 'regent')!, lowered).join()).toMatch(/only 1 Master/);
    expect(kindWarnings(k, MASTERS)).toEqual([]);
  });
});
