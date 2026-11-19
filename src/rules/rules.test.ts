import { describe, expect, it } from 'vitest';
import {
  applyTurn,
  computeDamage,
  createMatch,
  facingModifier,
  getUnit,
  hex,
  hexKey,
  kindOf,
  manaIncome,
  projectTimeline,
  reachable,
  ringPosition,
  SCAFFOLD_MAP,
  SUMMONS,
  turnDelay,
  validateTurn,
  type MapDef,
  type MapHex,
  type MatchState,
  type Unit,
  type HexTerrain,
  hexDistance,
} from './index';
import { ELEMENTS } from './data/summons';

// ---------- helpers ----------

/** Build a small rectangular axial map. `cells(q, r)` may override hexes. */
function testMap(w: number, h: number, cells: (q: number, r: number) => Partial<MapHex> = () => ({}), waterLevel = 0): MapDef {
  const hexes: MapHex[] = [];
  for (let r = 0; r < h; r++)
    for (let q = 0; q < w; q++) hexes.push({ hex: hex(q, r), height: 1, terrain: 'plain' as HexTerrain, ...cells(q, r) });
  return { name: 'test', hexes, waterLevel, startClock: 6 * 60, spawns: [hex(0, h - 1), hex(w - 1, 0)], spawnFacing: [0, 3] };
}

let nextId = 100;
function place(state: MatchState, kind: string, side: 0 | 1, q: number, r: number, facing: 0 | 1 | 2 | 3 | 4 | 5 = 0, av = 999): Unit {
  const u: Unit = { id: nextId++, kind, side, pos: hex(q, r), facing, hp: 10, av, stranded: false };
  state.units.push(u);
  return u;
}

/** Force a given unit to be the active one. */
function activate(state: MatchState, u: Unit) {
  for (const x of state.units) if (x.id !== u.id && x.av <= 0) x.av = 1;
  u.av = 0;
  state.activeUnitId = u.id;
}

// ---------- hex angle & facing ----------

describe('facing modifier', () => {
  it('uses ×1.0 / ×1.2 / ×1.6 / ×2.0 for adjacent hits', () => {
    const d = hex(0, 0);
    const mod = (from: { q: number; r: number }) => {
      const m = facingModifier(d, 0, from);
      return m.num / m.den;
    };
    expect(mod(hex(1, 0))).toBe(1.0); // in front (E)
    expect(mod(hex(1, -1))).toBe(1.2); // 60°
    expect(mod(hex(0, 1))).toBe(1.2); // 60° other side
    expect(mod(hex(0, -1))).toBe(1.6); // 120°
    expect(mod(hex(-1, 0))).toBe(2.0); // directly behind
  });

  it('interpolates for ranged hits between hex directions', () => {
    // ring 2, halfway between E and NE corners → 30°
    const v = hex(2, -1);
    expect(ringPosition(v)).toEqual({ p: 1, d: 2 });
    const m = facingModifier(hex(0, 0), 0, v);
    expect(m.num / m.den).toBeCloseTo(1.1);
    // halfway between NW (120°) and W (180°) → 150° → 1.8
    const m2 = facingModifier(hex(0, 0), 0, hex(-1, -1));
    expect(m2.num / m2.den).toBeCloseTo(1.8);
  });
});

// ---------- turn delays ----------

describe('turn delay', () => {
  const k = (spd: number) => ({ ...kindOf('summoner'), stats: { ...kindOf('summoner').stats, spd } });
  it('matches the designer anchors', () => {
    expect(turnDelay(k(13), false, false)).toBe(25);
    expect(turnDelay(k(13), false, true)).toBe(37);
    expect(turnDelay(k(13), true, true)).toBe(50);
    expect(turnDelay(k(20), false, false)).toBe(16);
    expect(turnDelay(k(20), true, true)).toBe(32);
    expect(turnDelay(k(10), true, true)).toBe(60);
    expect(turnDelay(k(7), false, false)).toBe(36);
    expect(turnDelay(k(7), true, true)).toBe(72);
  });
});

// ---------- roster ----------

