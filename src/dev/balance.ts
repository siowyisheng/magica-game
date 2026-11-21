// Balance edits from the dev tool: kept in this browser as local overrides
// on top of what the game ships with (built-in data + the repo's
// data/overrides.json), exportable / importable as JSON, and — when running
// the dev server — writable into the repo's overrides file.
//
// Kinds and Magic Abilities are edited separately: a kind lists ability ids,
// and editing an ability changes every kind that uses it.

import {
  type Balance,
  type KindPatch,
  type MagicAbility,
  type UnitKind,
  abilityIds,
  abilityOf,
  getLocalBalance,
  getRepoBalance,
  kindOf,
  normalizeBalance,
  activeBalance,
  setLocalBalance,
  setRepoBalance,
  shippedAbility,
  shippedKind,
} from '../rules';

const KEY = 'magica.balance';
const FIELDS = ['name', 'cost', 'alignment', 'element', 'stats', 'moveTypes', 'attack'] as const;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

/** Load the browser's saved balance edits into the live roster (call at startup). */
export function loadLocalBalance() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (raw && typeof raw === 'object') setLocalBalance(normalizeBalance(raw));
  } catch {
    /* ignore broken storage */
  }
}

function persist(b: Balance) {
  setLocalBalance(b);
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    /* storage unavailable */
  }
}

/** Only the fields of a kind that differ from the shipped kind. */
function kindDiff(edited: UnitKind): KindPatch {
  const shipped = shippedKind(edited.id);
  const out: KindPatch = {};
  for (const f of FIELDS) if (!same(edited[f], shipped[f])) (out as Record<string, unknown>)[f] = clone(edited[f]);
  const ids = edited.magic.map((m) => m.id);
  if (!same(ids, shipped.magic.map((m) => m.id))) out.magicIds = ids;
  return out;
}

/** Save an edited kind (its own fields and which abilities it uses; ability contents are saved separately). */
export function saveKind(edited: UnitKind) {
  const b = getLocalBalance();
  const d = kindDiff(edited);
  if (Object.keys(d).length) b.kinds[edited.id] = d;
  else delete b.kinds[edited.id];
  persist(b);
}

/** Save an edited Magic Ability: every kind using it changes. */
export function saveAbility(a: MagicAbility) {
  const b = getLocalBalance();
  const shipped = shippedAbility(a.id);
  if (shipped && same(a, shipped)) delete b.abilities[a.id];
  else b.abilities[a.id] = clone(a);
  persist(b);
}

/** Create a new Magic Ability (local) and return its id. */
export function createAbility(name = 'New Spell'): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'spell';
  let id = base;
  for (let k = 2; abilityOf(id); k++) id = `${base}-${k}`;
  const b = getLocalBalance();
  b.abilities[id] = { id, name, kind: 'damage', range: 2, radius: 0, manaCost: 8, trajectory: 'direct' };
  persist(b);
  return id;
}

export function resetKind(id: string) {
  const b = getLocalBalance();
  delete b.kinds[id];
  persist(b);
}

/** Drop local edits to an ability (a locally created one is deleted; kinds keep the id until changed). */
export function resetAbility(id: string) {
  const b = getLocalBalance();
  delete b.abilities[id];
  persist(b);
}

export function resetAll() {
  persist({ kinds: {}, abilities: {} });
}

export function isEdited(id: string): boolean {
  return id in getLocalBalance().kinds;
}
export function isRepoEdited(id: string): boolean {
  return id in getRepoBalance().kinds;
}
export function isAbilityEdited(id: string): boolean {
  return id in getLocalBalance().abilities;
}
export function isAbilityRepoEdited(id: string): boolean {
  return id in getRepoBalance().abilities;
}

/** Everything that differs from the built-in data: repo overrides plus local edits. */
export function effectiveBalance(): Balance {
  return activeBalance();
}

export function exportBalanceJson(): string {
  return JSON.stringify({ format: 'magica-balance', version: 2, overrides: effectiveBalance() }, null, 1);
}

/** Import exported balance: it becomes the local edits (on top of what ships). */
export function importBalanceJson(text: string) {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('not a JSON file');
  }
  const raw = (data as { overrides?: unknown })?.overrides ?? data;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('not a Magica balance file');
  const b = normalizeBalance(raw);
  for (const id of Object.keys(b.kinds)) kindOf(id); // throws on unknown kinds
  persist(b);
  // keep only real differences from what ships
  for (const id of Object.keys(b.kinds)) saveKind(kindOf(id));
  for (const id of Object.keys(b.abilities)) saveAbility(abilityOf(id)!);
}

/** All abilities, for pickers. */
export function allAbilities(): MagicAbility[] {
  return abilityIds().map((id) => abilityOf(id)!).filter(Boolean);
}

/** True when the dev server's write endpoint is available. */
export const CAN_WRITE_REPO = import.meta.env.DEV;

/** Write the effective overrides into the repo's data/overrides.json (dev server only). */
export async function writeRepoBalance(): Promise<void> {
  const b = effectiveBalance();
  const res = await fetch('/__magica/overrides', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(b),
  });
  if (!res.ok) throw new Error(await res.text());
  setRepoBalance(b);
  persist({ kinds: {}, abilities: {} });
}
