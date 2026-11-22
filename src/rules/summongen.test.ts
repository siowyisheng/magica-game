import { describe, expect, it } from 'vitest';
import { COST_TOLERANCE, REFERENCE_SUMMONS, SUMMON_COST, generateSummonRoster, magicWorth, predictCost } from './summongen';
import { SUMMON_NAMES, SUMMON_SLOTS } from './data/summonSlots';
import { SUMMONS, SUMMONERS, kindWarnings } from './index';

const RULES = {
  withMagic: 18,
  alignments: { fire: { day: 2, night: 1 }, earth: { day: 2, night: 1 }, water: { day: 1, night: 2 }, air: { day: 1, night: 2 } },
} as const;

describe('Summon Cost model', () => {
  it('fits the references to about one Cost step, and prices Fly, Move and Magic', () => {
    const used = REFERENCE_SUMMONS.filter((r) => !r.excluded);
    const errs = used.map((r) => predictCost(r) - r.cost);
    const sd = Math.sqrt(errs.reduce((a, e) => a + e * e, 0) / errs.length);
    expect(sd).toBeLessThan(9);
    expect(SUMMON_COST.fly).toBeGreaterThan(8);
    expect(SUMMON_COST.mov).toBeGreaterThan(SUMMON_COST.spd);
    expect(SUMMON_COST.magic).toBeGreaterThan(0);
    // a Burst of radius 2 is worth more than a single-target bolt of the same MP
    expect(magicWorth(15, { kind: 'damage', range: 0, radius: 2, burst: true, manaCost: 12 })).toBeGreaterThan(magicWorth(15, { kind: 'damage', range: 4, radius: 0, manaCost: 8 }));
  });

  it('prices every shipped Summon at its Cost (within tolerance)', () => {
    for (const k of SUMMONS) {
      const m = k.magic[0];
      const spec = m && m.kind !== 'water' ? { kind: m.kind, range: m.range, radius: m.radius, burst: m.kind === 'damage' ? m.burst : undefined, manaCost: m.manaCost } : null;
      expect(Math.abs(predictCost({ stats: k.stats, moveTypes: k.moveTypes, attack: k.attack, magic: spec }) - k.cost), k.id).toBeLessThanOrEqual(COST_TOLERANCE);
    }
  });
});

describe('Summon generator', () => {
  it('fills every slot deterministically, keeping the roster rules', () => {
    const a = generateSummonRoster(2, SUMMON_SLOTS, SUMMON_NAMES, RULES, 400);
    expect(generateSummonRoster(2, SUMMON_SLOTS, SUMMON_NAMES, RULES, 400)).toEqual(a);
    expect(a).toHaveLength(28);
    expect(a.filter((g) => g.magic)).toHaveLength(18);
    expect(new Set(a.map((g) => g.name)).size).toBe(28);
    for (const g of a) {
      expect(Math.abs(predictCost(g) - g.cost)).toBeLessThanOrEqual(COST_TOLERANCE);
      expect(g.name.length).toBeLessThanOrEqual(6);
    }
    for (const [e, { day, night }] of Object.entries(RULES.alignments)) {
      expect(a.filter((g) => g.element === e && g.alignment === 'day')).toHaveLength(day);
      expect(a.filter((g) => g.element === e && g.alignment === 'night')).toHaveLength(night);
    }
  });

  it('uses names that no Summoner has', () => {
    const taken = new Set(SUMMONERS.map((k) => k.name));
    for (const n of SUMMON_NAMES) expect(taken.has(n.name), n.name).toBe(false);
    for (const k of SUMMONS) expect(kindWarnings(k, SUMMONS), k.id).toEqual([]);
  });
});
