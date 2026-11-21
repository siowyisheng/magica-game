import { describe, expect, it, afterEach } from 'vitest';
import { getLocalOverrides, kindOf } from '../rules';
import { exportBalanceJson, importBalanceJson, isEdited, resetAll, resetKind, saveKind } from './balance';

describe('balance edits', () => {
  afterEach(() => resetAll());

  it('keeps only fields that differ from what ships, and drops edits that are reverted', () => {
    const imp = JSON.parse(JSON.stringify(kindOf('imp')));
    imp.stats.atk = 19;
    saveKind(imp);
    expect(kindOf('imp').stats.atk).toBe(19);
    expect(Object.keys(getLocalOverrides().imp)).toEqual(['stats']);
    imp.stats.atk = 13;
    saveKind(imp);
    expect(isEdited('imp')).toBe(false);
  });

  it('round-trips through export / import, and resets', () => {
    const sexton = JSON.parse(JSON.stringify(kindOf('sexton')));
    sexton.stats.mp = 20;
    sexton.magic[0].manaCost = 16;
    saveKind(sexton);
    const json = exportBalanceJson();
    resetAll();
    expect(kindOf('sexton').stats.mp).toBe(17);
    importBalanceJson(json);
    expect(kindOf('sexton').stats.mp).toBe(20);
    expect(kindOf('sexton').magic[0].manaCost).toBe(16);
    resetKind('sexton');
    expect(kindOf('sexton').stats.mp).toBe(17);
    expect(() => importBalanceJson('{"nope": {}}')).toThrow();
  });
});
