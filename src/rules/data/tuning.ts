// Tunable rules constants. Integer-only.

/**
 * Base Delay (AV after a Wait-only turn) indexed by Speed (1..30).
 * Seeded from the designer anchors 7→36, 10→30, 13→25, 20→16; hand-tune freely.
 */
export const BASE_DELAY_BY_SPEED: readonly number[] = [
  /* 0 */ 50,
  48, 46, 44, 42, 40, 38, 36, 34, 32, 30, // 1-10
  28, 27, 25, 24, 22, 21, 20, 19, 17, 16, // 11-20
  15, 14, 13, 12, 11, 10, 9, 8, 8, 8, //     21-30
];

export const MAX_HP = 10;
export const MANA_MAX = 120;
export const MANA_START = 120;
/** Mana Income per hour = INCOME_MULTIPLIER × (STONE_BASE + stones) × Master MP − Upkeep. */
export const STONE_BASE = 2;
/** MP is half the size it once was, so Mana Income doubles it back. */
export const INCOME_MULTIPLIER = 2;
export const UPKEEP_DIVISOR = 8;

/** Damage taken less by terrain: Rough −1, Magic Stone −1. */
export const COVER = { plain: 0, rough: 1, stone: 1, pit: 0 } as const;

/** Alignment: added to ATK, DEF, MP and MDF at the aligned Time of Day, subtracted at the opposite one. */
export const ALIGN_STAT = 1;

/** Facing Bonus by the angle of the hit from the defender's Facing: under 90° Front +0, 90°–150° Flank +1, 150°–180° Back +2. */
export const FACING_BONUS = [0, 1, 2] as const;

/** Element Bonus: Counter (Strong) +4, neutral and same Element 0, Countered (Weak) −4. */
export const ELEMENT_BONUS = { counter: 4, neutral: 0, same: 0, countered: -4 } as const;

/** Time of Day boundaries in minutes of the day. */
export const DAY_START = 8 * 60;
export const DAY_END = 16 * 60;
export const NIGHT_START = 20 * 60;
export const NIGHT_END = 4 * 60;

export const MINUTES_PER_DAY = 24 * 60;

/** The match ends this many Game Clock hours after it starts (Time Limit). */
export const TIME_LIMIT_HOURS = 72;
