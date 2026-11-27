// An Online Match from this player's side: connecting, the hidden picks, the
// Planning Phase, passing turns, the clocks (Turn Timer and Time Bank), Pause,
// Resign, Abandon, rejoining, and the Match Report at the end.
//
// The match itself runs in the main game store (src/store.ts) like any other:
// this module feeds it the other player's turns and hears about this player's.

import { create } from 'zustand';
import {
  applyTemporaryBalance,
  applyTurn,
  createMatch,
  endTemporaryBalance,
  getRepoBalance,
  validateTurn,
  type MapDef,
  type MatchState,
  type SideId,
  type TurnAction,
} from '../rules';
import { useGame, setLocalSuspended, setOnlineHooks } from '../store';
import { createGame, ensureIdentity, history, loadIdentity, submitReport, wake, type Identity } from './api';
import { banksAfter, clockFace, DEFAULT_TIME, PAUSE_MAX_MS, PAUSES_PER_PLAYER, PLANNING_MS, TIMEOUT_GRACE_MS, turnAllowance, ABANDON_MS, type Banks, startBanks, type TimeSettings, validTime } from './clock';
import { commitPick, randomHex, rulesFingerprint, verifyPick } from './fingerprint';
import { Link } from './link';
import { PROTOCOL_VERSION, type PeerMsg, type Pick } from './protocol';
import type { MatchReport, MatchResult, ResultStatus } from './report';

export type Stage =
  /** Talking to the server (waking it, making the game). */
  | 'connecting'
  /** Waiting for the other player to join (the creator shares the Game ID). */
  | 'waiting'
  /** Paired; setting up the direct connection. */
  | 'linking'
  /** Choosing a Master and Loadout, unseen. */
  | 'picking'
  | 'planning'
  | 'playing'
  | 'ended'
  | 'failed';

export interface Turn {
  action: TurnAction;
  ms: number;
  timeout?: boolean;
}

interface OnlineState {
  stage: Stage | null;
  error: string | null;
  gameId: string | null;
  me: Identity | null;
  mySide: SideId | null;
  creator: boolean;
  opponent: { id: string; name: string } | null;
  map: MapDef | null;
  /** The Turn Timer and Time Bank, picked by the creator (the joiner learns them from its hello). */
  time: TimeSettings;
  /** My pick once locked, and the other's once revealed (by Side). */
  picks: [Pick | null, Pick | null];
  locked: [boolean, boolean];
  planningEndsAt: number | null;
  ready: [boolean, boolean];
  /** Every turn played, in order (the authority for the match). */
  turns: Turn[];
  banks: Banks;
  /** Clock time of the turn in progress (animations and Pauses left out). */
  elapsed: number;
  /** Who paused, and when (a Pause ends by itself after PAUSE_MAX_MS). */
  pause: { by: SideId; at: number } | null;
  pausesUsed: [number, number];
  /** The direct connection is up. */
  connected: boolean;
  /** When the other player dropped (null while connected). */
  goneSince: number | null;
  result: MatchResult | null;
  report: ResultStatus | 'sending' | 'error' | null;
}

const initial: OnlineState = {
  stage: null,
  error: null,
  gameId: null,
  me: null,
  mySide: null,
  creator: false,
  opponent: null,
  map: null,
  time: DEFAULT_TIME,
  picks: [null, null],
  locked: [false, false],
  planningEndsAt: null,
  ready: [false, false],
  turns: [],
  banks: startBanks(),
  elapsed: 0,
  pause: null,
  pausesUsed: [0, 0],
  connected: false,
  goneSince: null,
  result: null,
  report: null,
};

export const useOnline = create<OnlineState>(() => ({ ...initial }));

const CURRENT_KEY = 'magica.online.current';

// ---- private session state (not for rendering)
let link: Link | null = null;
let rules = '';
let mySalt = '';
let myCommitment = '';
let theirCommitment = '';
let start: MatchState | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;
let lastTick = 0;
let lastHeard = 0;
let pingTimer: ReturnType<typeof setInterval> | null = null;
/** The server's seed for this game: the match's tie-breaks (and a Random Map's layout) on both sides. */
let seed = 1;

const get = useOnline.getState;
const set = useOnline.setState;
const other = (s: SideId): SideId => (1 - s) as SideId;

function send(m: PeerMsg) {
  link?.send(m);
}

function fail(error: string) {
  set({ stage: 'failed', error });
}

