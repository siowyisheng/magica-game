import type { UnitKind } from '../types';

export const SUMMONER: UnitKind = {
  id: 'summoner',
  name: 'Summoner',
  isSummoner: true,
  element: null,
  alignment: 'none',
  cost: 0,
  role: 'summoner',
  stats: { atk: 8, def: 10, mp: 16, mdf: 12, spd: 11, mov: 4 },
  moveTypes: ['walk', 'wade'],
  attack: { minRange: 1, maxRange: 1, power: 2 },
  magic: [
    { id: 'bolt', name: 'Bolt', kind: 'damage', minRange: 1, maxRange: 3, power: 3, targets: 'enemy', radius: 0, manaCost: 24 },
    { id: 'rise', name: 'Rise', kind: 'water', delta: 1, manaCost: 32 },
    { id: 'ebb', name: 'Ebb', kind: 'water', delta: -1, manaCost: 32 },
  ],
};
