// Design rules for unit kinds, reported as warnings (the dev tool shows them
// but lets you experiment past them).

import type { UnitKind } from '../types';
import { MDF_FLOOR } from '../statgen';
import { abilityDisplayName, isHostile, isPhysical, powerStat } from '../ability';

export function kindWarnings(k: UnitKind, roster: readonly UnitKind[]): string[] {
  const w: string[] = [];
  const maxName = k.isMaster ? 7 : 6;
  if (!k.name.trim()) w.push('needs a name');
  else if (k.name.length > maxName) w.push(`name is longer than ${maxName} letters`);
  for (const [stat, v] of Object.entries(k.stats)) {
    // DEF, MDF and SPD may be 0; so may a Familiar's ATK or MP (it uses only one; a Master's MP sets its Mana Income)
    const min = stat === 'def' || stat === 'mdf' || stat === 'spd' || ((stat === 'mp' || stat === 'atk') && !k.isMaster) ? 0 : 1;
    if (!Number.isInteger(v) || v < min) w.push(`${stat.toUpperCase()} should be a whole number of at least ${min}`);
    else if (v > 30) w.push(`${stat.toUpperCase()} above 30 is far outside the usual range`);
  }
  if (k.stats.spd > 24) w.push('SPD above 24 has no Base Delay of its own');
  if (!k.moveTypes.length) w.push('needs at least one Move Type');
  if (k.moveTypes.includes('slow') && !k.moveTypes.includes('swim')) w.push('Slow should always come with Swim');
  if (!k.isMaster && k.moveTypes.includes('walk') && k.stats.mov < 4) w.push('walking Familiars should have MOV 4 or more');
  if (k.isMaster && k.stats.mdf < MDF_FLOOR.hard) w.push(`Masters need MDF ${MDF_FLOOR.hard} or more (Magic reaches far)`);
  else if (k.isMaster && k.stats.mdf < MDF_FLOOR.soft) {
    const low = roster.filter((o) => o.isMaster && o.stats.mdf < MDF_FLOOR.soft);
    if (low.length > MDF_FLOOR.atHardFloor) w.push(`only ${MDF_FLOOR.atHardFloor} Master may have MDF below ${MDF_FLOOR.soft} (now: ${low.map((o) => o.name).join(', ')})`);
  }
  if (k.isMaster && (k.moveTypes.length !== 2 || !k.moveTypes.includes('walk') || !k.moveTypes.includes('wade'))) w.push('Masters walk + wade');
  const m = k.ability;
  const name = abilityDisplayName(k);
  if (m.kind === 'water') {
    if (!k.isMaster) w.push(`${name}: Rise / Ebb are not for Familiars`);
  } else {
    if (m.kind === 'damage' && m.burst && m.range !== 0) w.push(`${name}: a Burst has range 0 (it is centred on the user)`);
    if (m.kind === 'damage' && m.burst && m.radius === 0) w.push(`${name}: a Burst needs an area (radius 1 or 2)`);
    if (m.radius === 2 && !(m.kind === 'damage' && m.burst)) w.push(`${name}: only a Burst may have radius 2`);
    if (m.range < (isHostile(m) && !(m.kind === 'damage' && m.burst) ? 1 : 0)) w.push(`${name}: range too short to aim`);
    if (m.kind !== 'damage' && 'riders' in m && m.riders?.length) w.push(`${name}: only a damaging Ability carries riders`);
    if (m.range > 1 && !m.trajectory) w.push(`${name}: a ranged Ability needs a Trajectory`);
  }
  if (k.isMaster && !isPhysical(m)) w.push('Masters have a physical Ability (ATK against DEF)');
  if (!k.isMaster) {
    if (k.cost % 8 !== 0 || k.cost < 16 || k.cost > 88) w.push('Cost should be a multiple of 8 from 16 to 88');
    const clash = roster.find((o) => o.id !== k.id && !o.isMaster && o.element === k.element && o.cost === k.cost);
    if (clash) w.push(`Cost ${k.cost} is also ${clash.name}'s (costs are unique within an Element)`);
    // one power stat: ATK for a physical Ability, MP for a magical one
    const unused = powerStat(k) === 'atk' ? 'mp' : 'atk';
    if (k.stats[unused] > 0) w.push(`${unused.toUpperCase()} ${k.stats[unused]} does nothing: ${name} uses ${powerStat(k).toUpperCase()} (set ${unused.toUpperCase()} to 0)`);
    if (k.signatureStat === unused) w.push(`its Signature Bonus raises ${unused.toUpperCase()}, which ${name} doesn't use`);
  }
  return w;
}
