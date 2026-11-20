import { create } from 'zustand';
import {
  type Command,
  type Dir,
  type GameEvent,
  type Hex,
  type MapDef,
  type MatchState,
  type TurnAction,
  type Unit,
  activeUnit,
  applyTurn,
  attackTargets,
  createMatch,
  delayForAction,
  getUnit,
  hexEq,
  hexKey,
  kindOf,
  planAttack,
  planMagic,
  reachable,
  SCAFFOLD_MAP,
  validateTurn,
  formatClock,
  unitAt,
  neighbor,
  type TargetPlan,
  type MagicPlan,
  type Target,
  targetAt,
  targetById,
  canPlace,
} from './rules';
import { chooseAction } from './ai/ai';
import { getMap } from './maps/library';
import { planTurnAnim, type TurnAnim } from './anim';

/** UI phase for the human's turn. The rules only see the final TurnAction. */
export type Phase =
  | { kind: 'idle' }
  /** Choosing what to do. `selected` = the acting unit's ranges are shown. */
  | { kind: 'move'; selected: boolean }
  | { kind: 'menu'; to: Hex; facing: Dir; sub?: 'magic' | 'summon' }
  | { kind: 'target'; to: Hex; facing: Dir; command: 'attack' | { magic: string } }
  | { kind: 'summonDir'; to: Hex; facing: Dir; summonKind: string }
  /** Quick action on a unit where both Attack and Magic are possible. */
  | { kind: 'quickChoice'; targetId: number; attack: TargetPlan; magic: MagicPlan };

/** Things outside the store (sound) may want to react to. */
export type GameSignal =
  | { type: 'turn'; before: MatchState; action: TurnAction; anim: TurnAnim | null; events: GameEvent[] }
  | { type: 'deny' }
  | { type: 'newMatch' };

const signalListeners = new Set<(s: GameSignal) => void>();
export function onGameSignal(fn: (s: GameSignal) => void): () => void {
  signalListeners.add(fn);
  return () => signalListeners.delete(fn);
}
const signal = (s: GameSignal) => signalListeners.forEach((fn) => fn(s));

export type CommandHover = 'wait' | 'attack' | 'magic' | 'summon' | null;

/** Maximum number of other units whose ranges can be shown at once. */
export const MAX_INSPECTED = 3;

interface Store {
  match: MatchState;
  /** Library id of the map new matches use. */
  mapId: string;
  /** Which screen is shown. */
  screen: 'game' | 'editor';
  phase: Phase;
  hoverHex: Hex | null;
  hoverUnitId: number | null;
  hoverCommand: CommandHover;
  /** Summon kind hovered in the Summon submenu. */
  hoverSummon: string | null;
  /** Other units whose ranges are toggled on (oldest first). Cleared when a turn ends. */
  inspected: number[];
  showHpBars: boolean;
  log: string[];
  aiThinking: boolean;
  /** The turn animation currently playing; `match` updates when it ends. */
  anim: TurnAnim | null;
  /** Play turn animations (off in tests). */
  animate: boolean;
  /** Bumped on every applied turn; used to animate. */
  version: number;

  newMatch: () => void;
  /** Start a match on a map (e.g. from the editor). */
  startMatch: (map: MapDef, mapId?: string) => void;
  setMapId: (id: string) => void;
  setScreen: (s: 'game' | 'editor') => void;
  setHoverHex: (h: Hex | null) => void;
  setHoverUnit: (id: number | null) => void;
  setHoverCommand: (c: CommandHover) => void;
  setHoverSummon: (k: string | null) => void;
  clickHex: (h: Hex) => void;
  rightClick: () => void;
  choose: (c: 'wait' | 'attack' | 'magic' | { magic: string } | { summon: string } | { sub: 'magic' | 'summon' }) => void;
  toggleHpBars: () => void;
  setAi: (side: 0 | 1, ai: boolean) => void;
  tickAi: () => void;
}

function phaseFor(match: MatchState): Phase {
  const u = activeUnit(match);
  if (!u || match.winner !== null || match.sides[u.side].ai) return { kind: 'idle' };
  return { kind: 'move', selected: true };
}

