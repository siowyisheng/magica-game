// The live roster: built-in kinds with balance overrides applied.
//
// Two layers of overrides sit on the built-in data: the repo's
// `data/overrides.json` (baked-in balance changes, written by the dev tool
// through the dev server) and the browser's local overrides (experiments).
// SUMMONS and SUMMONERS are live arrays, updated in place, so every importer
// sees the current values. Overrides apply to new matches.

import { BASE_SUMMONERS, DEFAULT_SUMMONER } from './data/summoner';
import { BASE_SUMMONS } from './data/summons';
import repoOverridesJson from './data/overrides.json';
import type { UnitKind } from './types';

/** The editable parts of a kind. */
export type KindPatch = Partial<Pick<UnitKind, 'name' | 'cost' | 'alignment' | 'element' | 'stats' | 'moveTypes' | 'attack' | 'magic'>>;
export type KindOverrides = Record<string, KindPatch>;

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

let repoOverrides: KindOverrides = clone(repoOverridesJson as KindOverrides);
let localOverrides: KindOverrides = {};

export const SUMMONS: UnitKind[] = [];
export const SUMMONERS: UnitKind[] = [];
const KINDS = new Map<string, UnitKind>();

function merged(base: UnitKind): UnitKind {
  return { ...clone(base), ...clone(repoOverrides[base.id] ?? {}), ...clone(localOverrides[base.id] ?? {}), id: base.id, isSummoner: base.isSummoner, role: base.role };
}

function rebuild() {
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
  const base = baseKind(id);
  return { ...base, ...clone(repoOverrides[id] ?? {}), id };
}

export function getRepoOverrides(): KindOverrides {
  return clone(repoOverrides);
}
export function getLocalOverrides(): KindOverrides {
  return clone(localOverrides);
}

/** Replace the browser's local overrides (and rebuild the roster). */
export function setLocalOverrides(o: KindOverrides) {
  localOverrides = clone(o);
  rebuild();
}

/** Replace the repo-layer overrides in memory (after the dev tool writes them). */
export function setRepoOverrides(o: KindOverrides) {
  repoOverrides = clone(o);
  rebuild();
}

export { BASE_SUMMONERS, BASE_SUMMONS, DEFAULT_SUMMONER };
