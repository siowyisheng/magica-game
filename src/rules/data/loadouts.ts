// Loadout rules, and random Loadouts. (No Loadouts ship with the game.)

import { FAMILIARS, kindOf } from '../kinds';
import { LOADOUT_SIZE } from '../match';

export interface Loadout {
  id: string;
  name: string;
  /** Exactly LOADOUT_SIZE Familiar kind ids. */
  familiars: string[];
  /** Its Signature Familiar, one of `familiars` (missing in Loadouts saved before Signatures). */
  signature?: string;
}

/** The problem reported for a Loadout with no (valid) Signature. */
export const NO_SIGNATURE = 'pick a Signature Familiar';

/** Problems with a Loadout (empty = valid). */
export function loadoutProblems(familiars: string[], signature: string | null | undefined): string[] {
  const p: string[] = [];
  const set = new Set(familiars);
  if (set.size !== familiars.length) p.push('a Familiar is listed twice');
  for (const id of set) {
    try {
      if (kindOf(id).isMaster) p.push(`${id} is a Master, not a Familiar`);
    } catch {
      p.push(`unknown Familiar ${id}`);
    }
  }
  if (set.size !== LOADOUT_SIZE) p.push(`pick exactly ${LOADOUT_SIZE} Familiars (${set.size} picked)`);
  if (!signature || !set.has(signature)) p.push(NO_SIGNATURE);
  return p;
}

/** The cheapest Familiar of each Element (from the live roster, overrides included). */
export function cheapestPerElement(): string[] {
  const best = new Map<string, (typeof FAMILIARS)[number]>();
  for (const k of FAMILIARS) {
    const b = best.get(k.element ?? '');
    if (!b || k.cost < b.cost || (k.cost === b.cost && k.id < b.id)) best.set(k.element ?? '', k);
  }
  return [...best.values()].map((k) => k.id);
}

/** Least number of the Elements' cheapest Familiars a random Loadout includes. */
export const RANDOM_LOADOUT_CHEAP_MIN = 2;

/**
 * A random Loadout: LOADOUT_SIZE Familiars drawn at random, with at least
 * RANDOM_LOADOUT_CHEAP_MIN of the Elements' cheapest Familiars among them, so a
 * Side always has something cheap to open with.
 */
export function randomLoadout(rand: () => number = Math.random): string[] {
  const shuffle = <T>(xs: T[]) => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const cheap = cheapestPerElement();
  const must = shuffle(cheap).slice(0, Math.min(RANDOM_LOADOUT_CHEAP_MIN, cheap.length));
  const rest = shuffle(FAMILIARS.map((k) => k.id).filter((id) => !must.includes(id))).slice(0, LOADOUT_SIZE - must.length);
  return [...must, ...rest];
}

/** A random Signature from a Loadout's Familiars. */
export function randomSignature(familiars: string[], rand: () => number = Math.random): string {
  return familiars[Math.floor(rand() * familiars.length)];
}
