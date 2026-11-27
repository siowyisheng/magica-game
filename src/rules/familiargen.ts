// The Familiar Cost model and a generator of roughly power-balanced Familiars.
//
// The reference table below (from the game that inspired this one, with the
// designer's notes on how each played) is treated as roughly balanced.
// Fitting it prices a Familiar's stats in Mana:
//
//   Cost ≈ c + w·ATK + w·DEF + w·MDF + w·SPD + w·MOV + Fly + ranged Attack + Magic
//
// It fits to about ±8 Mana, one step of Cost. 22 references can't price
// every detail of a Magic Ability on their own, so Magic has a fixed shape
// (MP × (1 + per hex of range + per ring of area), heals less) whose scale
// the fit sets. Petrify isn't in this game, so the two Familiars built around it
// are left out of the fit.
//
// The generator fills fixed slots (an Element, a Cost and a sprite, whose
// look sets the Move Types). For each slot it picks a reference whose role
// suits the sprite and Cost, perturbs its stats, then nudges the stats
// (raising what the role is good at, trimming what it neglects) until the
// model prices the Familiar at the slot's Cost. It keeps the reference's
// kind of Magic and names the Familiar from a catalogue tagged by role and
// look.

import { leastSquares, mulberry32 } from './statgen';
import type { Alignment, Element, MoveType, Stats, Trajectory, UnitKind } from './types';

/** What a Familiar is for, from the designer's notes. */
export type FamiliarRole =
  | 'grabber' // cheap and quick: takes Stones early, sits on them
  | 'screener' // cheap flyer: blocks with its ZOC, soaks a hit
  | 'workhorse' // tough all-rounder that holds Stones and gains ground
  | 'striker' // offence-heavy fighter: threatens the Master and frail Familiars
  | 'skirmisher' // cheap fighter
  | 'sniper' // very long-range Attack
  | 'ranged' // ranged Attack
  | 'artillery' // lobs an area spell; the answer to tanks
  | 'caster' // fighter with a long-reaching damage spell
  | 'healer'
  | 'burster' // small Burst around itself
  | 'stallbreaker' // big Burst around itself
  | 'harrier' // cheap flying caster that hunts in packs
  | 'assassin'; // fast, high-flying physical killer

export interface MagicSpec {
  kind: 'damage' | 'heal' | 'empower';
  range: number;
  radius: 0 | 1 | 2;
  burst?: boolean;
  trajectory?: Trajectory;
  manaCost: number;
}

export interface ReferenceFamiliar {
  name: string;
  cost: number;
  element: Element;
  alignment: Alignment;
  stats: Stats;
  moveTypes: MoveType[];
  attack: { range: number; trajectory?: Trajectory };
  magic: MagicSpec | null;
  role: FamiliarRole;
  /** Left out of the Cost fit (built around Petrify, which this game doesn't have). */
  excluded?: boolean;
}

type Ref = [name: string, cost: number, element: Element, alignment: Alignment, s: [number, number, number, number, number, number], move: MoveType[], attack: [number, Trajectory?], magic: MagicSpec | null, role: FamiliarRole, excluded?: boolean];

const dmg = (range: number, radius: 0 | 1, manaCost: number, trajectory?: Trajectory): MagicSpec => ({ kind: 'damage', range, radius, manaCost, ...(range > 1 ? { trajectory: trajectory ?? 'high' } : {}) });
const burst = (radius: 1 | 2, manaCost: number): MagicSpec => ({ kind: 'damage', range: 0, radius, burst: true, manaCost });
const heal = (manaCost: number): MagicSpec => ({ kind: 'heal', range: 1, radius: 0, manaCost });