function describe(match: MatchState, e: GameEvent): string | null {
  const name = (id: number) => {
    const u = match.units.find((x) => x.id === id);
    if (u) return `${u.side === 0 ? 'Green' : 'Red'} ${kindOf(u.kind).name}`;
    const o = match.obstacles.find((x) => x.id === id);
    return o ? `Obstacle (DEF ${o.def})` : `#${id}`;
  };
  switch (e.type) {
    case 'damage':
      return `${name(e.source)} → ${name(e.unitId)}: ${e.amount} dmg`;
    case 'heal':
      return `${name(e.unitId)} healed ${e.amount}${e.source === 'stone' ? ' (stone)' : ''}`;
    case 'summon':
      return `${name(e.by)} summoned ${kindOf(e.kind).name}`;
    case 'capture':
      return `${e.side === 0 ? 'Green' : 'Red'} captured a Magic Stone`;
    case 'water':
      return `Water Level is now ${e.level}`;
    case 'stranded':
      return `${name(e.unitId)} is Stranded`;
    case 'death':
      return match.obstacles.some((o) => o.id === e.unitId) ? `${name(e.unitId)} broke` : `${name(e.unitId)} fell`;
    case 'win':
      return `${e.side === 0 ? 'Green' : 'Red'} wins!`;
    case 'mana':
      return e.side === 0 ? `${formatClock(e.clock)} mana: Green ${e.amount >= 0 ? '+' : ''}${e.amount}` : null;
    default:
      return null;
  }
}

