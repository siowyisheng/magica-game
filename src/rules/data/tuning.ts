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
export const MAX_SUMMONS = 7;
/** Mana Income per hour = (STONE_BASE + stones) × Summoner MP − Upkeep. */
export const STONE_BASE = 2;
export const UPKEEP_DIVISOR = 8;

/** Damage-taken reduction in percent. */
export const COVER_PERCENT = { plain: 0, rough: 20, stone: 30 } as const;

/** Alignment stat modifier in percent. */
export const ALIGN_BONUS = 120;
export const ALIGN_PENALTY = 80;

/** Facing Modifier knots ×1000 at 0°, 60°, 120°, 180°. */
export const FACING_KNOTS = [1000, 1200, 1600, 2000] as const;

/** Time of Day boundaries in minutes of the day. */
export const DAY_START = 8 * 60;
export const DAY_END = 16 * 60;
export const NIGHT_START = 20 * 60;
export const NIGHT_END = 4 * 60;

export const MINUTES_PER_DAY = 24 * 60;

/** Damage = DAMAGE_K × ATK/DEF (or MP/MDF) × modifiers. */
export const DAMAGE_K = 3;
/** Heal = MP / HEAL_DIVISOR (rounded). */
export const HEAL_DIVISOR = 3;