const REFERENCE_ROWS: Ref[] = [
  ['Fa-Rancell', 16, 'earth', 'none', [4, 2, 0, 3, 5, 5], ['walk', 'wade'], [1], null, 'grabber'],
  ['Da-Colm', 64, 'earth', 'none', [9, 7, 0, 7, 3, 6], ['walk', 'wade'], [1], null, 'workhorse'],
  ['Ae-Ferrion', 32, 'earth', 'none', [6, 3, 0, 2, 2, 5], ['walk'], [6, 'high'], null, 'sniper'],
  ['Gia-Bro', 40, 'earth', 'none', [5, 4, 6, 7, 0, 5], ['walk', 'wade'], [1], dmg(4, 1, 6, 'high'), 'artillery'],
  ['D-Alma', 24, 'earth', 'day', [3, 5, 4, 2, 4, 7], ['walk'], [1], heal(4), 'healer'],
  ['Ba-Mado', 80, 'earth', 'night', [7, 5, 0, 7, 5, 5], ['fly'], [1], null, 'assassin', true],
  ['Reque', 16, 'water', 'none', [5, 2, 0, 3, 7, 5], ['slow', 'swim'], [1], null, 'grabber'],
  ['Neptjunoue', 64, 'water', 'none', [8, 6, 7, 7, 7, 6], ['slow', 'swim'], [1], dmg(4, 0, 8, 'direct'), 'caster'],
  ['Tarbss', 48, 'water', 'none', [8, 5, 0, 5, 4, 5], ['swim'], [7, 'direct'], null, 'sniper'],
  ['Zamilpen', 40, 'water', 'day', [6, 6, 0, 4, 2, 6], ['slow', 'swim'], [1], null, 'workhorse', true],
  ['Marme', 32, 'water', 'night', [4, 4, 4, 6, 4, 5], ['slow', 'swim'], [1], heal(4), 'healer'],
  ['Tentarch', 88, 'water', 'none', [10, 9, 10, 6, 5, 6], ['slow', 'swim'], [1], burst(2, 15), 'stallbreaker'],
  ['Hepitus', 24, 'fire', 'none', [5, 3, 0, 4, 1, 6], ['walk'], [1], null, 'skirmisher'],
  ['Oonevievle', 56, 'fire', 'none', [9, 6, 0, 6, 3, 6], ['walk'], [1], null, 'striker'],
  ['Blexe', 40, 'fire', 'none', [7, 4, 0, 4, 2, 5], ['walk'], [4, 'direct'], null, 'ranged'],
  ['Dullmdaler', 32, 'fire', 'night', [3, 3, 7, 5, 2, 6], ['walk'], [1], burst(1, 4), 'burster'],
  ['Zenosblead', 88, 'fire', 'none', [8, 6, 8, 7, 6, 5], ['walk'], [1], dmg(7, 0, 10, 'direct'), 'caster'],
  ['Greon', 80, 'fire', 'day', [7, 5, 0, 3, 4, 7], ['fly'], [1], null, 'assassin'],
  ['Pelitt', 16, 'air', 'none', [1, 0, 0, 6, 7, 4], ['fly'], [1], null, 'screener'],
  ['Currier-Bell', 48, 'air', 'none', [7, 5, 7, 3, 3, 5], ['fly'], [1], dmg(3, 1, 8, 'high'), 'artillery'],
  ['Amoltamiss', 56, 'air', 'night', [7, 5, 0, 5, 5, 4], ['fly'], [5, 'high'], null, 'ranged'],
  ['Guene-Foss', 32, 'air', 'day', [3, 2, 4, 4, 4, 6], ['fly'], [1], dmg(4, 0, 4, 'high'), 'harrier'],
  ['Fifenall', 48, 'air', 'none', [2, 3, 5, 7, 4, 5], ['fly'], [1], heal(4), 'healer'],
  ['Regna-Croxe', 80, 'air', 'none', [9, 5, 9, 5, 5, 6], ['fly'], [1], burst(2, 12), 'stallbreaker'],
];

export const REFERENCE_FAMILIARS: readonly ReferenceFamiliar[] = REFERENCE_ROWS.map(([name, cost, element, alignment, s, moveTypes, [range, trajectory], magic, role, excluded]) => ({
  name,
  cost,
  element,
  alignment,
  stats: { atk: s[0], def: s[1], mp: s[2], mdf: s[3], spd: s[4], mov: s[5] },
  moveTypes,
  attack: range > 1 ? { range, trajectory } : { range },
  magic,
  role,
  ...(excluded ? { excluded } : {}),
}));

// ---------- the Cost model ----------

/** Fixed shape of a Magic Ability's worth (the fit sets its scale). */
export const MAGIC_SHAPE = { perRange: 0.2, perRing: 1.5, heal: 0.9 } as const;

