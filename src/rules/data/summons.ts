import type { Alignment, AttackAbility, Element, MagicAbility, MoveType, Stats, UnitKind } from '../types';

// 28 original placeholder Summons, 7 per Element. Costs are multiples of 8
// in 16..96 and unique within each Element; Upkeep is Cost / 8.
// Each Element: 2 Day, 2 Night, 3 unaligned.

type Def = [
  id: string,
  name: string,
  cost: number,
  alignment: Alignment,
  role: string,
  stats: [atk: number, def: number, mp: number, mdf: number, spd: number, mov: number],
  moveTypes: MoveType[],
  attack: [min: number, max: number, power: number],
  magic: Omit<Extract<MagicAbility, { kind: 'damage' | 'heal' }>, 'id'>,
];

const dmg = (name: string, minRange: number, maxRange: number, power: number, manaCost: number, radius: 0 | 1 = 0) =>
  ({ name, kind: 'damage', minRange, maxRange, power, targets: 'enemy', radius, manaCost }) as const;
const heal = (name: string, minRange: number, maxRange: number, power: number, manaCost: number, radius: 0 | 1 = 0) =>
  ({ name, kind: 'heal', minRange, maxRange, power, targets: 'ally', radius, manaCost }) as const;

const TABLE: Record<Element, Def[]> = {
  fire: [
    ['ember-imp', 'Ember Imp', 16, 'night', 'scout', [13, 9, 11, 9, 13, 5], ['walk'], [1, 1, 3], dmg('Spark', 1, 2, 2, 8)],
    ['cinder-hound', 'Cinder Hound', 24, 'none', 'fighter', [15, 10, 8, 9, 14, 6], ['walk'], [1, 1, 3], dmg('Flame Bite', 1, 1, 3, 8)],
    ['pyre-archer', 'Pyre Archer', 40, 'day', 'ranged', [14, 9, 10, 10, 11, 4], ['walk'], [2, 3, 3], dmg('Fire Arrow', 2, 4, 2, 16)],
    ['phoenix-wisp', 'Phoenix Wisp', 48, 'day', 'healer', [11, 9, 14, 12, 13, 5], ['fly'], [1, 1, 2], heal('Rekindle', 0, 2, 4, 16)],
    ['salamander', 'Salamander', 56, 'night', 'skirmisher', [15, 12, 12, 11, 11, 4], ['walk'], [1, 1, 3], dmg('Steam Burst', 1, 2, 3, 24, 1)],
    ['magma-golem', 'Magma Golem', 64, 'none', 'tank', [16, 17, 8, 10, 9, 4], ['walk'], [1, 1, 3], dmg('Slag', 1, 1, 2, 8)],
    ['inferno-drake', 'Inferno Drake', 88, 'none', 'dragon', [18, 13, 16, 13, 12, 5], ['fly'], [1, 1, 3], dmg('Firestorm', 2, 3, 3, 24, 1)],
  ],
  air: [
    ['gale-sprite', 'Gale Sprite', 16, 'day', 'scout', [10, 8, 12, 10, 15, 5], ['fly'], [1, 1, 2], dmg('Gust', 1, 3, 2, 8)],
    ['storm-hawk', 'Storm Hawk', 32, 'none', 'fighter', [14, 9, 9, 9, 15, 6], ['fly'], [1, 1, 3], dmg('Talon Wind', 1, 2, 2, 8)],
    ['thunder-monk', 'Thunder Monk', 40, 'none', 'caster', [12, 11, 15, 13, 11, 4], ['walk'], [1, 1, 2], dmg('Lightning', 2, 4, 3, 16)],
    ['breeze-maiden', 'Breeze Maiden', 48, 'day', 'healer', [8, 9, 15, 14, 12, 4], ['fly'], [1, 1, 2], heal('Soothing Breeze', 0, 3, 3, 24, 1)],
    ['night-harpy', 'Night Harpy', 56, 'night', 'skirmisher', [15, 10, 10, 10, 14, 5], ['fly'], [1, 1, 3], dmg('Screech', 1, 2, 2, 8)],
    ['cloud-giant', 'Cloud Giant', 72, 'none', 'tank', [17, 15, 11, 12, 9, 4], ['walk'], [1, 1, 3], dmg('Thunderclap', 1, 1, 2, 16, 1)],
    ['tempest-djinn', 'Tempest Djinn', 96, 'night', 'dragon', [15, 12, 18, 15, 12, 5], ['fly'], [1, 2, 2], dmg('Tempest', 2, 4, 3, 24, 1)],
  ],
  earth: [
    ['mud-golemling', 'Mud Golemling', 16, 'none', 'tank', [11, 13, 6, 8, 7, 4], ['walk', 'wade'], [1, 1, 3], dmg('Pebble', 1, 2, 2, 8)],
    ['thorn-beast', 'Thorn Beast', 24, 'day', 'fighter', [14, 12, 8, 9, 10, 4], ['walk', 'wade'], [1, 1, 3], dmg('Thorn Spray', 1, 2, 2, 8)],
    ['stone-slinger', 'Stone Slinger', 32, 'none', 'ranged', [13, 12, 9, 10, 10, 4], ['walk', 'wade'], [2, 3, 3], dmg('Rock Throw', 2, 4, 2, 16)],
    ['dryad', 'Dryad', 48, 'day', 'healer', [9, 11, 14, 14, 10, 4], ['walk', 'wade'], [1, 1, 2], heal('Verdant Mend', 0, 2, 4, 16)],
    ['iron-tortoise', 'Iron Tortoise', 64, 'none', 'tank', [13, 19, 8, 14, 7, 3], ['slow', 'swim'], [1, 1, 3], dmg('Shell Bash', 1, 1, 2, 8)],
    ['burrow-wyrm', 'Burrow Wyrm', 80, 'night', 'skirmisher', [17, 14, 12, 11, 10, 4], ['walk', 'wade'], [1, 1, 3], dmg('Quake', 1, 1, 3, 24, 1)],
    ['mountain-titan', 'Mountain Titan', 96, 'night', 'dragon', [19, 18, 10, 13, 8, 4], ['walk'], [1, 1, 4], dmg('Landslide', 1, 3, 2, 24, 1)],
  ],
  water: [
    ['bubble-sprite', 'Bubble Sprite', 16, 'none', 'scout', [9, 9, 12, 11, 12, 4], ['walk', 'wade'], [1, 1, 2], dmg('Splash', 1, 2, 2, 8)],
    ['reef-crab', 'Reef Crab', 24, 'none', 'tank', [14, 14, 6, 9, 9, 3], ['slow', 'swim'], [1, 1, 3], dmg('Bubble Shot', 1, 2, 2, 8)],
    ['tide-caller', 'Tide Caller', 40, 'night', 'caster', [9, 10, 15, 13, 11, 4], ['walk', 'wade'], [1, 1, 2], dmg('Water Jet', 2, 4, 3, 16)],
    ['undine', 'Undine', 48, 'none', 'healer', [8, 10, 15, 15, 11, 4], ['walk', 'swim'], [1, 1, 2], heal('Healing Rain', 1, 3, 3, 24, 1)],
    ['shark-knight', 'Shark Knight', 56, 'night', 'fighter', [17, 12, 8, 10, 13, 6], ['swim'], [1, 1, 3], dmg('Riptide', 1, 1, 3, 8)],
    ['frost-wolf', 'Frost Wolf', 72, 'day', 'skirmisher', [16, 12, 12, 12, 13, 5], ['walk'], [1, 1, 3], dmg('Ice Fang', 1, 2, 3, 16)],
    ['leviathan', 'Leviathan', 96, 'day', 'dragon', [18, 16, 16, 14, 10, 5], ['swim'], [1, 2, 3], dmg('Tidal Wave', 1, 3, 3, 24, 1)],
  ],
};

function build(element: Element, d: Def): UnitKind {
  const [id, name, cost, alignment, role, s, moveTypes, a, magic] = d;
  const stats: Stats = { atk: s[0], def: s[1], mp: s[2], mdf: s[3], spd: s[4], mov: s[5] };
  const attack: AttackAbility = { minRange: a[0], maxRange: a[1], power: a[2] };
  return {
    id,
    name,
    isSummoner: false,
    element,
    alignment,
    cost,
    stats,
    moveTypes,
    attack,
    magic: [{ ...magic, id: `${id}:magic` }],
    role,
  };
}

export const ELEMENTS: readonly Element[] = ['fire', 'air', 'earth', 'water'];

export const SUMMONS: readonly UnitKind[] = ELEMENTS.flatMap((e) => TABLE[e].map((d) => build(e, d)));
