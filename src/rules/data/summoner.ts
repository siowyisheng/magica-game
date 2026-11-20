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
  attack: { range: 1 },
  magic: [
    { id: 'bolt', name: 'Bolt', kind: 'damage', range: 3, radius: 0, manaCost: 24, trajectory: 'direct' },
    { id: 'rise', name: 'Rise', kind: 'water', delta: 1, manaCost: 32 },
    { id: 'ebb', name: 'Ebb', kind: 'water', delta: -1, manaCost: 32 },
  ],
};