export const useGame = create<Store>((set, get) => {
  const commit = (action: TurnAction, alreadyMoved = true) => {
    const { match } = get();
    const err = validateTurn(match, action);
    if (err) {
      set((s) => ({ log: [`Illegal: ${err}`, ...s.log].slice(0, 40) }));
      signal({ type: 'deny' });
      return;
    }
    // describe with the pre-state for names of units that die
    const { state, events } = applyTurn(match, action);
    const lines = events.map((e) => describe({ ...state, units: [...match.units, ...state.units], obstacles: [...match.obstacles, ...state.obstacles] }, e)).filter(Boolean) as string[];
    const finish = () =>
      set((s) => ({
        match: state,
        anim: null,
        phase: phaseFor(state),
        hoverCommand: null,
        hoverSummon: null,
        inspected: [],
        log: [...lines.reverse(), ...s.log].slice(0, 40),
        version: s.version + 1,
      }));
    const anim = get().animate ? planTurnAnim(match, action, performance.now(), alreadyMoved) : null;
    signal({ type: 'turn', before: match, action, anim: anim && anim.duration > 0 ? anim : null, events });
    if (!anim || anim.duration <= 0) return finish();
    set({ anim, phase: { kind: 'idle' }, hoverCommand: null, hoverSummon: null });
    setTimeout(() => {
      if (get().anim === anim) finish();
    }, anim.duration);
  };

  const toggleInspect = (id: number) =>
    set((s) => {
      if (s.inspected.includes(id)) return { inspected: s.inspected.filter((x) => x !== id) };
      const next = [...s.inspected, id];
      return { inspected: next.length > MAX_INSPECTED ? next.slice(next.length - MAX_INSPECTED) : next };
    });

  /** The unit under the cursor, other than the acting unit. */
  const otherUnderCursor = (): Unit | undefined => {
    const { match, hoverUnitId, hoverHex } = get();
    const u = (hoverUnitId !== null ? match.units.find((x) => x.id === hoverUnitId) : undefined) ?? (hoverHex ? unitAt(match, hoverHex) : undefined);
    return u && u.id !== match.activeUnitId ? u : undefined;
  };

  const initial = createMatch(SCAFFOLD_MAP, { ai: [false, true], seed: Date.now() & 0xffff });

  return {
    match: initial,
    mapId: 'builtin:scaffold-ford',
    screen: 'game',
    phase: phaseFor(initial),
    hoverHex: null,
    hoverUnitId: null,
    hoverCommand: null,
    hoverSummon: null,
    inspected: [],
    showHpBars: true,
    log: ['Match start — 06:00'],
    aiThinking: false,
    anim: null,
    animate: true,
    version: 0,

    newMatch: () => {
      const map = getMap(get().mapId)?.map ?? get().match.map;
      get().startMatch(map);
    },
    startMatch: (map, mapId) => {
      const ai = get().match.sides.map((s) => s.ai) as [boolean, boolean];
      const m = createMatch(map, { ai, seed: Date.now() & 0xffff });
      if (mapId) set({ mapId });
      set({ match: m, anim: null, inspected: [], phase: phaseFor(m), log: [`${map.name}: match start — ${formatClock(map.startClock)}`], version: get().version + 1 });
      signal({ type: 'newMatch' });
    },
    setHoverHex: (h) => {
      const cur = get().hoverHex;
      if ((cur === null && h === null) || (cur && h && hexEq(cur, h))) return;
      set({ hoverHex: h });
    },
    setHoverUnit: (id) => get().hoverUnitId !== id && set({ hoverUnitId: id }),
    setHoverCommand: (c) => set({ hoverCommand: c }),
    setHoverSummon: (k) => get().hoverSummon !== k && set({ hoverSummon: k }),

    clickHex: (h) => {
      const { match, phase } = get();
      const u = activeUnit(match);
      if (!u) return;
      switch (phase.kind) {
        case 'move': {
          if (!phase.selected) return set({ phase: { kind: 'move', selected: true } });
          const target = targetAt(match, h);
          if (target && target.id !== u.id) {
            const q = quickPlans(match, u, target);
            const canAttack = !!q.attack;
            const canMagic = !!q.magic && q.magic.affordable;
            if (canAttack && canMagic) {
              return set({ phase: { kind: 'quickChoice', targetId: target.id, attack: q.attack!, magic: q.magic! } });
            }
            if (canAttack) return commit({ unitId: u.id, to: q.attack!.dest, facing: u.facing, command: { type: 'attack', target: target.pos }  }, false); // quick action: slide from the unit's hex
            if (canMagic) {
              return commit({ unitId: u.id, to: q.magic!.dest, facing: u.facing, command: { type: 'magic', ability: q.magic!.ability.id, target: target.pos }  }, false); // quick action: slide from the unit's hex
            }
            if (q.magic || blockedShot(match, u, target)) return signal({ type: 'deny' }); // unaffordable, or no clear shot
            return set({ phase: { kind: 'move', selected: false } });
          }
          if (hexEq(h, u.pos)) return set({ phase: { kind: 'menu', to: u.pos, facing: u.facing } });
          const n = reachable(match, u).get(hexKey(h));
          if (n && n.canEnd) return set({ phase: { kind: 'menu', to: h, facing: u.facing } });
          return set({ phase: { kind: 'move', selected: false } }); // not in range: deselect
        }
        case 'menu': {
          // Left-clicking the map while the command menu is open sets Facing (used by Wait).
          if (hexEq(h, phase.to)) return;
          set({ phase: { ...phase, facing: closestFacing(phase.to, h) } });
          return;
        }
        case 'target': {
          const command: Command =
            phase.command === 'attack'
              ? { type: 'attack', target: h }
              : { type: 'magic', ability: phase.command.magic, target: h };
          const action = { unitId: u.id, to: phase.to, facing: phase.facing, command };
          if (validateTurn(match, action)) return signal({ type: 'deny' });
          commit(action);
          return;
        }
        case 'summonDir': {
          // pick by direction: the valid adjacent hex closest in angle to the click
          const dir = summonDirToward(match, u.id, phase.to, phase.summonKind, h);
          if (dir === null) return signal({ type: 'deny' });
          commit({ unitId: u.id, to: phase.to, facing: dir, command: { type: 'summon', kind: phase.summonKind, dir } });
          return;
        }
        default:
          return;
      }
    },

    rightClick: () => {
      const { phase, match } = get();
      const u = activeUnit(match);
      if (!u || phase.kind === 'idle') return;
      const other = otherUnderCursor();
      switch (phase.kind) {
        case 'move':
          if (other) return toggleInspect(other.id);
          return set({ phase: { kind: 'move', selected: !phase.selected } });
        case 'menu':
          if (other) return toggleInspect(other.id);
          if (phase.sub) return set({ phase: { kind: 'menu', to: phase.to, facing: phase.facing }, hoverSummon: null });
          return set({ phase: { kind: 'move', selected: true }, hoverCommand: null }); // cancel move
        case 'target':
          if (other) return toggleInspect(other.id);
          return set({ phase: { kind: 'menu', to: phase.to, facing: phase.facing } });
        case 'summonDir':
          return set({ phase: { kind: 'menu', to: phase.to, facing: phase.facing, sub: 'summon' } });
        case 'quickChoice':
          return set({ phase: { kind: 'move', selected: true } });
      }
    },

    choose: (c) => {
      const { phase, match } = get();
      const u = activeUnit(match);
      if (!u) return;
      if (phase.kind === 'quickChoice') {
        const target = getUnit(match, phase.targetId);
        if (c === 'attack') return commit({ unitId: u.id, to: phase.attack.dest, facing: u.facing, command: { type: 'attack', target: target.pos }  }, false); // quick action: slide from the unit's hex
        if (c === 'magic') {
          return commit({ unitId: u.id, to: phase.magic.dest, facing: u.facing, command: { type: 'magic', ability: phase.magic.ability.id, target: target.pos }  }, false); // quick action: slide from the unit's hex
        }
        return;
      }
      if (phase.kind !== 'menu') return;
      const { to, facing } = phase;
      if (c === 'wait') return commit({ unitId: u.id, to, facing, command: { type: 'wait' } });
      if (c === 'attack') return set({ phase: { kind: 'target', to, facing, command: 'attack' } });
      if (c === 'magic') return;
      if ('sub' in c) return set({ phase: { kind: 'menu', to, facing, sub: c.sub } });
      if ('summon' in c) return set({ phase: { kind: 'summonDir', to, facing, summonKind: c.summon } });
      const ab = kindOf(u.kind).magic.find((m) => m.id === c.magic);
      if (!ab) return;
      if (ab.kind === 'water') return commit({ unitId: u.id, to, facing, command: { type: 'magic', ability: ab.id, target: to } });
      set({ phase: { kind: 'target', to, facing, command: { magic: ab.id } } });
    },

    setMapId: (mapId) => set({ mapId }),
    setScreen: (screen) => set({ screen, hoverHex: null, hoverUnitId: null }),
    toggleHpBars: () => set((s) => ({ showHpBars: !s.showHpBars })),
    setAi: (side, ai) => {
      const m = get().match;
      const sides = [...m.sides] as MatchState['sides'];
      sides[side] = { ...sides[side], ai };
      const match = { ...m, sides };
      set({ match, phase: phaseFor(match) });
    },

    tickAi: () => {
      const { match, aiThinking, anim } = get();
      const u = activeUnit(match);
      if (aiThinking || anim || !u || match.winner !== null || !match.sides[u.side].ai) return;
      set({ aiThinking: true });
      setTimeout(() => {
        const m = get().match;
        if (m !== match || get().anim) return set({ aiThinking: false });
        const action = chooseAction(m);
        set({ aiThinking: false });
        commit(action, false);
      }, 450);
    },
  };
});

