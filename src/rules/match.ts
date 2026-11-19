import { type Dir, type Hex, facingTowardTarget, hexDistance, hexEq, hexKey, neighbor } from './hex';
import {
  BASE_DELAY_BY_SPEED,
  MANA_MAX,
  MANA_START,
  MAX_HP,
  MAX_SUMMONS,
  STONE_BASE,
  UPKEEP_DIVISOR,
} from './data/tuning';
import { kindOf } from './kinds';
import { affectedUnits, attackTargets, computeDamage, computeHeal, minAimDistance, type Effect } from './combat';
import { canStandOn, isStranded, mapHexAt, reachable, surfaceOf, unitAt } from './terrain';
import type { GameEvent, MagicAbility, MapDef, MatchState, SideId, TurnAction, Unit, UnitKind } from './types';

// ---------- delays ----------

export function baseDelay(spd: number): number {
  const i = Math.max(0, Math.min(BASE_DELAY_BY_SPEED.length - 1, spd));
  return BASE_DELAY_BY_SPEED[i];
}

/** Turn Delay: Base Delay + half of it per Move / acting Command; floored at the end. */
export function turnDelay(kind: UnitKind, moved: boolean, acted: boolean): number {
  const b = baseDelay(kind.stats.spd);
  const halves = 2 + (moved ? 1 : 0) + (acted ? 1 : 0);
  return Math.floor((b * halves) / 2);
}

export function delayForAction(state: MatchState, action: Pick<TurnAction, 'unitId' | 'to' | 'command'>): number {
  const u = getUnit(state, action.unitId);
  return turnDelay(kindOf(u.kind), !hexEq(u.pos, action.to), action.command.type !== 'wait');
}

// ---------- queries ----------

export function getUnit(state: MatchState, id: number): Unit {
  const u = state.units.find((x) => x.id === id);
  if (!u) throw new Error(`no unit ${id}`);
  return u;
}

export function activeUnit(state: MatchState): Unit | null {
  return state.activeUnitId === null ? null : getUnit(state, state.activeUnitId);
}

export function summonerOf(state: MatchState, side: SideId): Unit | undefined {
  return state.units.find((u) => u.side === side && kindOf(u.kind).isSummoner);
}

export function summonCount(state: MatchState, side: SideId): number {
  return state.units.filter((u) => u.side === side && !kindOf(u.kind).isSummoner).length;
}

export function stonesControlled(state: MatchState, side: SideId): number {
  return state.stones.filter((s) => s.owner === side).length;
}

export function upkeep(state: MatchState, side: SideId): number {
  let total = 0;
  for (const u of state.units) {
    if (u.side !== side) continue;
    const k = kindOf(u.kind);
    if (!k.isSummoner) total += k.cost / UPKEEP_DIVISOR;
  }
  return total;
}

/** Hourly Mana Income (may be negative). */
export function manaIncome(state: MatchState, side: SideId): number {
  const s = summonerOf(state, side);
  if (!s) return 0;
  const mp = kindOf(s.kind).stats.mp;
  return (STONE_BASE + stonesControlled(state, side)) * mp - upkeep(state, side);
}

export function magicAbility(kind: UnitKind, id: string): MagicAbility {
  const a = kind.magic.find((m) => m.id === id);
  if (!a) throw new Error(`${kind.id} has no ability ${id}`);
  return a;
}

export function canCastWater(state: MatchState, delta: 1 | -1): boolean {
  if (!state.hasWater) return false;
  const next = state.waterLevel + delta;
  return next >= state.minWaterLevel && next <= state.maxWaterLevel;
}

// ---------- creation ----------

export interface MatchOptions {
  ai?: [boolean, boolean];
  seed?: number;
}

