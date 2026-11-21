// Loadout rules and the starter Loadouts that ship with the game.

import { kindOf } from '../kinds';
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