describe('roster', () => {
  it('has 7 summons per element with unique costs in multiples of 8 from 16..96', () => {
    expect(SUMMONS).toHaveLength(28);
    for (const e of ELEMENTS) {
      const s = SUMMONS.filter((x) => x.element === e);
      expect(s).toHaveLength(7);
      const costs = s.map((x) => x.cost);
      expect(new Set(costs).size).toBe(7);
      for (const c of costs) {
        expect(c % 8).toBe(0);
        expect(c).toBeGreaterThanOrEqual(16);
        expect(c).toBeLessThanOrEqual(96);
      }
      expect(s.filter((x) => x.alignment === 'day')).toHaveLength(2);
      expect(s.filter((x) => x.alignment === 'night')).toHaveLength(2);
    }
  });

  it('uses short names, max-only ranges, and Summon Magic costs of 4–16', () => {
    for (const k of SUMMONS) {
      expect(k.name.length).toBeLessThanOrEqual(6);
      expect(k.attack).toEqual({ range: k.attack.range });
      const m = k.magic[0];
      expect(m.manaCost).toBeGreaterThanOrEqual(4);
      expect(m.manaCost).toBeLessThanOrEqual(16);
      expect(m).not.toHaveProperty('minRange');
      expect(m).not.toHaveProperty('power');
    }
  });

  it('gives Summoners walk+wade, most Earth summons wade, and no Fire summon wade', () => {
    expect(kindOf('summoner').moveTypes).toEqual(['walk', 'wade']);
    const earth = SUMMONS.filter((x) => x.element === 'earth');
    expect(earth.filter((x) => x.moveTypes.includes('wade')).length).toBeGreaterThan(earth.length / 2);
    for (const f of SUMMONS.filter((x) => x.element === 'fire')) expect(f.moveTypes).not.toContain('wade');
  });
});

// ---------- damage ----------

describe('damage', () => {
  it('applies ATK/DEF ratio, element counter and facing; can be 0', () => {
    const state = createMatch(testMap(6, 6));
    state.clock = 18 * 60; // neutral time
    const hound = place(state, 'hound', 0, 1, 1); // fire, ATK 15
    const hawk = place(state, 'hawk', 1, 2, 1, 3); // air, DEF 9, faces W toward hound
    const front = computeDamage(state, hound, hound.pos, hawk, 'physical');
    // 3 × 15/9 × 2 (fire counters air) × 1.0 = 10
    expect(front.amount).toBe(10);
    expect(front.lethal).toBe(true);

    const crab = place(state, 'crab', 1, 3, 3, 0); // water DEF 14
    const weak = computeDamage(state, hound, hex(2, 3), crab, 'physical');
    // 3 × 15/14 × 0.5 (water counters fire) × 2.0 (from behind) = 3.21 → 3
    expect(weak.amount).toBe(3);

  });

  it('can deal 0 damage', () => {
    // Day-aligned air Sprite at night (ATK 10 ×0.8) into a fire Golem (DEF 17, counters air) on a Magic Stone:
    // 3 × 8/17 × 0.5 × 0.7 = 0.49 → 0
    const state = createMatch(testMap(6, 6, (q, r) => (q === 4 && r === 4 ? { terrain: 'stone' } : {})));
    state.clock = 22 * 60;
    const golem = place(state, 'golem', 1, 4, 4, 3);
    const sprite = place(state, 'sprite', 0, 3, 4);
    expect(computeDamage(state, sprite, sprite.pos, golem, 'physical').amount).toBe(0);
  });

  it('reduces damage on rough (20%) and magic stones (30%)', () => {
    const state = createMatch(testMap(6, 6, (q, r) => (q === 2 && r === 1 ? { terrain: 'rough' } : q === 2 && r === 2 ? { terrain: 'stone' } : {})));
    state.clock = 18 * 60;
    const a = place(state, 'summoner', 0, 1, 1);
    const b = place(state, 'summoner', 1, 2, 1, 3);
    // 3 × 8/10 = 2.4 ; rough → 1.92 → 2
    expect(computeDamage(state, a, a.pos, b, 'physical').amount).toBe(2);
    expect(computeDamage(state, a, a.pos, b, 'physical').breakdown!.cover).toBe(20);
    b.pos = hex(2, 2);
    a.pos = hex(1, 2);
    // stone → 1.68 → 2
    expect(computeDamage(state, a, a.pos, b, 'physical').amount).toBe(2);
    expect(computeDamage(state, a, a.pos, b, 'physical').breakdown!.cover).toBe(30);
  });

  it('applies day/night alignment', () => {
    const state = createMatch(testMap(6, 6));
    const archer = place(state, 'archer', 0, 1, 1); // day, fire ATK 14
    const sum = place(state, 'summoner', 1, 3, 1, 3); // DEF 10
    state.clock = 12 * 60; // day: ATK ×1.2
    expect(computeDamage(state, archer, archer.pos, sum, 'physical').amount).toBe(5); // 5.04
    state.clock = 22 * 60; // night: ×0.8
    expect(computeDamage(state, archer, archer.pos, sum, 'physical').amount).toBe(3); // 3.36
  });
});

