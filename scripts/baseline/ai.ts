// Frozen copy of the AI before the strength work, used as the arena baseline. Do not edit.
// One-ply, timeline-aware AI. Enumerates every reachable hex × Command ×
// target and scores the outcome, including how much damage enemies who act
// before this Unit's next turn could deal to it. Pure and deterministic.

import {
  type Dir,
  type Hex,
  type MatchState,
  type TurnAction,
  type Unit,
  type Command,
  DIRS,
  canStandOn,
  canCastWater,
  computeDamage,
  delayForAction,
  elementModifier,
  facingToward,
  hexDistance,
  hexEq,
  hexKey,
  kindOf,
  magicTargetHexes,
  manaIncome,
  mapHexAt,
  neighbor,
  previewEffects,
  reachable,
  SUMMONS,
  validateTurn,
  attackTargets,
  activeUnit,
  resultingFacing,
  canPlace,
  inRoster,
  planAttack,
  shotAllowed,
  trajectoryOf,
} from '../../src/rules';

export const AI_WEIGHTS = {
  damage: 10,
  kill: 60,
  killSummoner: 100000,
  heal: 7,
  friendlyFire: 14,
  threat: 9,
  deathRisk: 70,
  summonerDeathRisk: 5000,
  capture: 45,
  onStone: 6,
  approach: 3,
  summonerSafety: 4,
  summonBase: 40,
  summonCostValue: 0.45,
  summonCounter: 18,
  summonNegativeIncome: 35,
  manaSpend: 0.25,
  strandEnemy: 30,
  strandAlly: 35,
  delay: 0.15,
  /** Per enemy that breaking an Obstacle would bring into this Unit's Attack Reach. */
  obstacleOpening: 25,
};

type W = typeof AI_WEIGHTS;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function unitValue(u: Unit): number {
  const k = kindOf(u.kind);
  return k.isSummoner ? 6 : 1 + k.cost / 48;
}

interface EnemyReach {
  unit: Unit;
  positions: Hex[];
}

function enemyReaches(state: MatchState, me: Unit): EnemyReach[] {
  return state.units
    .filter((u) => u.side !== me.side)
    .map((u) => {
      const nodes = reachable(state, u);
      const positions: Hex[] = [];
      for (const n of nodes.values()) if (n.canEnd || hexEq(n.hex, u.pos)) positions.push(n.hex);
      return { unit: u, positions };
    });
}

/** Max damage `e` could deal to a virtual copy of `me` standing at `h` facing `f`. */
function maxDamageFrom(state: MatchState, e: EnemyReach, me: Unit, h: Hex, f: Dir): number {
  const ek = kindOf(e.unit.kind);
  const target: Unit = { ...me, pos: h, facing: f };
  const mana = state.sides[e.unit.side].mana;
  let best = 0;
  const spells = ek.magic.filter((m) => m.kind === 'damage' && m.manaCost <= mana);
  const view: MatchState = { ...state, units: state.units.map((u) => (u.id === me.id ? target : u)) };
  const atkTraj = trajectoryOf(ek.attack);
  for (const p of e.positions) {
    if (hexEq(p, h)) continue;
    const d = hexDistance(p, h);
    if (d >= 1 && d <= ek.attack.range && shotAllowed(view, e.unit.id, atkTraj, p, h)) {
      best = Math.max(best, computeDamage(state, e.unit, p, target, 'physical').amount);
    }
    for (const m of spells) {
      if (m.kind !== 'damage') continue;
      if (d <= m.range + m.radius && (m.radius > 0 || shotAllowed(view, e.unit.id, trajectoryOf(m), p, h))) {
        best = Math.max(best, computeDamage(state, e.unit, p, target, 'magic').amount);
      }
    }
  }
  return best;
}

/**
 * Value of hitting an Obstacle: how many enemies breaking it would bring
 * into this Unit's Attack Reach (from where it ends the turn), scaled by how
 * much of its HP this hit takes.
 */
function obstacleValue(state: MatchState, me: Unit, dest: Hex, id: number, amount: number, lethal: boolean, w: W): number {
  const o = state.obstacles.find((x) => x.id === id);
  if (!o) return 0;
  const meAfter: Unit = { ...me, pos: dest };
  const now: MatchState = { ...state, units: state.units.map((u) => (u.id === me.id ? meAfter : u)) };
  const without: MatchState = { ...now, obstacles: state.obstacles.filter((x) => x.id !== id) };
  let opened = 0;
  for (const e of state.units) {
    if (e.side === me.side || hexDistance(e.pos, o.pos) > 4) continue;
    if (!planAttack(now, meAfter, e) && planAttack(without, meAfter, e)) opened++;
  }
  const share = lethal ? 1 : amount / Math.max(1, o.hp) / 2;
  return opened * w.obstacleOpening * share;
}

interface Candidate {
  action: TurnAction;
  score: number;
}

