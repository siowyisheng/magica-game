import type { MapDef } from '../types';
import { hexEq, hexKey } from '../hex';
import { canStandOn, mapHexAt, surfaceOf } from '../terrain';
import { BASE_MASTERS } from '../data/masters';

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

/**
 * Every rule a playable map must satisfy: a name, at least one Magic Stone,
 * two distinct spawns a Master can stand on, Obstacles only on dry Plain
 * or Rough (not on spawns), and the water rules. Returns problems (empty =
 * valid).
 */
export function validateMap(map: MapDef): string[] {
  const problems: string[] = [];
  if (!map.name.trim()) problems.push('the map needs a name');
  if (!map.hexes.some((h) => h.terrain === 'stone')) problems.push('place at least one Magic Stone');
  const names = ['Green', 'Red'];
  map.spawns.forEach((s, i) => {
    const mh = mapHexAt(map, s);
    if (!mh) problems.push(`${names[i]} spawn is off the map`);
    else if (!canStandOn(BASE_MASTERS[0], mh, map.waterLevel)) problems.push(`${names[i]} spawn is on a hex a Master cannot stand on`);
    if ((map.obstacles ?? []).some((o) => hexEq(o.hex, s))) problems.push(`${names[i]} spawn is under an Obstacle`);
  });
  if (hexEq(map.spawns[0], map.spawns[1])) problems.push('both spawns are on the same hex');
  const seen = new Set<string>();
  for (const o of map.obstacles ?? []) {
    const k = hexKey(o.hex);
    if (seen.has(k)) problems.push(`two Obstacles share a hex`);
    seen.add(k);
    const mh = mapHexAt(map, o.hex);
    if (!mh) problems.push('an Obstacle is off the map');
    else if ((mh.terrain !== 'plain' && mh.terrain !== 'rough') || surfaceOf(mh, map.waterLevel) !== 'land') {
      problems.push('Obstacles must stand on dry Plain or Rough');
    }
  }
  problems.push(...validateMapWater(map));
  return [...new Set(problems)];
}
