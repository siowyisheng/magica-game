// The player's Loadouts, kept in this browser next to the starter Loadouts,
// with JSON export / import.

import { STARTER_LOADOUTS, loadoutProblems, type Loadout } from '../rules';

const KEY = 'magica.loadouts';

export interface StoredLoadout extends Loadout {
  starter: boolean;
}

function readUser(): Loadout[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Loadout[];
    return raw.filter((l) => l && typeof l.id === 'string' && typeof l.name === 'string' && Array.isArray(l.summons));
  } catch {
    return [];
  }
}

function writeUser(list: Loadout[]) {
  localStorage.setItem(KEY, JSON.stringify(list.map(({ id, name, summons }) => ({ id, name, summons }))));
}

export function listLoadouts(): StoredLoadout[] {
  return [...STARTER_LOADOUTS.map((l) => ({ ...l, starter: true })), ...readUser().map((l) => ({ ...l, starter: false }))];
}

export function getLoadout(id: string): StoredLoadout | undefined {
  return listLoadouts().find((l) => l.id === id);
}

/** Problems that stop a Loadout being saved (name and Summons). */
export function saveProblems(name: string, summons: string[], id: string | null): string[] {
  const p: string[] = [];
  const n = name.trim();
  if (!n) p.push('the Loadout needs a name');
  else if (n.length > 24) p.push('names are at most 24 characters');
  else if (listLoadouts().some((l) => l.id !== id && l.name.toLowerCase() === n.toLowerCase())) p.push(`a Loadout called “${n}” already exists`);
  return [...p, ...loadoutProblems(summons)];
}

/** Save (insert or replace) one of the player's Loadouts. Starters can't be overwritten. */
export function saveLoadout(id: string | null, name: string, summons: string[]): StoredLoadout {
  if (id?.startsWith('starter:')) id = null;
  const list = readUser();
  const entry: Loadout = { id: id ?? `loadout-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`, name: name.trim(), summons: [...summons] };
  const i = list.findIndex((l) => l.id === entry.id);
  if (i >= 0) list[i] = entry;
  else list.push(entry);
  writeUser(list);
  return { ...entry, starter: false };
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
  for (const l of items) {
    if (!l || typeof l.name !== 'string' || !Array.isArray(l.summons) || loadoutProblems(l.summons).length) continue;
    let name = l.name.trim().slice(0, 24) || 'Imported';
    for (let k = 2; saveProblems(name, l.summons, null).length; k++) name = `${l.name.trim().slice(0, 20)} (${k})`;
    saveLoadout(null, name, l.summons);
    added++;
  }
  if (!added) throw new Error('no valid Loadouts in the file');
  return added;
}
