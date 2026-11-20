import type { MapDef } from '../types';

/** Highest share of the map that may be water after one Rise. */
export const MAX_FLOOD_SHARE = 0.4;

/**
 * Water design rules every map must satisfy (if it has water at all):
 * - after one Ebb, some Deep Water remains, so swim-only Units are never all Stranded;
 * - after one Rise, at most 40% of hexes are water.
 * Returns a list of problems (empty = valid).
 */
export function validateMapWater(map: MapDef): string[] {
  const problems: string[] = [];
  // Pits never hold water and are left out of both rules.
  const ground = map.hexes.filter((h) => h.terrain !== 'pit');
  const hasWater = ground.some((h) => h.height < map.waterLevel);
  if (!hasWater) return problems;
  const low = map.waterLevel - 1;
  if (!ground.some((h) => low - h.height >= 2)) problems.push(`no Deep Water remains at Water Level ${low}`);
  const high = map.waterLevel + 1;
  const flooded = ground.filter((h) => h.height < high).length / ground.length;
  if (flooded > MAX_FLOOD_SHARE) problems.push(`Rise floods ${(flooded * 100).toFixed(0)}% of the map (max ${MAX_FLOOD_SHARE * 100}%)`);
  return problems;
}
