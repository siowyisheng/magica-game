import { type Dir, type Hex, facingTowardTarget, hexDistance, hexEq, hexKey, neighbor } from './hex';
import {
  BASE_DELAY_BY_SPEED,
  INCOME_MULTIPLIER,
  MANA_MAX,
  MANA_START,
  MAX_HP,
  STONE_BASE,
  TIME_LIMIT_HOURS,
  UPKEEP_DIVISOR,
} from './data/tuning';
import { DEFAULT_MASTER, FAMILIARS, kindOf } from './kinds';
import { affectedUnits, computeDamage, computeEmpower, computeHeal, magicHitOrigin, minAimDistance, shotAllowed, trajectoryOf, type Effect } from './combat';
import { alignmentBonus } from './time';
import { isPhysical, powerOf } from './ability';
import { canPlace, canSummonAt, isStranded, mapHexAt, reachable, surfaceOf } from './terrain';
import { isObstacle, type GameEvent, type MapDef, type MatchState, type SideId, type TurnAction, type Unit, type UnitKind } from './types';

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
  return turnDelay(kindOf(u), !hexEq(u.pos, action.to), action.command.type !== 'wait');
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

export function masterOf(state: MatchState, side: SideId): Unit | undefined {
  return state.units.find((u) => u.side === side && kindOf(u).isMaster);
}

export function familiarCount(state: MatchState, side: SideId): number {
  return state.units.filter((u) => u.side === side && !kindOf(u).isMaster).length;
}

export function stonesControlled(state: MatchState, side: SideId): number {
  return state.stones.filter((s) => s.owner === side).length;
}

export function upkeep(state: MatchState, side: SideId): number {
  let total = 0;
  for (const u of state.units) {
    if (u.side !== side) continue;
    const k = kindOf(u);
    if (!k.isMaster) total += k.cost / UPKEEP_DIVISOR;
  }
  return total;
}

/** The hour mark the next Mana Income is paid at. */
export function nextIncomeAt(clock: number): number {
  return (Math.floor(clock / 60) + 1) * 60;
}

/**
 * Hourly Mana Income (may be negative) paid at the hour mark `at` (default:
 * the next one). The Master's MP counts its Alignment at that hour.
 */
export function manaIncome(state: MatchState, side: SideId, at = nextIncomeAt(state.clock)): number {
  const s = masterOf(state, side);
  if (!s) return 0;
  const k = kindOf(s);
  const mp = Math.max(0, k.stats.mp + alignmentBonus(k.alignment, at));
  return INCOME_MULTIPLIER * (STONE_BASE + stonesControlled(state, side)) * mp - upkeep(state, side);
}

/**
 * Mana `side` will have `minutes` from now: its Mana plus the Income paid at
 * each hour mark the clock passes on the way (as it stands now), within 0–cap.
 */
export function manaAfter(state: MatchState, side: SideId, minutes: number): number {
  let mana = state.sides[side].mana;
  for (let h = Math.floor(state.clock / 60) + 1; h * 60 <= state.clock + minutes; h++) mana = Math.max(0, Math.min(MANA_MAX, mana + manaIncome(state, side, h * 60)));
  return mana;
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
  /** Master kind for each Side (default Sigil). */
  masters?: [string, string];
  /** AI strength per Side. */
  aiLevels?: ['normal' | 'hard', 'normal' | 'hard'];
  /** Each Side's Loadout (Familiar kind ids); null = all Familiars (Test Match). */
  rosters?: [string[] | null, string[] | null];
  /** Each Side's Signature Familiar (one of its Loadout); ignored without a Loadout. */
  signatures?: [string | null, string | null];
}

/** Number of Familiars in a Loadout. */
export const LOADOUT_SIZE = 20;

/** Whether `side` may Summon `kind` (it is in the Side's Loadout, or there is none). */
export function inRoster(state: MatchState, side: SideId, kind: string): boolean {
  const r = state.sides[side].roster;
  return !r || r.includes(kind);
}

/** How many of a Familiar a Signature may have on the map at once (others: 1). */
export const SIGNATURE_LIMIT = 3;

/** Whether `kind` is `side`'s Signature (never in a Test Match). */
export function isSignature(state: MatchState, side: SideId, kind: string): boolean {
  const s = state.sides[side];
  return !!s.roster && s.signature === kind;
}

/** How many of `kind` `side` may have on the map at once (no limit without a Loadout). */
export function summonLimit(state: MatchState, side: SideId, kind: string): number {
  if (!state.sides[side].roster) return Infinity;
  return isSignature(state, side, kind) ? SIGNATURE_LIMIT : 1;
}

/** How many of `kind` `side` has on the map. */
export function onMap(state: MatchState, side: SideId, kind: string): number {
  return state.units.filter((u) => u.side === side && u.kind === kind).length;
}

/**
 * The Familiars `side` may Summon now: in its Loadout and under their limit on
 * the map. A Signature comes with its Signature Bonus.
 */