export function createMatch(map: MapDef, opts: MatchOptions = {}): MatchState {
  const heights = map.hexes.map((h) => h.height);
  const minHeight = Math.min(...heights);
  const hasWater = map.hexes.some((h) => h.height < map.waterLevel);
  const state: MatchState = {
    map,
    waterLevel: map.waterLevel,
    minWaterLevel: Math.min(minHeight, map.waterLevel),
    maxWaterLevel: map.waterLevel + 1,
    hasWater,
    clock: map.startClock,
    units: [],
    stones: map.hexes.filter((h) => h.terrain === 'stone').map((h) => ({ hex: h.hex, owner: null })),
    sides: [
      { mana: MANA_START, ai: opts.ai?.[0] ?? false },
      { mana: MANA_START, ai: opts.ai?.[1] ?? true },
    ],
    nextUnitId: 1,
    activeUnitId: null,
    winner: null,
    turnNumber: 0,
    rngState: (opts.seed ?? 12345) >>> 0,
  };
  for (const side of [0, 1] as const) {
    const k = kindOf('summoner');
    state.units.push({
      id: state.nextUnitId++,
      kind: k.id,
      side,
      pos: map.spawns[side],
      facing: map.spawnFacing[side],
      hp: MAX_HP,
      av: turnDelay(k, false, false),
      stranded: false,
    });
  }
  advance(state, []);
  return state;
}

// ---------- validation ----------

export function validateTurn(state: MatchState, action: TurnAction): string | null {
  if (state.winner !== null) return 'match is over';
  if (action.unitId !== state.activeUnitId) return 'not this unit’s turn';
  const unit = getUnit(state, action.unitId);
  const kind = kindOf(unit.kind);
  const moved = !hexEq(unit.pos, action.to);
  if (unit.stranded && (moved || action.command.type !== 'wait')) return 'stranded units can only Wait';
  if (moved) {
    const node = reachable(state, unit).get(hexKey(action.to));
    if (!node || !node.canEnd) return 'destination not reachable';
  }
  const view = withUnitAt(state, unit.id, action.to);
  const cmd = action.command;
  switch (cmd.type) {
    case 'wait':
      return null;
    case 'attack': {
      const t = unitAt(view, cmd.target);
      if (!t) return 'no target';
      const movedUnit = getUnit(view, unit.id);
      if (!attackTargets(view, movedUnit, action.to).some((x) => x.id === t.id)) return 'target out of range';
      return null;
    }
    case 'magic': {
      const ab = kind.magic.find((m) => m.id === cmd.ability);
      if (!ab) return 'unknown ability';
      if (state.sides[unit.side].mana < ab.manaCost) return 'not enough mana';
      if (ab.kind === 'water') return canCastWater(state, ab.delta) ? null : 'water level cannot change further';
      const d = hexDistance(action.to, cmd.target);
      if (d < minAimDistance(ab) || d > ab.range) return 'target out of range';
      if (!mapHexAt(state.map, cmd.target)) return 'target off map';
      if (affectedUnits(view, getUnit(view, unit.id), ab, cmd.target).length === 0) return 'no valid target';
      return null;
    }
    case 'summon': {
      if (!kind.isSummoner) return 'only Summoners can Summon';
      const sk = kindOf(cmd.kind);
      if (sk.isSummoner) return 'cannot summon a Summoner';
      if (state.sides[unit.side].mana < sk.cost) return 'not enough mana';
      if (summonCount(state, unit.side) >= MAX_SUMMONS) return 'summon limit reached';
      const h = neighbor(action.to, cmd.dir);
      const mh = mapHexAt(state.map, h);
      if (!mh) return 'off map';
      if (unitAt(view, h)) return 'hex occupied';
      if (!canStandOn(sk, mh, state.waterLevel)) return 'summon cannot stand there';
      return null;
    }
  }
}

function withUnitAt(state: MatchState, id: number, pos: Hex): MatchState {
  return { ...state, units: state.units.map((u) => (u.id === id ? { ...u, pos } : u)) };
}

// ---------- preview ----------

/** Exact effects of a Command, without applying it. */
export function previewEffects(state: MatchState, action: TurnAction): Effect[] {
  const unit = getUnit(state, action.unitId);
  const kind = kindOf(unit.kind);
  const view = withUnitAt(state, unit.id, action.to);
  const caster = getUnit(view, unit.id);
  const cmd = action.command;
  if (cmd.type === 'attack') {
    const t = unitAt(view, cmd.target);
    if (!t) return [];
    return [computeDamage(view, caster, action.to, t, 'physical')];
  }
  if (cmd.type === 'magic') {
    const ab = kind.magic.find((m) => m.id === cmd.ability);
    if (!ab || ab.kind === 'water') return [];
    return affectedUnits(view, caster, ab, cmd.target).map((t) =>
      ab.kind === 'heal' ? computeHeal(view, caster, t) : computeDamage(view, caster, action.to, t, 'magic'),
    );
  }
  return [];
}

