// The Online Match clock: a free Turn Timer each turn, then the player's Time Bank.
// Pure: the session feeds it the milliseconds a turn took (animations and Pauses
// already left out) and reads back how much is left.

/** Free thinking time per turn (the Turn Timer). */
export const TURN_TIMER_MS = 10_000;
/** Each player's Time Bank at the start of an Online Match. */
export const TIME_BANK_MS = 60_000;
/** The Planning Phase before the first turn. */
export const PLANNING_MS = 30_000;
/** How long the waiting player gives a silent mover past its clock before playing its Timeout. */
export const TIMEOUT_GRACE_MS = 5_000;
/** Pauses each player may call per Online Match. */
export const PAUSES_PER_PLAYER = 3;
/** A Pause ends by itself after this long. */
export const PAUSE_MAX_MS = 120_000;
/** Disconnected this long, a player has Abandoned the match. */
export const ABANDON_MS = 120_000;

/** Each Side's Time Bank, in milliseconds. */
export type Banks = [number, number];

export const startBanks = (): Banks => [TIME_BANK_MS, TIME_BANK_MS];

/** The most a turn can take before it Times Out, with `bank` left. */
export function turnAllowance(bank: number): number {
  return TURN_TIMER_MS + Math.max(0, bank);
}

/** The Time Bank left after a turn that took `ms` (only time past the Turn Timer drains it). */
export function spend(bank: number, ms: number): number {
  return Math.max(0, bank - Math.max(0, ms - TURN_TIMER_MS));
}

/** What a turn's clock shows `ms` into it: Turn Timer seconds left, then the Time Bank left. */
export function clockFace(bank: number, ms: number): { timer: number; bank: number; out: boolean } {
  const timer = Math.max(0, TURN_TIMER_MS - ms);
  const left = spend(bank, ms);
  return { timer, bank: left, out: timer === 0 && left === 0 };
}

/** Banks after a whole list of turns: `times[i]` taken by the Side that played turn i. */
export function banksAfter(times: { side: 0 | 1; ms: number }[]): Banks {
  const b = startBanks();
  for (const t of times) b[t.side] = spend(b[t.side], t.ms);
  return b;
}

/** "0:07" style, rounded up so 0.2 s left still shows 1. */
export function formatSeconds(ms: number): string {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
