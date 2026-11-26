// Commitments for the hidden picks, and the rules fingerprint both games must share.

import { FAMILIARS, MASTERS, BALANCE_VERSION } from '../rules';
import { REPLAY_VERSION } from '../replay/replay';
import { canonical } from './report';
import { PROTOCOL_VERSION, type Pick } from './protocol';

export async function sha256(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** A random hex string (for salts and keys). */
export function randomHex(bytes = 16): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The hash a player sends when locking its pick; the pick and salt are revealed later. */
export function commitPick(pick: Pick, salt: string): Promise<string> {
  return sha256(canonical({ pick, salt }));
}

export async function verifyPick(pick: Pick, salt: string, commitment: string): Promise<boolean> {
  return (await commitPick(pick, salt)) === commitment;
}

/**
 * The rules an Online Match is played under: format versions and every Unit's stats and
 * Ability as they stand now (call it with the shipped balance in force). Two games
 * can only play each other when these match.
 */
export async function rulesFingerprint(): Promise<string> {
  const kinds = [...MASTERS, ...FAMILIARS].map((k) => ({ ...k }));
  return (await sha256(canonical({ protocol: PROTOCOL_VERSION, replay: REPLAY_VERSION, balance: BALANCE_VERSION, kinds }))).slice(0, 16);
}
