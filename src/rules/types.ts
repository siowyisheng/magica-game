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

/**
 * How a ranged Ability travels. High arcs over everything and always hits a
 * target in range; Direct flies straight and needs a Clear Angle past Units,
 * Obstacles and high ground.
 */
export type Trajectory = 'high' | 'direct';

/** Which stat a damaging Ability hits with: ATK against DEF (physical) or MP against MDF (magical). */
export type Power = 'atk' | 'mp';

/** The name of a Unit's Act button. */
export type AbilityLabel = 'attack' | 'heal' | 'buff' | 'debuff';

/**
 * An effect a damaging Ability can carry on top of its damage, on every enemy Unit
 * it hits: a Hex (MDF lowered for a while) or Entangle (no movement on its next turn).
 */
export type Rider = { kind: 'hex'; amount?: number; minutes?: number } | { kind: 'entangle' };

/**
 * Ability: what a Unit does when it Acts. Every Unit has exactly one. Damage
 * hits enemies (and Obstacles) with ATK or MP (`power`); heals and Empower
 * help allies (caster included): heals restore MP, Empower gives a fixed ATK
 * bonus (`amount`). Abilities are free: they cost no Mana.
 */
export type Ability =
  | {
      id: string;
      name: string;
      /**
       * damage, heal and empower as before; hex lowers enemies' MDF for a while;
       * entangle stops enemies moving on their next turn.
       */
      kind: 'damage' | 'heal' | 'empower' | 'hex' | 'entangle';
      /** Damage only: ATK against DEF ('atk') or MP against MDF ('mp'). Absent means 'mp'. */
      power?: Power;
      /** Empower: ATK added to the target until its next physical hit. Hex: MDF taken away (default 3). */
      amount?: number;
      /** Hex only: how long it lasts, in Game Clock minutes (default 180). */
      minutes?: number;
      /** Damage only: a Hex and/or Entangle on every enemy Unit it hits. */
      riders?: Rider[];
      /** Maximum distance to the aimed hex. */
      range: number;
      /** 0 = single hex, 1 = aimed hex and its neighbours, 2 = two rings (Burst only). */
      radius: 0 | 1 | 2;
      /**
       * Burst (damage only): centred on the user (range 0), hitting every
       * Unit and Obstacle in the area, allies included, but not the user.
       */
      burst?: boolean;
      /** Set when range > 1. */
      trajectory?: Trajectory;
      /** The Act button's name; absent means the default for its kind (damage: attack, heal: heal, empower: buff). */
      label?: AbilityLabel;
    }
  | {
      id: string;
      name: string;
      kind: 'water';
      /** +1 = Rise, -1 = Ebb */
      delta: 1 | -1;
      label?: AbilityLabel;
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
  /** The one thing it does when it Acts. */
  ability: Ability;
  /** Its own name for the Ability, shown instead of the Ability's name. */
  abilityName?: string;
  /** The stat its Signature Bonus raises by 1 (default: its power stat). */
  signatureStat?: SignatureStat;
  /** Set on the kind a Signature Unit uses (its Signature Bonus applied). */
  asSignature?: true;
}

/** The stats a Signature Bonus may raise. */
export type SignatureStat = 'atk' | 'def' | 'mp' | 'mdf' | 'spd' | 'mov';
export const SIGNATURE_STATS: readonly SignatureStat[] = ['atk', 'def', 'mp', 'mdf', 'spd', 'mov'];

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
  /** Empowered: ATK added to this Unit's next physical hit, then cleared. */
  empowered?: number;
  /** Summoned as its Side's Signature: has the Signature Bonus. */
  signature?: boolean;
  /** Hexed: MDF lowered by `amount` until the Game Clock reaches `until`. */
  hex?: { amount: number; until: number };
  /** Entangled: MOV 0 until the end of its next turn. */
  entangled?: boolean;
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
  /** The Loadout's Signature Familiar (absent with no Loadout). */
  signature?: string;
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
  /** Use the Unit's Ability, aimed at `target` (its own hex for a Burst). */
  | { type: 'act'; target: Hex }
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
  | { type: 'empower'; unitId: number; amount: number; source: number }
  | { type: 'hex'; unitId: number; amount: number; until: number; source: number }
  | { type: 'entangle'; unitId: number; source: number }
  | { type: 'hexEnd'; unitId: number }
  | { type: 'stranded'; unitId: number }
  | { type: 'summon'; unitId: number; kind: string; by: number }
  | { type: 'capture'; side: SideId; hex: Hex }
  | { type: 'mana'; side: SideId; amount: number; clock: number }
  | { type: 'water'; level: number }
  | { type: 'death'; unitId: number }
  | { type: 'win'; side: SideId }
  | { type: 'timeUp'; result: SideId | 'draw'; stones: [number, number]; hp: [number, number] };