// ---------- derived helpers used by the UI ----------

export interface QuickPlans {
  attack: TargetPlan | null;
  magic: MagicPlan | null;
}

export function quickPlans(match: MatchState, actor: Unit, target: Target): QuickPlans {
  return { attack: planAttack(match, actor, target), magic: planMagic(match, actor, target) };
}

/** The quick-action preview for the unit under the cursor, when the acting unit is Selected. */
export function hoverQuick(
  s: Pick<Store, 'match' | 'phase' | 'hoverHex' | 'hoverUnitId'>,
): { target: Target; plans: QuickPlans } | null {
  const u = activeUnit(s.match);
  if (!u) return null;
  if (s.phase.kind === 'quickChoice') {
    const target = targetById(s.match, (s.phase as { targetId: number }).targetId);
    return target ? { target, plans: { attack: s.phase.attack, magic: s.phase.magic } } : null;
  }
  if (s.phase.kind !== 'move' || !s.phase.selected) return null;
  const target =
    (s.hoverUnitId !== null ? targetById(s.match, s.hoverUnitId) : undefined) ??
    (s.hoverHex ? targetAt(s.match, s.hoverHex) : undefined);
  if (!target || target.id === u.id) return null;
  const plans = quickPlans(s.match, u, target);
  return plans.attack || plans.magic ? { target, plans } : null;
}

