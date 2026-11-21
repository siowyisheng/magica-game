// Turn animation plan: a pure description of what to play between the
// state before a turn and the state after it. The renderer samples it.

import {
  type Element,
  type Hex,
  type MatchState,
  type TurnAction,
  type Dir,
  type SideId,
  neighbor,
  affectedUnits,
  getUnit,
  hexDistance,
  hexEq,
  kindOf,
  pathTo,
  reachable,
  targetAt,
  trajectoryOf,
} from './rules';

export type AnimStep =
  /** `fly`: rise, glide straight to the destination, descend (Fly units). */
  | { kind: 'move'; unitId: number; path: Hex[]; fly: boolean; t0: number; t1: number }
  | { kind: 'melee'; unitId: number; from: Hex; target: Hex; t0: number; t1: number }
  | {
      kind: 'projectile';
      from: Hex;
      to: Hex;
      style: 'arrow' | 'orb';
      element: Element | null;
      heal: boolean;
      /** High Trajectory: drawn on a tall arc; Direct: a straight line. */
      high: boolean;
      t0: number;
      t1: number;
    }
  | { kind: 'hit'; unitIds: number[]; t0: number; t1: number }
  /** Summoner glows and approaches, a light blooms on the hex, the summon fades in, the Summoner backs off. */
  /** A light swells on the Magic Stone (ease in/out); the stone changes colour at the peak. */
  | { kind: 'capture'; hex: Hex; side: SideId; t0: number; t1: number }
  | { kind: 'summon'; unitId: number; from: Hex; target: Hex; summonKind: string; side: SideId; facing: Dir; t0: number; t1: number };

export interface TurnAnim {
  /** performance.now() at which the animation started. */
  start: number;
  duration: number;
  steps: AnimStep[];
  actorId: number;
  /** Where the actor ends its move. */
  to: Hex;
  /** Facing the actor shows while animating. */
  facing: number;
}

export const MS_PER_HEX = 130;
/** Fly moves: time to rise to cruising height, and to descend onto the hex. */
export const FLY_RISE_MS = 260;
export const FLY_LAND_MS = 260;

export function fliesKind(kindId: string): boolean {
  return kindOf(kindId).moveTypes.includes('fly');
}

/** How long a move along `path` takes to animate (walk: per hex; fly: rise, straight glide, descend). */
export function moveDurationMs(kindId: string, path: Hex[]): number {
  if (path.length < 2) return 0;
  if (!fliesKind(kindId)) return MS_PER_HEX * (path.length - 1);
  return FLY_RISE_MS + FLY_LAND_MS + MS_PER_HEX * Math.max(1, hexDistance(path[0], path[path.length - 1]));
}
const MELEE_MS = 520;
const MELEE_IMPACT = 0.55; // fraction of the melee step when the bonk lands
const HIT_MS = 220;
export const SUMMON_MS = 1250;
export const CAPTURE_MS = 900;
/** Phases of the summon step as fractions of its duration. */
export const SUMMON_PHASES = { approachEnd: 0.24, lightStart: 0.18, fadeStart: 0.36, fadeEnd: 0.74, backStart: 0.8 } as const;

/**
 * @param skipMove true when the move was already shown (the player's own
 *   move preview), so only the Command plays.
 */
export function planTurnAnim(before: MatchState, action: TurnAction, start: number, skipMove = false): TurnAnim {
  const unit = getUnit(before, action.unitId);
  const kind = kindOf(unit.kind);
  const steps: AnimStep[] = [];
  let t = 0;

  if (!skipMove && !hexEq(unit.pos, action.to)) {
    const path = pathTo(reachable(before, unit), action.to);
    const dur = Math.max(MS_PER_HEX, moveDurationMs(unit.kind, path));
    steps.push({ kind: 'move', unitId: unit.id, path, fly: fliesKind(unit.kind), t0: t, t1: t + dur });
    t += dur;
  }

  const cmd = action.command;
  if (cmd.type === 'attack') {
    const target = targetAt(before, cmd.target);
    const d = hexDistance(action.to, cmd.target);
    if (d <= 1) {
      steps.push({ kind: 'melee', unitId: unit.id, from: action.to, target: cmd.target, t0: t, t1: t + MELEE_MS });
      const impact = t + MELEE_MS * MELEE_IMPACT;
      if (target) steps.push({ kind: 'hit', unitIds: [target.id], t0: impact, t1: impact + HIT_MS });
      t += MELEE_MS;
    } else {
      const fly = 180 + 90 * d;
      const high = trajectoryOf(kind.attack) === 'high';
      const flyMs = high ? fly + 140 : fly;
      steps.push({ kind: 'projectile', from: action.to, to: cmd.target, style: 'arrow', element: kind.element, heal: false, high, t0: t, t1: t + flyMs });
      t += flyMs - fly;
      t += fly;
      if (target) steps.push({ kind: 'hit', unitIds: [target.id], t0: t, t1: t + HIT_MS });
      t += HIT_MS;
    }
  } else if (cmd.type === 'magic') {
    const ab = kind.magic.find((m) => m.id === cmd.ability);
    if (ab && ab.kind !== 'water') {
      const view = { ...before, units: before.units.map((u) => (u.id === unit.id ? { ...u, pos: action.to } : u)) };
      const hitIds = affectedUnits(view, getUnit(view, unit.id), ab, cmd.target).map((u) => u.id);
      const d = hexDistance(action.to, cmd.target);
      if (d > 0) {
        const high = trajectoryOf(ab) === 'high';
        const fly = 200 + 80 * d + (high ? 140 : 0);
        steps.push({
          kind: 'projectile',
          from: action.to,
          to: cmd.target,
          style: 'orb',
          element: kind.element,
          heal: ab.kind === 'heal',
          high,
          t0: t,
          t1: t + fly,
        });
        t += fly;
      }
      if (ab.kind === 'damage' && hitIds.length) steps.push({ kind: 'hit', unitIds: hitIds, t0: t, t1: t + HIT_MS });
      t += HIT_MS;
    }
  }

  if (cmd.type === 'summon') {
    steps.push({
      kind: 'summon',
      unitId: unit.id,
      from: action.to,
      target: neighbor(action.to, cmd.dir),
      summonKind: cmd.kind,
      side: unit.side,
      facing: cmd.dir,
      t0: t,
      t1: t + SUMMON_MS,
    });
    t += SUMMON_MS;
  }

  // Capture: the acting unit ends its turn on a Magic Stone its Side doesn't control.
  const stone = before.stones.find((st) => hexEq(st.hex, action.to));
  if (stone && stone.owner !== unit.side) {
    steps.push({ kind: 'capture', hex: action.to, side: unit.side, t0: t, t1: t + CAPTURE_MS });
    t += CAPTURE_MS;
  }

  const facing = cmd.type === 'summon' ? cmd.dir : action.facing;
  return { start, duration: t, steps, actorId: unit.id, to: action.to, facing };
}

