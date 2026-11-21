import { describe, expect, it, afterEach } from 'vitest';
import { abilityOf, abilityUsers, getLocalBalance, kindOf } from '../rules';
import { createAbility, exportBalanceJson, importBalanceJson, isEdited, resetAll, resetKind, saveAbility, saveKind } from './balance';

describe('balance edits', () => {
  afterEach(() => resetAll());

  it('keeps only fields that differ from what ships, and drops edits that are reverted', () => {
    const imp = JSON.parse(JSON.stringify(kindOf('imp')));
    imp.stats.atk = 19;
    saveKind(imp);
    expect(kindOf('imp').stats.atk).toBe(19);
    expect(Object.keys(getLocalBalance().kinds.imp)).toEqual(['stats']);
    imp.stats.atk = 13;
    saveKind(imp);
    expect(isEdited('imp')).toBe(false);
  });

  it('shares Magic Abilities: one edit changes every kind that uses it', () => {
    // all Summoners share Bolt
    const bolt = abilityOf('bolt')!;
    expect(abilityUsers('bolt').length).toBe(30);
    saveAbility({ ...bolt, manaCost: 16 });
    expect(kindOf('regent').magic[0].manaCost).toBe(16);
    expect(kindOf('oni').magic[0].manaCost).toBe(16);
    // give the Hound the Imp's Spark: both use the same record
    const hound = JSON.parse(JSON.stringify(kindOf('hound')));
    hound.magic = [abilityOf('spark')!];
    saveKind(hound);
    expect(abilityUsers('spark').map((k) => k.id).sort()).toEqual(['hound', 'imp']);
    saveAbility({ ...abilityOf('spark')!, manaCost: 12 });
    expect(kindOf('hound').magic[0].manaCost).toBe(12);
    expect(kindOf('imp').magic[0].manaCost).toBe(12);
    // a new ability can be created and assigned
    const id = createAbility('Ember Rain');
    expect(abilityOf(id)?.name).toBe('Ember Rain');
  });

  it('round-trips through export / import, and resets', () => {
    const hermit = JSON.parse(JSON.stringify(kindOf('hermit')));
    hermit.stats.mp = 20;
    saveKind(hermit);
    saveAbility({ ...abilityOf('rise')!, manaCost: 24 });
    const json = exportBalanceJson();
    resetAll();
    expect(kindOf('hermit').stats.mp).toBe(14);
    importBalanceJson(json);
    expect(kindOf('hermit').stats.mp).toBe(20);
    expect(kindOf('hermit').magic[1].manaCost).toBe(24);
    resetKind('hermit');
    expect(kindOf('hermit').stats.mp).toBe(14);
    expect(() => importBalanceJson('{"nope": {}}')).toThrow();
  });
});
