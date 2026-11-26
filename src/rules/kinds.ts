// The live roster: built-in kinds with balance overrides applied.
//
// Abilities are shared records: a kind names the id of its one Ability, so
// several kinds can use the same one and editing it changes all of them.
//
// Two layers of overrides sit on the built-in data: the repo's
// `data/overrides.json` (baked-in balance changes, written by the dev tool
// through the dev server) and the browser's local overrides (experiments).
// FAMILIARS and MASTERS are live arrays, updated in place, so every importer
// sees the current values. Overrides apply to new matches.

import { BASE_MASTERS, DEFAULT_MASTER } from './data/masters';
import { BASE_FAMILIARS } from './data/familiars';
import { BASE_ABILITY_LIST } from './data/abilities';
import repoOverridesJson from './data/overrides.json';
import type { Ability, SignatureStat, UnitKind } from './types';
import { powerStat } from './ability';

/** The editable parts of a kind; its Ability by id. */
export type KindPatch = Partial<Pick<UnitKind, 'name' | 'cost' | 'alignment' | 'element' | 'stats' | 'moveTypes' | 'abilityName' | 'signatureStat'>> & { abilityId?: string };

/** Balance overrides: per-kind patches and edited or new Abilities. */
export interface Balance {
  kinds: Record<string, KindPatch>;
  abilities: Record<string, Ability>;
}

/**
 * The balance format's version. 4: one Ability per kind (by `abilityId`), no
 * Mana costs, and Speed shifted down by 6. Older balances can't be converted
 * faithfully (a kind's Attack and Magic Abilities don't map onto one Ability).
 */
export const BALANCE_VERSION = 4;

/** True for a balance saved before version 4 (it names Magic Ability lists, Attacks or Mana costs). */
export function isOldBalance(raw: unknown): boolean {
  const r = (raw ?? {}) as Record<string, unknown>;
  const kinds = (r.kinds ?? (r.abilities ? {} : r)) as Record<string, Record<string, unknown>>;
  const abilities = (r.abilities ?? {}) as Record<string, Record<string, unknown>>;
  return Object.values(kinds).some((p) => p && ('magicIds' in p || 'attack' in p || 'magic' in p)) || Object.values(abilities).some((a) => a && 'manaCost' in a);
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

/** A balance in the current shape (missing parts empty). Use `isOldBalance` first: older shapes aren't converted. */
export function normalizeBalance(raw: unknown): Balance {
  const r = (raw ?? {}) as Partial<Balance>;
  return { kinds: clone(r.kinds ?? {}), abilities: clone(r.abilities ?? {}) };
}

const BASE_ABILITIES = new Map<string, Ability>();
for (const m of BASE_ABILITY_LIST) BASE_ABILITIES.set(m.id, clone(m));

let repo: Balance = normalizeBalance(repoOverridesJson);
let local: Balance = { kinds: {}, abilities: {} };

export const FAMILIARS: UnitKind[] = [];
export const MASTERS: UnitKind[] = [];
const KINDS = new Map<string, UnitKind>();

/** An Ability as the game currently uses it (local edit, else repo, else built-in). */
export function abilityOf(id: string): Ability | undefined {
  const a = local.abilities[id] ?? repo.abilities[id] ?? BASE_ABILITIES.get(id);
  return a ? { ...clone(a), id } : undefined;
}

/** An Ability as shipped (repo, else built-in). */
export function shippedAbility(id: string): Ability | undefined {
  const a = repo.abilities[id] ?? BASE_ABILITIES.get(id);
  return a ? { ...clone(a), id } : undefined;
}

/** Every known Ability id: built-in, then repo-added, then locally added. */
export function abilityIds(): string[] {
  return [...new Set([...BASE_ABILITIES.keys(), ...Object.keys(repo.abilities), ...Object.keys(local.abilities)])];
}

export function isBuiltInAbility(id: string): boolean {
  return BASE_ABILITIES.has(id);
}

function compose(base: UnitKind, layers: Balance[], resolve: (id: string) => Ability | undefined): UnitKind {
  let k: UnitKind = clone(base);
  let id = base.ability.id;
  for (const l of layers) {
    const { abilityId, ...rest } = l.kinds[base.id] ?? {};
    k = { ...k, ...clone(rest) };
    if (abilityId) id = abilityId;
  }
  if (!k.abilityName) delete k.abilityName;
  return { ...k, id: base.id, isMaster: base.isMaster, ability: resolve(id) ?? clone(base.ability) };
}

function rebuild() {
  const merged = (b: UnitKind) => compose(b, [repo, local], abilityOf);
  FAMILIARS.splice(0, FAMILIARS.length, ...BASE_FAMILIARS.map(merged));
  MASTERS.splice(0, MASTERS.length, ...BASE_MASTERS.map(merged));
  KINDS.clear();
  for (const k of [...MASTERS, ...FAMILIARS]) KINDS.set(k.id, k);
}
rebuild();

/**
 * A kind by id, or a Unit's kind: a Unit summoned as its Side's Signature gets
 * the kind with its Signature Bonus (+1 to its Signature stat).
 */
export function kindOf(x: string | { kind: string; signature?: boolean }): UnitKind {
  const id = typeof x === 'string' ? x : x.kind;
  const k = KINDS.get(id);
  if (!k) throw new Error(`unknown unit kind ${id}`);
  return typeof x !== 'string' && x.signature ? signatureKind(k) : k;
}

/** The stat a kind's Signature Bonus raises. */
export function signatureStatOf(k: UnitKind): SignatureStat {
  return k.signatureStat ?? powerStat(k);
}

const SIGNATURE_KINDS = new WeakMap<UnitKind, UnitKind>();
/** A kind with its Signature Bonus. */
export function signatureKind(k: UnitKind): UnitKind {
  if (k.isMaster) return k;
  let s = SIGNATURE_KINDS.get(k);
  if (!s) {
    const stat = signatureStatOf(k);
    s = { ...k, stats: { ...k.stats, [stat]: k.stats[stat] + 1 }, asSignature: true };
    SIGNATURE_KINDS.set(k, s);
  }
  return s;
}

/** A kind as built in, before any overrides. */
export function baseKind(id: string): UnitKind {
  const k = [...BASE_MASTERS, ...BASE_FAMILIARS].find((x) => x.id === id);
  if (!k) throw new Error(`unknown unit kind ${id}`);
  return clone(k);
}

/** A kind with only the repo's overrides (what the game ships with). */
export function shippedKind(id: string): UnitKind {
  return compose(baseKind(id), [repo], shippedAbility);
}

/** Kinds that currently use an Ability. */
export function abilityUsers(id: string): UnitKind[] {
  return [...MASTERS, ...FAMILIARS].filter((k) => k.ability.id === id);
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

export { BASE_MASTERS, BASE_FAMILIARS, DEFAULT_MASTER };

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