// ---------- movement ----------

describe('movement', () => {
  it('charges rough and climbing correctly for walk and slow', () => {
    const state = createMatch(
      testMap(8, 3, (q) => (q === 1 ? { terrain: 'rough' } : q === 2 ? { height: 2 } : q === 3 ? { height: 4 } : {})),
    );
    state.units = [];
    const walker = place(state, 'summoner', 0, 0, 1); // MOV 4, walk
    const nodes = reachable(state, walker);
    expect(nodes.get(hexKey(hex(1, 1)))?.cost).toBe(2); // rough
    expect(nodes.get(hexKey(hex(2, 1)))?.cost).toBe(4); // +1 plain +1 climb
    expect(nodes.has(hexKey(hex(3, 1)))).toBe(false); // climb of 2 is blocked
  });

  it('lets fly cross water but not end on it; swim only in water', () => {
    const state = createMatch(testMap(5, 1, (q) => (q === 1 || q === 2 ? { height: 0 } : { height: 2 }), 2)); // water level 2: h0 deep
    state.units = [];
    const hawk = place(state, 'hawk', 0, 0, 0);
    const n = reachable(state, hawk);
    expect(n.get(hexKey(hex(1, 0)))?.canEnd).toBe(false);
    expect(n.get(hexKey(hex(3, 0)))?.canEnd).toBe(true);
    const shark = place(state, 'shark', 0, 1, 0);
    const s = reachable(state, shark);
    expect(s.get(hexKey(hex(2, 0)))?.canEnd).toBe(true);
    expect(s.has(hexKey(hex(3, 0)))).toBe(false);
  });

  it('stops ground units entering an enemy Zone of Control; flyers ignore it', () => {
    const state = createMatch(testMap(8, 3));
    state.units = [];
    const walker = place(state, 'hound', 0, 0, 1); // MOV 6
    place(state, 'clod', 1, 3, 1);
    const n = reachable(state, walker);
    // hex (2,1) is in ZOC; (1,1) is not. Hound cannot pass (2,1) to reach (2,0)->... beyond
    expect(n.get(hexKey(hex(2, 1)))?.cost).toBe(2);
    expect(n.get(hexKey(hex(3, 0)))?.cost).toBe(3); // reachable, but it is a ZOC stop
    expect(n.has(hexKey(hex(4, 0)))).toBe(false);
    expect(n.has(hexKey(hex(4, 1)))).toBe(false);
    const hawk = place(state, 'hawk', 0, 0, 0);
    const h = reachable(state, hawk);
    expect(h.get(hexKey(hex(5, 0)))?.cost).toBe(5);
  });

  it('cannot pass through enemies but can pass through allies', () => {
    const state = createMatch(testMap(5, 1));
    state.units = [];
    const a = place(state, 'hound', 0, 0, 0);
    const ally = place(state, 'hound', 0, 1, 0);
    let n = reachable(state, a);
    expect(n.get(hexKey(hex(1, 0)))?.canEnd).toBe(false);
    expect(n.get(hexKey(hex(2, 0)))?.canEnd).toBe(true);
    ally.side = 1;
    n = reachable(state, a);
    expect(n.has(hexKey(hex(2, 0)))).toBe(false);
  });
});

// ---------- match flow ----------

