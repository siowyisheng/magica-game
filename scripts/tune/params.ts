// The AI weights the tuner adjusts, and how.
//
// Each weight is tuned as a multiplier on its default, in log space: x = ln(value / default).
// So every weight moves in relative steps (±15% at the start, `c`), whatever its scale, and
// stays within [default / 4, default × 4] (or `max` for a weight that must stay at or below
// a cap). Each weight here prices one thing (docs/ai.md); weights left out are structural
// (killMaster, masterDeathRisk), counts (screenTop, alignmentHours), or a common scale that
// would only duplicate another (approach: every pull is approach × jobPull / nearPull /
// masterStage, so the three pulls are tuned and approach stays put).

export interface Param {
  name: string;
  /** Upper bound on the value itself (e.g. 1 for a share). */
  max?: number;
}

export const PARAMS: Param[] = [
  // what hits and kills are worth
  { name: 'damage' },
  { name: 'kill' },
  { name: 'setupKill' },
  { name: 'masterHit' },
  { name: 'empower' },
  // my own side's HP (danger, friendly fire, healing) and Units' safety
  { name: 'ownHp' },
  { name: 'deathRisk' },
  { name: 'masterHpCost' },
  { name: 'masterRisk' },
  { name: 'masterComfort' },
  { name: 'unsureDeath', max: 1 },
  // Stones
  { name: 'capture' },
  { name: 'stoneReopen' },
  // movement and pressure
  { name: 'masterStage' },
  { name: 'jobPull' },
  { name: 'nearPull' },
  { name: 'leadPush' },
  { name: 'support' },
  { name: 'screen' },
  // summoning and Mana
  { name: 'summonBase' },
  { name: 'needScale' },
  { name: 'summonFront' },
  { name: 'manaSpend' },
  { name: 'reserveSpend' },
  // time
  { name: 'delay' },
];
