// Map library: built-in maps from the repo plus the player's own maps, kept
// in this browser (localStorage) and exportable / importable as JSON files.

import { SCAFFOLD_MAP, generateRandomMap, type MapDef, type ObstacleDefense, validateMap } from '../rules';
import { THEMES } from '../render/themes';

export interface StoredMap {
  /** 'builtin:<name>' for built-in maps, otherwise a generated id. */
  id: string;
  builtin: boolean;
  map: MapDef;
}

const KEY = 'magica.maps';

export const BUILTIN_MAPS: StoredMap[] = [];

function readUser(): StoredMap[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as { id: string; map: MapDef }[];
    return raw.filter((m) => m && typeof m.id === 'string' && isMapDef(m.map)).map((m) => ({ id: m.id, builtin: false, map: migrateObstacles(m.map) }));
  } catch {
    return [];
  }
}

function writeUser(maps: StoredMap[]) {
  localStorage.setItem(KEY, JSON.stringify(maps.filter((m) => !m.builtin).map(({ id, map }) => ({ id, map }))));
}

export function listMaps(): StoredMap[] {
  return [...BUILTIN_MAPS, ...readUser()];
}

export function getMap(id: string): StoredMap | undefined {
  return listMaps().find((m) => m.id === id);
}

/** The map id that means "a new random map every match". */
export const RANDOM_MAP_ID = 'random';

/** A new random map (src/rules/maps/random.ts), with any of the game's Themes. */
export function randomMap(seed: number = Math.floor(Math.random() * 1e9)): MapDef {
  return generateRandomMap(seed, THEMES.map((t) => t.id));
}

/** The map to play for a map id: a fresh random map for RANDOM_MAP_ID, else the stored one. */
export function mapFor(id: string): MapDef | undefined {
  return id === RANDOM_MAP_ID ? randomMap() : getMap(id)?.map;
}

/** Save (insert or replace) one of the player's maps. Built-in maps can't be overwritten. */
export function saveMap(id: string | null, map: MapDef): StoredMap {
  if (id?.startsWith('builtin:')) id = null;
  const user = readUser();
  const entry: StoredMap = { id: id ?? `map-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`, builtin: false, map };
  const i = user.findIndex((m) => m.id === entry.id);
  if (i >= 0) user[i] = entry;
  else user.push(entry);
  writeUser(user);
  return entry;
}

export function deleteMap(id: string) {
  writeUser(readUser().filter((m) => m.id !== id));
}

/** Loose structural check of untrusted JSON before it is used as a map. */
export function isMapDef(x: unknown): x is MapDef {
  const m = x as MapDef;
  const isHex = (h: unknown) => !!h && typeof (h as { q: unknown }).q === 'number' && typeof (h as { r: unknown }).r === 'number';
  return (
    !!m &&
    typeof m.name === 'string' &&
    Array.isArray(m.hexes) &&
    m.hexes.length > 0 &&
    m.hexes.every((h) => isHex(h?.hex) && typeof h.height === 'number' && ['plain', 'rough', 'stone', 'pit'].includes(h.terrain)) &&
    typeof m.waterLevel === 'number' &&
    typeof m.startClock === 'number' &&
    Array.isArray(m.spawns) &&
    m.spawns.length === 2 &&
    m.spawns.every(isHex) &&
    Array.isArray(m.spawnFacing) &&
    (m.obstacles === undefined || (Array.isArray(m.obstacles) && m.obstacles.every((o) => isHex(o?.hex) && [2, 4, 6, 5, 10, 15].includes(o.def))))
  );
}

/** Maps saved before Defense was halved list Obstacle Defense 5 / 10 / 15: now 2 / 4 / 6. */
export function migrateObstacles(map: MapDef): MapDef {
  const old: Record<number, ObstacleDefense> = { 5: 2, 10: 4, 15: 6 };
  if (!map.obstacles?.some((o) => o.def in old)) return map;
  return { ...map, obstacles: map.obstacles.map((o) => ({ ...o, def: old[o.def] ?? o.def })) };
}

export function exportMapJson(map: MapDef): string {
  return JSON.stringify({ format: 'magica-map', version: 1, map }, null, 1);
}

/** Parse an exported map file. Throws with a readable message when it isn't one. */
export function parseMapJson(text: string): MapDef {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('not a JSON file');
  }
  const map = (data as { map?: unknown })?.map ?? data;
  if (!isMapDef(map)) throw new Error('not a Magica map file');
  return migrateObstacles(map);
}

export function isPlayable(map: MapDef): boolean {
  return validateMap(map).length === 0;
}
