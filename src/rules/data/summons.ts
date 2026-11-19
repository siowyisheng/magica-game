import type { Alignment, Element, MagicAbility, MoveType, Stats, UnitKind } from '../types';

// 28 original placeholder Summons, 7 per Element. Names are at most 6
// letters. Costs are multiples of 8 in 16..96 and unique within each
// Element; Upkeep is Cost / 8. Each Element: 2 Day, 2 Night, 3 unaligned.
// Abilities have no power: strength comes from ATK / MP only.

type Def = [
  id: string,
  name: string,
  cost: number,
  alignment: Alignment,
  role: string,
  stats: [atk: number, def: number, mp: number, mdf: number, spd: number, mov: number],
  moveTypes: MoveType[],
  attackRange: number,
  magic: Omit<Extract<MagicAbility, { kind: 'damage' | 'heal' }>, 'id'>,
];

const dmg = (name: string, range: number, manaCost: number, radius: 0 | 1 = 0) =>
  ({ name, kind: 'damage', range, radius, manaCost }) as const;
const heal = (name: string, range: number, manaCost: number, radius: 0 | 1 = 0) =>
  ({ name, kind: 'heal', range, radius, manaCost }) as const;

const TABLE: Record<Element, Def[]> = {
  fire: [
    ['imp', 'Imp', 16, 'night', 'scout', [13, 9, 11, 9, 13, 5], ['walk'], 1, dmg('Spark', 2, 4)],
    ['hound', 'Hound', 24, 'none', 'fighter', [15, 10, 8, 9, 14, 6], ['walk'], 1, dmg('Flame Bite', 1, 4)],
    ['archer', 'Archer', 40, 'day', 'ranged', [14, 9, 10, 10, 11, 4], ['walk'], 3, dmg('Fire Arrow', 4, 8)],
    ['wisp', 'Wisp', 48, 'day', 'healer', [11, 9, 14, 12, 13, 5], ['fly'], 1, heal('Rekindle', 2, 8)],
    ['newt', 'Newt', 56, 'night', 'skirmisher', [15, 12, 12, 11, 11, 4], ['walk'], 1, dmg('Steam Burst', 2, 12, 1)],
    ['golem', 'Golem', 64, 'none', 'tank', [16, 17, 8, 10, 9, 4], ['walk'], 1, dmg('Slag', 1, 4)],
    ['drake', 'Drake', 88, 'none', 'dragon', [18, 13, 16, 13, 12, 5], ['fly'], 1, dmg('Firestorm', 3, 12, 1)],
  ],
  air: [
    ['sprite', 'Sprite', 16, 'day', 'scout', [10, 8, 12, 10, 15, 5], ['fly'], 1, dmg('Gust', 3, 4)],
    ['hawk', 'Hawk', 32, 'none', 'fighter', [14, 9, 9, 9, 15, 6], ['fly'], 1, dmg('Talon Wind', 2, 4)],
    ['monk', 'Monk', 40, 'none', 'caster', [12, 11, 15, 13, 11, 4], ['walk'], 1, dmg('Lightning', 4, 8)],
    ['muse', 'Muse', 48, 'day', 'healer', [8, 9, 15, 14, 12, 4], ['fly'], 1, heal('Soothing Breeze', 3, 12, 1)],
    ['harpy', 'Harpy', 56, 'night', 'skirmisher', [15, 10, 10, 10, 14, 5], ['fly'], 1, dmg('Screech', 2, 4)],
    ['giant', 'Giant', 72, 'none', 'tank', [17, 15, 11, 12, 9, 4], ['walk'], 1, dmg('Thunderclap', 1, 8, 1)],
    ['djinn', 'Djinn', 96, 'night', 'dragon', [15, 12, 18, 15, 12, 5], ['fly'], 2, dmg('Tempest', 4, 12, 1)],
  ],
  earth: [
    ['clod', 'Clod', 16, 'none', 'tank', [11, 13, 6, 8, 7, 4], ['walk', 'wade'], 1, dmg('Pebble', 2, 4)],
    ['thorn', 'Thorn', 24, 'day', 'fighter', [14, 12, 8, 9, 10, 4], ['walk', 'wade'], 1, dmg('Thorn Spray', 2, 4)],
    ['sling', 'Sling', 32, 'none', 'ranged', [13, 12, 9, 10, 10, 4], ['walk', 'wade'], 3, dmg('Rock Throw', 4, 8)],
    ['dryad', 'Dryad', 48, 'day', 'healer', [9, 11, 14, 14, 10, 4], ['walk', 'wade'], 1, heal('Verdant Mend', 2, 8)],
    ['turtle', 'Turtle', 64, 'none', 'tank', [13, 19, 8, 14, 7, 3], ['slow', 'swim'], 1, dmg('Shell Bash', 1, 4)],
    ['wyrm', 'Wyrm', 80, 'night', 'skirmisher', [17, 14, 12, 11, 10, 4], ['walk', 'wade'], 1, dmg('Quake', 1, 12, 1)],
    ['titan', 'Titan', 96, 'night', 'dragon', [19, 18, 10, 13, 8, 4], ['walk'], 1, dmg('Landslide', 3, 12, 1)],
  ],
  water: [
    ['bubble', 'Bubble', 16, 'none', 'scout', [9, 9, 12, 11, 12, 4], ['walk', 'wade'], 1, dmg('Splash', 2, 4)],
    ['crab', 'Crab', 24, 'none', 'tank', [14, 14, 6, 9, 9, 3], ['slow', 'swim'], 1, dmg('Bubble Shot', 2, 4)],
    ['siren', 'Siren', 40, 'night', 'caster', [9, 10, 15, 13, 11, 4], ['walk', 'wade'], 1, dmg('Water Jet', 4, 8)],
    ['undine', 'Undine', 48, 'none', 'healer', [8, 10, 15, 15, 11, 4], ['walk', 'swim'], 1, heal('Healing Rain', 3, 12, 1)],
    ['shark', 'Shark', 56, 'night', 'fighter', [17, 12, 8, 10, 13, 6], ['swim'], 1, dmg('Riptide', 1, 4)],
    ['wolf', 'Wolf', 72, 'day', 'skirmisher', [16, 12, 12, 12, 13, 5], ['walk'], 1, dmg('Ice Fang', 2, 8)],
    ['kraken', 'Kraken', 96, 'day', 'dragon', [18, 16, 16, 14, 10, 5], ['swim'], 2, dmg('Tidal Wave', 3, 12, 1)],
  ],
};

function build(element: Element, d: Def): UnitKind {
  const [id, name, cost, alignment, role, s, moveTypes, attackRange, magic] = d;
  const stats: Stats = { atk: s[0], def: s[1], mp: s[2], mdf: s[3], spd: s[4], mov: s[5] };
  return {
    id,
    name,
    isSummoner: false,
    element,
    alignment,
    cost,
    stats,
    moveTypes,
    attack: { range: attackRange },
    magic: [{ ...magic, id: `${id}:magic` }],
    role,
  };
}

export const ELEMENTS: readonly Element[] = ['fire', 'air', 'earth', 'water'];

export const SUMMONS: readonly UnitKind[] = ELEMENTS.flatMap((e) => TABLE[e].map((d) => build(e, d)));
