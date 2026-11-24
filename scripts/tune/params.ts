// The AI weights the tuner adjusts, and how.
//
// Each weight is tuned as a multiplier on its default, in log space: x = ln(value / default).
// So every weight moves in relative steps (±15% at the start, `c`), whatever its scale, and
// stays within [default / 4, default × 4] (or `max` for a weight that must stay at or below
// a cap). Weights left out are structural (killMaster, masterDeathRisk) or counts
// (screenTop, alignmentHours), or default to 0 (pressure).

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
  { name: 'heal' },
  { name: 'empower' },
  { name: 'friendlyFire' },
  // danger
  { name: 'threat' },
  { name: 'deathRisk' },
  { name: 'hurtCurve', max: 1 },
  { name: 'tradeCredit', max: 0.95 },
  // the Master's HP budget
  { name: 'masterHpCost' },
  { name: 'masterRisk' },
  { name: 'masterComfort' },
  { name: 'masterMaybeDeath', max: 1 },
  { name: 'unsureDeath', max: 1 },
  { name: 'refuge' },
  // Stones
  { name: 'capture' },
  { name: 'guard' },
  { name: 'onStone' },
  { name: 'stoneReopen' },
  // movement and pressure
  { name: 'approach' },
  { name: 'masterStage' },
  { name: 'jobPull' },
  { name: 'nearPull' },
  { name: 'leadPush' },
  { name: 'focus' },
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
