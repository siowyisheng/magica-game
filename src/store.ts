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
  SUMMONERS,
  randomLoadout,
  targetAt,
  targetById,
  canPlace,
  activeBalance,
  applyTemporaryBalance,
  endTemporaryBalance,
} from './rules';
import { autoLoadout, chooseAction } from './ai/ai';
import { getLoadout, isPlayable } from './loadouts/library';
import { getMap } from './maps/library';
import { animWallMs, planTurnAnim, type TurnAnim } from './anim';
import { ReplayCursor, loadReplay, newReplay, replayProblem, storeReplay, type Replay } from './replay/replay';

export type HpBarsMode = 'always' | 'damaged' | 'off';

/** Match Setup: map, and per Side a Summoner ('random' allowed) and who plays it. */
export interface MatchSetup {
  mapId: string;
  /** Test Match: both Sides may Summon all 28 Summons. */
  test: boolean;
  summoners: [string, string];
  /** Loadout id per Side, or 'random' (LOADOUT_SIZE random Summons) or 'auto' (built for the Summoner). */
  loadouts: [string, string];
  ai: [boolean, boolean];
  /** AI strength per Side (used when that Side is AI). */
  aiLevels?: ['normal' | 'hard', 'normal' | 'hard'];
}

const SETUP_KEY = 'magica.setup';
function loadSetup(): MatchSetup {
  const d: MatchSetup = {
    mapId: 'builtin:scaffold-ford',
    test: false,
    summoners: ['regent', 'random'],
    loadouts: ['random', 'random'],
    ai: [false, true],
  };
  try {
    return { ...d, ...JSON.parse(localStorage.getItem(SETUP_KEY) ?? '{}') };
  } catch {
    return d;
  }
}

/** Resolve 'random' Summoner choices (uses the given random source). */
export function resolveSummoners(choice: [string, string], rand: () => number = Math.random): [string, string] {
  // 'random', or a Summoner that no longer exists (an old saved setup): a random one
  const pick = (c: string) => (c !== 'random' && SUMMONERS.some((k) => k.id === c) ? c : SUMMONERS[Math.floor(rand() * SUMMONERS.length)].id);
  return [pick(choice[0]), pick(choice[1])];
}

/** Resolve a Loadout choice into its Summons. */
export function resolveLoadout(choice: string, summonerId: string, rand: () => number = Math.random): string[] {
  if (choice === 'auto') return autoLoadout(summonerId, rand);
  const l = getLoadout(choice);
  if (l && isPlayable(l)) return [...l.summons];
  // 'random', or a choice that can't be played: an old 'random18' or starter, a deleted or incomplete Loadout
  return randomLoadout(rand);
}

/** Summoners and Loadouts for a Match Setup ('random' / 'auto' resolved). */
export function resolveSetup(setup: Pick<MatchSetup, 'test' | 'summoners' | 'loadouts'>, rand: () => number = Math.random) {
  const summoners = resolveSummoners(setup.summoners, rand);
  const rosters: [string[] | null, string[] | null] = setup.test
    ? [null, null]
    : [resolveLoadout(setup.loadouts[0], summoners[0], rand), resolveLoadout(setup.loadouts[1], summoners[1], rand)];
  return { summoners, rosters };
}

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

/** Watching a Replay. The live match is set aside until the Replay is left. */
export interface ReplayView {
  replay: Replay;
  cursor: ReplayCursor;
  /** Turns applied to the position shown. */
  index: number;
  playing: boolean;
  speed: 1 | 2 | 4;
  /** Why playback stopped early, if a turn could not be replayed. */
  error: string | null;
  /** The Play from here dialog is open. */
  takeover: boolean;
  live: { match: MatchState; recording: Recording | null; log: string[]; paused: boolean };
}

/** The live match's Replay while it is recorded, with the position it has reached. */
export type Recording = Replay & { head: MatchState };

