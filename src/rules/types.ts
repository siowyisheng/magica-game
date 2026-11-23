import type { Dir, Hex } from './hex';

export type Element = 'fire' | 'air' | 'earth' | 'water';
export type Alignment = 'day' | 'night' | 'none';
export type TimeOfDay = 'day' | 'night' | 'neutral';
export type MoveType = 'walk' | 'slow' | 'fly' | 'swim' | 'wade';
export type SideId = 0 | 1;

export interface Stats {
  atk: number;
  def: number;
  mp: number;
  mdf: number;
  spd: number;
  mov: number;
}

/** Attack Ability: hits one enemy within `range` (no minimum range). */
export interface AttackAbility {
  range: number;
  /** How a ranged (range > 1) Attack flies; absent for melee. */
  trajectory?: Trajectory;
}

/**
 * How a ranged Attack or Magic Ability travels. High arcs over everything
 * and always hits a target in range; Direct flies straight and needs a
 * Clear Angle past Units and Obstacles.
 */
export type Trajectory = 'high' | 'direct';

/**
 * Magic Ability. Damage hits enemies only; heals hit allies (caster
 * included). Strength comes from the caster's MP — abilities have no power.
 */
export type MagicAbility =
  | {
      id: string;
      name: string;
      kind: 'damage' | 'heal';
      /** Maximum distance to the aimed hex. */
      range: number;
      /** 0 = single hex, 1 = aimed hex and its neighbours, 2 = two rings (Burst only). */
      radius: 0 | 1 | 2;
      manaCost: number;
      /**
       * Burst (damage only): centred on the caster (range 0), hitting every
       * Unit and Obstacle in the area, allies included, but not the caster.
       */
      burst?: boolean;
      /** Set when range > 1. */
      trajectory?: Trajectory;
    }
  | {
      id: string;
      name: string;
      kind: 'water';
      /** +1 = Rise, -1 = Ebb */
      delta: 1 | -1;
      manaCost: number;
    };

/** Static definition of a kind of Unit (a Master or a Familiar). */
export interface UnitKind {
  id: string;
  name: string;
  isMaster: boolean;
  element: Element | null;
  alignment: Alignment;
  /** Familiar cost in Mana; 0 for Masters. */
  cost: number;
  stats: Stats;
  moveTypes: MoveType[];
  attack: AttackAbility;
  magic: MagicAbility[];
  /** Short role label used for placeholder art and UI. */
  role: string;
}

export type HexTerrain = 'plain' | 'rough' | 'stone' | 'pit';

export interface MapHex {
  hex: Hex;
  height: number;
  terrain: HexTerrain;
  /** Theme look (0 or 1) for Plain and Rough; picked from the position when absent. */
  variant?: 0 | 1;
}

/** An Obstacle's Defense (and Magic Defense). */
export type ObstacleDefense = 2 | 4 | 6;

export interface MapObstacle {
  hex: Hex;
  def: ObstacleDefense;
}

export interface MapDef {
  name: string;
  /** Theme id (visual only). */
  theme?: string;
  /** Obstacles at the start of the match. */
  obstacles?: MapObstacle[];
  /** Hexes in deterministic authoring order. */
  hexes: MapHex[];
  waterLevel: number;
  startClock: number;
  spawns: [Hex, Hex];
  spawnFacing: [Dir, Dir];
}

export interface Unit {
  id: number;
  kind: string;
  side: SideId;
  pos: Hex;
  facing: Dir;
  hp: number;
  av: number;
  /** Set at start of turn when the Unit stands on a hex it may not enter. */
  stranded: boolean;
}

/** A neutral map object with HP; ids share the Unit id space. */
export interface Obstacle {
  id: number;
  pos: Hex;
  def: ObstacleDefense;
  hp: number;
}

/** Anything that can be hit: a Unit or an Obstacle. */
export type Target = Unit | Obstacle;

export function isObstacle(t: Target): t is Obstacle {
  return !('kind' in t);
}

export interface Stone {
  hex: Hex;
  owner: SideId | null;
}

export interface SideState {
  mana: number;
  ai: boolean;
  /** AI strength when `ai` is set (default Normal). */
  aiLevel?: 'normal' | 'hard';
  /** Familiar kinds this Side may Summon (its Loadout); absent = all (Test Match). */
  roster?: string[];
}

export interface MatchState {
  map: MapDef;
  waterLevel: number;
  minWaterLevel: number;
  maxWaterLevel: number;
  hasWater: boolean;
  /** Absolute minutes since 00:00 of day 1. */
  clock: number;
  units: Unit[];
  obstacles: Obstacle[];
  stones: Stone[];
  sides: [SideState, SideState];
  nextUnitId: number;
  activeUnitId: number | null;
  /** The winning Side, 'draw' if the Time Limit ended it level, or null while the match goes on. */
  winner: SideId | 'draw' | null;
  /** Game Clock at which the Time Limit ends the match. */
  timeLimit: number;
  turnNumber: number;
  rngState: number;
}

export type Command =
  | { type: 'wait' }
  | { type: 'attack'; target: Hex }
  | { type: 'magic'; ability: string; target: Hex }
  | { type: 'summon'; kind: string; dir: Dir };

export interface TurnAction {
  unitId: number;
  to: Hex;
  facing: Dir;
  command: Command;
}

export type GameEvent =
  | { type: 'turnStart'; unitId: number; clock: number }
  | { type: 'move'; unitId: number; from: Hex; to: Hex }
  | { type: 'damage'; unitId: number; amount: number; source: number }
  | { type: 'heal'; unitId: number; amount: number; source: number | 'stone' }
  | { type: 'stranded'; unitId: number }
  | { type: 'summon'; unitId: number; kind: string; by: number }
  | { type: 'capture'; side: SideId; hex: Hex }
  | { type: 'mana'; side: SideId; amount: number; clock: number }
  | { type: 'water'; level: number }
  | { type: 'death'; unitId: number }
  | { type: 'win'; side: SideId }
  | { type: 'timeUp'; result: SideId | 'draw'; stones: [number, number]; hp: [number, number] };
