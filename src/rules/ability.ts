// What a Unit's one Ability is, for the player: its name, the Act button's
// label and the Familiar's Class.

import type { Ability, AbilityLabel, Power, UnitKind } from './types';

/** Fighter: physical damage; Caster: magical damage; Healer: heals; Support: buffs and debuffs. */
export type FamiliarClass = 'fighter' | 'caster' | 'healer' | 'support';

/** Which stat a damaging Ability hits with (physical ATK or magical MP). */
export function powerOf(a: Ability): Power {
  return a.kind === 'damage' ? (a.power ?? 'mp') : 'mp';
}

/** A physical hit: ATK against DEF (Empower adds to it). */
export function isPhysical(a: Ability): boolean {
  return a.kind === 'damage' && powerOf(a) === 'atk';
}

/** The Act button's name: the Ability's label, else the default for its kind. */
export function abilityLabel(a: Ability): AbilityLabel {
  if (a.label) return a.label;
  return a.kind === 'damage' ? 'attack' : a.kind === 'heal' ? 'heal' : 'buff';
}

export const LABEL_TEXT: Record<AbilityLabel, string> = { attack: 'Attack', heal: 'Heal', buff: 'Buff', debuff: 'Debuff' };

/** What the Unit calls its Ability: its own name for it, else the Ability's name. */
export function abilityDisplayName(k: UnitKind): string {
  return k.abilityName || k.ability.name;
}

/** The Unit's Class, from its Ability: Attack with ATK → Fighter, with MP → Caster; Heal → Healer; Buff or Debuff → Support. */
export function classOf(k: UnitKind): FamiliarClass {
  const label = abilityLabel(k.ability);
  if (label === 'attack') return powerOf(k.ability) === 'atk' ? 'fighter' : 'caster';
  return label === 'heal' ? 'healer' : 'support';
}

export const CLASS_NAME: Record<FamiliarClass, string> = { fighter: 'Fighter', caster: 'Caster', healer: 'Healer', support: 'Support' };

/** The stat the Unit's Ability uses (ATK or MP); Empower and water Abilities use neither, shown as MP. */
/** Whether an Ability is a Burst (it hits around its user, aimed at the user's own hex). */
export function isBurst(a: Ability): a is Exclude<Ability, { kind: 'water' }> {
  return a.kind === 'damage' && !!a.burst;
}

export function powerStat(k: UnitKind): Power {
  return isPhysical(k.ability) ? 'atk' : 'mp';
}
