// Replays: a match recorded as its starting position, the balance in force
// and the list of turns. The rules are deterministic, so re-applying the
// turns rebuilds every position. Kept in this browser: the most recent
// matches for a while, saved ones until deleted. JSON export / import.

import { applyTurn, isOldBalance, kindOf, validateTurn, type Balance, type MatchState, type SideId, type TurnAction } from '../rules';

export interface Replay {
  id: string;
  /** Player-given name; null shows a default made from the Masters and map. */
  name: string | null;
  /** Saved Replays are kept until deleted; the others are Recent and roll off. */
  saved: boolean;
  createdAt: number;
  updatedAt: number;
  /** Stats and abilities in force when the match was played. */
  balance: Balance;
  initial: MatchState;
  actions: TurnAction[];
  winner: SideId | 'draw' | null;
  /** The Replay format it was recorded in (absent: before version 3). */
  version?: number;
}

export type ReplayMeta = Omit<Replay, 'initial' | 'actions' | 'balance'> & {
  mapName: string;
  masters: [string, string];
  turns: number;
};

/** How many unsaved Replays are kept. */
export const RECENT_LIMIT = 10;

const INDEX_KEY = 'magica.replays';
const bodyKey = (id: string) => `magica.replay.${id}`;

export function newReplay(initial: MatchState, balance: Balance): Replay {
  const now = Date.now();
  return {
    id: `replay-${now.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    name: null,
    saved: false,
    createdAt: now,
    updatedAt: now,
    balance: JSON.parse(JSON.stringify(balance)),
    initial: JSON.parse(JSON.stringify(initial)),
    actions: [],
    winner: initial.winner,
    version: REPLAY_VERSION,
  };
}

function mastersOf(s: MatchState): [string, string] {
  const of = (side: SideId) => s.units.find((u) => u.side === side && kindOf(u).isMaster)?.kind ?? '?';
  return [of(0), of(1)];
}

export function metaOf(r: Replay): ReplayMeta {
  return {
    id: r.id,
    name: r.name,
    saved: r.saved,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    winner: r.winner,
    mapName: r.initial.map.name,
    masters: mastersOf(r.initial),
    turns: r.actions.length,
  };
}

/** The name shown for a Replay. */
export function replayTitle(m: Pick<ReplayMeta, 'name' | 'masters' | 'mapName'>): string {
  if (m.name) return m.name;
  const name = (id: string) => {
    try {
      return kindOf(id).name;
    } catch {
      return id;
    }
  };
  return `${name(m.masters[0])} vs ${name(m.masters[1])} · ${m.mapName}`;
}

// ---------- storage ----------

function readIndex(): ReplayMeta[] {
  try {
    const raw = JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]');
    // entries saved before the rename keep their Masters under `summoners`
    return Array.isArray(raw)
      ? raw.filter((m) => m && typeof m.id === 'string').map((m) => (m.masters || !m.summoners ? m : { ...m, masters: m.summoners }))
      : [];
  } catch {
    return [];
  }
}

function writeIndex(list: ReplayMeta[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(list));
}

/** Saved Replays first, then Recent ones; newest first within each. */
export function listReplays(): ReplayMeta[] {
  return readIndex().sort((a, b) => Number(b.saved) - Number(a.saved) || b.updatedAt - a.updatedAt);
}

export function loadReplay(id: string): Replay | null {
  try {
    const raw = localStorage.getItem(bodyKey(id));
    return raw ? (JSON.parse(raw) as Replay) : null;
  } catch {
    return null;
  }
}

/** Drop the oldest unsaved Replays beyond `keep`; returns whether any were dropped. */
function pruneRecent(list: ReplayMeta[], keep: number, protect: string): ReplayMeta[] {
  const recent = list.filter((m) => !m.saved && m.id !== protect).sort((a, b) => b.updatedAt - a.updatedAt);
  const drop = new Set(recent.slice(Math.max(0, keep)).map((m) => m.id));
  for (const id of drop) localStorage.removeItem(bodyKey(id));
  return list.filter((m) => !drop.has(m.id));
}

/**
 * Write a Replay (insert or replace). Keeps at most RECENT_LIMIT unsaved
 * Replays; when storage is full, drops older Recent ones and tries again.
 */
export function storeReplay(r: Replay): boolean {
  let list = readIndex().filter((m) => m.id !== r.id);
  list.push(metaOf(r));
  list = pruneRecent(list, r.saved ? RECENT_LIMIT : RECENT_LIMIT - 1, r.id);
  const body = JSON.stringify(r);
  for (let keep = RECENT_LIMIT - 1; keep >= -1; keep--) {
    try {
      localStorage.setItem(bodyKey(r.id), body);
      writeIndex(list);
      return true;
    } catch {
      list = pruneRecent(list, keep, r.id);
    }
  }
  return false;
}

export function updateReplay(id: string, patch: Partial<Pick<Replay, 'name' | 'saved'>>): Replay | null {
  const r = loadReplay(id);
  if (!r) return null;
  const next = { ...r, ...patch };
  storeReplay(next);
  return next;
}

export function deleteReplay(id: string) {
  localStorage.removeItem(bodyKey(id));
  try {
    writeIndex(readIndex().filter((m) => m.id !== id));
  } catch {
    /* storage unavailable */
  }
}

export function exportReplayJson(r: Replay): string {
  return JSON.stringify({ format: 'magica-replay', version: REPLAY_VERSION, replay: r });
}

/**
 * The Replay format's version. 2: one Ability per Unit (the Act Command), and
 * Speed shifted down by 6. 3: one of each Familiar on the map (Signatures up to
 * 3), and Mana Income following the Master's Alignment. Older Replays can't be
 * watched: their turns may no longer be legal, or play out differently.
 */
export const REPLAY_VERSION = 3;

/** True for a Replay recorded before the current version. */
export function isOldReplay(r: Pick<Replay, 'actions' | 'balance' | 'version'>): boolean {
  return (r.version ?? 0) < REPLAY_VERSION || r.actions.some((a) => (a.command.type as string) === 'attack' || (a.command.type as string) === 'magic') || isOldBalance(r.balance);
}

const OLD_REPLAY = 'it was recorded under older rules (before Signature Familiars)';

/** Parse an exported Replay; it is stored as a new, saved Replay. */
export function importReplayJson(text: string): Replay {
  const raw = JSON.parse(text);
  const r = raw?.format === 'magica-replay' ? raw.replay : null;
  if (!r || !r.initial || !Array.isArray(r.actions) || !r.balance) throw new Error('not a magica Replay file');
  if (typeof raw.version !== 'number' || raw.version < REPLAY_VERSION || isOldReplay({ ...r, version: raw.version }))
    throw new Error(`this Replay can’t be watched any more: ${OLD_REPLAY}`);
  const imported: Replay = { ...newReplay(r.initial, r.balance), name: r.name ?? null, saved: true, actions: r.actions, winner: r.winner ?? null, createdAt: r.createdAt ?? Date.now() };
  storeReplay(imported);
  return imported;
}

/** Why a Replay can't be watched at all (it names unit kinds that no longer exist), or null. */
export function replayProblem(r: Pick<Replay, 'initial' | 'actions' | 'balance' | 'version'>): string | null {
  if (isOldReplay(r)) return OLD_REPLAY;
  const kinds = new Set<string>(r.initial.units.map((u) => u.kind));
  for (const a of r.actions) if (a.command.type === 'summon') kinds.add(a.command.kind);
  for (const k of kinds)
    try {
      kindOf(k);
    } catch {
      return `it uses ${k}, which is no longer in the game`;
    }
  return null;
}

// ---------- playback ----------

/** Positions kept while watching, so stepping back is quick. */
const CHECKPOINT_EVERY = 20;

export interface Position {
  state: MatchState;
  /** Turns applied: the position after `index` turns. */
  index: number;
  /** Set when a turn could not be applied (the rules changed since it was recorded). */
  error: string | null;
}

/**
 * Rebuilds positions of one Replay. The Replay's balance must be in force
 * (applyTemporaryBalance) while it is used.
 */
export class ReplayCursor {
  private checkpoints = new Map<number, MatchState>();
  /** Turns that can be applied; past this a turn is illegal under today's rules. */
  playable: number;
  brokenAt: { turn: number; reason: string } | null = null;

  constructor(readonly replay: Replay) {
    this.checkpoints.set(0, replay.initial);
    this.playable = replay.actions.length;
  }

  /** The position after `index` turns (clamped to what can be played). */
  at(index: number): Position {
    const target = Math.max(0, Math.min(index, this.playable));
    let from = 0;
    for (const k of this.checkpoints.keys()) if (k <= target && k > from) from = k;
    let state = this.checkpoints.get(from)!;
    for (let i = from; i < target; i++) {
      const action = this.replay.actions[i];
      const err = validateTurn(state, action);
      if (err) {
        this.playable = i;
        this.brokenAt = { turn: i + 1, reason: err };
        return { state, index: i, error: this.errorText() };
      }
      state = applyTurn(state, action).state;
      if ((i + 1) % CHECKPOINT_EVERY === 0) this.checkpoints.set(i + 1, state);
    }
    return { state, index: target, error: index > this.playable ? this.errorText() : null };
  }

  /** Mark turn `index` (0-based) as unplayable, when it fails while animating forward. */
  breakAt(index: number, reason: string) {
    this.playable = Math.min(this.playable, index);
    this.brokenAt = { turn: index + 1, reason };
  }

  errorText(): string | null {
    return this.brokenAt ? `Turn ${this.brokenAt.turn} can't be replayed (${this.brokenAt.reason}): the rules have changed since this match was played.` : null;
  }
}