export type Screen = 'game' | 'editor' | 'dev' | 'loadouts' | 'replays';

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
  screen: Screen;
  /** The Match Setup dialog is open. */
  setupOpen: boolean;
  /** The in-match Loadouts view is open. */
  loadoutsOpen: boolean;
  setLoadoutsOpen: (open: boolean) => void;
  /** Last Match Setup (remembered between visits). */
  setup: MatchSetup;
  phase: Phase;
  hoverHex: Hex | null;
  hoverUnitId: number | null;
  hoverCommand: CommandHover;
  /** Summon kind hovered in the Summon submenu. */
  hoverSummon: string | null;
  /** Other units whose ranges are toggled on (oldest first). Cleared when a turn ends. */
  inspected: number[];
  /** Floating HP bars: on every unit, only on damaged ones (default), or none. AV bars show unless off. */
  hpBars: HpBarsMode;
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
  startMatch: (map: MapDef, mapId?: string, setup?: Partial<MatchSetup>) => void;
  setMapId: (id: string) => void;
  setScreen: (s: Screen) => void;
  setSetupOpen: (open: boolean) => void;
  /** Start a match from a Match Setup (and remember it). */
  startFromSetup: (setup: MatchSetup) => void;
  setHoverHex: (h: Hex | null) => void;
  setHoverUnit: (id: number | null) => void;
  setHoverCommand: (c: CommandHover) => void;
  setHoverSummon: (k: string | null) => void;
  clickHex: (h: Hex) => void;
  rightClick: () => void;
  choose: (c: 'wait' | 'attack' | 'magic' | { magic: string } | { summon: string } | { sub: 'magic' | 'summon' }) => void;
  setHpBars: (mode: HpBarsMode) => void;
  setAi: (side: 0 | 1, ai: boolean) => void;
  tickAi: () => void;

  /** The match is Paused: no turn starts and no Command can be given. */
  paused: boolean;
  togglePause: () => void;
  /** The live match's Replay, recorded as it is played. */
  recording: Recording | null;
  replay: ReplayView | null;
  /** Watch a stored Replay (from the start). */
  openReplay: (id: string) => boolean;
  exitReplay: () => void;
  replaySeek: (index: number) => void;
  replayStep: (delta: 1 | -1) => void;
  replayTogglePlay: () => void;
  replaySetSpeed: (speed: 1 | 2 | 4) => void;
  setTakeoverOpen: (open: boolean) => void;
  /** Continue the Replay's current position as a live match. */
  playFromHere: (ai: [boolean, boolean]) => void;
  tickReplay: () => void;
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
    case 'timeUp':
      return `Time Limit: Stones ${e.stones[0]}–${e.stones[1]}, HP ${e.hp[0]}–${e.hp[1]}${e.result === 'draw' ? ' — a draw' : ''}`;
    case 'mana':
      return e.side === 0 ? `${formatClock(e.clock)} mana: Green ${e.amount >= 0 ? '+' : ''}${e.amount}` : null;
    default:
      return null;
  }
}

