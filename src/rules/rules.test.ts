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
  isStranded,
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
  const k = (spd: number) => ({ ...kindOf('sigil'), stats: { ...kindOf('sigil').stats, spd } });
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
      expect(k.attack).toEqual(k.attack.range > 1 ? { range: k.attack.range, trajectory: k.attack.trajectory } : { range: k.attack.range });
      if (k.attack.range > 1) expect(['high', 'direct']).toContain(k.attack.trajectory);
      const m = k.magic[0];
      expect(m.manaCost).toBeGreaterThanOrEqual(4);
      expect(m.manaCost).toBeLessThanOrEqual(16);
      expect(m).not.toHaveProperty('minRange');
      expect(m).not.toHaveProperty('power');
    }
  });

  it('gives Summoners walk+wade, most Earth summons wade, and no Fire summon wade', () => {
    expect(kindOf('sigil').moveTypes).toEqual(['walk', 'wade']);
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
    const a = place(state, 'sigil', 0, 1, 1);
    const b = place(state, 'sigil', 1, 2, 1, 3);
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
    const sum = place(state, 'sigil', 1, 3, 1, 3); // DEF 10
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
    const walker = place(state, 'sigil', 0, 0, 1); // MOV 4, walk
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
    expect(attackTargets(s, archer, archer.pos).map((u) => ('kind' in u ? u.kind : 'obstacle'))).toContain('imp');
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

describe('water level bounds and map water rules', () => {
  it('Ebb goes at most 1 below the start; the scaffold map keeps Deep Water and floods ≤ 40% on Rise', async () => {
    const { validateMapWater } = await import('./index');
    const s = createMatch(SCAFFOLD_MAP);
    expect(s.minWaterLevel).toBe(SCAFFOLD_MAP.waterLevel - 1);
    expect(s.maxWaterLevel).toBe(SCAFFOLD_MAP.waterLevel + 1);
    expect(validateMapWater(SCAFFOLD_MAP)).toEqual([]);
  });
});

describe('stranded movement', () => {
  it('a stranded unit may move into hexes it can enter and act; staying put allows only Wait', async () => {
    const { validateTurn, reachable } = await import('./index');
    // shark (swim only) stranded on land next to water
    const s = createMatch(testMap(6, 6, (q) => (q >= 3 ? { height: 0 } : { height: 2 }), 2));
    const shark = place(s, 'shark', 0, 2, 2, 0, 0);
    shark.stranded = true;
    activate(s, shark);
    const foe = place(s, 'imp', 1, 5, 2);
    void foe;
    const nodes = reachable(s, shark);
    expect(nodes.get(hexKey(hex(3, 2)))?.canEnd).toBe(true);
    expect(validateTurn(s, { unitId: shark.id, to: shark.pos, facing: 0, command: { type: 'attack', target: hex(3, 2) } })).toMatch(/only Wait/);
    expect(validateTurn(s, { unitId: shark.id, to: hex(4, 2), facing: 0, command: { type: 'attack', target: hex(5, 2) } })).toBeNull();
    expect(validateTurn(s, { unitId: shark.id, to: shark.pos, facing: 0, command: { type: 'wait' } })).toBeNull();
  });

  it('slow+swim units are never stranded', () => {
    const land = createMatch(testMap(3, 3, () => ({ height: 3 }), 2));
    const crab = place(land, 'crab', 0, 1, 1);
    const water = createMatch(testMap(3, 3, () => ({ height: -1 }), 2));
    const crab2 = place(water, 'crab', 0, 1, 1);
    expect(isStranded(land, crab)).toBe(false);
    expect(isStranded(water, crab2)).toBe(false);
  });
});

describe('alignment never changes Speed or Move', () => {
  it('keeps Turn Delay and Move Range identical at day and night', async () => {
    const { delayForAction, reachable } = await import('./index');
    const at = (clock: number) => {
      const s = createMatch(testMap(8, 8));
      s.clock = clock;
      s.units = s.units.filter((u) => u.side === 0);
      const sprite = place(s, 'sprite', 0, 3, 3, 0, 0); // day-aligned
      activate(s, sprite);
      return {
        delay: delayForAction(s, { unitId: sprite.id, to: hex(4, 3), command: { type: 'wait' } }),
        range: [...reachable(s, sprite).keys()].sort().join(' '),
      };
    };
    expect(at(12 * 60)).toEqual(at(22 * 60)); // day vs night
  });
});

// ---------- Pits, Obstacles, Trajectory and Clear Angle ----------

describe('pits', () => {
  it('cannot be entered or stood on by ground units; Fly crosses but cannot stop', () => {
    const map = testMap(6, 3, (q) => (q === 2 ? { terrain: 'pit' } : {}));
    const s = createMatch(map);
    s.units = [];
    const imp = place(s, 'imp', 0, 1, 1);
    const sprite = place(s, 'sprite', 0, 1, 0);
    const walk = reachable(s, imp);
    expect([...walk.values()].some((n) => n.hex.q >= 2)).toBe(false);
    const fly = reachable(s, sprite);
    expect(fly.get(hexKey(hex(2, 0)))?.canEnd).toBe(false);
    expect(fly.get(hexKey(hex(3, 0)))?.canEnd).toBe(true);
  });

  it('never fill with water and are left out of the water rules', async () => {
    const { validateMapWater } = await import('./index');
    // pit at height -5 would otherwise be Deep Water
    const map = testMap(6, 6, (q, r) => (q === 0 && r === 0 ? { terrain: 'pit', height: -5 } : {}), 0);
    const s = createMatch(map);
    expect(s.hasWater).toBe(false);
    expect(validateMapWater(map)).toEqual([]);
  });
});

describe('obstacles', () => {
  const withObstacle = (def: 5 | 10 | 15 = 10) => {
    const map = { ...testMap(7, 3), obstacles: [{ hex: hex(3, 1), def }] };
    const s = createMatch(map);
    s.units = [];
    return s;
  };

  it('block movement for ground units, can be flown over, and take damage with DEF = MDF', async () => {
    const { computeDamage: dmg } = await import('./index');
    const s = withObstacle(10);
    const golem = place(s, 'golem', 0, 2, 1);
    expect(reachable(s, golem).has(hexKey(hex(3, 1)))).toBe(false);
    const hawk = place(s, 'hawk', 0, 2, 0);
    expect(reachable(s, hawk).get(hexKey(hex(3, 1)))?.canEnd).toBe(false);
    const o = s.obstacles[0];
    // no Facing, no Element: hit from any side for the same damage
    const a = dmg(s, golem, hex(2, 1), o, 'physical').amount;
    const b = dmg(s, golem, hex(4, 1), o, 'physical').amount;
    expect(a).toBe(b);
    // ATK 16 vs DEF 10 → round(3 × 16 / 10) = 5
    expect(a).toBe(5);
  });

  it('are destroyed at 0 HP, freeing the hex', () => {
    const s = withObstacle(5);
    const golem = place(s, 'golem', 0, 2, 1, 0, 0);
    s.obstacles[0].hp = 2;
    activate(s, golem);
    const { state } = applyTurn(s, { unitId: golem.id, to: golem.pos, facing: 0, command: { type: 'attack', target: hex(3, 1) } });
    expect(state.obstacles).toHaveLength(0);
    const g2 = getUnit(state, golem.id);
    expect(reachable(state, g2).has(hexKey(hex(3, 1)))).toBe(true);
  });
});

describe('trajectory and clear angle', () => {
  it('Direct shots are blocked by a unit or obstacle in between; High shots are not', async () => {
    const { attackTargets, clearShot } = await import('./index');
    const s = withLine();
    const sling = place(s, 'sling', 0, 0, 1); // Direct, range 3
    const archer = place(s, 'archer', 0, 0, 0); // High, range 3
    const foe = place(s, 'imp', 1, 3, 1);
    // nothing in between
    expect(clearShot(s, sling.id, sling.pos, foe.pos)).toBe(true);
    // an Obstacle straight in the line of fire
    s.obstacles.push({ id: 900, pos: hex(1, 1), def: 10, hp: 10 });
    expect(attackTargets(s, sling, sling.pos).some((t) => t.id === foe.id)).toBe(false);
    // High arcs over it (archer at (0,0) to (3,0)... aim at foe through the obstacle row)
    const foe2 = place(s, 'imp', 1, 2, 1);
    expect(attackTargets(s, archer, archer.pos).some((t) => t.id === foe2.id)).toBe(true);
    // allies block Direct shots too
    s.obstacles = [];
    place(s, 'clod', 0, 1, 1);
    expect(attackTargets(s, sling, sling.pos).some((t) => t.id === foe.id)).toBe(false);
  });

  it('a body beside the line does not block when there is room to shoot past it', async () => {
    const { clearShot } = await import('./index');
    const s = withLine();
    const sling = place(s, 'sling', 0, 0, 1);
    // target 2 hexes away diagonally; a unit next to the line, not on it
    place(s, 'imp', 1, 1, 2);
    expect(clearShot(s, sling.id, sling.pos, hex(2, 0))).toBe(true);
  });

  it('Direct Magic also needs a Clear Angle', async () => {
    const { magicTargetHexes } = await import('./index');
    const s = withLine();
    const siren = place(s, 'siren', 0, 0, 1); // Water Jet: Direct, range 4
    place(s, 'imp', 1, 3, 1);
    const ab = kindOf('siren').magic[0];
    if (ab.kind === 'water') throw new Error('unexpected');
    expect(ab.trajectory).toBe('direct');
    expect(magicTargetHexes(s, siren, ab, siren.pos).some((h) => h.q === 3 && h.r === 1)).toBe(true);
    place(s, 'clod', 1, 2, 1);
    expect(magicTargetHexes(s, siren, ab, siren.pos).some((h) => h.q === 3 && h.r === 1)).toBe(false);
  });
});

function withLine(): MatchState {
  const s = createMatch(testMap(7, 3));
  s.units = [];
  return s;
}

// ---------- Summoners and balance overrides ----------

describe('summoners', () => {
  it('has ten Summoners with short names, all walk + wade with Bolt, Rise and Ebb', async () => {
    const { SUMMONERS, kindWarnings } = await import('./index');
    expect(SUMMONERS).toHaveLength(10);
    expect(new Set(SUMMONERS.map((k) => k.id)).size).toBe(10);
    for (const k of SUMMONERS) {
      expect(k.name.length).toBeLessThanOrEqual(7);
      expect(k.moveTypes).toEqual(['walk', 'wade']);
      expect(k.magic.map((m) => m.id)).toEqual(['bolt', 'rise', 'ebb']);
      expect(kindWarnings(k, SUMMONERS)).toEqual([]);
    }
    expect(SUMMONERS.filter((k) => k.element).length).toBe(2);
    expect(SUMMONERS.filter((k) => k.alignment !== 'none').length).toBe(2);
  });

  it('lets each Side start with its chosen Summoner', () => {
    const s = createMatch(SCAFFOLD_MAP, { summoners: ['cinder', 'orrery'] });
    expect(s.units.map((u) => u.kind)).toEqual(['cinder', 'orrery']);
  });

  it('applies local overrides to the live roster and can reset them', async () => {
    const { setLocalOverrides, kindOf: k, SUMMONS: roster } = await import('./index');
    setLocalOverrides({ imp: { stats: { ...k('imp').stats, atk: 20 } } });
    expect(k('imp').stats.atk).toBe(20);
    expect(roster.find((x) => x.id === 'imp')!.stats.atk).toBe(20);
    setLocalOverrides({});
    expect(k('imp').stats.atk).toBe(13);
  });

  it('summon kinds pass the design checks', async () => {
    const { SUMMONS: roster, kindWarnings } = await import('./index');
    for (const kind of roster) expect(kindWarnings(kind, roster), kind.id).toEqual([]);
  });
});
