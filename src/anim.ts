// Turn animation plan: a pure description of what to play between the
// state before a turn and the state after it. The renderer samples it.

import {
  type Element,
  type Hex,
  type MatchState,
  type TurnAction,
  type GameEvent,
  type Dir,
  type SideId,
  neighbor,
  affectedUnits,
  getUnit,
  hexDistance,
  hexEq,
  kindOf,
  pathTo,
  previewEffects,
  MAX_HP,
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
  /** A Burst: a shockwave ring expanding from the caster to `radius` hexes. */
  | { kind: 'burst'; at: Hex; radius: number; element: Element | null; t0: number; t1: number }
  /** Master glows and approaches, a light blooms on the hex, the familiar fades in, the Master backs off. */
  /** A light swells on the Magic Stone (ease in/out); the stone changes colour at the peak. */
  | { kind: 'capture'; hex: Hex; side: SideId; t0: number; t1: number }
  /**
   * Empower: golden motes spiral from the caster to the target, then a column
   * of light rises round the target with sparks climbing it; the ATK bonus
   * lands at the column's peak (EMPOWER_PEAK).
   */
  | { kind: 'empower'; from: Hex; to: Hex; t0: number; t1: number }
  /** Stone Heal at the start of the next unit's turn: a soft green glow rises from its Stone. */
  | { kind: 'stoneHeal'; unitId: number; hex: Hex; t0: number; t1: number }
  | { kind: 'summon'; unitId: number; from: Hex; target: Hex; summonKind: string; side: SideId; facing: Dir; t0: number; t1: number };

export interface TurnAnim {
  /** performance.now() at which the animation started. */
  start: number;
  /** Length in animation time (ms at 1×). */
  duration: number;
  /** Playback speed: animation ms per real ms (Replays play at 1×, 2× or 4×). */
  rate?: number;
  steps: AnimStep[];
  actorId: number;
  /** Where the actor ends its move. */
  to: Hex;
  /** Facing the actor shows while animating. */
  facing: number;
  /** When each hit or heal lands: HP bars change and a Damage Number pops then. */
  impacts: Impact[];
}

/** One unit's (or Obstacle's) HP change, at animation time `t`. */
export interface Impact {
  unitId: number;
  t: number;
  kind: 'damage' | 'heal' | 'empower';
  amount: number;
  /** HP shown from the impact on. */
  hpAfter: number;
  lethal: boolean;
}

/** A unit brought to 0 HP fades out over this long after the impact. */
export const KO_FADE_MS = 300;

/** Animation time elapsed at real time `now`. */
export function animElapsed(anim: TurnAnim, now: number = performance.now()): number {
  return (now - anim.start) * (anim.rate ?? 1);
}

/** Real milliseconds the animation takes. */
export function animWallMs(anim: TurnAnim): number {
  return anim.duration / (anim.rate ?? 1);
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
export const EMPOWER_MS = 950;
export const STONE_HEAL_MS = 650;
/** Fraction of the Stone Heal step when the HP goes up. */
export const STONE_HEAL_PEAK = 0.5;
/** Fraction of the Empower step when the bonus lands. */
export const EMPOWER_PEAK = 0.6;
/** Phases of the summon step as fractions of its duration. */
export const SUMMON_PHASES = { approachEnd: 0.24, lightStart: 0.18, fadeStart: 0.36, fadeEnd: 0.74, backStart: 0.8 } as const;

/**
 * @param skipMove true when the move was already shown (the player's own
 *   move preview), so only the Command plays.
 */
/**
 * @param turnEnd what the turn led to (its events and the state after), so the
 *   next unit's start-of-turn Stone Heal can be shown at the end.
 */
export function planTurnAnim(before: MatchState, action: TurnAction, start: number, skipMove = false, turnEnd?: { events: GameEvent[]; after: MatchState }): TurnAnim {
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
  let impactT: number | null = null; // when the Command's hits or heals land
  if (cmd.type === 'attack') {
    const target = targetAt(before, cmd.target);
    const d = hexDistance(action.to, cmd.target);
    if (d <= 1) {
      steps.push({ kind: 'melee', unitId: unit.id, from: action.to, target: cmd.target, t0: t, t1: t + MELEE_MS });
      const impact = t + MELEE_MS * MELEE_IMPACT;
      impactT = impact;
      if (target) steps.push({ kind: 'hit', unitIds: [target.id], t0: impact, t1: impact + HIT_MS });
      t += MELEE_MS;
    } else {
      const fly = 180 + 90 * d;
      const high = trajectoryOf(kind.attack) === 'high';
      const flyMs = high ? fly + 140 : fly;
      steps.push({ kind: 'projectile', from: action.to, to: cmd.target, style: 'arrow', element: kind.element, heal: false, high, t0: t, t1: t + flyMs });
      t += flyMs - fly;
      t += fly;
      impactT = t;
      if (target) steps.push({ kind: 'hit', unitIds: [target.id], t0: t, t1: t + HIT_MS });
      t += HIT_MS;
    }
  } else if (cmd.type === 'magic') {
    const ab = kind.magic.find((m) => m.id === cmd.ability);
    if (ab && ab.kind !== 'water') {
      const view = { ...before, units: before.units.map((u) => (u.id === unit.id ? { ...u, pos: action.to } : u)) };
      const hitIds = affectedUnits(view, getUnit(view, unit.id), ab, cmd.target).map((u) => u.id);
      const d = hexDistance(action.to, cmd.target);
      if (ab.kind === 'empower') {
        steps.push({ kind: 'empower', from: action.to, to: cmd.target, t0: t, t1: t + EMPOWER_MS });
        impactT = t + EMPOWER_MS * EMPOWER_PEAK;
        t += EMPOWER_MS;
      } else if (ab.kind === 'damage' && ab.burst) {
        const ms = 320 + 120 * ab.radius;
        steps.push({ kind: 'burst', at: action.to, radius: ab.radius, element: kind.element, t0: t, t1: t + ms });
        t += Math.round(ms * 0.6); // units are hit as the wave passes
      } else if (d > 0) {
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
      if (ab.kind !== 'empower') {
        impactT = t;
        if (ab.kind === 'damage' && hitIds.length) steps.push({ kind: 'hit', unitIds: hitIds, t0: t, t1: t + HIT_MS });
        t += HIT_MS;
      }
    }
  }

  const impacts: Impact[] = [];
  if (impactT !== null) {
    for (const e of previewEffects(before, action)) {
      const hpAfter = e.kind === 'heal' ? Math.min(MAX_HP, e.hpBefore + e.amount) : e.kind === 'empower' ? e.hpBefore : Math.max(0, e.hpBefore - e.amount);
      impacts.push({ unitId: e.unitId, t: impactT, kind: e.kind, amount: e.amount, hpAfter, lethal: e.lethal });
      if (e.lethal) t = Math.max(t, impactT + KO_FADE_MS); // let the fade finish
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
  // the next unit's turn starts: Stone Heal, when it actually heals
  const sh = turnEnd?.events.find((e) => e.type === 'heal' && e.source === 'stone');
  if (sh && sh.type === 'heal' && turnEnd) {
    const healed = turnEnd.after.units.find((u) => u.id === sh.unitId);
    if (healed) {
      steps.push({ kind: 'stoneHeal', unitId: healed.id, hex: healed.pos, t0: t, t1: t + STONE_HEAL_MS });
      impacts.push({ unitId: healed.id, t: t + STONE_HEAL_MS * STONE_HEAL_PEAK, kind: 'heal', amount: sh.amount, hpAfter: healed.hp, lethal: false });
      t += STONE_HEAL_MS;
    }
  }

  return { start, duration: t, steps, actorId: unit.id, to: action.to, facing, impacts };
}