/** Directions around `to` where `kind` could be summoned (hex on map, free, standable). */
export function validSummonDirs(match: MatchState, summonerId: number, to: Hex, kind: string): Dir[] {
  const sk = kindOf(kind);
  return ([0, 1, 2, 3, 4, 5] as Dir[]).filter((d) => canPlace(match, sk, neighbor(to, d), summonerId));
}

/**
 * True when `actor` could hit `target` from its Move Range but for a Clear
 * Angle (a Direct shot blocked by Units or Obstacles).
 */
export function blockedShot(match: MatchState, actor: Unit, target: Target): boolean {
  if (planAttack(match, actor, target) || planMagic(match, actor, target)) return false;
  return !!(planAttack(match, actor, target, true) || planMagic(match, actor, target, true));
}

/**
 * The valid summon direction closest in angle to `toward` (the hex under the
 * cursor), so any point roughly in that direction selects the hex. Null when
 * the cursor is on the Summoner's own hex or no direction is valid.
 */
export function summonDirToward(match: MatchState, summonerId: number, to: Hex, kind: string, toward: Hex | null): Dir | null {
  if (!toward || hexEq(toward, to)) return null;
  const valid = validSummonDirs(match, summonerId, to, kind);
  if (!valid.length) return null;
  const toXY = (h: Hex) => [Math.sqrt(3) * (h.q + h.r / 2), 1.5 * h.r];
  const [fx, fy] = toXY(to);
  const [tx, ty] = toXY(toward);
  const a = Math.atan2(ty - fy, tx - fx);
  let best: Dir | null = null;
  let bestDiff = Infinity;
  for (const d of valid) {
    let diff = Math.abs(a - (-Math.PI / 3) * d) % (2 * Math.PI);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff < bestDiff - 1e-9) {
      bestDiff = diff;
      best = d;
    }
  }
  return best;
}

/** The hex direction whose on-screen angle is closest to the direction from `from` to `to`. */
export function closestFacing(from: Hex, to: Hex): Dir {
  const toXY = (h: Hex) => [Math.sqrt(3) * (h.q + h.r / 2), 1.5 * h.r];
  const [fx, fy] = toXY(from);
  const [tx, ty] = toXY(to);
  const a = Math.atan2(ty - fy, tx - fx);
  let best: Dir = 0;
  let bestDiff = Infinity;
  for (const d of [0, 1, 2, 3, 4, 5] as Dir[]) {
    // direction d points at -60°·d in this (y-down) frame
    const da = (-Math.PI / 3) * d;
    let diff = Math.abs(a - da) % (2 * Math.PI);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff < bestDiff - 1e-9) {
      bestDiff = diff;
      best = d;
    }
  }
  return best;
}

/** Previewed Turn Delay for the active Unit based on what the player is hovering. */
export function previewDelay(
  s: Pick<Store, 'match' | 'phase' | 'hoverHex' | 'hoverCommand' | 'hoverUnitId'>,
): number | undefined {
  const u = activeUnit(s.match);
  if (!u) return undefined;
  const d = (to: Hex, acted: boolean) =>
    delayForAction(s.match, { unitId: u.id, to, command: acted ? { type: 'attack', target: to } : { type: 'wait' } });
  const p = s.phase;
  switch (p.kind) {
    case 'move': {
      const q = hoverQuick(s);
      if (q) {
        const plan = q.plans.attack ?? q.plans.magic!;
        return d(plan.dest, true);
      }
      if (p.selected && s.hoverHex && !hexEq(s.hoverHex, u.pos)) {
        const n = reachable(s.match, u).get(hexKey(s.hoverHex));
        if (n?.canEnd) return d(s.hoverHex, false);
      }
      return undefined;
    }
    case 'quickChoice':
      return d(p.attack.dest, true);
    case 'menu':
      if (s.hoverCommand) return d(p.to, s.hoverCommand !== 'wait');
      return undefined;
    case 'target':
    case 'summonDir':
      return d(p.to, true);
    default:
      return undefined;
  }
}

export function canAttackFrom(match: MatchState, unitId: number, to: Hex): boolean {
  const u = getUnit(match, unitId);
  return attackTargets(match, { ...u, pos: to }, to).length > 0;
}
