// The Online Match clock: a free Turn Timer each turn, then the player's Time Bank.
// Pure: the session feeds it the milliseconds a turn took (animations and Pauses
// already left out) and reads back how much is left.

/** Free thinking time per turn (the Turn Timer), unless the creator picks another. */
export const TURN_TIMER_MS = 10_000;
/** Each player's Time Bank at the start of an Online Match, unless the creator picks another. */
export const TIME_BANK_MS = 60_000;

/** The time settings an Online Match's creator picks: the Turn Timer and the Time Bank. */
export interface TimeSettings {
  turnMs: number;
  bankMs: number;
}
export const TURN_TIMER_CHOICES_MS = [5_000, 10_000, 20_000, 30_000];
export const TIME_BANK_CHOICES_MS = [0, 30_000, 60_000, 120_000, 300_000];
export const DEFAULT_TIME: TimeSettings = { turnMs: TURN_TIMER_MS, bankMs: TIME_BANK_MS };

/** `x` if it is one of the offered settings, else null. */
export function validTime(x: unknown): TimeSettings | null {
  const t = x as TimeSettings | null;
  return t && TURN_TIMER_CHOICES_MS.includes(t.turnMs) && TIME_BANK_CHOICES_MS.includes(t.bankMs) ? { turnMs: t.turnMs, bankMs: t.bankMs } : null;
}

/** "10 s a turn + 1:00 bank" */
export function describeTime(t: TimeSettings): string {
  return `${t.turnMs / 1000} s a turn + ${formatSeconds(t.bankMs)} bank`;
}
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

export const startBanks = (t: TimeSettings = DEFAULT_TIME): Banks => [t.bankMs, t.bankMs];

/** The most a turn can take before it Times Out, with `bank` left. */
export function turnAllowance(bank: number, t: TimeSettings = DEFAULT_TIME): number {
  return t.turnMs + Math.max(0, bank);
}

/** The Time Bank left after a turn that took `ms` (only time past the Turn Timer drains it). */
export function spend(bank: number, ms: number, t: TimeSettings = DEFAULT_TIME): number {
  return Math.max(0, bank - Math.max(0, ms - t.turnMs));
}

/** What a turn's clock shows `ms` into it: Turn Timer seconds left, then the Time Bank left. */
export function clockFace(bank: number, ms: number, t: TimeSettings = DEFAULT_TIME): { timer: number; bank: number; out: boolean } {
  const timer = Math.max(0, t.turnMs - ms);
  const left = spend(bank, ms, t);
  return { timer, bank: left, out: timer === 0 && left === 0 };
}

/** Banks after a whole list of turns: `times[i]` taken by the Side that played turn i. */
export function banksAfter(times: { side: 0 | 1; ms: number }[], settings: TimeSettings = DEFAULT_TIME): Banks {
  const b = startBanks(settings);
  for (const t of times) b[t.side] = spend(b[t.side], t.ms, settings);
  return b;
}

/** "0:07" style, rounded up so 0.2 s left still shows 1. */
export function formatSeconds(ms: number): string {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
