// Loadout rules and the starter Loadouts that ship with the game.

import { SUMMONS, kindOf } from '../kinds';
import { LOADOUT_SIZE } from '../match';

export interface Loadout {
  id: string;
  name: string;
  /** Exactly 18 Summon kind ids. */
  summons: string[];
}

/** Problems with a Loadout (empty = valid). */
export function loadoutProblems(summons: string[]): string[] {
  const p: string[] = [];
  const set = new Set(summons);
  if (set.size !== summons.length) p.push('a Summon is listed twice');
  for (const id of set) {
    try {
      if (kindOf(id).isSummoner) p.push(`${id} is a Summoner, not a Summon`);
    } catch {
      p.push(`unknown Summon ${id}`);
    }
  }
  if (set.size !== LOADOUT_SIZE) p.push(`pick exactly ${LOADOUT_SIZE} Summons (${set.size} picked)`);
  return p;
}

/** The cheapest Summon of each Element (from the live roster, overrides included). */
export function cheapestPerElement(): string[] {
  const best = new Map<string, (typeof SUMMONS)[number]>();
  for (const k of SUMMONS) {
    const b = best.get(k.element ?? '');
    if (!b || k.cost < b.cost || (k.cost === b.cost && k.id < b.id)) best.set(k.element ?? '', k);
  }
  return [...best.values()].map((k) => k.id);
}

/** Least number of the Elements' cheapest Summons a random Loadout includes. */
export const RANDOM_LOADOUT_CHEAP_MIN = 2;

/**
 * A random Loadout: 18 Summons drawn at random, with at least
 * RANDOM_LOADOUT_CHEAP_MIN of the Elements' cheapest Summons among them, so a
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
  const rest = shuffle(SUMMONS.map((k) => k.id).filter((id) => !must.includes(id))).slice(0, LOADOUT_SIZE - must.length);
  return [...must, ...rest];
}

export const STARTER_LOADOUTS: Loadout[] = [
  {
    id: 'starter:balanced',
    name: 'Balanced',
    summons: ['imp', 'archer', 'wisp', 'golem', 'drake', 'sprite', 'hawk', 'monk', 'giant', 'clod', 'sling', 'dryad', 'titan', 'bubble', 'siren', 'undine', 'shark', 'kraken'],
  },
  {
    id: 'starter:fire-air',
    name: 'Fire & Air',
    summons: ['imp', 'hound', 'archer', 'wisp', 'newt', 'golem', 'drake', 'sprite', 'hawk', 'monk', 'muse', 'harpy', 'giant', 'djinn', 'clod', 'sling', 'bubble', 'siren'],
  },
  {
    id: 'starter:earth-water',
    name: 'Earth & Water',
    summons: ['clod', 'thorn', 'sling', 'dryad', 'turtle', 'wyrm', 'titan', 'bubble', 'crab', 'siren', 'undine', 'shark', 'wolf', 'kraken', 'imp', 'archer', 'sprite', 'monk'],
  },
  {
    id: 'starter:swarm',
    name: 'Swarm',
    summons: ['imp', 'hound', 'archer', 'wisp', 'newt', 'sprite', 'hawk', 'monk', 'muse', 'harpy', 'clod', 'thorn', 'sling', 'dryad', 'bubble', 'crab', 'siren', 'undine'],
  },
  {
    id: 'starter:heavy',
    name: 'Heavy Hitters',
    summons: ['archer', 'wisp', 'newt', 'golem', 'drake', 'muse', 'harpy', 'giant', 'djinn', 'dryad', 'turtle', 'wyrm', 'titan', 'siren', 'undine', 'shark', 'wolf', 'kraken'],
  },
];
