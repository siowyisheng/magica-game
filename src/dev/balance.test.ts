import { describe, expect, it, afterEach } from 'vitest';
import { abilityOf, abilityUsers, getLocalBalance, kindOf } from '../rules';
import { createAbility, exportBalanceJson, importBalanceJson, isEdited, resetAll, resetKind, saveAbility, saveKind } from './balance';

describe('balance edits', () => {
  afterEach(() => resetAll());

  it('keeps only fields that differ from what ships, and drops edits that are reverted', () => {
    const imp = JSON.parse(JSON.stringify(kindOf('imp')));
    const shipped = imp.stats.atk;
    imp.stats.atk = 19;
    saveKind(imp);
    expect(kindOf('imp').stats.atk).toBe(19);
    expect(Object.keys(getLocalBalance().kinds.imp)).toEqual(['stats']);
    imp.stats.atk = shipped;
    saveKind(imp);
    expect(isEdited('imp')).toBe(false);
  });

  it('shares Abilities: one edit changes every kind that uses it', () => {
    // Strike is shared by many Familiars and Masters
    const users = abilityUsers('strike').map((k) => k.id);
    expect(users.length).toBeGreaterThanOrEqual(2);
    saveAbility({ ...abilityOf('fireball')!, range: 5 } as never);
    expect((kindOf('pyromancer').ability as { range: number }).range).toBe(5);
    // the old Master spells are still known abilities, used by no one
    expect(abilityUsers('bolt')).toEqual([]);
    expect(abilityOf('rise')?.kind).toBe('water');
    // give the Hound Kindle's Empower: both use the same record
    const hound = JSON.parse(JSON.stringify(kindOf('hound')));
    hound.ability = abilityOf('empower')!;
    saveKind(hound);
    expect(getLocalBalance().kinds.hound).toEqual({ abilityId: 'empower' });
    expect(abilityUsers('empower').map((k) => k.id).sort()).toEqual(['hound', 'wisp']);
    saveAbility({ ...abilityOf('empower')!, amount: 5 } as never);
    expect((kindOf('hound').ability as { amount?: number }).amount).toBe(5);
    // a unit's own name for its Ability
    hound.abilityName = 'Rally';
    saveKind(hound);
    expect(kindOf('hound').abilityName).toBe('Rally');
    // a new ability can be created and assigned
    const id = createAbility('Ember Rain');
    expect(abilityOf(id)?.name).toBe('Ember Rain');
  });

  it('round-trips through export / import, rejects old balances, and resets', () => {
    const shippedMp = kindOf('hermit').stats.mp;
    const hermit = JSON.parse(JSON.stringify(kindOf('hermit')));
    hermit.stats.mp = shippedMp + 3;
    saveKind(hermit);
    saveAbility({ ...abilityOf('empower')!, amount: 4 } as never);
    const json = exportBalanceJson();
    expect(JSON.parse(json).version).toBe(4);
    resetAll();
    expect(kindOf('hermit').stats.mp).toBe(shippedMp);
    importBalanceJson(json);
    expect(kindOf('hermit').stats.mp).toBe(shippedMp + 3);
    expect((kindOf('wisp').ability as { amount?: number }).amount).toBe(4);
    resetKind('hermit');
    expect(kindOf('hermit').stats.mp).toBe(shippedMp);
    expect(() => importBalanceJson('{"nope": {}}')).toThrow();
    // a balance from before one Ability per kind can't be converted
    const old = { format: 'magica-balance', version: 3, overrides: { kinds: { imp: { magicIds: ['bolt'] } }, abilities: {} } };
    expect(() => importBalanceJson(JSON.stringify(old))).toThrow(/one Ability/);
  });
});