export const useGame = create<Store>((set, get) => {
  const commit = (action: TurnAction, alreadyMoved = true, rate = 1) => {
    const { match } = get();
    const err = validateTurn(match, action);
    const watching = get().replay;
    if (err && watching) {
      watching.cursor.breakAt(watching.index, err);
      set({ replay: { ...watching, playing: false, error: watching.cursor.errorText() } });
      return;
    }
    if (err) {
      set((s) => ({ log: [`Illegal: ${err}`, ...s.log].slice(0, 40) }));
      signal({ type: 'deny' });
      return;
    }
    // describe with the pre-state for names of units that die
    const { state, events } = applyTurn(match, action);
    if (!watching) record(match, action, state);
    const lines = events.map((e) => describe({ ...state, units: [...match.units, ...state.units], obstacles: [...match.obstacles, ...state.obstacles] }, e)).filter(Boolean) as string[];
    const finish = () =>
      set((s) => {
        // Who is AI may have changed while the turn animated: keep the current choice.
        const next = { ...state, sides: state.sides.map((sd, i) => ({ ...sd, ai: s.match.sides[i].ai })) as MatchState['sides'] };
        const r = s.replay;
        return {
          ...(r ? { replay: { ...r, index: r.index + 1 } } : { recording: s.recording && { ...s.recording, head: next } as Recording }),
          match: next,
          anim: null,
          phase: phaseFor(next),
          hoverCommand: null,
          hoverSummon: null,
          inspected: [],
          log: [...lines.reverse(), ...s.log].slice(0, 40),
          version: s.version + 1,
        };
      });
    const anim = get().animate ? { ...planTurnAnim(match, action, performance.now(), alreadyMoved), rate } : null;
    signal({ type: 'turn', before: match, action, anim: anim && anim.duration > 0 ? anim : null, events });
    if (!anim || anim.duration <= 0) return finish();
    set({ anim, phase: { kind: 'idle' }, hoverCommand: null, hoverSummon: null });
    setTimeout(() => {
      if (get().anim === anim) finish();
    }, animWallMs(anim));
  };

  /** Add a turn to the live match's Replay (a fresh one if the match was replaced from outside). */
  const record = (before: MatchState, action: TurnAction, after: MatchState) => {
    let rec = get().recording;
    if (!rec || rec.head !== before) rec = { ...newReplay(before, activeBalance()), head: before };
    const next: Recording = { ...rec, actions: [...rec.actions, action], winner: after.winner, updatedAt: Date.now(), head: after };
    persist(next);
    set({ recording: next });
  };
  const persist = (rec: Recording) => {
    const { head: _head, ...replay } = rec;
    try {
      storeReplay(replay);
    } catch {
      /* storage unavailable */
    }
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

  const initialSetup = loadSetup();
  const initial = createMatch(getMap(initialSetup.mapId)?.map ?? SCAFFOLD_MAP, { ai: initialSetup.ai, seed: Date.now() & 0xffff, ...resolveSetup(initialSetup) });

  return {
    match: initial,
    mapId: loadSetup().mapId,
    screen: 'game',
    setupOpen: false,
    loadoutsOpen: false,
    setLoadoutsOpen: (loadoutsOpen) => set({ loadoutsOpen }),
    setup: loadSetup(),
    phase: phaseFor(initial),
    hoverHex: null,
    hoverUnitId: null,
    hoverCommand: null,
    hoverSummon: null,
    inspected: [],
    hpBars: 'damaged',
    log: ['Match start — 06:00'],
    aiThinking: false,
    anim: null,
    animate: true,
    version: 0,
    paused: false,
    recording: null,
    replay: null,

    newMatch: () => {
      const map = getMap(get().mapId)?.map ?? get().match.map;
      get().startMatch(map);
    },
    startMatch: (map, mapId, setup) => {
      const last = get().setup;
      const ai = setup?.ai ?? (get().match.sides.map((s) => s.ai) as [boolean, boolean]);
      const { summoners, rosters } = resolveSetup({ ...last, ...setup });
      const aiLevels = setup?.aiLevels ?? last.aiLevels ?? (['normal', 'normal'] as ['normal' | 'hard', 'normal' | 'hard']);
      const m = createMatch(map, { ai, seed: Date.now() & 0xffff, summoners, rosters, aiLevels });
      if (mapId) set({ mapId });
      if (get().replay) endTemporaryBalance();
      set({ match: m, recording: { ...newReplay(m, activeBalance()), head: m }, replay: null, paused: false, aiThinking: false, anim: null, inspected: [], phase: phaseFor(m), log: [`${map.name}: match start — ${formatClock(map.startClock)}`], version: get().version + 1 });
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
      if (get().paused || get().replay) return;
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
      if (get().paused || get().replay) {
        // still allowed: showing another unit's ranges
        const { match, hoverUnitId, hoverHex } = get();
        const o = (hoverUnitId !== null ? match.units.find((x) => x.id === hoverUnitId) : undefined) ?? (hoverHex ? unitAt(match, hoverHex) : undefined);
        if (o) toggleInspect(o.id);
        return;
      }
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
      if (get().paused || get().replay) return;
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
    setSetupOpen: (setupOpen) => set({ setupOpen }),
    startFromSetup: (setup) => {
      try {
        localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
      } catch {
        /* storage unavailable */
      }
      const map = getMap(setup.mapId)?.map ?? get().match.map;
      set({ setup, setupOpen: false, screen: 'game' });
      get().startMatch(map, setup.mapId, setup);
    },
    setScreen: (screen) => {
      if (screen !== 'game' && get().replay) get().exitReplay();
      set({ screen, hoverHex: null, hoverUnitId: null });
    },
    setHpBars: (hpBars) => set({ hpBars }),
    setAi: (side, ai) => {
      if (get().replay) return;
      const m = get().match;
      const sides = [...m.sides] as MatchState['sides'];
      sides[side] = { ...sides[side], ai };
      const match = { ...m, sides };
      const rec = get().recording;
      set({ match, phase: get().paused ? get().phase : phaseFor(match), recording: rec && rec.head === m ? { ...rec, head: match } : rec });
    },

    tickAi: () => {
      const { match, aiThinking, anim, paused, replay } = get();
      const u = activeUnit(match);
      if (paused || replay || aiThinking || anim || !u || match.winner !== null || !match.sides[u.side].ai) return;
      set({ aiThinking: true });
      setTimeout(() => {
        const m = get().match;
        if (m !== match || get().anim || get().paused || get().replay) return set({ aiThinking: false });
        const action = chooseAction(m);
        set({ aiThinking: false });
        commit(action, false);
      }, 450);
    },

    togglePause: () => {
      if (get().replay) return get().replayTogglePlay();
      const paused = !get().paused;
      // a person's turn keeps its place; it just can't be confirmed while Paused
      set({ paused });
    },

    openReplay: (id) => {
      const replay = loadReplay(id);
      if (!replay || replayProblem(replay)) return false;
      const cur = get().replay;
      const live = cur ? cur.live : { match: get().match, recording: get().recording, log: get().log, paused: get().paused };
      applyTemporaryBalance(replay.balance);
      const cursor = new ReplayCursor(replay);
      const pos = cursor.at(0);
      set({
        screen: 'game',
        replay: { replay, cursor, index: 0, playing: false, speed: 1, error: pos.error, takeover: false, live },
        match: pos.state,
        anim: null,
        aiThinking: false,
        phase: { kind: 'idle' },
        inspected: [],
        log: [`Replay: ${replay.initial.map.name} — ${replay.actions.length} turns`],
        version: get().version + 1,
      });
      return true;
    },

    exitReplay: () => {
      const r = get().replay;
      if (!r) return;
      endTemporaryBalance();
      const { match, recording, log, paused } = r.live;
      set({ replay: null, match, recording, log, paused, anim: null, aiThinking: false, inspected: [], phase: phaseFor(match), version: get().version + 1 });
    },

    replaySeek: (index) => {
      const r = get().replay;
      if (!r) return;
      const pos = r.cursor.at(index);
      set({
        replay: { ...r, index: pos.index, error: pos.error ?? r.error, playing: pos.error ? false : r.playing },
        match: pos.state,
        anim: null,
        aiThinking: false,
        log: [`Turn ${pos.index} of ${r.replay.actions.length}`, ...get().log].slice(0, 40),
        version: get().version + 1,
      });
    },

    replayStep: (delta) => {
      const r = get().replay;
      if (!r) return;
      if (delta < 0) return set({ replay: { ...r, playing: false } }), get().replaySeek(r.index - 1);
      if (get().anim) get().replaySeek(r.index); // finish the current turn at once
      const cur = get().replay!;
      set({ replay: { ...cur, playing: false } });
      if (cur.index >= cur.cursor.playable) return;
      commit(cur.replay.actions[cur.index], false, cur.speed);
    },

    replayTogglePlay: () => {
      const r = get().replay;
      if (!r) return;
      const atEnd = r.index >= r.cursor.playable;
      if (!r.playing && atEnd && r.cursor.playable === r.replay.actions.length) get().replaySeek(0);
      const cur = get().replay!;
      set({ replay: { ...cur, playing: !r.playing && cur.index < cur.cursor.playable } });
    },

    replaySetSpeed: (speed) => {
      const r = get().replay;
      if (r) set({ replay: { ...r, speed } });
    },

    setTakeoverOpen: (takeover) => {
      const r = get().replay;
      if (r) set({ replay: { ...r, takeover, playing: false } });
    },

    playFromHere: (ai) => {
      const r = get().replay;
      if (!r) return;
      if (get().anim) get().replaySeek(r.index);
      const pos = get().match;
      endTemporaryBalance();
      const match: MatchState = { ...pos, sides: pos.sides.map((sd, i) => ({ ...sd, ai: ai[i] })) as MatchState['sides'] };
      set({
        replay: null,
        match,
        recording: { ...newReplay(match, activeBalance()), head: match },
        paused: false,
        anim: null,
        aiThinking: false,
        inspected: [],
        phase: phaseFor(match),
        log: [`Playing from turn ${get().replay?.index ?? r.index} of the Replay`],
        version: get().version + 1,
      });
    },

    tickReplay: () => {
      const r = get().replay;
      if (!r || !r.playing || get().anim || get().aiThinking) return;
      if (r.index >= r.cursor.playable) return set({ replay: { ...r, playing: false, error: r.cursor.errorText() ?? r.error } });
      set({ aiThinking: true });
      const match = get().match;
      setTimeout(() => {
        const cur = get().replay;
        set({ aiThinking: false });
        if (!cur || !cur.playing || get().match !== match || get().anim) return;
        commit(cur.replay.actions[cur.index], false, cur.speed);
      }, 450 / r.speed);
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
