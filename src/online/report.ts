// Match Reports: what each player's game sends the server when an Online Match ends,
// and how the server judges a pair of them. Shared by the client and the server.

import type { MatchState, SideId, TurnAction } from '../rules/types';
import type { TimeSettings } from './clock';

/** How an Online Match ended. */
export type EndReason = 'master' | 'timeLimit' | 'resign' | 'abandon';

export interface MatchResult {
  winner: SideId | 'draw';
  reason: EndReason;
}

/** The Replay part of a report: everything needed to watch the match again. */
export interface ReportReplay {
  initial: MatchState;
  actions: TurnAction[];
  /** Milliseconds each turn took (Turn Timer and Time Bank time; animations and Pauses left out). */
  times: number[];
  /** Turns that were a Timeout (indexes into `actions`). */
  timeouts: number[];
  /** The Turn Timer and Time Bank the creator picked (absent: before they could be picked, 10 s and 60 s). */
  time?: TimeSettings;
}

export interface MatchReport {
  gameId: string;
  /** The reporting player. */
  playerId: string;
  /** Green's and Red's Player IDs. */
  players: [string, string];
  result: MatchResult;
  replay: ReportReplay;
  /** Rules fingerprint the match was played under (game version and stats). */
  rules: string;
}

export type ResultStatus = 'confirmed' | 'unconfirmed' | 'contested' | 'pending';

/** How long the server waits for the second report before calling a match Unconfirmed. */
export const SECOND_REPORT_WAIT_MS = 10 * 60_000;

/** JSON with object keys sorted, so equal values always give equal text. */
export function canonical(x: unknown): string {
  if (x === null || typeof x !== 'object') return JSON.stringify(x);
  if (Array.isArray(x)) return `[${x.map(canonical).join(',')}]`;
  const o = x as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
    .join(',')}}`;
}

/**
 * What two reports must agree on: the result, the starting position and every turn
 * (and who played which Side). Turn times aren't compared: lag makes them differ a little.
 */
export function comparisonKey(r: Pick<MatchReport, 'gameId' | 'players' | 'result' | 'replay' | 'rules'>): string {
  return canonical({ gameId: r.gameId, players: r.players, result: r.result, initial: r.replay.initial, actions: r.replay.actions, timeouts: r.replay.timeouts, time: r.replay.time, rules: r.rules });
}

/**
 * A match's result status from its reports' comparison keys: Confirmed when both
 * players' reports agree, Contested when they differ, Unconfirmed when only one came
 * in and the wait for the other is over (Pending before that).
 */
export function resultStatus(keys: string[], firstAt: number, now: number): ResultStatus {
  if (keys.length >= 2) return keys.every((k) => k === keys[0]) ? 'confirmed' : 'contested';
  if (keys.length === 1) return now - firstAt >= SECOND_REPORT_WAIT_MS ? 'unconfirmed' : 'pending';
  return 'pending';
}
