// Pure mapping from a turn (its animation plan and rule events) to timed
// sound cues, so effects line up with what is drawn.

import { type GameEvent, type MatchState, type TurnAction, type SideId, kindOf, getUnit, mapHexAt, surfaceOf, timeOfDay, hexDistance, isPhysical } from '../rules';
import { FLY_LAND_MS, FLY_RISE_MS, MS_PER_HEX, SUMMON_PHASES, type TurnAnim } from '../anim';
import type { Sfx, StepKind } from './sfx';

export interface Cue {
  /** Milliseconds after the turn's animation starts. */
  at: number;
  sfx: Sfx;
}

function stepKind(state: MatchState, unitKind: string, h: { q: number; r: number }): StepKind {
  const k = kindOf(unitKind);
  if (k.moveTypes.includes('fly')) return 'fly';
  const mh = mapHexAt(state.map, h);
  const surf = mh ? surfaceOf(mh, state.waterLevel) : 'land';
  if (surf !== 'land') return k.moveTypes.includes('swim') ? 'swim' : 'wade';
  return k.moveTypes.includes('slow') ? 'slow' : 'walk';
}

/**
 * Cues for one turn. `anim` may be null (no animation): action cues then
 * play at once. `viewer` is the human side the sounds are "for" (capture
 * major/minor, victory/defeat), or null in AI-vs-AI.
 */
export function turnCues(before: MatchState, action: TurnAction, anim: TurnAnim | null, events: GameEvent[], viewer: SideId | null): Cue[] {
  const cues: Cue[] = [];
  const actor = getUnit(before, action.unitId);
  const actorKind = kindOf(actor);
  const heavy = actorKind.cost >= 64;
  const damageTo = new Map<number, number>();
  for (const e of events) if (e.type === 'damage' && e.source !== e.unitId) damageTo.set(e.unitId, (damageTo.get(e.unitId) ?? 0) + e.amount);
  const end = anim?.duration ?? 0;

  for (const s of anim?.steps ?? []) {
    switch (s.kind) {
      case 'move':
        if (s.fly) {
          // take off, a few wing-beats while gliding, a soft landing
          cues.push({ at: s.t0, sfx: { name: 'step', kind: 'fly', heavy } });
          for (let t = s.t0 + FLY_RISE_MS + 120; t < s.t1 - FLY_LAND_MS; t += 240) cues.push({ at: t, sfx: { name: 'flap', soft: true } });
          cues.push({ at: s.t1 - 40, sfx: { name: 'land', heavy } });
          break;
        }
        for (let i = 1; i < s.path.length; i++) {
          cues.push({ at: s.t0 + (i - 0.5) * MS_PER_HEX, sfx: { name: 'step', kind: stepKind(before, actor.kind, s.path[i]), heavy } });
        }
        break;
      case 'melee':
        cues.push({ at: s.t0 + (s.t1 - s.t0) * 0.25, sfx: { name: 'swing' } });
        break;
      case 'projectile':
        cues.push({ at: s.t0, sfx: s.style === 'arrow' ? { name: 'arrow' } : { name: 'cast', element: s.element, heal: s.heal } });
        if (s.heal) cues.push({ at: s.t1, sfx: { name: 'heal', stone: false } });
        break;
      case 'burst':
        cues.push({ at: s.t0, sfx: { name: 'cast', element: s.element, heal: false } });
        break;
      case 'hit': {
        const magic = action.command.type === 'act' && !isPhysical(actorKind.ability);
        const amount = Math.max(...s.unitIds.map((id) => damageTo.get(id) ?? 0));
        cues.push({ at: s.t0, sfx: { name: 'impact', amount, magic } });
        break;
      }
      case 'summon':
        cues.push({ at: s.t0, sfx: { name: 'summonCharge' } });
        cues.push({ at: s.t0 + (s.t1 - s.t0) * SUMMON_PHASES.fadeStart, sfx: { name: 'summonAppear', element: kindOf(s.summonKind).element } });
        break;
      case 'capture':
        cues.push({ at: (s.t0 + s.t1) / 2, sfx: { name: 'capture', mine: viewer === null ? true : s.side === viewer } });
        break;
    }
  }

  // Effects with no animation step of their own.
  const cmd = action.command;
  if (cmd.type === 'act') {
    const ab = actorKind.ability;
    const moveEnd = anim?.steps.find((s) => s.kind === 'move')?.t1 ?? 0;
    if (ab?.kind === 'water') cues.push({ at: moveEnd, sfx: { name: 'water', rise: ab.delta > 0 } });
    if ((ab?.kind === 'heal' || ab?.kind === 'empower') && !anim?.steps.some((s) => s.kind === 'projectile')) {
      cues.push({ at: moveEnd, sfx: { name: 'cast', element: actorKind.element, heal: true } });
      cues.push({ at: moveEnd + 200, sfx: { name: 'heal', stone: false } });
    }
  }
  if (!anim) {
    if (cmd.type === 'act' && actorKind.ability.kind === 'damage') cues.push({ at: 0, sfx: { name: 'impact', amount: Math.max(0, ...damageTo.values()), magic: !isPhysical(actorKind.ability) } });
    if (cmd.type === 'summon') cues.push({ at: 0, sfx: { name: 'summonAppear', element: kindOf(cmd.kind).element } });
  }

  // After the animation: deaths, then what happens as the next turn starts.
  let after = end;
  const deaths = events.filter((e) => e.type === 'death');
  if (deaths.length) {
    cues.push({ at: after, sfx: { name: 'death' } });
    after += 250;
  }
  const win = events.find((e) => e.type === 'win');
  if (win && win.type === 'win') {
    cues.push({ at: after + 200, sfx: { name: viewer === null || win.side === viewer ? 'victory' : 'defeat' } });
    return cues.sort((a, b) => a.at - b.at);
  }
  const startClock = events.find((e) => e.type === 'turnStart');
  if (events.some((e) => e.type === 'mana')) cues.push({ at: after, sfx: { name: 'hour' } });
  if (startClock && startClock.type === 'turnStart') {
    const was = timeOfDay(before.clock);
    const now = timeOfDay(startClock.clock);
    if (was !== now && now === 'day') cues.push({ at: after, sfx: { name: 'dawn' } });
    if (was !== now && now === 'night') cues.push({ at: after, sfx: { name: 'dusk' } });
  }
  if (events.some((e) => e.type === 'stranded')) cues.push({ at: after + 60, sfx: { name: 'stranded' } });
  if (events.some((e) => e.type === 'heal' && e.source === 'stone')) {
    // with the Stone Heal step's glow when it plays, else just after the turn
    const sh = anim?.steps.find((s) => s.kind === 'stoneHeal');
    cues.push({ at: sh ? sh.t0 + (sh.t1 - sh.t0) * 0.4 : after + 120, sfx: { name: 'heal', stone: true } });
  }
  return cues.sort((a, b) => a.at - b.at);
}

/**
 * How tense the battle is, 0..1: how many units are close to an enemy, and
 * how hurt the most hurt Master is.
 */
export function battleTension(state: MatchState): number {
  const units = state.units;
  if (!units.length) return 0;
  const engaged = units.filter((u) => units.some((o) => o.side !== u.side && hexDistance(o.pos, u.pos) <= 3)).length / units.length;
  const masters = units.filter((u) => kindOf(u).isMaster);
  const minHp = masters.length ? Math.min(...masters.map((u) => u.hp)) : 10;
  return Math.max(0, Math.min(1, 0.15 + 0.5 * engaged + 0.45 * (1 - minHp / 10)));
}
