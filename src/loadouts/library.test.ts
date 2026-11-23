import { beforeEach, describe, expect, it } from 'vitest';
import { FAMILIARS } from '../rules';

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

  it('starts empty, saves, renames-on-import and deletes', () => {
    expect(lib.listLoadouts()).toEqual([]);
    const familiars = FAMILIARS.slice(0, 20).map((k) => k.id);
    const saved = lib.saveLoadout(null, 'Mine', familiars);
    expect(lib.getLoadout(saved.id)?.name).toBe('Mine');
    expect(lib.isPlayable(saved)).toBe(true);
    expect(lib.saveProblems('mine', familiars, null)).toContain('a Loadout called “mine” already exists');
    expect(lib.saveProblems('Other', familiars.slice(1), null).some((p) => p.includes('exactly 20'))).toBe(true);
    const json = lib.exportLoadoutsJson();
    expect(lib.importLoadoutsJson(json)).toBe(1);
    expect(lib.listLoadouts().map((l) => l.name)).toContain('Mine (2)');
    lib.deleteLoadout(saved.id);
    expect(lib.getLoadout(saved.id)).toBeUndefined();
  });

  it('keeps an older 18-Familiar Loadout, listed but not playable until edited', () => {
    const old = FAMILIARS.slice(0, 18).map((k) => k.id);
    mem.set('magica.loadouts', JSON.stringify([{ id: 'old', name: 'Old', familiars: old }]));
    const l = lib.getLoadout('old')!;
    expect(l.familiars).toHaveLength(18);
    expect(lib.isPlayable(l)).toBe(false);
    // an older export imports too, still incomplete
    expect(lib.importLoadoutsJson(JSON.stringify({ loadouts: [{ name: 'Old', familiars: old }] }))).toBe(1);
    expect(lib.listLoadouts().map((x) => x.name)).toContain('Old (2)');
  });
});
