// The strategic layer of the AI (docs/ai-plan.md): once per turn, read the
// board and work out a Plan for a Side: its Posture, its Front, its summon
// Needs (and how well each Familiar fits them), its Reserve, each Familiar's
// Job, and which of its Stones an enemy can really take next turn. The move
// scorer (ai.ts) reads the Plan. No search; pure and deterministic.

import {
  type Hex,
  type MatchState,
  type SideId,
  type Unit,
  type UnitKind,
  FAMILIARS,
  MAX_HP,
  computeDamage,
  facingToward,
  hexDistance,
  hexEq,
  hexKey,
  inRoster,
  kindOf,
  manaIncome,
  neighbor,
  reachable,
  turnDelay,
  MANA_MAX,
} from '../rules';

export type PostureName = 'defend' | 'expand' | 'contest' | 'squeeze' | 'kill';
export type NeedTag = 'grab' | 'answer' | 'heal' | 'hold' | 'assassin' | 'fight';

export interface Need {
  tag: NeedTag;
  weight: number;
  /** answer: the enemy Unit to answer. */
  target?: Unit;
}

/** A danger to the Master: an enemy and how soon it could kill it. */
export interface Threat {
  unit: Unit;
  /** Enemy turns to kill the Master (moving in, then hitting). */
  turnsToKill: number;
  /** 1 when it kills within 2 turns, falling to 0 at 4. */
  urgency: number;
}

export interface Plan {
  side: SideId;
  posture: Record<PostureName, number>;
  /** The Posture with the highest utility. */
  dominant: PostureName;
  /** How far ahead the Side is (≈ −1..1): material share, Stones, Mana. */
  lead: number;
  front: Hex | null;
  frontLabel: string;
  /** What the Front is: a Stone, the enemy Master, or the threat being defended against. */
  frontKind: 'stone' | 'master' | 'threat' | 'none';
  /** The best Stone or the enemy Master: the Front before a threat takes its place (Master staging). */
  objective: Hex | null;
  threats: Threat[];
  /** Danger from all enemies together: how soon they could kill the Master. */
  combinedTurnsToKill: number;
  needs: Need[];
  /** Mana to keep back, and why. */
  reserve: number;
  reserveFor: string | null;
  reserveAnswer: string | null;
  /** Familiar id → the hex of its Job, and what the Job is. */
  jobs: Map<number, { hex: Hex; label: string }>;
  /** Keys of own Stones an enemy could end its next move on (R1). */
  threatenedStones: Set<string>;
  /** Fit of each Familiar kind (in this Side's Loadout) for the Needs, 0..~1.5. */
  fit: (kind: UnitKind) => number;
  /** How well `kind` answers `enemy` (damage dealt against damage taken), 0..1.5. */
  answerFit: (kind: UnitKind, enemy: Unit) => number;
  /** One line for the screen. */
  text: string;
}

const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

export function unitValue(u: Unit): number {
  const k = kindOf(u.kind);
  return k.isMaster ? 6 : 1 + k.cost / 48;
}

const flies = (k: UnitKind) => k.moveTypes.includes('fly');

/** Longest distance at which a kind can damage: Attack, or a damaging spell's range + area. */
export function hitReach(k: UnitKind): number {
  let r = k.attack.range;
  for (const m of k.magic) if (m.kind === 'damage') r = Math.max(r, m.range + m.radius);
  return r;
}

/** A Unit of `kind` standing at `pos`, for what-if damage. */
function virtual(kind: UnitKind, side: SideId, pos: Hex, facing = 0): Unit {
  return { id: -1000 - side, kind: kind.id, side, pos, facing: facing as Unit['facing'], hp: MAX_HP, av: 0, stranded: false };
}

/** Best damage `attacker` could deal `target` with one hit from `from` (Attack or a damaging spell, if affordable). */
function bestHit(state: MatchState, attacker: Unit, from: Hex, target: Unit): number {
  const k = kindOf(attacker.kind);
  let d = computeDamage(state, attacker, from, target, 'physical').amount;
  const mana = state.sides[attacker.side]?.mana ?? 0;
  if (k.magic.some((m) => m.kind === 'damage' && m.manaCost <= mana)) d = Math.max(d, computeDamage(state, attacker, from, target, 'magic').amount);
  return d;
}

/**
 * Enemy turns `e` spends closing in before it can hit hex `h` (0: it can this turn),
 * straight-line. The one estimate of arrival for turns-to-kill and for how long a
 * Unit holds out (the move scorer's real-path danger covers the turn at hand).
 */
