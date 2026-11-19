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

export interface AttackAbility {
  minRange: number;
  maxRange: number;
  power: number;
}

export type AbilityTargets = 'enemy' | 'ally' | 'any';

export type MagicAbility =
  | {
      id: string;
      name: string;
      kind: 'damage' | 'heal';
      minRange: number;
      maxRange: number;
      power: number;
      targets: AbilityTargets;
      /** 0 = single hex, 1 = target hex and its neighbours. */
      radius: 0 | 1;
      manaCost: number;
    }
  | {
      id: string;
      name: string;
      kind: 'water';
      /** +1 = Rise, -1 = Ebb */
      delta: 1 | -1;
      manaCost: number;
    };

/** Static definition of a kind of Unit (one Summoner kind, 28 Summon kinds). */
export interface UnitKind {
  id: string;
  name: string;
  isSummoner: boolean;
  element: Element | null;
  alignment: Alignment;
  /** Summon cost in Mana; 0 for Summoners. */
  cost: number;
  stats: Stats;
  moveTypes: MoveType[];
  attack: AttackAbility;
  magic: MagicAbility[];
  /** Short role label used for placeholder art and UI. */
  role: string;
}

export type HexTerrain = 'plain' | 'rough' | 'stone';

export interface MapHex {
  hex: Hex;
  height: number;
  terrain: HexTerrain;
}

export interface MapDef {
  name: string;
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

export interface Stone {
  hex: Hex;
  owner: SideId | null;
}

export interface SideState {
  mana: number;
  ai: boolean;
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
  stones: Stone[];
  sides: [SideState, SideState];
  nextUnitId: number;
  activeUnitId: number | null;
  winner: SideId | null;
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
  | { type: 'win'; side: SideId };