/** What the Magic Ability is worth before scaling: MP × its shape. */
export function magicWorth(mp: number, m: MagicSpec | null): number {
  if (!m) return 0;
  // heals and Empower are priced alike (support for an ally)
  if (m.kind !== 'damage') return mp * MAGIC_SHAPE.heal;
  return mp * (1 + MAGIC_SHAPE.perRange * m.range + MAGIC_SHAPE.perRing * m.radius);
}

export interface FamiliarCostModel {
  atk: number;
  def: number;
  mdf: number;
  spd: number;
  mov: number;
  fly: number;
  ranged: number;
  magic: number;
  base: number;
}

type Priced = Pick<ReferenceFamiliar, 'stats' | 'moveTypes' | 'attack' | 'magic'>;

const FEATURES = (s: Priced): number[] => [
  s.stats.atk,
  s.stats.def,
  s.stats.mdf,
  s.stats.spd,
  s.stats.mov,
  s.moveTypes.includes('fly') ? 1 : 0,
  s.attack.range > 1 ? 1 : 0,
  magicWorth(s.stats.mp, s.magic),
];

export function fitFamiliarCost(refs: readonly ReferenceFamiliar[] = REFERENCE_FAMILIARS): FamiliarCostModel {
  const used = refs.filter((r) => !r.excluded);
  const x = leastSquares(
    used.map((r) => [...FEATURES(r), 1]),
    used.map((r) => r.cost),
  );
  return { atk: x[0], def: x[1], mdf: x[2], spd: x[3], mov: x[4], fly: x[5], ranged: x[6], magic: x[7], base: x[8] };
}

export const FAMILIAR_COST: FamiliarCostModel = fitFamiliarCost();

/** The Cost the model gives a Familiar, in Mana (not rounded to a step). */
export function predictCost(s: Priced, m: FamiliarCostModel = FAMILIAR_COST): number {
  const f = FEATURES(s);
  return m.base + m.atk * f[0] + m.def * f[1] + m.mdf * f[2] + m.spd * f[3] + m.mov * f[4] + m.fly * f[5] + m.ranged * f[6] + m.magic * f[7];
}

/**
 * The Cost the model gives a live Familiar with one Ability: a physical one
 * counts as its Attack (ranged or not), anything else as its Magic Ability
 * (its MP then priced by the Ability's shape).
 */
export function predictKindCost(k: UnitKind, m: FamiliarCostModel = FAMILIAR_COST): number {
  const a = k.ability;
  const physical = a.kind === 'damage' && a.power === 'atk';
  const magic: MagicSpec | null =
    physical || a.kind === 'water'
      ? null
      : // Hex and Entangle have no reference Familiars: priced like Empower, the other support Ability.
        // Riders on a damage Ability aren't priced at all (no reference data): tune those by hand.
        { kind: a.kind === 'hex' || a.kind === 'entangle' ? 'empower' : a.kind, range: a.range, radius: a.radius, burst: a.burst, trajectory: a.trajectory, manaCost: 0 };
  const attack = physical && a.range > 1 ? { range: a.range, trajectory: a.trajectory } : { range: 1 };
  return predictCost({ stats: k.stats, moveTypes: k.moveTypes, attack, magic }, m);
}

// ---------- slots ----------

/** A place in the roster: Element, Cost, and the sprite whose look sets the Move Types. */
export interface FamiliarSlot {
  /** The sprite's key, which is also the Familiar's id. */
  sprite: string;
  element: Element;
  cost: number;
  moveTypes: MoveType[];
  /** Roles the sprite's look suits. */
  suits: FamiliarRole[];
  /** Words describing the look, for naming. */
  look: string[];
}

// ---------- generation ----------

export interface GeneratedFamiliar {
  id: string;
  name: string;
  element: Element;
  alignment: Alignment;
  cost: number;
  role: FamiliarRole;
  /** The reference it was built from. */
  from: string;
  stats: Stats;
  moveTypes: MoveType[];
  attack: { range: number; trajectory?: Trajectory };
  magic: MagicSpec | null;
}

