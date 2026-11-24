import { describe, expect, it, afterEach } from 'vitest';
import { FAMILIARS, abilityOf, abilityUsers, getLocalBalance, kindOf } from '../rules';
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
    // an ability two shipped Familiars share (whichever it is in the current roster)
    const shared = FAMILIARS.flatMap((k) => k.magic.map((m) => m.id)).find((id, i, all) => all.indexOf(id) !== i)!;
    const users = abilityUsers(shared).map((k) => k.id);
    expect(users.length).toBeGreaterThanOrEqual(2);
    saveAbility({ ...abilityOf(shared)!, manaCost: 6 });
    for (const id of users) expect(kindOf(id).magic.find((m) => m.id === shared)!.manaCost).toBe(6);
    // Masters have none, but their old spells are still known abilities
    expect(kindOf('regent').magic).toEqual([]);
    expect(abilityUsers('bolt')).toEqual([]);
    expect(abilityOf('rise')?.kind).toBe('water');
    // give the Hound Kindle's Empower: both use the same record
    const hound = JSON.parse(JSON.stringify(kindOf('hound')));
    hound.magic = [abilityOf('empower')!];
    saveKind(hound);
    expect(abilityUsers('empower').map((k) => k.id).sort()).toEqual(['hound', 'wisp']);
    saveAbility({ ...abilityOf('empower')!, manaCost: 12 });
    expect(kindOf('hound').magic[0].manaCost).toBe(12);
    expect(kindOf('wisp').magic[0].manaCost).toBe(12);
    // a new ability can be created and assigned
    const id = createAbility('Ember Rain');
    expect(abilityOf(id)?.name).toBe('Ember Rain');
  });

  it('round-trips through export / import, and resets', () => {
    const shippedMp = kindOf('hermit').stats.mp;
    const hermit = JSON.parse(JSON.stringify(kindOf('hermit')));
    hermit.stats.mp = shippedMp + 3;
    saveKind(hermit);
    saveAbility({ ...abilityOf('empower')!, manaCost: 6 });
    const json = exportBalanceJson();
    resetAll();
    expect(kindOf('hermit').stats.mp).toBe(shippedMp);
    importBalanceJson(json);
    expect(kindOf('hermit').stats.mp).toBe(shippedMp + 3);
    expect(kindOf('wisp').magic[0].manaCost).toBe(6);
    resetKind('hermit');
    expect(kindOf('hermit').stats.mp).toBe(shippedMp);
    expect(() => importBalanceJson('{"nope": {}}')).toThrow();
  });
});