export function arriveTurns(e: Unit, h: Hex): number {
  const ek = kindOf(e.kind);
  const reach = ek.stats.mov + hitReach(ek);
  const d = hexDistance(e.pos, h);
  return d <= reach ? 0 : Math.ceil((d - reach) / Math.max(1, ek.stats.mov));
}

/** Enemy turns for `e` to kill `m`: turns to move within reach, then one per hit needed. */
function turnsToKill(state: MatchState, e: Unit, m: Unit): number {
  // it arrives from its own direction
  const from = neighbor(m.pos, facingToward(m.pos, e.pos));
  const dmg = bestHit(state, e, from, m);
  if (dmg <= 0) return Infinity;
  return arriveTurns(e, m.pos) + Math.ceil(m.hp / dmg);
}

const urgencyOf = (ttk: number) => clamp((4 - ttk) / 2);
/**
 * Defend only for real danger: a kill within 2 enemy turns. At 3 the Master still
 * has its own turns to react, and its per-turn threat check keeps it safe; with
 * heavy hitters about, "3 turns" holds almost all game and would freeze it.
 */
const defendOf = (ttk: number) => (ttk <= 2 ? 1 : 0);

/** How well a Familiar of `kind` (for `side`) answers `enemy`: share of its HP taken per hit, against the hit it takes back. */
function answerFitOf(state: MatchState, side: SideId, kind: UnitKind, enemy: Unit): number {
  const ek = kindOf(enemy.kind);
  // attack from its front (no Facing Bonus): an honest estimate
  const from = neighbor(enemy.pos, enemy.facing);
  const me = virtual(kind, side, from, facingToward(from, enemy.pos));
  const dealt = bestHit(state, me, from, enemy);
  let taken = bestHit(state, enemy, enemy.pos, me);
  // a ranged answer can strike a melee enemy without standing next to it
  if (kind.attack.range > 1 && hitReach(ek) <= 1) taken *= 0.4;
  const s = Math.min(1, dealt / Math.max(1, enemy.hp));
  const t = Math.min(1, taken / MAX_HP);
  return clamp(1.6 * s - 0.6 * t + 0.2, 0, 1.5);
}

const plans = new WeakMap<MatchState, { sig: string; plan: [Plan | undefined, Plan | undefined] }>();

/** What the Plan depends on, so a state changed in place (tests, tools) never reuses a stale one. */
function signature(state: MatchState): string {
  const u = state.units.map((x) => `${x.id}:${x.kind}:${x.side}:${x.pos.q},${x.pos.r}:${x.facing}:${x.hp}:${x.av}:${x.empowered ?? 0}`).join('|');
  const st = state.stones.map((x) => x.owner ?? '-').join('');
  return `${u}#${st}#${state.sides[0].mana},${state.sides[1].mana}#${state.clock}#${state.waterLevel}`;
}

/** The Plan for `side` in `state` (cached per state). */
export function makePlan(state: MatchState, side: SideId): Plan {
  const sig = signature(state);
  let entry = plans.get(state);
  if (!entry || entry.sig !== sig) plans.set(state, (entry = { sig, plan: [undefined, undefined] }));
  return (entry.plan[side] ??= buildPlan(state, side));
}

