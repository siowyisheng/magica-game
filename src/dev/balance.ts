// Balance edits from the dev tool: kept in this browser as local overrides
// on top of what the game ships with (built-in data + the repo's
// data/overrides.json), exportable / importable as JSON, and — when running
// the dev server — writable into the repo's overrides file.

import {
  type KindOverrides,
  type KindPatch,
  type UnitKind,
  getLocalOverrides,
  getRepoOverrides,
  kindOf,
  setLocalOverrides,
  setRepoOverrides,
  shippedKind,
} from '../rules';

const KEY = 'magica.balance';
const FIELDS = ['name', 'cost', 'alignment', 'element', 'stats', 'moveTypes', 'attack', 'magic'] as const;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Load the browser's saved balance edits into the live roster (call at startup). */
export function loadLocalBalance() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (raw && typeof raw === 'object') setLocalOverrides(raw as KindOverrides);
  } catch {
    /* ignore broken storage */
  }
}

function persist(o: KindOverrides) {
  setLocalOverrides(o);
  try {
    localStorage.setItem(KEY, JSON.stringify(o));
  } catch {
    /* storage unavailable */
  }
}

/** Only the fields that differ from the shipped kind. */
function diff(edited: UnitKind): KindPatch {
  const shipped = shippedKind(edited.id);
  const out: KindPatch = {};
  for (const f of FIELDS) if (!same(edited[f], shipped[f])) (out as Record<string, unknown>)[f] = JSON.parse(JSON.stringify(edited[f]));
  return out;
}

/** Save an edited kind as a local override (or drop the override if it matches what ships). */
export function saveKind(edited: UnitKind) {
  const o = getLocalOverrides();
  const d = diff(edited);
  if (Object.keys(d).length) o[edited.id] = d;
  else delete o[edited.id];
  persist(o);
}

export function resetKind(id: string) {
  const o = getLocalOverrides();
  delete o[id];
  persist(o);
}

export function resetAll() {
  persist({});
}

export function isEdited(id: string): boolean {
  return id in getLocalOverrides();
}
export function isRepoEdited(id: string): boolean {
  return id in getRepoOverrides();
}

/** Everything that differs from the built-in data: repo overrides plus local edits, merged per kind. */
export function effectiveOverrides(): KindOverrides {
  const repo = getRepoOverrides();
  const local = getLocalOverrides();
  const out: KindOverrides = { ...repo };
  for (const [id, p] of Object.entries(local)) out[id] = { ...(repo[id] ?? {}), ...p };
  return out;
}

export function exportBalanceJson(): string {
  return JSON.stringify({ format: 'magica-balance', version: 1, overrides: effectiveOverrides() }, null, 1);
}

/** Import exported balance: it becomes the local edits (on top of what ships). */
export function importBalanceJson(text: string) {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('not a JSON file');
  }
  const o = ((data as { overrides?: unknown })?.overrides ?? data) as KindOverrides;
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('not a Magica balance file');
  for (const id of Object.keys(o)) kindOf(id); // throws on unknown kinds
  // keep only differences from what ships
  const local: KindOverrides = {};
  for (const [id, p] of Object.entries(o)) {
    const edited = { ...kindOf(id), ...shippedKind(id), ...p, id } as UnitKind;
    const d = diff(edited);
    if (Object.keys(d).length) local[id] = d;
  }
  persist(local);
}

/** True when the dev server's write endpoint is available. */
export const CAN_WRITE_REPO = import.meta.env.DEV;

/** Write the effective overrides into the repo's data/overrides.json (dev server only). */
export async function writeRepoBalance(): Promise<void> {
  const overrides = effectiveOverrides();
  const res = await fetch('/__magica/overrides', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(overrides),
  });
  if (!res.ok) throw new Error(await res.text());
  setRepoOverrides(overrides);
  persist({});
}
