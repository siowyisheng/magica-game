import { SUMMONER } from './data/summoner';
import { SUMMONS } from './data/summons';
import type { UnitKind } from './types';

const KINDS = new Map<string, UnitKind>([[SUMMONER.id, SUMMONER], ...SUMMONS.map((k) => [k.id, k] as const)]);

export function kindOf(id: string): UnitKind {
  const k = KINDS.get(id);
  if (!k) throw new Error(`unknown unit kind ${id}`);
  return k;
}

export { SUMMONER, SUMMONS };
