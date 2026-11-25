import type { Alignment, Element, MoveType, Stats, UnitKind } from '../types';
import { baseAbility } from './abilities';

// The 40 Familiars, ten per Element, one at each Cost from 16 to 88 in steps
// of 8 (Upkeep is Cost / 8). Each has exactly one Ability (by id, from
// data/abilities.ts) and uses ATK (physical) or MP (magic), never both. Each
// keeps its sprite, whose key is its id: the sprite's look sets its Move Types.
// Names are at most 6 letters.
//
// This is the balance as it stood when Familiars went to one Ability each (the
// repo's overrides baked in, Speed shifted down by 6). The 21 that had an Attack
// and a Magic Ability kept the one whose stat was higher (MP on a tie); the
// comment says which. The first part of each comment names the reference the
// Familiar was first built from.

type Def = [
  id: string,
  name: string,
  element: Element,
  cost: number,
  alignment: Alignment,
  stats: [atk: number, def: number, mp: number, mdf: number, spd: number, mov: number],
  moveTypes: MoveType[],
  ability: string,
  abilityName?: string,
];

const DEFS: Def[] = [
  ['imp', 'Scamp', 'fire', 16, 'none', [5, 1, 0, 2, 5, 5], ['walk'], 'strike'], // from Fa-Rancell
  ['hound', 'Cinder', 'fire', 24, 'none', [6, 3, 0, 2, 3, 7], ['walk'], 'strike'], // from Hepitus
  ['salamander', 'Ember', 'fire', 32, 'none', [0, 3, 6, 3, 5, 5], ['walk'], 'gale-shot'], // from Hepitus; had an Attack too: MP 6 ≥ ATK 5, kept Gale Shot, ATK 5 → 0
  ['archer', 'Archon', 'fire', 40, 'day', [7, 3, 0, 4, 2, 5], ['walk'], 'shot-4'], // from Blexe
  ['wisp', 'Kindle', 'fire', 48, 'none', [0, 4, 5, 6, 6, 3], ['fly'], 'empower'], // from Fifenall (was a healer with Rekindle); had an Attack too: MP 5 ≥ ATK 3, kept Empower, ATK 3 → 0
  ['newt', 'Ashen', 'fire', 56, 'night', [7, 6, 0, 5, 7, 5], ['walk'], 'strike'], // from Dullmdaler
  ['golem', 'Magma', 'fire', 64, 'none', [7, 8, 0, 8, 4, 4], ['walk', 'wade'], 'strike'], // from Da-Colm
  ['pyromancer', 'Blaze', 'fire', 72, 'none', [0, 6, 10, 6, 3, 5], ['walk'], 'fireball'], // from Gia-Bro; had an Attack too: MP 10 ≥ ATK 8, kept Fireball, ATK 8 → 0
  ['minotaur', 'Taurus', 'fire', 80, 'none', [12, 8, 0, 6, 5, 7], ['walk'], 'strike'], // from Oonevievle
  ['drake', 'Pyrex', 'fire', 88, 'none', [0, 5, 12, 6, 6, 6], ['fly'], 'inferno'], // from Regna-Croxe; had an Attack too: MP 12 ≥ ATK 10, kept Inferno, ATK 10 → 0
  ['sprite', 'Spark', 'air', 16, 'none', [3, 1, 0, 2, 7, 4], ['fly'], 'strike'], // from Guene-Foss
  ['bat', 'Flit', 'air', 24, 'none', [0, 2, 4, 2, 4, 5], ['fly'], 'gale-shot'], // from Pelitt; had an Attack too: MP 4 ≥ ATK 3, kept Gale Shot, ATK 3 → 0
  ['hawk', 'Comet', 'air', 32, 'day', [5, 3, 0, 1, 5, 6], ['fly'], 'lob-2'], // from Guene-Foss
  ['monk', 'Squall', 'air', 40, 'night', [7, 4, 0, 3, 4, 3], ['fly'], 'lob-5'], // from Gia-Bro
  ['muse', 'Nimbus', 'air', 48, 'none', [0, 4, 6, 5, 5, 5], ['fly'], 'wind-lance'], // from Currier-Bell; had an Attack too: MP 6 ≥ ATK 6, kept Wind Lance, ATK 6 → 0
  ['harpy', 'Shriek', 'air', 56, 'none', [0, 4, 8, 3, 6, 4], ['fly'], 'downburst'], // from Currier-Bell; had an Attack too: MP 8 ≥ ATK 5, kept Downburst, ATK 5 → 0
  ['angel', 'Halo', 'air', 64, 'none', [0, 6, 6, 7, 5, 5], ['fly'], 'soothing-wind'], // from Fifenall; had an Attack too: MP 6 ≥ ATK 3, kept Soothing Wind, ATK 3 → 0
  ['giant', 'Ruin', 'air', 72, 'night', [0, 7, 9, 6, 5, 5], ['walk'], 'cyclone'], // from Zenosblead; had an Attack too: MP 9 ≥ ATK 9, kept Cyclone, ATK 9 → 0
  ['griffin', 'Talon', 'air', 80, 'none', [11, 7, 0, 6, 6, 5], ['fly'], 'strike'], // from Greon
  ['djinn', 'Vortex', 'air', 88, 'none', [0, 6, 11, 7, 6, 5], ['fly'], 'lightning'], // from Regna-Croxe; had an Attack too: MP 11 ≥ ATK 9, kept Lightning, ATK 9 → 0
  ['clod', 'Clay', 'earth', 16, 'none', [4, 3, 0, 3, 5, 4], ['walk', 'wade'], 'strike'], // from Fa-Rancell
  ['thorn', 'Briar', 'earth', 24, 'none', [0, 4, 3, 3, 3, 5], ['walk'], 'verdant-mend'], // from D-Alma; had an Attack too: MP 3 ≥ ATK 2, kept Verdant Mend, ATK 2 → 0
  ['sling', 'Thorne', 'earth', 32, 'none', [7, 5, 0, 4, 1, 5], ['walk', 'wade'], 'strike'], // from Blexe
  ['beetle', 'Scarab', 'earth', 40, 'night', [0, 5, 6, 5, 5, 4], ['walk', 'wade'], 'shockwave'], // from Dullmdaler; had an Attack too: MP 6 ≥ ATK 6, kept Shockwave, ATK 6 → 0
  ['dryad', 'Mortar', 'earth', 48, 'none', [0, 4, 8, 7, 2, 5], ['walk', 'wade'], 'boulder'], // from Gia-Bro; had an Attack too: MP 8 ≥ ATK 5, kept Boulder, ATK 5 → 0
  ['treant', 'Elder', 'earth', 56, 'day', [9, 11, 0, 8, 2, 3], ['walk'], 'strike'], // from Da-Colm
  ['turtle', 'Bunker', 'earth', 64, 'none', [0, 6, 7, 6, 4, 5], ['walk', 'wade'], 'stone-spike'], // from Neptjunoue; had an Attack too: MP 7 ≥ ATK 7, kept Stone Spike, ATK 7 → 0
  ['mammoth', 'Tusk', 'earth', 72, 'day', [10, 7, 0, 8, 7, 5], ['walk', 'wade'], 'strike'], // from Da-Colm
  ['wyrm', 'Tremor', 'earth', 80, 'none', [0, 6, 11, 6, 5, 5], ['walk', 'wade'], 'meteor'], // from Zenosblead; had an Attack too: MP 11 ≥ ATK 9, kept Meteor, ATK 9 → 0
  ['titan', 'Rook', 'earth', 88, 'none', [0, 8, 13, 9, 4, 5], ['walk'], 'shockwave'], // from Da-Colm; had an Attack too: MP 13 ≥ ATK 12, kept Shockwave, ATK 12 → 0
  ['bubble', 'Dew', 'water', 16, 'none', [5, 2, 0, 1, 7, 5], ['slow', 'swim'], 'strike'], // from Reque
  ['crab', 'Coral', 'water', 24, 'night', [0, 3, 5, 3, 5, 4], ['slow', 'swim'], 'water-jet'], // from Marme; had an Attack too: MP 5 ≥ ATK 5, kept Water Jet, ATK 5 → 0
  ['kappa', 'Ripple', 'water', 32, 'none', [7, 3, 0, 2, 4, 5], ['walk', 'swim'], 'strike'], // from Hepitus
  ['siren', 'Naiad', 'water', 40, 'none', [0, 3, 7, 4, 5, 4], ['slow', 'swim'], 'water-jet'], // from Neptjunoue; had an Attack too: MP 7 ≥ ATK 7, kept Water Jet, ATK 7 → 0
  ['undine', 'Mender', 'water', 48, 'none', [0, 5, 5, 6, 6, 6], ['slow', 'swim'], 'healing-rain'], // from D-Alma; had an Attack too: MP 5 ≥ ATK 3, kept Healing Rain, ATK 3 → 0
  ['shark', 'Harpun', 'water', 56, 'none', [9, 4, 0, 6, 4, 5], ['swim'], 'lob-5'], // from Tarbss
  ['priestess', 'Tide', 'water', 64, 'day', [0, 5, 11, 6, 6, 4], ['slow', 'swim'], 'tidal-wave'], // from Gia-Bro; had an Attack too: MP 11 ≥ ATK 8, kept Tidal Wave, ATK 8 → 0
  ['wolf', 'Frost', 'water', 72, 'none', [11, 5, 0, 6, 7, 6], ['walk', 'swim'], 'strike'], // from Oonevievle
  ['hydra', 'Hydra', 'water', 80, 'none', [14, 8, 0, 6, 6, 8], ['slow', 'swim'], 'strike'], // from Oonevievle
  ['kraken', 'Abyss', 'water', 88, 'night', [13, 9, 0, 9, 5, 6], ['slow', 'swim'], 'strike'], // from Tentarch; had Maelstrom too: ATK 13 > MP 12, kept the Attack, MP 12 → 0
];

function build([id, name, element, cost, alignment, s, moveTypes, ability, abilityName]: Def): UnitKind {
  const stats: Stats = { atk: s[0], def: s[1], mp: s[2], mdf: s[3], spd: s[4], mov: s[5] };
  return { id, name, isMaster: false, element, alignment, cost, stats, moveTypes, ability: baseAbility(ability), ...(abilityName ? { abilityName } : {}) };
}

export const ELEMENTS: readonly Element[] = ['fire', 'air', 'earth', 'water'];

/** Built-in familiars (before any balance overrides), Fire, Air, Earth, Water. */
export const BASE_FAMILIARS: readonly UnitKind[] = ELEMENTS.flatMap((e) => DEFS.filter((d) => d[2] === e).map(build));