// ---------- facing ----------

/**
 * The Facing a Unit ends its turn with: the chosen Facing for Wait, toward
 * the target for Attack and targeted Magic, toward the summoned hex for Summon.
 */
export function resultingFacing(state: MatchState, action: TurnAction): Dir {
  const cmd = action.command;
  switch (cmd.type) {
    case 'wait':
      return action.facing;
    case 'summon':
      return cmd.dir;
    case 'attack':
      return facingTowardTarget(action.to, cmd.target, action.facing);
    case 'magic': {
      const ab = kindOf(getUnit(state, action.unitId).kind).magic.find((m) => m.id === cmd.ability);
      if (!ab || ab.kind === 'water') return action.facing;
      return facingTowardTarget(action.to, cmd.target, action.facing);
    }
  }
}

// ---------- apply ----------

function clone(state: MatchState): MatchState {
  return {
    ...state,
    units: state.units.map((u) => ({ ...u, pos: { ...u.pos } })),
    stones: state.stones.map((s) => ({ ...s })),
    sides: [{ ...state.sides[0] }, { ...state.sides[1] }],
  };
}

export interface TurnResult {
  state: MatchState;
  events: GameEvent[];
}

export function applyTurn(prev: MatchState, action: TurnAction): TurnResult {
  const err = validateTurn(prev, action);
  if (err) throw new Error(`illegal turn: ${err}`);
  const effects = previewEffects(prev, action);
  const state = clone(prev);
  const events: GameEvent[] = [];
  const unit = getUnit(state, action.unitId);
  const kind = kindOf(unit.kind);
  const moved = !hexEq(unit.pos, action.to);

  if (moved) {
    events.push({ type: 'move', unitId: unit.id, from: unit.pos, to: action.to });
    unit.pos = { ...action.to };
  }
  unit.facing = resultingFacing(prev, action);

  const cmd = action.command;
  if (cmd.type === 'attack' || cmd.type === 'magic') {
    if (cmd.type === 'magic') {
      const ab = magicAbility(kind, cmd.ability);
      state.sides[unit.side].mana -= ab.manaCost;
      if (ab.kind === 'water') {
        state.waterLevel += ab.delta;
        events.push({ type: 'water', level: state.waterLevel });
      }
    }
    for (const e of effects) {
      const t = getUnit(state, e.unitId);
      if (e.kind === 'damage') {
        t.hp -= e.amount;
        events.push({ type: 'damage', unitId: t.id, amount: e.amount, source: unit.id });
      } else {
        t.hp = Math.min(MAX_HP, t.hp + e.amount);
        events.push({ type: 'heal', unitId: t.id, amount: e.amount, source: unit.id });
      }
    }
  } else if (cmd.type === 'summon') {
    const sk = kindOf(cmd.kind);
    state.sides[unit.side].mana -= sk.cost;
    const id = state.nextUnitId++;
    state.units.push({
      id,
      kind: sk.id,
      side: unit.side,
      pos: neighbor(unit.pos, cmd.dir),
      facing: cmd.dir,
      hp: MAX_HP,
      av: turnDelay(sk, true, true),
      stranded: false,
    });
    events.push({ type: 'summon', unitId: id, kind: sk.id, by: unit.id });
  }

  // Capture: the acting Unit ends its turn on a Magic Stone.
  if (unit.hp > 0) {
    const stone = state.stones.find((s) => hexEq(s.hex, unit.pos));
    if (stone && stone.owner !== unit.side) {
      stone.owner = unit.side;
      events.push({ type: 'capture', side: unit.side, hex: stone.hex });
    }
  }

  unit.av = turnDelay(kind, moved, cmd.type !== 'wait');
  state.turnNumber++;
  resolveDeaths(state, events);
  advance(state, events);
  return { state, events };
}

function resolveDeaths(state: MatchState, events: GameEvent[]): void {
  const dead = state.units.filter((u) => u.hp <= 0);
  for (const d of dead) {
    events.push({ type: 'death', unitId: d.id });
    if (kindOf(d.kind).isSummoner && state.winner === null) {
      state.winner = (1 - d.side) as SideId;
      events.push({ type: 'win', side: state.winner });
    }
  }
  if (dead.length) state.units = state.units.filter((u) => u.hp > 0);
}

