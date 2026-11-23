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

  it('shares Magic Abilities: one edit changes every kind that uses it', () => {
    // Coral and Mender share Healing Rain
    const rain = abilityOf('healing-rain')!;
    expect(abilityUsers('healing-rain').map((k) => k.id).sort()).toEqual(['crab', 'undine']);
    saveAbility({ ...rain, manaCost: 6 });
    expect(kindOf('crab').magic[0].manaCost).toBe(6);
    expect(kindOf('undine').magic[0].manaCost).toBe(6);
    // Summoners have none, but their old spells are still known abilities
    expect(kindOf('regent').magic).toEqual([]);
    expect(abilityUsers('bolt')).toEqual([]);
    expect(abilityOf('rise')?.kind).toBe('water');
    // give the Hound the Wisp's Rekindle: both use the same record
    const hound = JSON.parse(JSON.stringify(kindOf('hound')));
    hound.magic = [abilityOf('rekindle')!];
    saveKind(hound);
    expect(abilityUsers('rekindle').map((k) => k.id).sort()).toEqual(['hound', 'wisp']);
    saveAbility({ ...abilityOf('rekindle')!, manaCost: 12 });
    expect(kindOf('hound').magic[0].manaCost).toBe(12);
    expect(kindOf('wisp').magic[0].manaCost).toBe(12);
    // a new ability can be created and assigned
    const id = createAbility('Ember Rain');
    expect(abilityOf(id)?.name).toBe('Ember Rain');
  });

  it('round-trips through export / import, and resets', () => {
    const hermit = JSON.parse(JSON.stringify(kindOf('hermit')));
    hermit.stats.mp = 10;
    saveKind(hermit);
    saveAbility({ ...abilityOf('healing-rain')!, manaCost: 6 });
    const json = exportBalanceJson();
    resetAll();
    expect(kindOf('hermit').stats.mp).toBe(7);
    importBalanceJson(json);
    expect(kindOf('hermit').stats.mp).toBe(10);
    expect(kindOf('crab').magic[0].manaCost).toBe(6);
    resetKind('hermit');
    expect(kindOf('hermit').stats.mp).toBe(7);
    expect(() => importBalanceJson('{"nope": {}}')).toThrow();
  });
});