export const FAMILIAR_BOUNDS: Record<keyof Stats, [number, number]> = {
  atk: [1, 10],
  def: [0, 9],
  mp: [0, 10], // 0 for a Familiar with no Magic Ability: MP does nothing without one
  mdf: [2, 8],
  spd: [0, 8],
  mov: [3, 7],
};

/** Furthest a reference is stretched from its own Cost to fill a slot, in Mana. */
export const MAX_STRETCH = 32;

/** Most Familiars of one role in a roster. */
export const MAX_PER_ROLE = 4;

/** How close the model must price a generated Familiar to its slot's Cost, in Mana. */
export const COST_TOLERANCE = 4;

const STAT_KEYS = ['atk', 'def', 'mp', 'mdf', 'spd', 'mov'] as const;

function gauss(rng: () => number): number {
  return Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-12))) * Math.cos(2 * Math.PI * rng());
}

const MEAN = Object.fromEntries(STAT_KEYS.map((k) => [k, REFERENCE_FAMILIARS.reduce((a, r) => a + r.stats[k], 0) / REFERENCE_FAMILIARS.length])) as Record<keyof Stats, number>;

/** Which references can fill a slot: flyers from flyers, swimmers from swimmers, walkers from walkers. */
function moveClass(moveTypes: MoveType[]): 'fly' | 'swim' | 'ground' {
  if (moveTypes.includes('fly')) return 'fly';
  if (moveTypes.includes('swim') && !moveTypes.includes('walk')) return 'swim';
  return 'ground';
}

function compatible(slot: FamiliarSlot, r: ReferenceFamiliar): boolean {
  const s = moveClass(slot.moveTypes);
  const c = moveClass(r.moveTypes);
  // walk + swim sprites can take either
  if (slot.moveTypes.includes('walk') && slot.moveTypes.includes('swim')) return c !== 'fly';
  return s === c;
}

/** Nudge stats until the model prices the Familiar within tolerance of `target`. */
export function fitToCost(s: Priced, target: number, ref: ReferenceFamiliar): Stats {
  const stats = { ...s.stats };
  const z = (k: keyof Stats) => ref.stats[k] - MEAN[k];
  const adjustable = STAT_KEYS.filter((k) => k !== 'mov' && (k !== 'mp' || s.magic));
  const strong = [...adjustable].sort((a, b) => z(b) - z(a));
  const weak = [...strong].reverse();
  for (let i = 0; i < 80; i++) {
    const p = predictCost({ ...s, stats }, FAMILIAR_COST);
    const gap = target - p;
    if (Math.abs(gap) <= COST_TOLERANCE) break;
    // Move only when far off: a point of MOV is worth a lot
    if (Math.abs(gap) > FAMILIAR_COST.mov * 1.5) {
      const k = 'mov';
      const next = stats[k] + Math.sign(gap);
      if (next >= FAMILIAR_BOUNDS[k][0] && next <= FAMILIAR_BOUNDS[k][1]) {
        stats[k] = next;
        continue;
      }
    }
    // spread the change round the role's three strongest (raising) or weakest (trimming) stats
    const order = (gap > 0 ? strong : weak).filter((x) => {
      const next = stats[x] + Math.sign(gap);
      return next >= FAMILIAR_BOUNDS[x][0] && next <= FAMILIAR_BOUNDS[x][1];
    });
    if (!order.length) break;
    const k = order[i % Math.min(3, order.length)];
    stats[k] += Math.sign(gap);
  }
  return stats;
}