/** Order key: lowest AV, then higher Speed, then Side 0 first, then creation order. */
export function compareTurnOrder(a: { av: number; spd: number; side: number; id: number }, b: typeof a): number {
  return a.av - b.av || b.spd - a.spd || a.side - b.side || a.id - b.id;
}

function nextUnit(state: MatchState): Unit {
  const sorted = [...state.units].sort((a, b) =>
    compareTurnOrder(
      { av: a.av, spd: kindOf(a.kind).stats.spd, side: a.side, id: a.id },
      { av: b.av, spd: kindOf(b.kind).stats.spd, side: b.side, id: b.id },
    ),
  );
  return sorted[0];
}

/** Advance the Game Clock to the next turn, paying Mana and applying start-of-turn effects. */
function advance(state: MatchState, events: GameEvent[]): void {
  while (state.winner === null) {
    const next = nextUnit(state);
    const delta = next.av;
    const from = state.clock;
    const to = from + delta;
    // Hour marks crossed in (from, to]
    for (let h = Math.floor(from / 60) + 1; h * 60 <= to; h++) {
      for (const side of [0, 1] as const) {
        const income = manaIncome(state, side);
        const before = state.sides[side].mana;
        state.sides[side].mana = Math.max(0, Math.min(MANA_MAX, before + income));
        events.push({ type: 'mana', side, amount: state.sides[side].mana - before, clock: h * 60 });
      }
    }
    state.clock = to;
    for (const u of state.units) u.av -= delta;
    state.activeUnitId = next.id;
    events.push({ type: 'turnStart', unitId: next.id, clock: state.clock });

    // Start-of-turn: Stranded damage, then Stone Heal.
    next.stranded = isStranded(state, next);
    if (next.stranded) {
      next.hp -= 1;
      events.push({ type: 'stranded', unitId: next.id });
      events.push({ type: 'damage', unitId: next.id, amount: 1, source: next.id });
    }
    const onStone = state.stones.some((s) => hexEq(s.hex, next.pos));
    if (onStone && next.hp > 0 && next.hp < MAX_HP) {
      next.hp += 1;
      events.push({ type: 'heal', unitId: next.id, amount: 1, source: 'stone' });
    }
    if (next.hp > 0) return;
    // Died at the start of its turn: resolve and find the next unit.
    resolveDeaths(state, events);
    state.activeUnitId = null;
  }
}

// ---------- timeline ----------

export interface TimelineEntry {
  unitId: number;
  clock: number;
  /** True for the first (exact) entry of each Unit; later ones are projections. */
  exact: boolean;
  /** True for the acting Unit's previewed next turn. */
  preview: boolean;
}

/**
 * Project the next `count` turns. The active Unit's next turn uses
 * `activeDelay` (its previewed Turn Delay) when given; repeats assume a
 * Move + Attack turn.
 */
export function projectTimeline(state: MatchState, count: number, activeDelay?: number): TimelineEntry[] {
  type Sim = { id: number; av: number; spd: number; side: number; repeat: number; exact: boolean; preview: boolean };
  const sims: Sim[] = state.units.map((u) => {
    const k = kindOf(u.kind);
    const isActive = u.id === state.activeUnitId;
    return {
      id: u.id,
      av: isActive ? (activeDelay ?? turnDelay(k, true, true)) : u.av,
      spd: k.stats.spd,
      side: u.side,
      repeat: turnDelay(k, true, true),
      exact: !isActive || activeDelay !== undefined,
      preview: isActive && activeDelay !== undefined,
    };
  });
  const out: TimelineEntry[] = [];
  let elapsed = 0;
  while (out.length < count && sims.length) {
    sims.sort(compareTurnOrder);
    const s = sims[0];
    elapsed += s.av;
    const d = s.av;
    for (const x of sims) x.av -= d;
    out.push({ unitId: s.id, clock: state.clock + elapsed, exact: s.exact, preview: s.preview });
    s.av = s.repeat;
    s.exact = false;
    s.preview = false;
  }
  return out;
}

export { reachable, surfaceOf };