/** Start an Online Match: make a new game (creator) or join one by its Game ID. */
export async function startOnline(opts: { name: string; map?: MapDef; time?: TimeSettings; gameId?: string }) {
  leaveOnline();
  setLocalSuspended(true);
  set({ ...initial, stage: 'connecting', creator: !opts.gameId, map: opts.map ?? null, time: opts.time ?? DEFAULT_TIME });
  const keep = currentGame();
  if (!(await wake())) return fail("Can't reach the server. It may be starting up: try again in a minute.");
  let me: Identity;
  let gameId: string;
  try {
    me = await ensureIdentity(opts.name);
    gameId = opts.gameId ? opts.gameId.trim().toUpperCase() : await createGame(me);
  } catch (e) {
    return fail((e as Error).message);
  }
  applyTemporaryBalance(getRepoBalance());
  rules = await rulesFingerprint();
  set({ me, gameId, stage: 'waiting' });
  // remembered for a rejoin (a rejoining joiner keeps the map and time settings it was sent)
  const map = opts.map ?? (keep?.gameId === gameId ? keep.map : null);
  const time = opts.time ?? (keep?.gameId === gameId ? validTime(keep.time) : null) ?? DEFAULT_TIME;
  set({ map, time });
  localStorage.setItem(CURRENT_KEY, JSON.stringify({ gameId, map, time, creator: !opts.gameId || !!keep?.creator }));
  connect(me, gameId);
}

/** Rejoin the Online Match this browser was last in (after a reload or a drop). */
export async function rejoinOnline(name: string): Promise<boolean> {
  const cur = currentGame();
  if (!cur) return false;
  await startOnline({ name, gameId: cur.gameId, map: cur.map ?? undefined, time: validTime(cur.time) ?? undefined });
  return true;
}

