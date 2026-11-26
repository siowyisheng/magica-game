// Messages between the two players' games in an Online Match (over the direct
// connection), and between a game and the server (over its WebSocket).

import type { MapDef, TurnAction } from '../rules/types';
import type { MatchResult } from './report';

/** Bumped whenever these messages change. */
export const PROTOCOL_VERSION = 1;

/** A player's hidden choice before the Planning Phase. */
export interface Pick {
  master: string;
  familiars: string[];
  signature: string;
}

export type PeerMsg =
  /** First message both ways: who I am and what I play by. The creator also sends the map. */
  | { t: 'hello'; protocol: number; rules: string; playerId: string; name: string; map?: MapDef }
  /** My pick is locked: its hash, revealed once both are locked. */
  | { t: 'lock'; commitment: string }
  | { t: 'reveal'; pick: Pick; salt: string }
  | { t: 'ready' }
  /** Turn `n` (0-based), the time it took, and whether it was a Timeout. */
  | { t: 'turn'; n: number; action: TurnAction; ms: number; timeout?: boolean }
  | { t: 'pause' }
  | { t: 'resume' }
  | { t: 'resign' }
  /** The other player was gone 2 minutes: I claim the win. */
  | { t: 'abandon' }
  /** Catch-up after a reconnect: everything played so far. */
  | { t: 'sync-request' }
  | {
      t: 'sync';
      picks: [Pick, Pick];
      turns: { action: TurnAction; ms: number; timeout?: boolean }[];
      started: boolean;
      pausesUsed: [number, number];
      ended: MatchResult | null;
    }
  | { t: 'ping' };

/** Server → game, over the WebSocket. */
export type ServerMsg =
  /** Both players are here: which Side I play, the shared seed, and who the other is. */
  | { t: 'paired'; gameId: string; side: 0 | 1; seed: number; creator: boolean; opponent: { id: string; name: string }; rejoin: boolean }
  /** The other player's half of setting up the direct connection. */
  | { t: 'signal'; data: unknown }
  | { t: 'opponent-left' }
  | { t: 'error'; message: string };

/** Game → server. */
export type ClientMsg = { t: 'join'; gameId: string } | { t: 'signal'; data: unknown };
