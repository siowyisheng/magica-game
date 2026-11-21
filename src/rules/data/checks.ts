// Design rules for unit kinds, reported as warnings (the dev tool shows them
// but lets you experiment past them).

import type { UnitKind } from '../types';

export function kindWarnings(k: UnitKind, roster: readonly UnitKind[]): string[] {
  const w: string[] = [];
  const maxName = k.isSummoner ? 7 : 6;
  if (!k.name.trim()) w.push('needs a name');
  else if (k.name.length > maxName) w.push(`name is longer than ${maxName} letters`);
  for (const [stat, v] of Object.entries(k.stats)) {
    if (!Number.isInteger(v) || v < 1) w.push(`${stat.toUpperCase()} should be a whole number of at least 1`);
    else if (v > 30) w.push(`${stat.toUpperCase()} above 30 is far outside the usual range`);
  }
  if (k.stats.spd < 1 || k.stats.spd > 20) w.push('SPD outside 1–20 has no Base Delay of its own');
  if (!k.moveTypes.length) w.push('needs at least one Move Type');
  if (k.moveTypes.includes('slow') && !k.moveTypes.includes('swim')) w.push('Slow should always come with Swim');
  if (k.moveTypes.includes('walk') && k.stats.mov < 4) w.push('walkers should have MOV 4 or more');
  if (k.isSummoner && (k.moveTypes.length !== 2 || !k.moveTypes.includes('walk') || !k.moveTypes.includes('wade'))) w.push('Summoners walk + wade');
  if (k.attack.range < 1) w.push('Attack range must be at least 1');
  if (k.attack.range > 1 && !k.attack.trajectory) w.push('a ranged Attack needs a Trajectory');
  if (!k.isSummoner) {
    if (k.cost % 8 !== 0 || k.cost < 16 || k.cost > 96) w.push('Cost should be a multiple of 8 from 16 to 96');
    const clash = roster.find((o) => o.id !== k.id && !o.isSummoner && o.element === k.element && o.cost === k.cost);
    if (clash) w.push(`Cost ${k.cost} is also ${clash.name}'s (costs are unique within an Element)`);
    if (k.magic.length > 1) w.push('summons have at most one Magic Ability');
  }
  for (const m of k.magic) {
    if (m.manaCost < 0 || !Number.isInteger(m.manaCost)) w.push(`${m.name}: Mana cost should be a whole number`);
    if (m.kind === 'water') {
      if (!k.isSummoner) w.push(`${m.name}: Rise / Ebb are Summoner spells`);
      continue;
    }
    if (!k.isSummoner && (m.manaCost < 4 || m.manaCost > 16)) w.push(`${m.name}: Summon Magic should cost 4–16`);
    if (m.range < (m.kind === 'damage' ? 1 : 0)) w.push(`${m.name}: range too short to aim`);
    if (m.range > 1 && !m.trajectory) w.push(`${m.name}: a ranged spell needs a Trajectory`);
  }
  return w;
}
