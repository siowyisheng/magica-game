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
export const MANA_START = 40;
/** Mana Income per hour = (STONE_BASE + stones) × Summoner MP − Upkeep. */
export const STONE_BASE = 2;
export const UPKEEP_DIVISOR = 8;

/** Damage-taken reduction in percent. */
export const COVER_PERCENT = { plain: 0, rough: 20, stone: 30, pit: 0 } as const;

/** Alignment: added to ATK, DEF, MP and MDF at the aligned Time of Day, subtracted at the opposite one. */
export const ALIGN_STAT = 2;

/**
 * Facing Bonus, doubled (to stay in integers), by the angle of the hit from
 * the defender's Facing: under 30° +0, 30°–90° +0.5, 90°–150° +1.5, 150°+ +2.
 */
export const FACING_BONUS_X2 = [0, 1, 3, 4] as const;

/** Element Bonus, doubled: Counter (Strong) +4, neutral +1, same Element −1, Countered (Weak) −3.5. */
export const ELEMENT_BONUS_X2 = { counter: 8, neutral: 2, same: -2, countered: -7 } as const;

/** Time of Day boundaries in minutes of the day. */
export const DAY_START = 8 * 60;
export const DAY_END = 16 * 60;
export const NIGHT_START = 20 * 60;
export const NIGHT_END = 4 * 60;

export const MINUTES_PER_DAY = 24 * 60;

/** Heal = MP / HEAL_DIVISOR (rounded). */
export const HEAL_DIVISOR = 3;

/** The match ends this many Game Clock hours after it starts (Time Limit). */
export const TIME_LIMIT_HOURS = 72;
