import { beforeEach, describe, expect, it } from 'vitest';
import { STARTER_LOADOUTS } from '../rules';

// in-memory localStorage for node
const mem = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};

const lib = await import('./library');

describe('loadout library', () => {
  beforeEach(() => mem.clear());

  it('lists the starters, saves, renames-on-import and deletes', () => {
    expect(lib.listLoadouts().filter((l) => l.starter)).toHaveLength(STARTER_LOADOUTS.length);
    const summons = STARTER_LOADOUTS[0].summons;
    const saved = lib.saveLoadout(null, 'Mine', summons);
    expect(lib.getLoadout(saved.id)?.name).toBe('Mine');
    expect(lib.saveProblems('mine', summons, null)).toContain('a Loadout called “mine” already exists');
    expect(lib.saveProblems('Other', summons.slice(1), null).some((p) => p.includes('exactly 18'))).toBe(true);
    const json = lib.exportLoadoutsJson();
    expect(lib.importLoadoutsJson(json)).toBe(1);
    expect(lib.listLoadouts().map((l) => l.name)).toContain('Mine (2)');
    lib.deleteLoadout(saved.id);
    expect(lib.getLoadout(saved.id)).toBeUndefined();
  });

  it('never overwrites a starter', () => {
    const s = STARTER_LOADOUTS[0];
    const saved = lib.saveLoadout(s.id, 'Copy', s.summons);
    expect(saved.id).not.toBe(s.id);
  });
});