function buildPlan(state: MatchState, side: SideId): Plan {
  const enemySide = (1 - side) as SideId;
  const mine = state.units.filter((u) => u.side === side);
  const theirs = state.units.filter((u) => u.side !== side);
  const master = mine.find((u) => kindOf(u.kind).isMaster);
  const enemyMaster = theirs.find((u) => kindOf(u.kind).isMaster);
  const myFamiliars = mine.filter((u) => !kindOf(u.kind).isMaster);

  // ---- situation ----
  const material = (us: Unit[]) => us.reduce((a, u) => a + (unitValue(u) * u.hp) / MAX_HP, 0);
  const ratio = material(mine) / Math.max(1, material(theirs));
  // the one measure of being ahead: material share, Stones and Mana (the move scorer's push reads it)
  const myStones = state.stones.filter((x) => x.owner === side).length;
  const theirStones = state.stones.filter((x) => x.owner === enemySide).length;
  const lead =
    (material(mine) - material(theirs)) / Math.max(1, material(mine) + material(theirs)) +
    0.08 * (myStones - theirStones) +
    (0.2 * (state.sides[side].mana - state.sides[enemySide].mana)) / MANA_MAX;
  const incMe = manaIncome(state, side);
  const incThem = manaIncome(state, enemySide);

  // Danger to the Master, one enemy at a time and all together.
  const threats: Threat[] = [];
  let combinedTurnsToKill = Infinity;
  if (master) {
    for (const e of theirs) {
      const ttk = turnsToKill(state, e, master);
      if (ttk < Infinity) threats.push({ unit: e, turnsToKill: ttk, urgency: urgencyOf(ttk) });
    }
    threats.sort((a, b) => a.turnsToKill - b.turnsToKill || unitValue(b.unit) - unitValue(a.unit) || a.unit.id - b.unit.id);
    // together: by turn t each enemy has hit (t − its arrival) times
    const parts = theirs
      .map((e) => {
        const dmg = bestHit(state, e, neighbor(master.pos, facingToward(master.pos, e.pos)), master);
        return { dmg, arrive: arriveTurns(e, master.pos) };
      })
      .filter((p) => p.dmg > 0);
    for (let t = 1; t <= 6 && combinedTurnsToKill === Infinity; t++) {
      if (parts.reduce((a, p) => a + Math.max(0, t - p.arrive) * p.dmg, 0) >= master.hp) combinedTurnsToKill = t;
    }
  }
  const urgency = defendOf(Math.min(threats[0]?.turnsToKill ?? Infinity, combinedTurnsToKill));

  // How soon a Side could reach a hex: its units, or a Familiar summoned next to its Master.
  const eta = (us: Unit[], h: Hex) => {
    let best = Infinity;
    for (const u of us) {
      const k = kindOf(u.kind);
      const d = hexDistance(u.pos, h);
      best = Math.min(best, Math.ceil(d / Math.max(1, k.stats.mov)));
      if (k.isMaster) best = Math.min(best, 1 + Math.ceil(Math.max(0, d - 1) / 5));
    }
    return best;
  };
  const local = (us: Unit[], h: Hex) => us.reduce((a, u) => a + (hexDistance(u.pos, h) <= 5 ? (unitValue(u) * u.hp) / MAX_HP : 0), 0);

  // R1: own Stones an enemy could end its next move on (its movement, not a straight distance).
  const enemyCanEnd = new Set<string>();
  for (const e of theirs) for (const n of reachable(state, e).values()) if (n.canEnd) enemyCanEnd.add(hexKey(n.hex));
  const threatenedStones = new Set<string>();
  for (const st of state.stones) {
    if (st.owner !== side) continue;
    const occupied = state.units.find((u) => hexEq(u.pos, st.hex));
    // standing on it hides it from reachable(): an enemy that can end next to it could take it if it were empty
    const near = [st.hex, ...[0, 1, 2, 3, 4, 5].map((d) => neighbor(st.hex, d as Unit['facing']))];
    const takeable = occupied ? theirs.some((e) => near.some((h) => enemyCanEnd.has(hexKey(h)) && hexDistance(e.pos, st.hex) <= kindOf(e.kind).stats.mov)) : enemyCanEnd.has(hexKey(st.hex));
    if (takeable) threatenedStones.add(hexKey(st.hex));
  }

  // ---- posture ----
  const open = state.stones.filter((st) => st.owner !== side);
  const free = state.stones.filter((st) => st.owner === null);
  const firstToFree = free.filter((st) => eta(mine, st.hex) <= eta(theirs, st.hex)).length;
  const ownStones = state.stones.filter((st) => st.owner === side).length;
  const posture: Record<PostureName, number> = {
    defend: urgency,
    expand: free.length ? clamp((2 * firstToFree) / Math.max(1, state.stones.length)) : 0,
    contest: 0.35,
    // ahead on income from Stones it holds, and those Stones safe
    squeeze: ownStones ? clamp((incMe - incThem) / Math.max(4, incThem)) * (1 - threatenedStones.size / ownStones) : 0,
    kill: enemyMaster ? clamp((ratio - 1.8) / 0.7) * (myFamiliars.some((u) => hexDistance(u.pos, enemyMaster.pos) <= 3 * kindOf(u.kind).stats.mov) ? 1 : 0.5) : 0,
  };
  const dominant = (Object.keys(posture) as PostureName[]).reduce((a, b) => (posture[b] > posture[a] ? b : a));

  // ---- front ----
  let front: Hex | null = null;
  let frontLabel = 'none';
  let frontKind: Plan['frontKind'] = 'none';
  let bestScore = -Infinity;
  for (const st of open) {
    const gain = st.owner === null ? 1 : 1.6;
    const balance = 1 / (1 + Math.exp(-(local(mine, st.hex) - local(theirs, st.hex)) / 3));
    const sc = (gain * (0.35 + balance)) / (1 + eta(mine, st.hex));
    if (sc > bestScore || (sc === bestScore && front && hexKey(st.hex) < hexKey(front))) {
      bestScore = sc;
      front = st.hex;
      frontLabel = `${st.owner === null ? 'free' : 'enemy'} Stone ${st.hex.q},${st.hex.r}`;
      frontKind = 'stone';
    }
  }
  if (enemyMaster && (posture.kill * 2 > bestScore || !front)) {
    bestScore = posture.kill * 2;
    front = enemyMaster.pos;
    frontLabel = `enemy Master ${kindOf(enemyMaster.kind).name}`;
    frontKind = 'master';
  }
  // what the Master stages toward even when the Front is a threat
  const objective = front;
  if (threats[0] && posture.defend > 0.3 && posture.defend * 3 > bestScore) {
    front = threats[0].unit.pos;
    frontLabel = `threat ${kindOf(threats[0].unit.kind).name}`;
    frontKind = 'threat';
  }

  // ---- needs and fits ----
  const answerFit = (kind: UnitKind, enemy: Unit) => answerFitOf(state, side, kind, enemy);
  const needs: Need[] = [];
  if (open.length) needs.push({ tag: 'grab', weight: posture.expand + 0.5 * posture.contest });
  // answer: the dangerous enemies, and strong ones near the Front
  const answered = new Set<number>();
  for (const t of threats.slice(0, 2)) {
    if (t.urgency <= 0) continue;
    needs.push({ tag: 'answer', weight: 1.5 * t.urgency, target: t.unit });
    answered.add(t.unit.id);
  }
  if (front) {
    const strong = theirs
      .filter((e) => !kindOf(e.kind).isMaster && !answered.has(e.id) && hexDistance(e.pos, front!) <= 5 && kindOf(e.kind).cost >= 48)
      .sort((a, b) => unitValue(b) - unitValue(a) || a.id - b.id)[0];
    if (strong) needs.push({ tag: 'answer', weight: 0.4 * (unitValue(strong) / 3), target: strong });
  }
  const ownHealerNear = master && myFamiliars.some((u) => kindOf(u.kind).magic.some((m) => m.kind === 'heal') && hexDistance(u.pos, master.pos) <= 6);
  if (master && (posture.defend > 0 || master.hp < MAX_HP)) needs.push({ tag: 'heal', weight: 0.8 * Math.max(posture.defend, (MAX_HP - master.hp) / MAX_HP) * (ownHealerNear ? 0.3 : 1) });
  if (posture.squeeze > 0) needs.push({ tag: 'hold', weight: 0.8 * posture.squeeze });
  if (posture.kill > 0) needs.push({ tag: 'assassin', weight: 1.2 * posture.kill });
  needs.push({ tag: 'fight', weight: 0.4 });

  const nearFront = front ? theirs.filter((e) => !kindOf(e.kind).isMaster).sort((a, b) => hexDistance(a.pos, front!) - hexDistance(b.pos, front!) || a.id - b.id).slice(0, 3) : [];
  const fitCache = new Map<string, number>();
  const fit = (k: UnitKind): number => {
    const hit = fitCache.get(k.id);
    if (hit !== undefined) return hit;
    const st = k.stats;
    let v = 0;
    for (const n of needs) {
      let f = 0;
      switch (n.tag) {
        case 'grab':
          f = clamp((st.mov + (flies(k) ? 1.5 : 0) - 3) / 4) * (k.cost <= 40 ? 1 : k.cost <= 64 ? 0.7 : 0.4);
          break;
        case 'answer':
          f = n.target ? answerFit(k, n.target) : 0;
          break;
        case 'heal':
          f = k.magic.some((m) => m.kind === 'heal') ? 1 : k.magic.some((m) => m.kind === 'empower') ? 0.3 : 0;
          break;
        case 'hold':
          f = clamp((st.def + st.mdf - 6) / 8);
          break;
        case 'assassin':
          f = clamp((st.atk + st.mov + (flies(k) ? 2 : 0) - 9) / 7);
          break;
        case 'fight':
          f = nearFront.length ? nearFront.reduce((a, e) => a + answerFit(k, e), 0) / nearFront.length : clamp((st.atk - 3) / 6);
          break;
      }
      v += n.weight * f;
    }
    fitCache.set(k.id, v);
    return v;
  };

  // ---- reserve ----
  let reserve = 0;
  let reserveFor: string | null = null;
  let reserveAnswer: string | null = null;
  if (master && enemyMaster) {
    const hours = turnDelay(kindOf(master.kind), true, true) / 60;
    const theirBudget = state.sides[enemySide].mana + Math.max(0, incThem) * hours;
    let worst: { k: UnitKind; ttk: number } | null = null;
    const spawn = neighbor(enemyMaster.pos, facingToward(enemyMaster.pos, master.pos));
    for (const k of FAMILIARS) {
      if (k.cost > theirBudget || !inRoster(state, enemySide, k.id)) continue;
      const ttk = turnsToKill(state, virtual(k, enemySide, spawn), master);
      if (!worst || ttk < worst.ttk || (ttk === worst.ttk && k.cost > worst.k.cost)) worst = { k, ttk };
    }
    if (worst && worst.ttk <= 3) {
      const threat = virtual(worst.k, enemySide, spawn, facingToward(spawn, master.pos));
      const answer = FAMILIARS.filter((k) => inRoster(state, side, k.id) && answerFitOf(state, side, k, threat) >= 0.6).sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id))[0];
      if (answer) {
        reserve = Math.max(0, Math.round(answer.cost - Math.max(0, incMe) * hours));
        reserveFor = worst.k.name;
        reserveAnswer = answer.name;
      }
    }
  }

  // ---- jobs ----
  const jobs = new Map<number, { hex: Hex; label: string }>();
  {
    type Obj = { hex: Hex; value: number; cap: number; label: string };
    const objs: Obj[] = [];
    for (const st of open) objs.push({ hex: st.hex, value: st.owner === null ? 1 : 1.5, cap: 1, label: `take ${st.hex.q},${st.hex.r}` });
    for (const st of state.stones)
      if (st.owner === side && threatenedStones.has(hexKey(st.hex))) objs.push({ hex: st.hex, value: 1.2, cap: 1, label: `guard ${st.hex.q},${st.hex.r}` });
    for (const e of theirs) {
      const t = threats.find((x) => x.unit.id === e.id);
      const isM = kindOf(e.kind).isMaster;
      // a healer keeping the enemy Master up is hunted first (peel, then kill)
      const medic = !isM && enemyMaster && kindOf(e.kind).magic.some((m) => m.kind === 'heal' && hexDistance(e.pos, enemyMaster.pos) <= kindOf(e.kind).stats.mov + m.range + m.radius);
      const value = isM ? 0.8 + 3 * posture.kill : unitValue(e) * (t && t.urgency > 0 ? 0.6 + 1.5 * t.urgency : medic ? 1 : 0.4);
      objs.push({ hex: e.pos, value, cap: isM ? 4 : 2, label: `hunt ${kindOf(e.kind).name}` });
    }
    const pairs: { f: Unit; o: Obj; cost: number }[] = [];
    for (const f of myFamiliars) {
      const mov = Math.max(1, kindOf(f.kind).stats.mov);
      for (const o of objs) pairs.push({ f, o, cost: (1 + hexDistance(f.pos, o.hex) / mov) / o.value });
    }
    pairs.sort((a, b) => a.cost - b.cost || a.f.id - b.f.id || hexKey(a.o.hex).localeCompare(hexKey(b.o.hex)));
    const used = new Map<Obj, number>();
    for (const p of pairs) {
      if (jobs.has(p.f.id) || (used.get(p.o) ?? 0) >= p.o.cap) continue;
      jobs.set(p.f.id, { hex: p.o.hex, label: p.o.label });
      used.set(p.o, (used.get(p.o) ?? 0) + 1);
    }
    if (front) for (const f of myFamiliars) if (!jobs.has(f.id)) jobs.set(f.id, { hex: front, label: 'front' });
  }

  // ---- text ----
  const pct = (x: number) => Math.round(x * 100);
  const needText = needs
    .filter((n) => n.weight >= 0.15)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((n) => (n.tag === 'answer' && n.target ? `answer ${kindOf(n.target.kind).name}` : n.tag))
    .join(', ');
  const top = (Object.keys(posture) as PostureName[])
    .filter((p) => posture[p] >= 0.2)
    .sort((a, b) => posture[b] - posture[a])
    .map((p) => `${p[0].toUpperCase()}${p.slice(1)} ${pct(posture[p])}`)
    .join(' · ');
  const text = [`${top || 'Contest'}`, `Front: ${frontLabel}`, needText && `Needs: ${needText}`, reserve > 0 && `Reserve ${reserve}◆ (${reserveAnswer} vs ${reserveFor})`]
    .filter(Boolean)
    .join(' — ');

  return { side, posture, dominant, lead, front, frontLabel, frontKind, objective, threats, combinedTurnsToKill, needs, reserve, reserveFor, reserveAnswer, jobs, threatenedStones, fit, answerFit, text };
}
