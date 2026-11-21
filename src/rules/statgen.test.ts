import { describe, expect, it } from 'vitest';
import {
  REFERENCE_SPREADS,
  RANGED_ATK,
  STAT_BOUNDS,
  STAT_BUDGET,
  budgetError,
  fitStatBudget,
  generateRoster,
  generateSpread,
  mulberry32,
  nameFit,
  rosterSpread,
} from './statgen';
import { SUMMONER_NAMES } from './data/summonerNames';
import { SUMMONS } from './kinds';

describe('Stat Budget', () => {
  it('fits the references closely, with ranged ATK far dearer than melee ATK', () => {
    const errs = REFERENCE_SPREADS.map((r) => budgetError(r.stats, r.range));
    const sd = Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / errs.length);
    expect(sd).toBeLessThan(0.3);
    expect(Math.max(...errs.map(Math.abs))).toBeLessThan(0.65);
    // a point of ATK at range 4 costs several times one in melee; Speed and Move are the dear stats
    expect(STAT_BUDGET.atkPerRange * 4).toBeGreaterThan(STAT_BUDGET.atkMelee * 2.5);
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
      }
    }
  });

  it('builds a diverse, named roster deterministically', () => {
    const a = generateRoster(248, SUMMONER_NAMES);
    expect(generateRoster(248, SUMMONER_NAMES)).toEqual(a);
    expect(a).toHaveLength(30);
    expect(new Set(a.map((r) => r.name)).size).toBe(30);
    expect(rosterSpread(a)).toBeGreaterThan(1.5);
    expect(a.filter((r) => r.range > 1)).toHaveLength(5);
    for (const r of a) expect(nameFit(SUMMONER_NAMES.find((n) => n.name === r.name)!, r.stats, r.range)).toBeLessThan(Infinity);
  });

  it('has names of at most 7 letters, none shared with a Summon', () => {
    const summonNames = new Set(SUMMONS.map((k) => k.name));
    for (const n of SUMMONER_NAMES) {
      expect(n.name.length).toBeLessThanOrEqual(7);
      expect(summonNames.has(n.name)).toBe(false);
    }
  });
});
