import { DAY_END, DAY_START, MINUTES_PER_DAY, NIGHT_END, NIGHT_START, ALIGN_BONUS, ALIGN_PENALTY } from './data/tuning';
import type { Alignment, TimeOfDay } from './types';

export function minuteOfDay(clock: number): number {
  return ((clock % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

export function timeOfDay(clock: number): TimeOfDay {
  const m = minuteOfDay(clock);
  if (m >= DAY_START && m < DAY_END) return 'day';
  if (m >= NIGHT_START || m < NIGHT_END) return 'night';
  return 'neutral';
}

/** Stat multiplier in percent for an Alignment at a given clock. */
export function alignmentPercent(alignment: Alignment, clock: number): number {
  if (alignment === 'none') return 100;
  const tod = timeOfDay(clock);
  if (tod === 'neutral') return 100;
  return tod === alignment ? ALIGN_BONUS : ALIGN_PENALTY;
}

export function formatClock(clock: number): string {
  const m = minuteOfDay(clock);
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Day number (1-based). */
export function dayOf(clock: number): number {
  return Math.floor(clock / MINUTES_PER_DAY) + 1;
}