describe('match flow', () => {
  it('starts both summoners with Base Delay; human first on ties', () => {
    const s = createMatch(SCAFFOLD_MAP);
    expect(s.clock).toBe(6 * 60 + 28);
    expect(getUnit(s, s.activeUnitId!).side).toBe(0);
  });

  it('summons next to the summoner with facing and Move+Attack AV; costs mana', () => {
    const s = createMatch(testMap(6, 6));
    const me = getUnit(s, s.activeUnitId!);
    const { state, events } = applyTurn(s, { unitId: me.id, to: me.pos, facing: 0, command: { type: 'summon', kind: 'imp', dir: 1 } });
    const imp = state.units.find((u) => u.kind === 'imp')!;
    expect(imp.facing).toBe(1);
    expect(getUnit(state, me.id).facing).toBe(1);
    expect(state.sides[0].mana).toBeLessThan(40);
    expect(events.some((e) => e.type === 'summon')).toBe(true);
  });

  it('captures stones by ending a turn, not by being summoned', () => {
    const s = createMatch(testMap(6, 6, (q, r) => (q === 1 && r === 4 ? { terrain: 'stone' } : {})));
    const me = getUnit(s, s.activeUnitId!); // at (0,5)
    expect(me.pos).toEqual(hex(0, 5));
    // summon onto (1,4): dir NE (1,-1)
    const r1 = applyTurn(s, { unitId: me.id, to: me.pos, facing: 1, command: { type: 'summon', kind: 'imp', dir: 1 } });
    expect(r1.state.stones[0].owner).toBe(null);
    // let the imp wait on the stone
    const st = r1.state;
    const imp = st.units.find((u) => u.kind === 'imp')!;
    activate(st, imp);
    const r2 = applyTurn(st, { unitId: imp.id, to: imp.pos, facing: 1, command: { type: 'wait' } });
    expect(r2.state.stones[0].owner).toBe(0);
  });

  it('pays (2 + stones) × MP − upkeep at each hour mark, clamped to [0,120]', () => {
    const s = createMatch(testMap(6, 6));
    expect(manaIncome(s, 0)).toBe(32);
    s.stones = [{ hex: hex(3, 3), owner: 0 }];
    expect(manaIncome(s, 0)).toBe(48);
    place(s, 'drake', 0, 2, 2); // upkeep 11
    expect(manaIncome(s, 0)).toBe(37);
    const me = getUnit(s, s.activeUnitId!);
    const before = s.sides[0].mana;
    // waiting crosses 07:00 at some point; play turns until an hour passes
    let st = s;
    let paid = false;
    for (let i = 0; i < 10 && !paid; i++) {
      const u = getUnit(st, st.activeUnitId!);
      const r = applyTurn(st, { unitId: u.id, to: u.pos, facing: u.facing, command: { type: 'wait' } });
      paid = r.events.some((e) => e.type === 'mana' && e.side === 0);
      st = r.state;
    }
    expect(paid).toBe(true);
    expect(st.sides[0].mana).toBe(Math.min(120, before + 37));
    void me;
  });

  it('strands units after Rise, dealing 1 damage and forcing Wait', () => {
    // water level 2 over height-1 ground: everything is Shallow (Summoners wade);
    // Rise makes it Deep, which strands them.
    const s = createMatch(testMap(6, 6, () => ({ height: 1 }), 2));
    const me = getUnit(s, s.activeUnitId!);
    const r = applyTurn(s, { unitId: me.id, to: me.pos, facing: 0, command: { type: 'magic', ability: 'rise', target: me.pos } });
    expect(r.state.waterLevel).toBe(3);
    const st = r.state;
    const active = getUnit(st, st.activeUnitId!);
    expect(active.stranded).toBe(true);
    expect(active.hp).toBe(9);
    expect(validateTurn(st, { unitId: active.id, to: active.pos, facing: 0, command: { type: 'magic', ability: 'bolt', target: me.pos } })).toMatch(/stranded/);
    // no further Rise beyond +1
    expect(st.maxWaterLevel).toBe(3);
  });

  it('heals 1 HP at the start of a turn on a magic stone', () => {
    const s = createMatch(testMap(6, 6, (q, r) => (q === 2 && r === 2 ? { terrain: 'stone' } : {})));
    s.units.find((u) => u.side === 1)!.av = 500;
    const imp = place(s, 'imp', 0, 2, 2, 0, 1);
    imp.hp = 5;
    const me = getUnit(s, s.activeUnitId!);
    const r = applyTurn(s, { unitId: me.id, to: me.pos, facing: 0, command: { type: 'wait' } });
    expect(r.state.activeUnitId).toBe(imp.id);
    expect(getUnit(r.state, imp.id).hp).toBe(6);
  });

  it('ends the match when a summoner dies', () => {
    const s = createMatch(testMap(4, 4));
    const me = getUnit(s, s.activeUnitId!);
    const foe = s.units.find((u) => u.side === 1)!;
    foe.pos = hex(1, 3);
    foe.hp = 1;
    const r = applyTurn(s, { unitId: me.id, to: me.pos, facing: 0, command: { type: 'attack', target: foe.pos } });
    expect(r.state.winner).toBe(0);
  });

  it('projects a timeline with previewed delay for the active unit', () => {
    const s = createMatch(SCAFFOLD_MAP);
    const tl = projectTimeline(s, 12, 28);
    expect(tl).toHaveLength(12);
    expect(tl[0].unitId).not.toBe(s.activeUnitId); // other summoner acts at 06:28 too, before our new 28
    expect(tl.find((e) => e.preview)?.clock).toBe(s.clock + 28);
  });

  it('is deterministic: replaying the same actions yields the same state', () => {
    const play = () => {
      let st = createMatch(SCAFFOLD_MAP);
      for (let i = 0; i < 6; i++) {
        const u = getUnit(st, st.activeUnitId!);
        st = applyTurn(st, { unitId: u.id, to: u.pos, facing: u.facing, command: { type: 'wait' } }).state;
      }
      return JSON.stringify({ ...st, map: null });
    };
    expect(play()).toBe(play());
  });
});

