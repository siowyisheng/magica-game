import type { Alignment, Element, Stats, UnitKind } from '../types';

// The ten Summoners. Every Side picks one before the match. All walk + wade
// and cast Bolt, Rise and Ebb; they differ in stats, and a few in Element
// or Alignment. MP also sets Mana Income, so high MP trades against
// fighting stats and Speed. Names are at most 7 letters.

type Def = [id: string, name: string, stats: [atk: number, def: number, mp: number, mdf: number, spd: number, mov: number], element?: Element, alignment?: Alignment];

const DEFS: Def[] = [
  ['sigil', 'Sigil', [8, 10, 16, 12, 11, 4]], // rune mage: balanced
  ['warden', 'Warden', [10, 15, 13, 12, 9, 4], undefined, 'day'], // armoured knight-cleric
  ['orrery', 'Orrery', [6, 8, 18, 13, 11, 4], undefined, 'night'], // stargazer: rich but fragile
  ['bramble', 'Bramble', [7, 11, 15, 15, 10, 4]], // druid crone: magic-proof
  ['cinder', 'Cinder', [11, 10, 15, 10, 12, 4], 'fire'], // ember noble
  ['zephyr', 'Zephyr', [9, 8, 13, 10, 13, 5]], // wind herald: fast, poor
  ['sexton', 'Sexton', [7, 9, 17, 14, 10, 4]], // grave-keeper with a skull familiar
  ['nereid', 'Nereid', [7, 10, 15, 13, 11, 4], 'water'], // sea priestess
  ['cairn', 'Cairn', [9, 13, 14, 12, 9, 4]], // stone hermit
  ['tinker', 'Tinker', [12, 11, 14, 10, 12, 4]], // clockwork tinkerer: fighter
];

function build([id, name, s, element, alignment]: Def): UnitKind {
  const stats: Stats = { atk: s[0], def: s[1], mp: s[2], mdf: s[3], spd: s[4], mov: s[5] };
  return {
    id,
    name,
    isSummoner: true,
    element: element ?? null,
    alignment: alignment ?? 'none',
    cost: 0,
    role: 'summoner',
    stats,
    moveTypes: ['walk', 'wade'],
    attack: { range: 1 },
    magic: [
      { id: 'bolt', name: 'Bolt', kind: 'damage', range: 3, radius: 0, manaCost: 24, trajectory: 'direct' },
      { id: 'rise', name: 'Rise', kind: 'water', delta: 1, manaCost: 32 },
      { id: 'ebb', name: 'Ebb', kind: 'water', delta: -1, manaCost: 32 },
    ],
  };
}

/** Built-in Summoners (before any balance overrides). */
export const BASE_SUMMONERS: readonly UnitKind[] = DEFS.map(build);

/** The default Summoner (Sigil). */
export const DEFAULT_SUMMONER = 'sigil';