export function chooseAction(state: MatchState, weights: W = AI_WEIGHTS): TurnAction {
  const me = activeUnit(state);
  if (!me) throw new Error('no active unit');
  const kind = kindOf(me.kind);
  const w = weights;
  const reaches = enemyReaches(state, me);
  const threatCache = new Map<string, number>();

  const threatAt = (h: Hex, f: Dir, delay: number, killed: Set<number>): number => {
    const key = `${hexKey(h)}|${f}|${delay}|${[...killed].join(',')}`;
    const hit = threatCache.get(key);
    if (hit !== undefined) return hit;
    let total = 0;
    for (const e of reaches) {
      if (killed.has(e.unit.id)) continue;
      if (e.unit.av >= delay) continue; // acts after my next turn
      total += maxDamageFrom(state, e, me, h, f);
    }
    threatCache.set(key, total);
    return total;
  };

  const bestFacing = (h: Hex, delay: number, killed: Set<number>): { facing: Dir; threat: number } => {
    let bestF: Dir = me.facing;
    let bestT = Infinity;
    // Prefer facing toward the nearest enemy on ties.
    const nearest = [...state.units]
      .filter((u) => u.side !== me.side && !killed.has(u.id))
      .sort((a, b) => hexDistance(a.pos, h) - hexDistance(b.pos, h) || a.id - b.id)[0];
    const pref = nearest && !hexEq(nearest.pos, h) ? facingToward(h, nearest.pos) : me.facing;
    const order: Dir[] = [pref, ...DIRS.filter((d) => d !== pref)];
    for (const f of order) {
      const t = threatAt(h, f, delay, killed);
      if (t < bestT) {
        bestT = t;
        bestF = f;
      }
    }
    return { facing: bestF, threat: bestT };
  };

  const objectives = (): Hex[] => {
    const out: Hex[] = state.stones.filter((s) => s.owner !== me.side).map((s) => s.hex);
    for (const u of state.units) if (u.side !== me.side) out.push(u.pos);
    return out;
  };
  const objs = objectives();
  const enemySummoner = state.units.find((u) => u.side !== me.side && kindOf(u.kind).isSummoner);

  const positionalScore = (h: Hex): number => {
    let s = 0;
    const stone = state.stones.find((st) => hexEq(st.hex, h));
    if (stone) {
      if (stone.owner !== me.side) s += w.capture;
      s += w.onStone * (10 - me.hp + 1) * 0.3;
    }
    if (kind.isSummoner) {
      // Keep distance from enemies (but not infinitely).
      let minD = 99;
      for (const u of state.units) if (u.side !== me.side) minD = Math.min(minD, hexDistance(u.pos, h));
      s += w.summonerSafety * Math.min(minD, 6);
    } else if (objs.length) {
      let minD = 99;
      for (const o of objs) minD = Math.min(minD, hexDistance(o, h));
      s -= w.approach * minD;
      if (enemySummoner) s -= w.approach * 0.3 * hexDistance(enemySummoner.pos, h);
    }
    return s;
  };

  const nodes = reachable(state, me);
  const dests: Hex[] = [];
  for (const n of nodes.values()) if (n.canEnd) dests.push(n.hex);

  const candidates: Candidate[] = [];
  const myMana = state.sides[me.side].mana;
  const income = manaIncome(state, me.side);

  // Rank summon kinds once (placement-independent).
  const summonKinds = kind.isSummoner
    ? SUMMONS.filter((s) => s.cost <= myMana && inRoster(state, me.side, s.id))
        .map((s) => {
          let counter = 0;
          for (const u of state.units) {
            if (u.side === me.side) continue;
            const uk = kindOf(u.kind);
            if (hexDistance(u.pos, me.pos) > 8) continue;
            const off = elementModifier(s.element, uk.element);
            const def = elementModifier(uk.element, s.element);
            if (off.num > off.den) counter += 1;
            if (def.num > def.den) counter -= 1;
          }
          let v = w.summonBase + s.cost * w.summonCostValue + counter * w.summonCounter;
          if (income - s.cost / 8 < 0) v -= w.summonNegativeIncome;
          return { kind: s, value: v };
        })
        .sort((a, b) => b.value - a.value || a.kind.cost - b.kind.cost)
        .slice(0, 4)
    : [];

  for (const dest of dests) {
    const pos = positionalScore(dest);
    const commands: Command[] = [{ type: 'wait' }];
    if (!me.stranded || !hexEq(dest, me.pos)) {
      const view: MatchState = { ...state, units: state.units.map((u) => (u.id === me.id ? { ...u, pos: dest } : u)) };
      const moved = { ...me, pos: dest };
      for (const t of attackTargets(view, moved, dest)) commands.push({ type: 'attack', target: t.pos });
      for (const ab of kind.magic) {
        if (ab.manaCost > myMana) continue;
        if (ab.kind === 'water') {
          if (canCastWater(state, ab.delta)) commands.push({ type: 'magic', ability: ab.id, target: dest });
          continue;
        }
        for (const h of magicTargetHexes(state, me, ab, dest)) commands.push({ type: 'magic', ability: ab.id, target: h });
      }
      for (const sk of summonKinds) {
        for (const d of DIRS) {
          const h = neighbor(dest, d);
          if (!canPlace(view, sk.kind, h, me.id)) continue;
          commands.push({ type: 'summon', kind: sk.kind.id, dir: d });
        }
      }
    }

    for (const command of commands) {
      const draft: TurnAction = { unitId: me.id, to: dest, facing: me.facing, command };
      const delay = delayForAction(state, draft);
      let score = pos - w.delay * delay;
      const killed = new Set<number>();

      if (command.type === 'attack' || command.type === 'magic') {
        const ab = command.type === 'magic' ? kind.magic.find((m) => m.id === command.ability)! : null;
        if (ab) score -= ab.manaCost * w.manaSpend;
        if (ab && ab.kind === 'water') {
          const level = state.waterLevel + ab.delta;
          for (const u of state.units) {
            const mh = mapHexAt(state.map, u.id === me.id ? dest : u.pos);
            if (!mh) continue;
            const strandedNow = !canStandOn(kindOf(u.kind), mh, state.waterLevel);
            const strandedAfter = !canStandOn(kindOf(u.kind), mh, level);
            if (strandedAfter && !strandedNow) score += u.side === me.side ? -w.strandAlly : w.strandEnemy * unitValue(u);
            if (!strandedAfter && strandedNow) score += u.side === me.side ? w.strandAlly : -w.strandEnemy;
          }
        } else {
          const effects = previewEffects(state, draft);
          if (effects.length === 0) continue;
          for (const e of effects) {
            if (e.obstacle) {
              score += obstacleValue(state, me, dest, e.unitId, e.amount, e.lethal, w);
              continue;
            }
            const t = state.units.find((u) => u.id === e.unitId)!;
            const v = unitValue(t);
            if (e.kind === 'damage') {
              if (t.side === me.side) score -= e.amount * w.friendlyFire * v;
              else {
                score += e.amount * w.damage * v;
                if (e.lethal) {
                  killed.add(t.id);
                  score += kindOf(t.kind).isSummoner ? w.killSummoner : w.kill * v;
                }
              }
            } else {
              score += (t.side === me.side ? 1 : -1) * e.amount * w.heal * v;
            }
          }
        }
      } else if (command.type === 'summon') {
        const sk = summonKinds.find((s) => s.kind.id === command.kind)!;
        score += sk.value;
        const h = neighbor(dest, command.dir);
        if (enemySummoner) score -= hexDistance(h, enemySummoner.pos) * 0.5;
        const stone = state.stones.find((s) => hexEq(s.hex, h));
        if (stone && stone.owner !== me.side) score += w.capture * 0.4;
      }

      let facing: Dir;
      let threat: number;
      if (command.type === 'summon') {
        facing = command.dir;
        threat = threatAt(dest, facing, delay, killed);
      } else {
        ({ facing, threat } = bestFacing(dest, delay, killed));
        if (command.type !== 'wait') {
          // Attack / Magic force Facing toward the target.
          const forced = resultingFacing(state, { ...draft, facing });
          if (forced !== facing) {
            facing = forced;
            threat = threatAt(dest, facing, delay, killed);
          }
        }
      }
      const v = unitValue(me);
      score -= Math.min(threat, me.hp) * w.threat * v;
      if (threat >= me.hp) score -= kind.isSummoner ? w.summonerDeathRisk : w.deathRisk * v;

      candidates.push({ action: { ...draft, facing }, score });
    }
  }

  const legal = candidates.filter((c) => validateTurn(state, c.action) === null);
  if (legal.length === 0) return { unitId: me.id, to: me.pos, facing: me.facing, command: { type: 'wait' } };
  let best = -Infinity;
  for (const c of legal) best = Math.max(best, c.score);
  const top = legal.filter((c) => c.score >= best - 1e-9);
  const rng = mulberry32(state.rngState ^ (state.turnNumber * 2654435761));
  return top[Math.floor(rng() * top.length)].action;
}

/**
 * An AI-built Loadout for a Summoner: four or five Summons of each Element
 * (five of the Summoner's own Element if it has one), always including the
 * two cheapest of each so it can summon early, the rest spread over cost.
 */
export function autoLoadout(summonerId: string, rand: () => number = Math.random): string[] {
  const own = kindOf(summonerId).element;
  const elements = ['fire', 'air', 'earth', 'water'] as const;
  const order = [...elements].sort(() => rand() - 0.5);
  if (own) order.sort((a, b) => (a === own ? -1 : b === own ? 1 : 0));
  const counts = new Map(order.map((e, i) => [e, i < 2 ? 5 : 4] as const));
  const out: string[] = [];
  for (const e of elements) {
    const byCost = SUMMONS.filter((s) => s.element === e).sort((a, b) => a.cost - b.cost);
    const picked = byCost.slice(0, 2);
    const rest = byCost.slice(2).sort(() => rand() - 0.5);
    picked.push(...rest.slice(0, counts.get(e)! - 2));
    out.push(...picked.map((k) => k.id));
  }
  return out;
}