export function currentGame(): { gameId: string; map: MapDef | null; time?: TimeSettings; creator: boolean } | null {
  try {
    return JSON.parse(localStorage.getItem(CURRENT_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function connect(me: Identity, gameId: string) {
  link?.close();
  link = new Link(me, gameId, {
    paired: (m) => {
      set({ mySide: m.side, creator: m.creator, opponent: m.opponent, stage: get().stage === 'waiting' ? 'linking' : get().stage });
      // the seed makes the Random Map (creator) and the match's tie-breaks the same on both sides
      seed = m.seed;
    },
    open: () => {
      set({ connected: true, goneSince: null });
      lastHeard = performance.now();
      send({ t: 'hello', protocol: PROTOCOL_VERSION, rules, playerId: me.playerId, name: me.name, ...(get().creator && get().map ? { map: get().map!, time: get().time } : {}) });
    },
    message: (m) => {
      lastHeard = performance.now();
      receive(m);
    },
    lost: () => {
      if (get().connected) set({ connected: false, goneSince: Date.now() });
      repairSoon();
    },
    failed: (why) => {
      // during a match a failure is a disconnection (the other may come back); before it, the end
      if (start && get().stage !== 'ended') {
        set({ connected: false, goneSince: get().goneSince ?? Date.now(), error: why });
        if (why.includes('server')) reconnectSoon();
        else repairSoon();
      } else fail(why);
    },
  });
  if (!ticker) {
    lastTick = performance.now();
    ticker = setInterval(tick, 100);
  }
  if (!pingTimer) pingTimer = setInterval(() => send({ t: 'ping' }), 2000);
}


/** Leave the Online Match (and its connection) and go back to local play. */
export function leaveOnline() {
  link?.close();
  link = null;
  if (ticker) clearInterval(ticker);
  if (pingTimer) clearInterval(pingTimer);
  ticker = pingTimer = null;
  if (get().stage) endTemporaryBalance();
  setOnlineHooks(null);
  setLocalSuspended(false);
  start = null;
  set({ ...initial });
}

// ---- picks

/** Lock in my Master and Loadout (hidden: only a hash goes to the other player until both are locked). */
export async function lockPick(pick: Pick) {
  const side = get().mySide;
  if (side === null || get().locked[side]) return;
  mySalt = randomHex();
  myCommitment = await commitPick(pick, mySalt);
  const picks = [...get().picks] as OnlineState['picks'];
  picks[side] = pick;
  const locked = [...get().locked] as OnlineState['locked'];
  locked[side] = true;
  set({ picks, locked });
  send({ t: 'lock', commitment: myCommitment });
  revealIfBothLocked();
}

function revealIfBothLocked() {
  const { locked, mySide, picks } = get();
  if (mySide !== null && locked[0] && locked[1]) send({ t: 'reveal', pick: picks[mySide]!, salt: mySalt });
}

// ---- receiving

async function receive(m: PeerMsg) {
  const s = get();
  const mine = s.mySide;
  if (mine === null) return;
  const theirs = other(mine);
  switch (m.t) {
    case 'ping':
      return;
    case 'hello': {
      if (m.protocol !== PROTOCOL_VERSION || m.rules !== rules) return fail('You and the other player are on different versions of the game. Both refresh the page and try again.');
      if (m.map && !s.creator) {
        const time = validTime(m.time) ?? DEFAULT_TIME;
        set({ map: m.map, time });
        const cur = currentGame();
        if (cur) localStorage.setItem(CURRENT_KEY, JSON.stringify({ ...cur, map: m.map, time }));
      }
      // after a rejoin, share what has been played; the one who knows more wins
      if (s.stage === 'linking' || s.stage === 'waiting') set({ stage: 'picking' });
      if (start) send({ t: 'sync', picks: s.picks as [Pick, Pick], turns: s.turns, started: s.stage === 'playing' || s.stage === 'ended', pausesUsed: s.pausesUsed, ended: s.result });
      else if (s.locked[mine]) send({ t: 'lock', commitment: myCommitment });
      return;
    }
    case 'lock': {
      theirCommitment = m.commitment;
      const locked = [...s.locked] as OnlineState['locked'];
      locked[theirs] = true;
      set({ locked });
      revealIfBothLocked();
      return;
    }
    case 'reveal': {
      if (!(await verifyPick(m.pick, m.salt, theirCommitment))) return fail('The other player changed their pick after locking it in.');
      const picks = [...get().picks] as OnlineState['picks'];
      picks[theirs] = m.pick;
      set({ picks });
      if (picks[0] && picks[1]) beginPlanning();
      return;
    }
    case 'ready': {
      const ready = [...s.ready] as OnlineState['ready'];
      ready[theirs] = true;
      set({ ready });
      maybeStartPlaying();
      return;
    }
    case 'turn':
      return receiveTurn(m.n, { action: m.action, ms: m.ms, timeout: m.timeout }, theirs);
    case 'pause':
      return applyPause(theirs);
    case 'resume':
      return applyResume();
    case 'resign':
      return finish({ winner: mine, reason: 'resign' });
    case 'abandon':
      return finish({ winner: theirs, reason: 'abandon' });
    case 'sync-request':
      if (start) send({ t: 'sync', picks: s.picks as [Pick, Pick], turns: s.turns, started: s.stage === 'playing' || s.stage === 'ended', pausesUsed: s.pausesUsed, ended: s.result });
      return;
    case 'sync': {
      if (!start && m.picks[0] && m.picks[1]) {
        set({ picks: m.picks, locked: [true, true] });
        beginPlanning(m.started);
      }
      if (!start) return;
      const mineTurns = get().turns;
      if (m.turns.length > mineTurns.length) rebuild(m.turns);
      set({ pausesUsed: [Math.max(m.pausesUsed[0], get().pausesUsed[0]), Math.max(m.pausesUsed[1], get().pausesUsed[1])] });
      if (m.started && get().stage === 'planning') startPlaying();
      if (m.ended && !get().result) finish(m.ended);
      return;
    }
  }
}

// ---- planning and the match

function beginPlanning(alreadyStarted = false) {
  const { picks, map } = get();
  if (!picks[0] || !picks[1] || !map) return;
  start = createMatch(map, {
    ai: [false, false],
    seed,
    masters: [picks[0].master, picks[1].master],
    rosters: [picks[0].familiars, picks[1].familiars],
    signatures: [picks[0].signature, picks[1].signature],
  });
  setOnlineHooks({ side: get().mySide!, onLocalTurn: localTurn, onPause: togglePauseOnline, canAct: () => get().stage === 'playing' && !get().pause });
  useGame.getState().startOnlineMatch(start, `Online vs ${get().opponent?.name ?? 'opponent'}`);
  set({ stage: 'planning', planningEndsAt: Date.now() + PLANNING_MS, ready: [false, false], turns: [], banks: startBanks(get().time), elapsed: 0 });
  if (alreadyStarted) startPlaying();
}

export function readyUp() {
  const side = get().mySide;
  if (side === null || get().stage !== 'planning') return;
  const ready = [...get().ready] as OnlineState['ready'];
  ready[side] = true;
  set({ ready });
  send({ t: 'ready' });
  maybeStartPlaying();
}

function maybeStartPlaying() {
  const { ready, stage, planningEndsAt } = get();
  if (stage !== 'planning') return;
  if ((ready[0] && ready[1]) || (planningEndsAt !== null && Date.now() >= planningEndsAt)) startPlaying();
}

function startPlaying() {
  set({ stage: 'playing', elapsed: 0 });
  lastTick = performance.now();
}

/** The Side whose turn it is (null when the match is over). */
function moverSide(): SideId | null {
  const m = useGame.getState().match;
  const u = m.units.find((x) => x.id === m.activeUnitId);
  return m.winner === null && u ? u.side : null;
}

/** This player confirmed a turn in the game (called by the store before applying it). */
function localTurn(action: TurnAction, timeout = false) {
  const s = get();
  const n = s.turns.length;
  const turn: Turn = { action, ms: Math.round(s.elapsed), ...(timeout ? { timeout } : {}) };
  addTurn(turn, s.mySide!);
  send({ t: 'turn', n, action, ms: turn.ms, ...(timeout ? { timeout } : {}) });
}

function addTurn(turn: Turn, side: SideId) {
  const turns = [...get().turns, turn];
  const banks = [...get().banks] as Banks;
  banks[side] = clockFace(banks[side], turn.ms, get().time).bank;
  set({ turns, banks, elapsed: 0 });
}

function receiveTurn(n: number, turn: Turn, from: SideId) {
  const s = get();
  if (n === s.turns.length) {
    const g = useGame.getState();
    // its turn only, and a legal one (a rejoin's sync fixes anything else)
    if (moverSide() !== from && !(turn.timeout && moverSide() === s.mySide)) return send({ t: 'sync-request' });
    if (g.anim) {
      // wait for the animation to end so turns apply in order
      setTimeout(() => receiveTurn(n, turn, from), 60);
      return;
    }
    if (validateTurn(g.match, turn.action)) return;
    addTurn(turn, moverSide()!);
    g.playRemote(turn.action);
    return;
  }
  if (n < s.turns.length) {
    // the other player called a Timeout on my turn n that I had already played late: theirs stands
    if (turn.timeout && s.turns[n] && !s.turns[n].timeout) rebuild([...s.turns.slice(0, n), turn]);
    return;
  }
  send({ t: 'sync-request' });
}

/** Rebuild the match from the start with these turns (a rejoin, or a Timeout that overrides a late move). */
function rebuild(turns: Turn[]) {
  if (!start) return;
  let st = start;
  const ok: Turn[] = [];
  for (const t of turns) {
    if (validateTurn(st, t.action)) break;
    st = applyTurn(st, t.action).state;
    ok.push(t);
  }
  const times = ok.map((t, i) => ({ side: sideOfTurn(i, ok), ms: t.ms }));
  set({ turns: ok, banks: banksAfter(times, get().time), elapsed: 0 });
  useGame.getState().loadOnlinePosition(st, start, ok.map((t) => t.action));
}

/** Which Side played turn `i` (replaying from the start). */
function sideOfTurn(i: number, turns: Turn[]): SideId {
  let st = start!;
  for (let k = 0; k < i; k++) st = applyTurn(st, turns[k].action).state;
  return st.units.find((u) => u.id === st.activeUnitId)!.side;
}

/** A Wait in place for the Unit whose turn it is (a Timeout). */
function timeoutAction(): TurnAction | null {
  const m = useGame.getState().match;
  const u = m.units.find((x) => x.id === m.activeUnitId);
  return u ? { unitId: u.id, to: u.pos, facing: u.facing, command: { type: 'wait' } } : null;
}

// ---- the clock

function tick() {
  const now = performance.now();
  const dt = now - lastTick;
  lastTick = now;
  const s = get();
  if (s.stage === 'planning') return maybeStartPlaying();
  if (s.stage !== 'playing') return;
  const g = useGame.getState();
  // a Pause ends by itself
  if (s.pause && Date.now() - s.pause.at >= PAUSE_MAX_MS) applyResume();
  // the other player gone too long: the match can be claimed (see claimAbandon)
  if (s.connected && now - lastHeard > 8000) {
    set({ connected: false, goneSince: Date.now() });
    repairSoon();
  }
  const mover = moverSide();
  if (mover === null) {
    if (g.match.winner !== null && !s.result) finish({ winner: g.match.winner, reason: endReason(g.match) });
    return;
  }
  if (g.anim || s.pause) return;
  const elapsed = s.elapsed + dt;
  set({ elapsed });
  const allowance = turnAllowance(s.banks[mover], s.time);
  if (mover === s.mySide && elapsed >= allowance) {
    // my clock ran out: my Unit Waits (a Timeout)
    const a = timeoutAction();
    if (a) {
      localTurn(a, true);
      g.playRemote(a);
    }
  } else if (mover !== s.mySide && elapsed >= allowance + TIMEOUT_GRACE_MS) {
    // the other player is silent past their clock: their Unit Waits, and I tell them
    const a = timeoutAction();
    if (a) {
      const n = s.turns.length;
      addTurn({ action: a, ms: Math.round(allowance), timeout: true }, mover);
      send({ t: 'turn', n, action: a, ms: Math.round(allowance), timeout: true });
      g.playRemote(a);
    }
  }
}

let repairing = false;
/** The direct channel dropped: ask the server to pair us again, every few seconds until it's back. */
function repairSoon() {
  if (repairing) return;
  repairing = true;
  setTimeout(() => {
    repairing = false;
    if (get().connected || !link || get().stage === 'ended' || !get().stage) return;
    link.repair();
    repairSoon();
  }, 3000 + Math.random() * 1000);
}

let reconnecting = false;
/** My own connection to the server dropped: make a new one. */
function reconnectSoon() {
  if (reconnecting || !link) return;
  reconnecting = true;
  // ask the server to pair us again (it does once both are there)
  const { me, gameId } = get();
  setTimeout(() => {
    reconnecting = false;
    if (me && gameId && !get().connected && get().stage !== 'ended' && get().stage) connect(me, gameId);
  }, 5000);
}

function endReason(m: MatchState): MatchResult['reason'] {
  return m.clock >= m.timeLimit ? 'timeLimit' : 'master';
}

// ---- Pause, Resign, Abandon

function togglePauseOnline() {
  const s = get();
  if (s.stage !== 'playing' || s.mySide === null) return;
  if (s.pause) {
    send({ t: 'resume' });
    applyResume();
  } else {
    if (s.pausesUsed[s.mySide] >= PAUSES_PER_PLAYER) return;
    send({ t: 'pause' });
    applyPause(s.mySide);
  }
}

export function pausesLeft(side: SideId): number {
  return PAUSES_PER_PLAYER - get().pausesUsed[side];
}

function applyPause(by: SideId) {
  if (get().pause || get().pausesUsed[by] >= PAUSES_PER_PLAYER) return;
  const pausesUsed = [...get().pausesUsed] as OnlineState['pausesUsed'];
  pausesUsed[by]++;
  set({ pause: { by, at: Date.now() }, pausesUsed });
  useGame.setState({ paused: true });
}

function applyResume() {
  if (!get().pause) return;
  set({ pause: null });
  useGame.setState({ paused: false });
}

export function resign() {
  const s = get();
  if (s.mySide === null || s.result) return;
  send({ t: 'resign' });
  finish({ winner: other(s.mySide), reason: 'resign' });
}

/** The other player has been gone ABANDON_MS: they've Abandoned, and I can claim the win. */
export function canClaimAbandon(): boolean {
  const s = get();
  return s.stage === 'playing' && !s.connected && s.goneSince !== null && Date.now() - s.goneSince >= ABANDON_MS;
}

export function claimAbandon() {
  const s = get();
  if (s.mySide === null || !canClaimAbandon()) return;
  send({ t: 'abandon' });
  finish({ winner: s.mySide, reason: 'abandon' });
}

// ---- the end and the Match Report

function finish(result: MatchResult) {
  if (get().result) return;
  set({ result, stage: 'ended', pause: null });
  const g = useGame.getState();
  if (g.match.winner === null) g.endOnlineMatch(result.winner);
  useGame.setState({ paused: false });
  void report();
}

async function report() {
  const s = get();
  if (!s.me || !s.gameId || !start || s.mySide === null || !s.opponent || !s.result) return;
  const players: [string, string] = s.mySide === 0 ? [s.me.playerId, s.opponent.id] : [s.opponent.id, s.me.playerId];
  const r: MatchReport = {
    gameId: s.gameId,
    playerId: s.me.playerId,
    players,
    result: s.result,
    replay: { initial: start, actions: s.turns.map((t) => t.action), times: s.turns.map((t) => t.ms), timeouts: s.turns.flatMap((t, i) => (t.timeout ? [i] : [])), time: s.time },
    rules,
  };
  set({ report: 'sending' });
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      set({ report: await submitReport(s.me, r) });
      localStorage.removeItem(CURRENT_KEY);
      // the first report waits for the other: check back until the status settles
      for (let k = 0; k < 24 && get().report === 'pending' && get().gameId === s.gameId; k++) {
        await new Promise((res) => setTimeout(res, 5000));
        const h = await history(s.me).catch(() => []);
        const mine = h.find((x) => x.gameId === s.gameId);
        if (mine && mine.status !== 'pending' && get().gameId === s.gameId) set({ report: mine.status });
      }
      return;
    } catch {
      await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)));
    }
  }
  set({ report: 'error' });
}

export { loadIdentity };