/** One Familiar for a slot, built from reference `ref`. */
export function generateFamiliar(rng: () => number, slot: FamiliarSlot, ref: ReferenceFamiliar): Omit<GeneratedFamiliar, 'name' | 'alignment'> {
  const stats = { ...ref.stats };
  for (const k of STAT_KEYS) {
    if (k === 'mov') continue;
    const [lo, hi] = FAMILIAR_BOUNDS[k];
    // ATK, DEF, MP and MDF are half the size of SPD, so they wobble half as much
    const wobble = k === 'spd' ? 1.3 : 0.65;
    const jittered = Math.max(lo, Math.min(hi, Math.round(stats[k] + gauss(rng) * wobble))); // always drawn, so the seeded stream is stable
    stats[k] = k === 'mp' && !ref.magic ? 0 : jittered;
  }
  // vary a ranged reach a little
  const attack = { ...ref.attack };
  if (attack.range > 1) attack.range = Math.max(3, Math.min(7, attack.range + Math.round(gauss(rng) * 0.7)));
  let magic = ref.magic ? { ...ref.magic } : null;
  if (magic && magic.kind === 'damage' && !magic.burst && magic.range > 1) magic.range = Math.max(2, Math.min(7, magic.range + Math.round(gauss(rng) * 0.7)));
  if (magic && magic.range <= 1) magic = { ...magic, trajectory: undefined };
  const priced = { stats, moveTypes: slot.moveTypes, attack, magic };
  return {
    id: slot.sprite,
    element: slot.element,
    cost: slot.cost,
    role: ref.role,
    from: ref.name,
    stats: fitToCost(priced, slot.cost, ref),
    moveTypes: slot.moveTypes,
    attack,
    magic,
  };
}

// ---------- names ----------

/** A name, the roles it suits and the looks it suits. */
export interface FamiliarName {
  name: string;
  roles: FamiliarRole[];
  looks: string[];
  /** Elements the word belongs to (absent: any). */
  elements?: Element[];
}

function nameScore(n: FamiliarName, g: { role: FamiliarRole; element: Element }, slot: FamiliarSlot): number {
  if (n.elements && !n.elements.includes(g.element)) return -Infinity;
  return (n.roles.includes(g.role) ? 2 : 0) + n.looks.filter((l) => slot.look.includes(l)).length + (n.elements ? 1 : 0);
}

// ---------- the roster ----------

export interface RosterRules {
  /** How many Familiars have a Magic Ability. */
  withMagic: number;
  /** Day and Night Familiars per Element. */
  alignments: Record<Element, { day: number; night: number }>;
}

/** Score of the last roster generateFamiliarRoster returned (for choosing a seed). */
export let lastRosterScore = 0;

/**
 * A whole roster: one Familiar per slot. Tries `tries` assignments of
 * references to slots, keeps those that meet the rules, and returns the most
 * diverse (most distinct roles, then most unlike stats).
 */
