// Design rules for unit kinds, reported as warnings (the dev tool shows them
// but lets you experiment past them).

import type { UnitKind } from '../types';
import { MDF_FLOOR } from '../statgen';

export function kindWarnings(k: UnitKind, roster: readonly UnitKind[]): string[] {
  const w: string[] = [];
  const maxName = k.isSummoner ? 7 : 6;
  if (!k.name.trim()) w.push('needs a name');
  else if (k.name.length > maxName) w.push(`name is longer than ${maxName} letters`);
  for (const [stat, v] of Object.entries(k.stats)) {
    // DEF and MDF may be 0; so may a Summon's MP (it matters only for Magic, and a Summoner's MP sets its Mana Income)
    const min = stat === 'def' || stat === 'mdf' || (stat === 'mp' && !k.isSummoner) ? 0 : 1;
    if (!Number.isInteger(v) || v < min) w.push(`${stat.toUpperCase()} should be a whole number of at least ${min}`);
    else if (v > 30) w.push(`${stat.toUpperCase()} above 30 is far outside the usual range`);
  }
  if (k.stats.spd < 1 || k.stats.spd > 20) w.push('SPD outside 1–20 has no Base Delay of its own');
  if (!k.moveTypes.length) w.push('needs at least one Move Type');
  if (k.moveTypes.includes('slow') && !k.moveTypes.includes('swim')) w.push('Slow should always come with Swim');
  if (!k.isSummoner && k.moveTypes.includes('walk') && k.stats.mov < 4) w.push('walking Summons should have MOV 4 or more');
  if (k.isSummoner && k.stats.mdf < MDF_FLOOR.hard) w.push(`Summoners need MDF ${MDF_FLOOR.hard} or more (Magic reaches far)`);
  else if (k.isSummoner && k.stats.mdf < MDF_FLOOR.soft) {
    const low = roster.filter((o) => o.isSummoner && o.stats.mdf < MDF_FLOOR.soft);
    if (low.length > MDF_FLOOR.atHardFloor) w.push(`only ${MDF_FLOOR.atHardFloor} Summoner may have MDF below ${MDF_FLOOR.soft} (now: ${low.map((o) => o.name).join(', ')})`);
  }
  if (k.isSummoner && (k.moveTypes.length !== 2 || !k.moveTypes.includes('walk') || !k.moveTypes.includes('wade'))) w.push('Summoners walk + wade');
  if (k.attack.range < 1) w.push('Attack range must be at least 1');
  for (const m of k.magic) {
    if (m.kind === 'water') continue;
    if (m.kind === 'damage' && m.burst && m.range !== 0) w.push(`${m.name}: a Burst has range 0 (it is centred on the caster)`);
    if (m.kind === 'damage' && m.burst && m.radius === 0) w.push(`${m.name}: a Burst needs an area (radius 1 or 2)`);
    if (m.radius === 2 && !(m.kind === 'damage' && m.burst)) w.push(`${m.name}: only a Burst may have radius 2`);
  }
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
    if (m.range < (m.kind === 'damage' && !m.burst ? 1 : 0)) w.push(`${m.name}: range too short to aim`);
    if (m.range > 1 && !m.trajectory) w.push(`${m.name}: a ranged spell needs a Trajectory`);
  }
  return w;
}
