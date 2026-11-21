// The live roster: built-in kinds with balance overrides applied.
//
// Magic Abilities are shared records: a kind lists the ids of its abilities,
// so several kinds can use the same one and editing it changes all of them.
//
// Two layers of overrides sit on the built-in data: the repo's
// `data/overrides.json` (baked-in balance changes, written by the dev tool
// through the dev server) and the browser's local overrides (experiments).
// SUMMONS and SUMMONERS are live arrays, updated in place, so every importer
// sees the current values. Overrides apply to new matches.

import { BASE_SUMMONERS, DEFAULT_SUMMONER } from './data/summoner';
import { BASE_SUMMONS } from './data/summons';
import repoOverridesJson from './data/overrides.json';
import type { MagicAbility, UnitKind } from './types';

/** The editable parts of a kind; its Magic Abilities by id. */
export type KindPatch = Partial<Pick<UnitKind, 'name' | 'cost' | 'alignment' | 'element' | 'stats' | 'moveTypes' | 'attack'>> & { magicIds?: string[] };

/** Balance overrides: per-kind patches and edited or new Magic Abilities. */
export interface Balance {
  kinds: Record<string, KindPatch>;
  abilities: Record<string, MagicAbility>;
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

/** Accept the current shape, or the older flat shape (kind id → patch with full `magic` arrays). */
export function normalizeBalance(raw: unknown): Balance {
  const r = (raw ?? {}) as Partial<Balance> & Record<string, unknown>;
  if (r.kinds || r.abilities) return { kinds: clone(r.kinds ?? {}), abilities: clone(r.abilities ?? {}) };
  const out: Balance = { kinds: {}, abilities: {} };
  for (const [id, p] of Object.entries(r)) {
    const { magic, ...rest } = (p ?? {}) as KindPatch & { magic?: MagicAbility[] };
    const patch: KindPatch = clone(rest);
    if (Array.isArray(magic)) {
      for (const m of magic) out.abilities[m.id] = clone(m);
      patch.magicIds = magic.map((m) => m.id);
    }
    out.kinds[id] = patch;
  }
  return out;
}

const BASE_ABILITIES = new Map<string, MagicAbility>();
for (const k of [...BASE_SUMMONERS, ...BASE_SUMMONS]) for (const m of k.magic) if (!BASE_ABILITIES.has(m.id)) BASE_ABILITIES.set(m.id, clone(m));

let repo: Balance = normalizeBalance(repoOverridesJson);
let local: Balance = { kinds: {}, abilities: {} };

export const SUMMONS: UnitKind[] = [];
export const SUMMONERS: UnitKind[] = [];
const KINDS = new Map<string, UnitKind>();

/** A Magic Ability as the game currently uses it (local edit, else repo, else built-in). */
export function abilityOf(id: string): MagicAbility | undefined {
  const a = local.abilities[id] ?? repo.abilities[id] ?? BASE_ABILITIES.get(id);
  return a ? { ...clone(a), id } : undefined;
}

/** A Magic Ability as shipped (repo, else built-in). */
export function shippedAbility(id: string): MagicAbility | undefined {
  const a = repo.abilities[id] ?? BASE_ABILITIES.get(id);
  return a ? { ...clone(a), id } : undefined;
}

/** Every known Magic Ability id: built-in, then repo-added, then locally added. */
export function abilityIds(): string[] {
  return [...new Set([...BASE_ABILITIES.keys(), ...Object.keys(repo.abilities), ...Object.keys(local.abilities)])];
}

export function isBuiltInAbility(id: string): boolean {
  return BASE_ABILITIES.has(id);
}

function compose(base: UnitKind, layers: Balance[], resolve: (id: string) => MagicAbility | undefined): UnitKind {
  let k: UnitKind = clone(base);
  let ids = base.magic.map((m) => m.id);
  for (const l of layers) {
    const { magicIds, ...rest } = l.kinds[base.id] ?? {};
    k = { ...k, ...clone(rest) };
    if (magicIds) ids = [...magicIds];
  }
  return { ...k, id: base.id, isSummoner: base.isSummoner, role: base.role, magic: ids.map(resolve).filter((m): m is MagicAbility => !!m) };
}

function rebuild() {
  const merged = (b: UnitKind) => compose(b, [repo, local], abilityOf);
  SUMMONS.splice(0, SUMMONS.length, ...BASE_SUMMONS.map(merged));
  SUMMONERS.splice(0, SUMMONERS.length, ...BASE_SUMMONERS.map(merged));
  KINDS.clear();
  for (const k of [...SUMMONERS, ...SUMMONS]) KINDS.set(k.id, k);
}
rebuild();

export function kindOf(id: string): UnitKind {
  const k = KINDS.get(id);
  if (!k) throw new Error(`unknown unit kind ${id}`);
  return k;
}

/** A kind as built in, before any overrides. */
export function baseKind(id: string): UnitKind {
  const k = [...BASE_SUMMONERS, ...BASE_SUMMONS].find((x) => x.id === id);
  if (!k) throw new Error(`unknown unit kind ${id}`);
  return clone(k);
}

/** A kind with only the repo's overrides (what the game ships with). */
export function shippedKind(id: string): UnitKind {
  return compose(baseKind(id), [repo], shippedAbility);
}

/** Kinds that currently use a Magic Ability. */
export function abilityUsers(id: string): UnitKind[] {
  return [...SUMMONERS, ...SUMMONS].filter((k) => k.magic.some((m) => m.id === id));
}

export function getRepoBalance(): Balance {
  return clone(repo);
}
export function getLocalBalance(): Balance {
  return clone(local);
}

/** Replace the browser's local overrides (and rebuild the roster). */
export function setLocalBalance(b: Balance) {
  local = clone(b);
  rebuild();
}

/** Replace the repo-layer overrides in memory (after the dev tool writes them). */
export function setRepoBalance(b: Balance) {
  repo = clone(b);
  rebuild();
}

/** @deprecated kept for older callers: kind patches only. */
export function setLocalOverrides(kinds: Record<string, KindPatch>) {
  setLocalBalance({ ...local, kinds: clone(kinds) });
}

export { BASE_SUMMONERS, BASE_SUMMONS, DEFAULT_SUMMONER };

/** Everything in force that differs from the built-in data: repo overrides with local edits on top. */
export function activeBalance(): Balance {
  const out: Balance = { kinds: clone(repo.kinds), abilities: { ...clone(repo.abilities), ...clone(local.abilities) } };
  for (const [id, p] of Object.entries(local.kinds)) out.kinds[id] = { ...(out.kinds[id] ?? {}), ...clone(p) };
  return out;
}

let suspended: { repo: Balance; local: Balance } | null = null;

/**
 * Use `b` as the whole balance for a while (watching a Replay), setting the
 * current overrides aside until `endTemporaryBalance`.
 */
export function applyTemporaryBalance(b: Balance) {
  if (!suspended) suspended = { repo, local };
  repo = normalizeBalance(b);
  local = { kinds: {}, abilities: {} };
  rebuild();
}

export function endTemporaryBalance() {
  if (!suspended) return;
  ({ repo, local } = suspended);
  suspended = null;
  rebuild();
}

export function temporaryBalanceActive(): boolean {
  return suspended !== null;
}
