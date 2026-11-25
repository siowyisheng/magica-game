import type { Ability } from '../types';

// The built-in Ability library. Every Unit has exactly one Ability (a Familiar
// lists its id; editing an Ability in the dev tool changes every Unit that uses
// it). Abilities are free: none costs Mana.
//
// - Physical (ATK against DEF): Strike (range 1), Shot (Direct) and Lob (High),
//   one entry per range.
// - Magic (MP against MDF for damage; heals restore MP; Empower adds ATK).
// - Unattached: abilities no Unit uses at present (Rise and Ebb were the only
//   way to change the Water Level).

export const PHYSICAL_ABILITIES: readonly Ability[] = [
  { id: 'strike', name: 'Strike', kind: 'damage', power: 'atk', range: 1, radius: 0 },
  { id: 'lob-2', name: 'Lob', kind: 'damage', power: 'atk', range: 2, radius: 0, trajectory: 'high' },
  { id: 'lob-5', name: 'Lob', kind: 'damage', power: 'atk', range: 5, radius: 0, trajectory: 'high' },
  { id: 'lob-6', name: 'Lob', kind: 'damage', power: 'atk', range: 6, radius: 0, trajectory: 'high' },
  { id: 'shot-3', name: 'Shot', kind: 'damage', power: 'atk', range: 3, radius: 0, trajectory: 'direct' },
  { id: 'shot-4', name: 'Shot', kind: 'damage', power: 'atk', range: 4, radius: 0, trajectory: 'direct' },
  { id: 'shot-5', name: 'Shot', kind: 'damage', power: 'atk', range: 5, radius: 0, trajectory: 'direct' },
];

export const MAGIC_ABILITIES: readonly Ability[] = [
  { id: 'empower', name: 'Empower', kind: 'empower', amount: 3, range: 1, radius: 0 },
  { id: 'fireball', name: 'Fireball', kind: 'damage', power: 'mp', range: 4, radius: 1, trajectory: 'high' },
  { id: 'inferno', name: 'Inferno', kind: 'damage', power: 'mp', range: 0, radius: 2, burst: true },
  { id: 'wind-lance', name: 'Wind Lance', kind: 'damage', power: 'mp', range: 5, radius: 0, trajectory: 'high' },
  { id: 'gale-shot', name: 'Gale Shot', kind: 'damage', power: 'mp', range: 4, radius: 0, trajectory: 'high' },
  { id: 'downburst', name: 'Downburst', kind: 'damage', power: 'mp', range: 4, radius: 1, trajectory: 'high' },
  { id: 'soothing-wind', name: 'Soothing Wind', kind: 'heal', range: 1, radius: 0 },
  { id: 'lightning', name: 'Lightning', kind: 'damage', power: 'mp', range: 5, radius: 1, trajectory: 'high' },
  { id: 'cyclone', name: 'Cyclone', kind: 'damage', power: 'mp', range: 0, radius: 2, burst: true },
  { id: 'verdant-mend', name: 'Verdant Mend', kind: 'heal', range: 1, radius: 0 },
  { id: 'shockwave', name: 'Shockwave', kind: 'damage', power: 'mp', range: 0, radius: 1, burst: true },
  { id: 'boulder', name: 'Boulder', kind: 'damage', power: 'mp', range: 4, radius: 1, trajectory: 'high' },
  { id: 'stone-spike', name: 'Stone Spike', kind: 'damage', power: 'mp', range: 4, radius: 0, trajectory: 'high' },
  { id: 'meteor', name: 'Meteor', kind: 'damage', power: 'mp', range: 6, radius: 0, trajectory: 'direct' },
  { id: 'healing-rain', name: 'Healing Rain', kind: 'heal', range: 1, radius: 0 },
  { id: 'water-jet', name: 'Water Jet', kind: 'damage', power: 'mp', range: 4, radius: 0, trajectory: 'direct' },
  { id: 'tidal-wave', name: 'Tidal Wave', kind: 'damage', power: 'mp', range: 5, radius: 1, trajectory: 'high' },
];

export const UNATTACHED_ABILITIES: readonly Ability[] = [
  { id: 'bolt', name: 'Bolt', kind: 'damage', power: 'mp', range: 3, radius: 0, trajectory: 'direct' },
  { id: 'rise', name: 'Rise', kind: 'water', delta: 1 },
  { id: 'ebb', name: 'Ebb', kind: 'water', delta: -1 },
  { id: 'flashfire', name: 'Flashfire', kind: 'damage', power: 'mp', range: 0, radius: 1, burst: true },
  { id: 'thunderclap', name: 'Thunderclap', kind: 'damage', power: 'mp', range: 4, radius: 1, trajectory: 'high' },
  { id: 'maelstrom', name: 'Maelstrom', kind: 'damage', power: 'mp', range: 0, radius: 2, burst: true },
];

export const BASE_ABILITY_LIST: readonly Ability[] = [...PHYSICAL_ABILITIES, ...MAGIC_ABILITIES, ...UNATTACHED_ABILITIES];

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

/** A built-in Ability by id (a copy). */
export function baseAbility(id: string): Ability {
  const a = BASE_ABILITY_LIST.find((x) => x.id === id);
  if (!a) throw new Error(`unknown ability ${id}`);
  return clone(a);
}