export function generateFamiliarRoster(seed: number, slots: FamiliarSlot[], names: FamiliarName[], rules: RosterRules, tries = 200): GeneratedFamiliar[] {
  const refs = REFERENCE_FAMILIARS.filter((r) => !r.excluded);
  let best: { roster: GeneratedFamiliar[]; score: number } | null = null;
  for (let t = 0; t < tries; t++) {
    const rng = mulberry32(seed * 7919 + t);
    const usedIn = new Map<string, Set<Element>>();
    const uses = new Map<string, number>();
    const roleCount = new Map<FamiliarRole, number>();
    const built = slots.map((slot) => {
      const options = refs
        .filter((r) => compatible(slot, r))
        // variety: a reference at most once per Element and twice in all; at most MAX_PER_ROLE of a role
        // variety: a reference at most twice in all, best not twice in an Element; at most MAX_PER_ROLE of a role;
        // and no reference stretched more than MAX_STRETCH Mana from its own Cost
        .filter((r) => (uses.get(r.name) ?? 0) < 2 && (roleCount.get(r.role) ?? 0) < MAX_PER_ROLE && Math.abs(r.cost - slot.cost) <= MAX_STRETCH)
        .map((r) => ({ r, score: Math.abs(r.cost - slot.cost) / 8 - (slot.suits.includes(r.role) ? 4 : 0) + (usedIn.get(r.name)?.has(slot.element) ? 3 : 0) + rng() * 2 }))
        .sort((a, b) => a.score - b.score);
      if (!options.length) return null;
      // when some reference suits the sprite's look, choose among those
      const suited = options.filter((o) => slot.suits.includes(o.r.role));
      if (suited.length) options.splice(0, options.length, ...suited);
      // mostly the best fit, sometimes the second or third
      const x = rng();
      const pick = options[Math.min(options.length - 1, x < 0.55 ? 0 : x < 0.85 ? 1 : 2)];
      uses.set(pick.r.name, (uses.get(pick.r.name) ?? 0) + 1);
      usedIn.set(pick.r.name, new Set([...(usedIn.get(pick.r.name) ?? []), slot.element]));
      roleCount.set(pick.r.role, (roleCount.get(pick.r.role) ?? 0) + 1);
      return generateFamiliar(rng, slot, pick.r);
    });
    if (built.some((b) => !b)) continue;
    const ok = built as Omit<GeneratedFamiliar, 'name' | 'alignment'>[];
    if (ok.filter((b) => b.magic).length !== rules.withMagic) continue;
    if (ok.some((b) => Math.abs(predictCost(b) - b.cost) > COST_TOLERANCE)) continue;
    const roles = new Set(ok.map((b) => b.role)).size;
    const perElementRoles = (['fire', 'air', 'earth', 'water'] as Element[]).reduce((a, e) => a + new Set(ok.filter((b) => b.element === e).map((b) => b.role)).size, 0);
    // stats far from the reference they came from read as a different unit: prefer small stretches
    const stretch = ok.reduce((a, b) => a + Math.abs(REFERENCE_FAMILIARS.find((r) => r.name === b.from)!.cost - b.cost), 0) / 8;
    const suited = ok.filter((b, i) => slots[i].suits.includes(b.role)).length;
    const score = roles * 10 + perElementRoles * 2 + suited * 3 - stretch;
    if (!best || score > best.score) best = { roster: ok.map((b) => ({ ...b, name: '', alignment: 'none' as Alignment })), score };
  }
  if (!best) throw new Error('no roster met the rules');
  lastRosterScore = best.score;
  const roster = best.roster;
  // Alignments: per Element, the slots whose reference was aligned go first, then by seed.
  const rng = mulberry32(seed);
  for (const e of ['fire', 'air', 'earth', 'water'] as Element[]) {
    const { day, night } = rules.alignments[e];
    const mine = roster.filter((g) => g.element === e);
    const refAlign = (g: GeneratedFamiliar) => REFERENCE_FAMILIARS.find((r) => r.name === g.from)!.alignment;
    const order = mine.map((g) => ({ g, k: (refAlign(g) !== 'none' ? 0 : 1) + rng() })).sort((a, b) => a.k - b.k).map((x) => x.g);
    const chosen = order.slice(0, day + night);
    // Day to those whose reference was Day, Night to Night, the rest by order
    const days = chosen.filter((g) => refAlign(g) === 'day').slice(0, day);
    const nights = chosen.filter((g) => !days.includes(g) && refAlign(g) === 'night').slice(0, night);
    for (const g of chosen) {
      if (days.includes(g)) g.alignment = 'day';
      else if (nights.includes(g)) g.alignment = 'night';
      else if (days.length < day) (g.alignment = 'day'), days.push(g);
      else (g.alignment = 'night'), nights.push(g);
    }
  }
  // Names: best fit first, each used once.
  const free = [...names];
  const pairs = roster.map((g, i) => ({ g, slot: slots[i] }));
  while (pairs.some((p) => !p.g.name)) {
    let pick: { p: (typeof pairs)[number]; n: FamiliarName; s: number } | null = null;
    for (const p of pairs) {
      if (p.g.name) continue;
      for (const n of free) {
        const s = nameScore(n, p.g, p.slot);
        if (s > -Infinity && (!pick || s > pick.s)) pick = { p, n, s };
      }
    }
    if (!pick) throw new Error('not enough names');
    pick.p.g.name = pick.n.name;
    free.splice(free.indexOf(pick.n), 1);
  }
  // improve: swap two names while that fits better overall
  const entry = (name: string) => names.find((n) => n.name === name)!;
  for (let improved = true, rounds = 0; improved && rounds < 20; rounds++) {
    improved = false;
    for (let i = 0; i < pairs.length; i++)
      for (let j = i + 1; j < pairs.length; j++) {
        const a = pairs[i];
        const b = pairs[j];
        const now = nameScore(entry(a.g.name), a.g, a.slot) + nameScore(entry(b.g.name), b.g, b.slot);
        const swapped = nameScore(entry(b.g.name), a.g, a.slot) + nameScore(entry(a.g.name), b.g, b.slot);
        if (swapped > now) {
          [a.g.name, b.g.name] = [b.g.name, a.g.name];
          improved = true;
        }
      }
  }
  return roster;
}