export function summonableKinds(state: MatchState, side: SideId): UnitKind[] {
  return FAMILIARS.filter((k) => inRoster(state, side, k.id) && onMap(state, side, k.id) < summonLimit(state, side, k.id)).map((k) =>
    isSignature(state, side, k.id) ? kindOf({ kind: k.id, signature: true }) : k,
  );
}

export function createMatch(map: MapDef, opts: MatchOptions = {}): MatchState {
  // Pits never hold water: they don't count for the Water Level rules.
  const ground = map.hexes.filter((h) => h.terrain !== 'pit');
  const heights = ground.map((h) => h.height);
  const minHeight = Math.min(...heights);
  const hasWater = ground.some((h) => h.height < map.waterLevel);
  const state: MatchState = {
    map,
    waterLevel: map.waterLevel,
    // 1 below the start, but never below the level at which no water remains
    minWaterLevel: Math.max(map.waterLevel - 1, Math.min(minHeight, map.waterLevel)),
    maxWaterLevel: map.waterLevel + 1,
    hasWater,
    clock: map.startClock,
    units: [],
    obstacles: [],
    stones: map.hexes.filter((h) => h.terrain === 'stone').map((h) => ({ hex: h.hex, owner: null })),
    sides: [
      { mana: MANA_START, ai: opts.ai?.[0] ?? false, aiLevel: opts.aiLevels?.[0] ?? 'normal', ...(opts.rosters?.[0] ? { roster: [...opts.rosters[0]], ...(opts.signatures?.[0] ? { signature: opts.signatures[0]! } : {}) } : {}) },
      { mana: MANA_START, ai: opts.ai?.[1] ?? true, aiLevel: opts.aiLevels?.[1] ?? 'normal', ...(opts.rosters?.[1] ? { roster: [...opts.rosters[1]], ...(opts.signatures?.[1] ? { signature: opts.signatures[1]! } : {}) } : {}) },
    ],
    nextUnitId: 1,
    activeUnitId: null,
    winner: null,
    timeLimit: map.startClock + TIME_LIMIT_HOURS * 60,
    turnNumber: 0,
    rngState: (opts.seed ?? 12345) >>> 0,
  };
  for (const side of [0, 1] as const) {
    const k = kindOf(opts.masters?.[side] ?? DEFAULT_MASTER);
    if (!k.isMaster) throw new Error(`${k.id} is not a Master`);
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
  for (const o of map.obstacles ?? []) {
    state.obstacles.push({ id: state.nextUnitId++, pos: o.hex, def: o.def, hp: MAX_HP });
  }
  advance(state, []);
  return state;
}

// ---------- validation ----------

export function validateTurn(state: MatchState, action: TurnAction): string | null {
  if (state.winner !== null) return 'match is over';
  if (action.unitId !== state.activeUnitId) return 'not this unit’s turn';
  const unit = getUnit(state, action.unitId);
  const kind = kindOf(unit);
  const moved = !hexEq(unit.pos, action.to);
  if (unit.stranded && !moved && action.command.type !== 'wait') return 'stranded units that stay put can only Wait';
  if (moved) {
    const node = reachable(state, unit).get(hexKey(action.to));
    if (!node || !node.canEnd) return 'destination not reachable';
  }
  const view = withUnitAt(state, unit.id, action.to);
  const cmd = action.command;
  switch (cmd.type) {
    case 'wait':
      return null;
    case 'act': {
      const ab = kind.ability;
      if (ab.kind === 'water') return canCastWater(state, ab.delta) ? null : 'water level cannot change further';
      const d = hexDistance(action.to, cmd.target);
      if (d < minAimDistance(ab) || d > ab.range) return 'target out of range';
      if (!mapHexAt(state.map, cmd.target)) return 'target off map';
      if (!shotAllowed(view, unit.id, trajectoryOf(ab), action.to, cmd.target)) return trajectoryOf(ab) === null ? 'too high or low to reach' : 'no clear angle';
      if (affectedUnits(view, getUnit(view, unit.id), ab, cmd.target).length === 0) return 'no valid target';
      return null;
    }
    case 'summon': {
      if (!kind.isMaster) return 'only Masters can Summon';
      const sk = kindOf(cmd.kind);
      if (sk.isMaster) return 'cannot summon a Master';
      if (!inRoster(state, unit.side, sk.id)) return 'not in this Side’s Loadout';
      if (onMap(state, unit.side, sk.id) >= summonLimit(state, unit.side, sk.id)) return 'already on the map';
      if (state.sides[unit.side].mana < sk.cost) return 'not enough mana';
      const h = neighbor(action.to, cmd.dir);
      if (!mapHexAt(state.map, h)) return 'off map';
      if (!canPlace(view, sk, h, unit.id)) return 'the Familiar cannot be placed there';
      if (!canSummonAt(view, sk, action.to, h, unit.id)) return 'too high or low to summon onto';
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
  const kind = kindOf(unit);
  const view = withUnitAt(state, unit.id, action.to);
  const caster = getUnit(view, unit.id);
  const cmd = action.command;
  if (cmd.type === 'act') {
    const ab = kind.ability;
    if (ab.kind === 'water') return [];
    const hit = powerOf(ab) === 'atk' ? 'physical' : 'magic';
    return affectedUnits(view, caster, ab, cmd.target).map((t) =>
      ab.kind === 'heal' && !isObstacle(t) ? computeHeal(view, caster, t) : ab.kind === 'empower' && !isObstacle(t) ? computeEmpower(ab, t) : computeDamage(view, caster, magicHitOrigin(ab, action.to, cmd.target, t), t, hit),
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
    case 'act': {
      const ab = kindOf(getUnit(state, action.unitId)).ability;
      if (ab.kind === 'water' || hexEq(action.to, cmd.target)) return action.facing;
      return facingTowardTarget(action.to, cmd.target, action.facing);
    }
  }
}

// ---------- apply ----------

function clone(state: MatchState): MatchState {
  return {
    ...state,
    units: state.units.map((u) => ({ ...u, pos: { ...u.pos } })),
    obstacles: state.obstacles.map((o) => ({ ...o, pos: { ...o.pos } })),
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
  const kind = kindOf(unit);
  const moved = !hexEq(unit.pos, action.to);

  if (moved) {
    events.push({ type: 'move', unitId: unit.id, from: unit.pos, to: action.to });
    unit.pos = { ...action.to };
  }
  unit.facing = resultingFacing(prev, action);

  const cmd = action.command;
  if (cmd.type === 'act') {
    // Abilities are free: no Mana
    const ab = kind.ability;
    if (ab.kind === 'water') {
      state.waterLevel += ab.delta;
      events.push({ type: 'water', level: state.waterLevel });
    }
    for (const e of effects) {
      if (e.obstacle) {
        const o = state.obstacles.find((x) => x.id === e.unitId)!;
        o.hp = Math.max(0, o.hp - e.amount);
        events.push({ type: 'damage', unitId: o.id, amount: e.amount, source: unit.id });
        continue;
      }
      const t = getUnit(state, e.unitId);
      if (e.kind === 'damage') {
        t.hp = Math.max(0, t.hp - e.amount);
        events.push({ type: 'damage', unitId: t.id, amount: e.amount, source: unit.id });
      } else if (e.kind === 'empower') {
        t.empowered = Math.max(t.empowered ?? 0, e.amount);
        events.push({ type: 'empower', unitId: t.id, amount: e.amount, source: unit.id });
      } else {
        t.hp = Math.min(MAX_HP, t.hp + e.amount);
        events.push({ type: 'heal', unitId: t.id, amount: e.amount, source: unit.id });
      }
    }
    // a physical hit uses up Empower (its damage above already counted it)
    if (isPhysical(ab)) delete unit.empowered;
  } else if (cmd.type === 'summon') {
    const signature = isSignature(state, unit.side, cmd.kind);
    const sk = kindOf({ kind: cmd.kind, signature });
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
      ...(signature ? { signature: true } : {}),
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
  const broken = state.obstacles.filter((o) => o.hp <= 0);
  for (const o of broken) events.push({ type: 'death', unitId: o.id });
  if (broken.length) state.obstacles = state.obstacles.filter((o) => o.hp > 0);
  const dead = state.units.filter((u) => u.hp <= 0);
  for (const d of dead) {
    events.push({ type: 'death', unitId: d.id });
    if (kindOf(d).isMaster && state.winner === null) {
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
      { av: a.av, spd: kindOf(a).stats.spd, side: a.side, id: a.id },
      { av: b.av, spd: kindOf(b).stats.spd, side: b.side, id: b.id },
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
    if (to >= state.timeLimit) {
      endOnTime(state, events);
      return;
    }
    // Hour marks crossed in (from, to]
    for (let h = Math.floor(from / 60) + 1; h * 60 <= to; h++) {
      for (const side of [0, 1] as const) {
        const income = manaIncome(state, side, h * 60);
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

/**
 * Time Limit: the Side controlling more Magic Stones wins; if level, the Side
 * with more total HP; if still level, a draw.
 */
function endOnTime(state: MatchState, events: GameEvent[]): void {
  const stones: [number, number] = [stonesControlled(state, 0), stonesControlled(state, 1)];
  const hp: [number, number] = [0, 1].map((s) => state.units.filter((u) => u.side === s).reduce((a, u) => a + u.hp, 0)) as [number, number];
  const result: SideId | 'draw' = stones[0] !== stones[1] ? (stones[0] > stones[1] ? 0 : 1) : hp[0] !== hp[1] ? (hp[0] > hp[1] ? 0 : 1) : 'draw';
  state.clock = state.timeLimit;
  state.winner = result;
  state.activeUnitId = null;
  events.push({ type: 'timeUp', result, stones, hp });
  if (result !== 'draw') events.push({ type: 'win', side: result });
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
    const k = kindOf(u);
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

/** Advance to the next turn (exposed for tests). */
export function advanceForTest(state: MatchState): GameEvent[] {
  const events: GameEvent[] = [];
  advance(state, events);
  return events;
}
