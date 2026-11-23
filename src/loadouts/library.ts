// The player's Loadouts, kept in this browser, with JSON export / import.
// A Loadout saved under an older size stays listed but is incomplete
// (loadoutProblems explains) until it is edited to the current size.

import { loadoutProblems, type Loadout } from '../rules';

const KEY = 'magica.loadouts';

/** Loadouts saved or exported before the rename list their Familiars as `summons`. */
function withFamiliars<T extends { familiars?: string[]; summons?: string[] }>(l: T): T & { familiars: string[] } {
  const { summons, ...rest } = (l ?? {}) as T;
  return { ...(rest as T), familiars: (l?.familiars ?? summons) as string[] };
}

export type StoredLoadout = Loadout;

function readUser(): Loadout[] {
  try {
    const raw = (JSON.parse(localStorage.getItem(KEY) ?? '[]') as (Loadout & { summons?: string[] })[]).map(withFamiliars);
    return raw.filter((l) => l && typeof l.id === 'string' && typeof l.name === 'string' && Array.isArray(l.familiars));
  } catch {
    return [];
  }
}

function writeUser(list: Loadout[]) {
  localStorage.setItem(KEY, JSON.stringify(list.map(({ id, name, familiars }) => ({ id, name, familiars }))));
}

export function listLoadouts(): StoredLoadout[] {
  return readUser();
}

export function getLoadout(id: string): StoredLoadout | undefined {
  return listLoadouts().find((l) => l.id === id);
}

/** Whether a saved Loadout can be played (it has exactly the current number of valid Familiars). */
export function isPlayable(l: Loadout): boolean {
  return loadoutProblems(l.familiars).length === 0;
}

/** Problems with a Loadout's name (empty, too long, or taken by another Loadout). */
export function nameProblems(name: string, id: string | null): string[] {
  const n = name.trim();
  if (!n) return ['the Loadout needs a name'];
  if (n.length > 24) return ['names are at most 24 characters'];
  if (listLoadouts().some((l) => l.id !== id && l.name.toLowerCase() === n.toLowerCase())) return [`a Loadout called “${n}” already exists`];
  return [];
}

/** Problems that stop a Loadout being saved (name and Familiars). */
export function saveProblems(name: string, familiars: string[], id: string | null): string[] {
  return [...nameProblems(name, id), ...loadoutProblems(familiars)];
}

/** Save (insert or replace) one of the player's Loadouts. */
export function saveLoadout(id: string | null, name: string, familiars: string[]): StoredLoadout {
  const list = readUser();
  const entry: Loadout = { id: id ?? `loadout-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`, name: name.trim(), familiars: [...familiars] };
  const i = list.findIndex((l) => l.id === entry.id);
  if (i >= 0) list[i] = entry;
  else list.push(entry);
  writeUser(list);
  return entry;
}

export function deleteLoadout(id: string) {
  writeUser(readUser().filter((l) => l.id !== id));
}

export function exportLoadoutsJson(): string {
  return JSON.stringify({ format: 'magica-loadouts', version: 1, loadouts: readUser() }, null, 1);
}

/** Import exported Loadouts, adding them (renamed if a name is taken). Returns how many were added. */
export function importLoadoutsJson(text: string): number {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('not a JSON file');
  }
  const items = ((data as { loadouts?: unknown })?.loadouts ?? data) as Loadout[];
  if (!Array.isArray(items)) throw new Error('not a Magica loadouts file');
  let added = 0;
  for (const raw of items) {
    const l = raw && typeof raw === 'object' ? withFamiliars(raw as Loadout & { summons?: string[] }) : raw;
    // an older export may have fewer Familiars: keep it (incomplete) as long as every Familiar is real
    if (!l || typeof l.name !== 'string' || !Array.isArray(l.familiars) || loadoutProblems(l.familiars).some((p) => !p.startsWith('pick exactly'))) continue;
    let name = l.name.trim().slice(0, 24) || 'Imported';
    for (let k = 2; nameProblems(name, null).length; k++) name = `${l.name.trim().slice(0, 20)} (${k})`;
    saveLoadout(null, name, l.familiars);
    added++;
  }
  if (!added) throw new Error('no valid Loadouts in the file');
  return added;
}
