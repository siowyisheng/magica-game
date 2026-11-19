import { create } from 'zustand';
import {
  type Command,
  type Dir,
  type GameEvent,
  type Hex,
  type MatchState,
  type TurnAction,
  activeUnit,
  applyTurn,
  attackTargets,
  createMatch,
  delayForAction,
  getUnit,
  hexEq,
  hexKey,
  kindOf,
  reachable,
  SCAFFOLD_MAP,
  validateTurn,
  formatClock,
} from './rules';
import { chooseAction } from './ai/ai';

/** UI phase for the human's turn. The rules only see the final TurnAction. */
export type Phase =
  | { kind: 'idle' }
  | { kind: 'move' }
  | { kind: 'menu'; to: Hex; facing: Dir; sub?: 'magic' | 'summon' }
  | { kind: 'target'; to: Hex; facing: Dir; command: 'attack' | { magic: string } }
  | { kind: 'summonDir'; to: Hex; facing: Dir; summonKind: string };

export type CommandHover = 'wait' | 'attack' | 'magic' | 'summon' | null;

interface Store {
  match: MatchState;
  phase: Phase;
  hoverHex: Hex | null;
  hoverUnitId: number | null;
  hoverCommand: CommandHover;
  showHpBars: boolean;
  pixelSize: number;
  log: string[];
  aiThinking: boolean;
  /** Bumped on every applied turn; used to animate. */
  version: number;

  newMatch: () => void;
  setHoverHex: (h: Hex | null) => void;
  setHoverUnit: (id: number | null) => void;
  setHoverCommand: (c: CommandHover) => void;
  clickHex: (h: Hex) => void;
  rightClick: () => void;
  choose: (c: 'wait' | 'attack' | { magic: string } | { summon: string } | { sub: 'magic' | 'summon' }) => void;
  toggleHpBars: () => void;
  setPixelSize: (n: number) => void;
  setAi: (side: 0 | 1, ai: boolean) => void;
  tickAi: () => void;
}

function phaseFor(match: MatchState): Phase {
  const u = activeUnit(match);
  if (!u || match.winner !== null || match.sides[u.side].ai) return { kind: 'idle' };
  if (u.stranded) return { kind: 'menu', to: u.pos, facing: u.facing };
  return { kind: 'move' };
}

function describe(match: MatchState, e: GameEvent): string | null {
  const name = (id: number) => {
    const u = match.units.find((x) => x.id === id);
    return u ? `${u.side === 0 ? 'Green' : 'Red'} ${kindOf(u.kind).name}` : `#${id}`;
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
      return `${name(e.unitId)} fell`;
    case 'win':
      return `${e.side === 0 ? 'Green' : 'Red'} wins!`;
    case 'mana':
      return e.side === 0 ? `${formatClock(e.clock)} mana: Green ${e.amount >= 0 ? '+' : ''}${e.amount}` : null;
    default:
      return null;
  }
}