describe('facing toward target and reach', () => {
  it('turns attackers toward their target; ties go to the preferred facing', async () => {
    const { facingTowardTarget, planAttack, planMagic, unitReach } = await import('./index');
    expect(facingTowardTarget(hex(0, 0), hex(3, 0), 4)).toBe(0);
    // (1,-2) is exactly between NE (1) and NW (2)
    expect(facingTowardTarget(hex(0, 0), hex(1, -2), 2)).toBe(2);
    expect(facingTowardTarget(hex(0, 0), hex(1, -2), 0)).toBe(1);

    const s = createMatch(testMap(8, 8));
    const me = getUnit(s, s.activeUnitId!); // (0,7)
    const foe = s.units.find((u) => u.side === 1)!;
    foe.pos = hex(2, 6);
    foe.facing = 0; // faces E: hitting from W (behind) is best
    const r = applyTurn(s, { unitId: me.id, to: hex(1, 6), facing: 3, command: { type: 'attack', target: foe.pos } });
    expect(getUnit(r.state, me.id).facing).toBe(0);

    const plan = planAttack(s, me, foe)!;
    expect(plan.dest).toEqual(hex(1, 6)); // directly behind the foe
    expect(plan.sources.length).toBeGreaterThan(1);
    const mplan = planMagic(s, me, foe)!; // Bolt 1–3
    const fm = (h: { q: number; r: number }) => { const m = facingModifier(foe.pos, foe.facing, h); return m.num / m.den; };
    const bestF = Math.max(...mplan.sources.map(fm));
    expect(fm(mplan.dest)).toBe(bestF);
    const farthest = Math.max(...mplan.sources.filter((h) => fm(h) === bestF).map((h) => hexDistance(h, foe.pos)));
    expect(hexDistance(mplan.dest, foe.pos)).toBe(farthest);
    const reach = unitReach(s, me);
    expect(reach.move.has(hexKey(hex(1, 6)))).toBe(true);
    expect(reach.magic.size).toBeGreaterThan(reach.attack.size);
  });

  it('never uses Slow without Swim; walkers have Move ≥ 4', () => {
    for (const k of SUMMONS) {
      if (k.moveTypes.includes('slow')) expect(k.moveTypes).toContain('swim');
      if (k.moveTypes.includes('walk')) expect(k.stats.mov).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('targeting without minimum range', () => {
  it('lets ranged attackers hit adjacent enemies; damage never aims at own hex; heals may include self', async () => {
    const { attackTargets, magicTargetHexes } = await import('./index');
    const s = createMatch(testMap(6, 6));
    const archer = place(s, 'archer', 0, 2, 2);
    place(s, 'imp', 1, 3, 2);
    expect(attackTargets(s, archer, archer.pos).map((u) => u.kind)).toContain('imp');
    // Newt's Steam Burst is radius 1: even with an enemy adjacent, it may not be aimed at the caster's hex
    const newt = place(s, 'newt', 0, 2, 4);
    place(s, 'imp', 1, 3, 4);
    const ab = kindOf('newt').magic[0];
    if (ab.kind === 'water') throw new Error('unexpected');
    expect(magicTargetHexes(s, newt, ab, newt.pos).some((h) => h.q === 2 && h.r === 4)).toBe(false);
    const undine = place(s, 'undine', 0, 0, 2);
    undine.hp = 6;
    const heal = kindOf('undine').magic[0];
    if (heal.kind === 'water') throw new Error('unexpected');
    expect(magicTargetHexes(s, undine, heal, undine.pos).some((h) => h.q === 0 && h.r === 2)).toBe(true);
  });
});