export const useGame = create<Store>((set, get) => {
  const commit = (action: TurnAction) => {
    const { match } = get();
    const err = validateTurn(match, action);
    if (err) {
      set((s) => ({ log: [`Illegal: ${err}`, ...s.log].slice(0, 40) }));
      return;
    }
    // describe with the pre-state for names of units that die
    const { state, events } = applyTurn(match, action);
    const lines = events.map((e) => describe({ ...state, units: [...match.units, ...state.units] }, e)).filter(Boolean) as string[];
    set((s) => ({
      match: state,
      phase: phaseFor(state),
      hoverCommand: null,
      log: [...lines.reverse(), ...s.log].slice(0, 40),
      version: s.version + 1,
    }));
  };

  const initial = createMatch(SCAFFOLD_MAP, { ai: [false, true], seed: Date.now() & 0xffff });

  return {
    match: initial,
    phase: phaseFor(initial),
    hoverHex: null,
    hoverUnitId: null,
    hoverCommand: null,
    showHpBars: true,
    pixelSize: 2,
    log: ['Match start — 06:00'],
    aiThinking: false,
    version: 0,

    newMatch: () => {
      const ai = get().match.sides.map((s) => s.ai) as [boolean, boolean];
      const m = createMatch(SCAFFOLD_MAP, { ai, seed: Date.now() & 0xffff });
      set({ match: m, phase: phaseFor(m), log: ['Match start — 06:00'], version: get().version + 1 });
    },
    setHoverHex: (h) => {
      const cur = get().hoverHex;
      if ((cur === null && h === null) || (cur && h && hexEq(cur, h))) return;
      set({ hoverHex: h });
    },
    setHoverUnit: (id) => get().hoverUnitId !== id && set({ hoverUnitId: id }),
    setHoverCommand: (c) => set({ hoverCommand: c }),

    clickHex: (h) => {
      const { match, phase } = get();
      const u = activeUnit(match);
      if (!u) return;
      switch (phase.kind) {
        case 'move': {
          if (hexEq(h, u.pos)) return set({ phase: { kind: 'menu', to: u.pos, facing: u.facing } });
          const n = reachable(match, u).get(hexKey(h));
          if (n && n.canEnd) set({ phase: { kind: 'menu', to: h, facing: u.facing } });
          return;
        }
        case 'menu': {
          // Left-clicking the map while the command menu is open sets Facing.
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
          if (validateTurn(match, action)) return;
          commit(action);
          return;
        }
        case 'summonDir': {
          const dir = ([0, 1, 2, 3, 4, 5] as Dir[]).find((d) => {
            const v = { q: h.q - phase.to.q, r: h.r - phase.to.r };
            return hexEq(v, [{ q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }][d]);
          });
          if (dir === undefined) return;
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
      switch (phase.kind) {
        case 'menu':
          if (phase.sub) return set({ phase: { kind: 'menu', to: phase.to, facing: phase.facing } });
          if (u?.stranded) return; // cannot move anyway
          return set({ phase: { kind: 'move' }, hoverCommand: null }); // cancel move
        case 'target':
        case 'summonDir':
          return set({ phase: { kind: 'menu', to: phase.to, facing: phase.facing } });
        default:
          return;
      }
    },

    choose: (c) => {
      const { phase, match } = get();
      const u = activeUnit(match);
      if (!u || phase.kind !== 'menu') return;
      const { to, facing } = phase;
      if (c === 'wait') return commit({ unitId: u.id, to, facing, command: { type: 'wait' } });
      if (c === 'attack') return set({ phase: { kind: 'target', to, facing, command: 'attack' } });
      if ('sub' in c) return set({ phase: { kind: 'menu', to, facing, sub: c.sub } });
      if ('summon' in c) return set({ phase: { kind: 'summonDir', to, facing, summonKind: c.summon } });
      const ab = kindOf(u.kind).magic.find((m) => m.id === c.magic);
      if (!ab) return;
      if (ab.kind === 'water') {
        return commit({ unitId: u.id, to, facing, command: { type: 'magic', ability: ab.id, target: to } });
      }
      set({ phase: { kind: 'target', to, facing, command: { magic: ab.id } } });
    },

    toggleHpBars: () => set((s) => ({ showHpBars: !s.showHpBars })),
    setPixelSize: (n) => set({ pixelSize: n }),
    setAi: (side, ai) => {
      const m = get().match;
      const sides = [...m.sides] as MatchState['sides'];
      sides[side] = { ...sides[side], ai };
      const match = { ...m, sides };
      set({ match, phase: phaseFor(match) });
    },

    tickAi: () => {
      const { match, aiThinking } = get();
      const u = activeUnit(match);
      if (aiThinking || !u || match.winner !== null || !match.sides[u.side].ai) return;
      set({ aiThinking: true });
      setTimeout(() => {
        const m = get().match;
        if (m !== match) return set({ aiThinking: false });
        const action = chooseAction(m);
        set({ aiThinking: false });
        commit(action);
      }, 450);
    },
  };
});

// ---------- derived helpers used by the UI ----------

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
export function previewDelay(s: Pick<Store, 'match' | 'phase' | 'hoverHex' | 'hoverCommand'>): number | undefined {
  const u = activeUnit(s.match);
  if (!u) return undefined;
  const d = (to: Hex, acted: boolean) =>
    delayForAction(s.match, { unitId: u.id, to, command: acted ? { type: 'attack', target: to } : { type: 'wait' } });
  const p = s.phase;
  switch (p.kind) {
    case 'move':
      if (s.hoverHex && !hexEq(s.hoverHex, u.pos)) {
        const n = reachable(s.match, u).get(hexKey(s.hoverHex));
        if (n?.canEnd) return d(s.hoverHex, false);
      }
      return undefined;
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
