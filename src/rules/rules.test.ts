import { withSpells } from '../testing/spells';
import { onTestFinished, describe, expect, it } from 'vitest';
import {
  applyTurn,
  computeDamage,
  createMatch,
  facingBonus,
  getUnit,
  hex,
  hexKey,
  kindOf,
  manaIncome,
  projectTimeline,
  reachable,
  ringPosition,
  SCAFFOLD_MAP,
  FAMILIARS,
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
import { ELEMENTS } from './data/familiars';
import { MANA_START } from './data/tuning';

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

describe('facing bonus', () => {
  it('is Front +0, Flank +1, Back +2 for adjacent hits', () => {
    const d = hex(0, 0);
    const bonus = (from: { q: number; r: number }) => facingBonus(d, 0, from);
    expect(bonus(hex(1, 0))).toBe(0); // in front (E)
    expect(bonus(hex(1, -1))).toBe(0); // 60°
    expect(bonus(hex(0, 1))).toBe(0); // 60° other side
    expect(bonus(hex(0, -1))).toBe(2); // 120°
    expect(bonus(hex(-1, 0))).toBe(2); // directly behind
  });

  it('puts ranged hits between hex directions into bands: under 90° +0, 90°–120° +1, 120°+ +2', () => {
    const v = hex(2, -1); // ring 2, halfway between E and NE → 30°
    expect(ringPosition(v)).toEqual({ p: 1, d: 2 });
    expect(facingBonus(hex(0, 0), 0, v)).toBe(0);
    expect(facingBonus(hex(0, 0), 0, hex(3, -1))).toBe(0); // 20°
    expect(facingBonus(hex(0, 0), 0, hex(-1, 2))).toBe(1); // 90°
    expect(facingBonus(hex(0, 0), 0, hex(-1, -1))).toBe(2); // 150°
  });
});

// ---------- turn delays ----------

describe('turn delay', () => {
  const k = (spd: number) => ({ ...kindOf('regent'), stats: { ...kindOf('regent').stats, spd } });
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
  it('gives every Master and Familiar its own id (ids also key the sprites)', async () => {
    const ids = [...(await import('./index')).MASTERS, ...FAMILIARS].map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has 10 familiars per element, one at each Cost from 16 to 88 in steps of 8', () => {
    expect(FAMILIARS).toHaveLength(40);
    for (const e of ELEMENTS) {
      const s = FAMILIARS.filter((x) => x.element === e);
      expect(s.map((x) => x.cost).sort((a, b) => a - b)).toEqual([16, 24, 32, 40, 48, 56, 64, 72, 80, 88]);
      // 3 aligned and 7 unaligned: Fire and Earth lean Day, Water and Air lean Night
      const [day, night] = e === 'fire' || e === 'earth' ? [2, 1] : [1, 2];
      expect(s.filter((x) => x.alignment === 'day')).toHaveLength(day);
      expect(s.filter((x) => x.alignment === 'night')).toHaveLength(night);
    }
  });

  it('gives a Magic Ability to at least 4 familiars of each Element, none to ranged attackers, and MP 0 to the rest', () => {
    for (const e of ELEMENTS) expect(FAMILIARS.filter((k) => k.element === e && k.magic.length === 1).length, e).toBeGreaterThanOrEqual(4);
    for (const k of FAMILIARS) if (k.attack.range > 1) expect(k.magic, k.id).toEqual([]);
    for (const k of FAMILIARS) if (!k.magic.length) expect(k.stats.mp, k.id).toBe(0);
  });

  it('uses short names, max-only ranges, and Familiar Magic costs of 4–16', () => {
    for (const k of FAMILIARS) {
      expect(k.name.length).toBeLessThanOrEqual(6);
      expect(k.attack).toEqual(k.attack.range > 1 ? { range: k.attack.range, trajectory: k.attack.trajectory } : { range: k.attack.range });
      if (k.attack.range > 1) expect(['high', 'direct']).toContain(k.attack.trajectory);
      expect(k.magic.length).toBeLessThanOrEqual(1);
      const m = k.magic[0];
      if (!m) continue;
      expect(m.manaCost).toBeGreaterThanOrEqual(4);
      expect(m.manaCost).toBeLessThanOrEqual(16);
      expect(m).not.toHaveProperty('minRange');
      expect(m).not.toHaveProperty('power');
    }
  });

  it('gives Masters walk+wade, most Earth familiars wade, and no Fire summon wade', () => {
    expect(kindOf('regent').moveTypes).toEqual(['walk', 'wade']);
    const earth = FAMILIARS.filter((x) => x.element === 'earth');
    expect(earth.filter((x) => x.moveTypes.includes('wade')).length).toBeGreaterThan(earth.length / 2);
    for (const f of FAMILIARS.filter((x) => x.element === 'fire')) expect(f.moveTypes).not.toContain('wade');
  });
});

// ---------- damage ----------

describe('damage', () => {
  it('is ATK − DEF + Element Bonus + Facing Bonus, never below 0', () => {
    const state = createMatch(testMap(6, 6));
    state.clock = 18 * 60; // neutral time
    const hound = place(state, 'hound', 0, 1, 1); // fire ATK 4
    const hawk = place(state, 'hawk', 1, 2, 1, 3); // air DEF 1, faces W toward the hound
    // 4 − 1 + 4 (fire counters air) + 0 (front) = 7
    expect(computeDamage(state, hound, hound.pos, hawk, 'physical').amount).toBe(7);

    // a Counter from behind: 3 + 4 + 2 = 9
    const hawk2 = place(state, 'hawk', 1, 4, 1, 0); // faces E, away from a hound at (3,1)
    const back = computeDamage(state, hound, hex(3, 1), hawk2, 'physical');
    expect(back.breakdown!.facing).toBe(2);
    expect(back.breakdown!.element).toBe(4);
    expect(back.amount).toBe(9);

    // Countered, even from behind: 4 − 5 − 4 + 2 = −3 → 0
    const crab = place(state, 'crab', 1, 3, 3, 0); // water DEF 5, faces E
    expect(computeDamage(state, hound, hex(2, 3), crab, 'physical').amount).toBe(0);

    // neutral (fire–earth): 4 − 2 = 2
    const clod = place(state, 'clod', 1, 2, 5, 3); // earth DEF 2, faces W
    expect(computeDamage(state, hound, hex(1, 5), clod, 'physical').amount).toBe(2);

    // same Element counts as neutral: 4 − 2 = 2
    const hound2 = place(state, 'hound', 1, 5, 3, 3); // fire DEF 2, faces W
    expect(computeDamage(state, hound, hex(4, 3), hound2, 'physical').amount).toBe(2);
  });

  it('every hit goes by the two Elements, Masters included (none: neutral)', () => {
    const state = createMatch(testMap(6, 6));
    state.clock = 18 * 60;
    const drake = place(state, 'drake', 0, 1, 1); // fire ATK 9
    const regent = place(state, 'regent', 1, 2, 1, 3); // Master with no Element, DEF 3, faces W
    // 9 − 3 + 0 = 6 (no Element: neutral)
    expect(computeDamage(state, drake, drake.pos, regent, 'physical').amount).toBe(6);
    const oni = place(state, 'oni', 0, 1, 4); // Master with no Element, ATK 9
    const golem = place(state, 'golem', 1, 2, 4, 3); // fire DEF 7, faces W
    // 9 − 7 + 0 = 2 (no Element: neutral)
    expect(computeDamage(state, oni, oni.pos, golem, 'physical').amount).toBe(2);
    const efreet = place(state, 'efreet', 0, 1, 2); // Fire Master
    const hawk = place(state, 'hawk', 1, 2, 2, 3); // air, faces W: Fire counters Air
    expect(computeDamage(state, efreet, efreet.pos, hawk, 'physical').breakdown!.element).toBe(4);
    // a Familiar hitting an Earth Master: Water is Countered by Earth
    const hydra = place(state, 'hydra', 0, 4, 1); // water ATK 10
    const dwarf = place(state, 'dwarf', 1, 5, 1, 3); // Earth Master DEF 5, faces W
    expect(computeDamage(state, hydra, hydra.pos, dwarf, 'physical').amount).toBe(1); // 10 − 5 − 4
    // Master against Master: by their Elements
    const oni2 = place(state, 'oni', 0, 4, 3); // no Element, ATK 9
    const dwarf2 = place(state, 'dwarf', 1, 5, 3, 3); // Earth, DEF 5
    expect(computeDamage(state, oni2, oni2.pos, dwarf2, 'physical').amount).toBe(4); // 9 − 5 + 0
    const sylph = place(state, 'sylph', 0, 4, 5); // Air Master, ATK 2 (Air counters Earth)
    const dwarf3 = place(state, 'dwarf', 1, 5, 5, 3);
    expect(computeDamage(state, sylph, sylph.pos, dwarf3, 'physical').amount).toBe(Math.max(0, kindOf('sylph').stats.atk - 5 + 4));
  });

  it('shows the full damage, past the remaining HP; HP stops at 0', () => {
    const state = createMatch(testMap(6, 6));
    state.clock = 18 * 60;
    const drake = place(state, 'drake', 0, 1, 1); // fire ATK 9
    const sylph = place(state, 'sylph', 1, 2, 1, 3); // Air Master DEF 1, faces W
    sylph.hp = 3;
    const e = computeDamage(state, drake, drake.pos, sylph, 'physical');
    expect(e.amount).toBe(12); // 9 − 1 + 4 (Fire counters Air), not capped at 3
    expect(e.lethal).toBe(true);
  });

  it('can deal 0 damage', () => {
    // air Sprite (ATK 2) into a fire Golem (DEF 7, counters air) on a Magic Stone
    const state = createMatch(testMap(6, 6, (q, r) => (q === 4 && r === 4 ? { terrain: 'stone' } : {})));
    state.clock = 22 * 60;
    const golem = place(state, 'golem', 1, 4, 4, 3);
    const sprite = place(state, 'sprite', 0, 3, 4);
    expect(computeDamage(state, sprite, sprite.pos, golem, 'physical').amount).toBe(0);
  });

  it('takes 1 off on rough and on magic stones', () => {
    const state = createMatch(testMap(6, 6, (q, r) => (q === 2 && r === 1 ? { terrain: 'rough' } : q === 2 && r === 2 ? { terrain: 'stone' } : {})));
    state.clock = 18 * 60;
    const a = place(state, 'oni', 0, 1, 1); // Master ATK 9
    const b = place(state, 'regent', 1, 2, 1, 3); // DEF 3
    // 9 − 3 + 0 (Master against Master, no Elements: neutral) = 6; rough → 5
    expect(computeDamage(state, a, a.pos, b, 'physical').amount).toBe(5);
    expect(computeDamage(state, a, a.pos, b, 'physical').breakdown!.cover).toBe(1);
    b.pos = hex(2, 2);
    a.pos = hex(1, 2);
    // stone → 5
    expect(computeDamage(state, a, a.pos, b, 'physical').amount).toBe(5);
    expect(computeDamage(state, a, a.pos, b, 'physical').breakdown!.cover).toBe(1);
  });

  it('applies day/night alignment as +1 / −1 to the stats', () => {
    const state = createMatch(testMap(6, 6));
    const archer = place(state, 'archer', 0, 1, 1); // day, ATK 7
    const sum = place(state, 'oni', 1, 3, 1, 3); // Master DEF 6, no Alignment
    state.clock = 18 * 60; // neutral: 7 − 6 = 1
    expect(computeDamage(state, archer, archer.pos, sum, 'physical').amount).toBe(1);
    state.clock = 12 * 60; // day: ATK 8 → 2
    expect(computeDamage(state, archer, archer.pos, sum, 'physical').amount).toBe(2);
    state.clock = 22 * 60; // night: ATK 6 → 0
    expect(computeDamage(state, archer, archer.pos, sum, 'physical').amount).toBe(0);
  });
});

// ---------- movement ----------

describe('movement', () => {
  it('charges rough and climbing correctly for walk and slow', () => {
    const state = createMatch(
      testMap(8, 3, (q) => (q === 1 ? { terrain: 'rough' } : q === 2 ? { height: 2 } : q === 3 ? { height: 4 } : {})),
    );
    state.units = [];
    const walker = place(state, 'regent', 0, 0, 1); // MOV 4, walk
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
  it('starts both masters with Base Delay; human first on ties', () => {
    const s = createMatch(SCAFFOLD_MAP);
    expect(s.clock).toBe(6 * 60 + 25); // Regent, SPD 13
    expect(getUnit(s, s.activeUnitId!).side).toBe(0);
  });

  it('summons next to the Master with facing and Move+Attack AV; costs mana', () => {
    const s = createMatch(testMap(6, 6));
    const me = getUnit(s, s.activeUnitId!);
    const { state, events } = applyTurn(s, { unitId: me.id, to: me.pos, facing: 0, command: { type: 'summon', kind: 'imp', dir: 1 } });
    const imp = state.units.find((u) => u.kind === 'imp')!;
    expect(imp.facing).toBe(1);
    expect(getUnit(state, me.id).facing).toBe(1);
    expect(state.sides[0].mana).toBeLessThan(MANA_START);
    expect(events.some((e) => e.type === 'summon')).toBe(true);
  });

  it('has no limit on how many Familiars a Side keeps on the map', () => {
    const s = createMatch(testMap(8, 8));
    const me = getUnit(s, s.activeUnitId!);
    for (let i = 0; i < 8; i++) place(s, 'imp', 0, 4 + (i % 4), 1 + Math.floor(i / 4));
    s.sides[0].mana = 120;
    const { state } = applyTurn(s, { unitId: me.id, to: me.pos, facing: 0, command: { type: 'summon', kind: 'imp', dir: 1 } });
    expect(state.units.filter((u) => u.side === 0 && u.kind === 'imp').length).toBe(9);
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

  it('pays 2 × (2 + stones) × MP − upkeep at each hour mark, clamped to [0,120]', () => {
    const s = createMatch(testMap(6, 6));
    expect(manaIncome(s, 0)).toBe(24); // Regent, MP 6
    s.stones = [{ hex: hex(3, 3), owner: 0 }];
    expect(manaIncome(s, 0)).toBe(36);
    place(s, 'drake', 0, 2, 2); // upkeep 11
    expect(manaIncome(s, 0)).toBe(25);
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
    expect(st.sides[0].mana).toBe(Math.min(120, before + 25));
    void me;
  });

  it('strands units after Rise, dealing 1 damage and forcing Wait', () => {
    onTestFinished(withSpells());
    // water level 2 over height-1 ground: everything is Shallow (Masters wade);
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

  it('ends the match when a master dies', () => {
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
    expect(tl[0].unitId).not.toBe(s.activeUnitId); // other master acts at 06:28 too, before our new 28
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
    onTestFinished(withSpells());
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
    expect(facingBonus(foe.pos, foe.facing, plan.dest)).toBe(2); // behind the foe (the Back band, 120° or more)
    expect(plan.sources.length).toBeGreaterThan(1);
    const mplan = planMagic(s, me, foe)!; // Bolt 1–3
    const fm = (h: { q: number; r: number }) => facingBonus(foe.pos, foe.facing, h);
    const bestF = Math.max(...mplan.sources.map(fm));
    expect(fm(mplan.dest)).toBe(bestF);
    const farthest = Math.max(...mplan.sources.filter((h) => fm(h) === bestF).map((h) => hexDistance(h, foe.pos)));
    expect(hexDistance(mplan.dest, foe.pos)).toBe(farthest);
    const reach = unitReach(s, me);
    expect(reach.move.has(hexKey(hex(1, 6)))).toBe(true);
    expect(reach.magic.size).toBeGreaterThan(reach.attack.size);
  });

  it('never uses Slow without Swim; walkers have Move ≥ 4', () => {
    for (const k of FAMILIARS) {
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
    // Dryad's Boulder is radius 1: even with an enemy adjacent, it may not be aimed at the caster's hex
    const dryad = place(s, 'dryad', 0, 2, 4);
    place(s, 'imp', 1, 3, 4);
    const ab = kindOf('dryad').magic[0];
    if (ab.kind === 'water') throw new Error('unexpected');
    expect(magicTargetHexes(s, dryad, ab, dryad.pos).some((h) => h.q === 2 && h.r === 4)).toBe(false);
    // a Burst is aimed at the caster's own hex, and only there
    const newt = place(s, 'newt', 0, 4, 4);
    place(s, 'imp', 1, 5, 4);
    const burst = kindOf('newt').magic[0];
    if (burst.kind === 'water') throw new Error('unexpected');
    expect(magicTargetHexes(s, newt, burst, newt.pos)).toEqual([newt.pos]);
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
  const withObstacle = (def: 2 | 4 | 6 = 4) => {
    const map = { ...testMap(7, 3), obstacles: [{ hex: hex(3, 1), def }] };
    const s = createMatch(map);
    s.units = [];
    return s;
  };

  it('block movement for ground units, can be flown over, and take damage with DEF = MDF', async () => {
    const { computeDamage: dmg } = await import('./index');
    const s = withObstacle(4);
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
    const s = withObstacle(2);
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
    s.obstacles.push({ id: 900, pos: hex(1, 1), def: 4, hp: 10 });
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

// ---------- Masters and balance overrides ----------

describe('masters', () => {
  it('has thirty Masters with short names, all walk + wade with no Magic Abilities, each on the Stat Budget', async () => {
    const { MASTERS, kindWarnings, budgetError } = await import('./index');
    expect(MASTERS).toHaveLength(30);
    expect(new Set(MASTERS.map((k) => k.id)).size).toBe(30);
    for (const k of MASTERS) {
      expect(k.name.length).toBeLessThanOrEqual(7);
      expect(k.moveTypes).toEqual(['walk', 'wade']);
      expect(k.magic).toEqual([]);
      expect(kindWarnings(k, MASTERS)).toEqual([]);
      expect(Math.abs(budgetError(k.stats, k.attack.range))).toBeLessThanOrEqual(0.3);
    }
    expect(new Set(MASTERS.map((k) => k.element).filter(Boolean)).size).toBe(4);
    expect(MASTERS.filter((k) => k.element).length).toBe(4);
    expect(MASTERS.filter((k) => k.alignment === 'day').length).toBe(2);
    expect(MASTERS.filter((k) => k.alignment === 'night').length).toBe(2);
    // MDF floor: none below 2, at most one below 3
    expect(Math.min(...MASTERS.map((k) => k.stats.mdf))).toBeGreaterThanOrEqual(2);
    expect(MASTERS.filter((k) => k.stats.mdf < 3).length).toBeLessThanOrEqual(1);
    const ranged = MASTERS.filter((k) => k.attack.range > 1);
    expect(ranged.map((k) => k.attack.range).sort()).toEqual([3, 4, 4, 5, 6]);
    expect(ranged.every((k) => k.attack.trajectory === (k.attack.range <= 4 ? 'direct' : 'high'))).toBe(true);
  });

  it('lets each Side start with its chosen Master', () => {
    const s = createMatch(SCAFFOLD_MAP, { masters: ['efreet', 'lich'] });
    expect(s.units.map((u) => u.kind)).toEqual(['efreet', 'lich']);
  });

  it('applies local overrides to the live roster and can reset them', async () => {
    const { setLocalOverrides, kindOf: k, FAMILIARS: roster, shippedKind } = await import('./index');
    const shipped = shippedKind('imp').stats.atk;
    setLocalOverrides({ imp: { stats: { ...k('imp').stats, atk: 20 } } });
    expect(k('imp').stats.atk).toBe(20);
    expect(roster.find((x) => x.id === 'imp')!.stats.atk).toBe(20);
    setLocalOverrides({});
    expect(k('imp').stats.atk).toBe(shipped);
  });

  it('summon kinds pass the design checks', async () => {
    const { FAMILIARS: roster, kindWarnings } = await import('./index');
    for (const kind of roster) expect(kindWarnings(kind, roster), kind.id).toEqual([]);
  });
});

describe('loadouts', () => {
  it('needs exactly 20 distinct Familiars', async () => {
    const { LOADOUT_SIZE, loadoutProblems } = await import('./index');
    expect(LOADOUT_SIZE).toBe(20);
    const twenty = FAMILIARS.slice(0, 20).map((k) => k.id);
    expect(loadoutProblems(twenty)).toEqual([]);
    expect(loadoutProblems(twenty.slice(0, 18))).not.toEqual([]);
    expect(loadoutProblems(['imp'])).not.toEqual([]);
  });

  it('only lets a Side Summon what is in its Loadout; no Loadout means all', async () => {
    const { activeUnit } = await import('./index');
    const swarm = FAMILIARS.filter((k) => k.cost <= 56).map((k) => k.id).slice(0, 20);
    const s = createMatch(SCAFFOLD_MAP, { rosters: [swarm, null] });
    const me = activeUnit(s)!;
    s.sides[me.side].mana = 120;
    const dir = ([0, 1, 2, 3, 4, 5] as const).find((d) => validateTurn(s, { unitId: me.id, to: me.pos, facing: d, command: { type: 'summon', kind: 'imp', dir: d } }) === null)!;
    const kraken = { unitId: me.id, to: me.pos, facing: dir, command: { type: 'summon' as const, kind: 'kraken', dir } };
    const imp = { ...kraken, command: { ...kraken.command, kind: 'imp' } };
    if (me.side === 0) {
      expect(validateTurn(s, kraken)).toMatch(/Loadout/);
      expect(validateTurn(s, imp)).toBeNull();
    } else {
      expect(validateTurn(s, kraken)).toBeNull();
    }
  });
});

describe('time limit', () => {
  it('ends the match 72 hours in: more Stones wins, then more HP, else a draw', async () => {
    const { advanceForTest } = await import('./match');
    const mk = () => {
      const s = createMatch(SCAFFOLD_MAP);
      s.clock = s.timeLimit - 5;
      for (const u of s.units) u.av = 10;
      return s;
    };
    let s = mk();
    s.stones[0].owner = 1;
    advanceForTest(s);
    expect(s.winner).toBe(1);
    s = mk();
    s.units[0].hp = 4;
    advanceForTest(s);
    expect(s.winner).toBe(1);
    s = mk();
    advanceForTest(s);
    expect(s.winner).toBe('draw');
    expect(s.clock).toBe(s.timeLimit);
  });
});

// ---------- Burst and area Facing ----------

describe('Burst and area Magic', () => {
  it('a Burst hits every Unit within its radius, allies included, but not the caster', async () => {
    const { getLocalBalance, setLocalBalance } = await import('./index');
    const before = getLocalBalance();
    try {
      setLocalBalance({
        kinds: { golem: { magicIds: ['test-burst'], stats: { ...kindOf('golem').stats, mp: 20 } } },
        abilities: { 'test-burst': { id: 'test-burst', name: 'Test Burst', kind: 'damage', range: 0, radius: 2, manaCost: 4, burst: true } },
      });
      const state = createMatch(testMap(8, 8));
      state.units = state.units.filter((u) => kindOf(u.kind).isMaster);
      for (const u of state.units) u.pos = u.side === 0 ? hex(0, 7) : hex(7, 0);
      const caster = place(state, 'golem', 0, 3, 3);
      const ally = place(state, 'clod', 0, 5, 3); // 2 away
      const foe = place(state, 'imp', 1, 3, 4); // 1 away
      const far = place(state, 'imp', 1, 6, 3); // 3 away
      state.sides[0].mana = 50;
      activate(state, caster);
      const action = { unitId: caster.id, to: caster.pos, facing: 0 as const, command: { type: 'magic' as const, ability: 'test-burst', target: caster.pos } };
      expect(validateTurn(state, action)).toBeNull();
      const { state: after } = applyTurn(state, action);
      const hp = (id: number) => after.units.find((u) => u.id === id)?.hp ?? 0;
      expect(hp(caster.id)).toBe(10);
      expect(hp(ally.id)).toBeLessThan(10);
      expect(hp(foe.id)).toBeLessThan(10);
      expect(hp(far.id)).toBe(10);
    } finally {
      setLocalBalance(before);
    }
  });

  it('a High area spell splashes with Facing measured from the hex it landed on', async () => {
    const { magicHitOrigin } = await import('./index');
    const lob = { id: 'lob', name: 'Lob', kind: 'damage', range: 4, radius: 1, manaCost: 6, trajectory: 'high' } as const;
    const direct = { ...lob, trajectory: 'direct' } as const;
    const caster = hex(0, 0);
    const aim = hex(3, 0);
    const splashed = { pos: hex(4, 0) } as Unit;
    const centre = { pos: aim } as Unit;
    expect(magicHitOrigin(lob, caster, aim, splashed)).toEqual(aim);
    expect(magicHitOrigin(lob, caster, aim, centre)).toEqual(caster);
    expect(magicHitOrigin(direct, caster, aim, splashed)).toEqual(caster);
  });
});

describe('random Loadouts', () => {
  it('draws 20 valid Familiars with at least 2 of the Elements’ cheapest, and varies', async () => {
    const { randomLoadout, cheapestPerElement, loadoutProblems, mulberry32, FAMILIARS: roster, kindOf: k } = await import('./index');
    const cheap = cheapestPerElement();
    expect(cheap).toHaveLength(4);
    for (const id of cheap) {
      const el = k(id).element;
      expect(Math.min(...roster.filter((x) => x.element === el).map((x) => x.cost))).toBe(k(id).cost);
    }
    const rng = mulberry32(7);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const l = randomLoadout(rng);
      expect(loadoutProblems(l)).toEqual([]);
      expect(l.filter((id) => cheap.includes(id)).length).toBeGreaterThanOrEqual(2);
      seen.add([...l].sort().join());
    }
    expect(seen.size).toBeGreaterThan(150);
  });
});

describe('Empower', () => {
  it("adds +3 ATK to a friendly unit (or the caster) until its next Attack, which uses it up", () => {
    const state = createMatch(testMap(8, 8));
    state.clock = 18 * 60;
    state.units = state.units.filter((u) => kindOf(u.kind).isMaster);
    for (const u of state.units) u.pos = u.side === 0 ? hex(0, 7) : hex(7, 0);
    const kindle = place(state, 'wisp', 0, 3, 3);
    const ally = place(state, 'hound', 0, 4, 3);
    const foe = place(state, 'clod', 1, 5, 3, 3);
    expect(kindOf('wisp').magic.map((m) => m.id)).toEqual(['empower']);
    state.sides[0].mana = 50;
    activate(state, kindle);
    // an enemy can't be Empowered
    expect(validateTurn(state, { unitId: kindle.id, to: kindle.pos, facing: 0, command: { type: 'magic', ability: 'empower', target: hex(5, 3) } })).not.toBeNull();
    const before = computeDamage(state, ally, ally.pos, foe, 'physical').amount;
    const r = applyTurn(state, { unitId: kindle.id, to: kindle.pos, facing: 0, command: { type: 'magic', ability: 'empower', target: ally.pos } });
    expect(r.events.some((e) => e.type === 'empower' && e.unitId === ally.id && e.amount === 3)).toBe(true);
    expect(r.state.sides[0].mana).toBe(46);
    const s2 = r.state;
    const a2 = getUnit(s2, ally.id);
    expect(a2.empowered).toBe(3);
    expect(computeDamage(s2, a2, a2.pos, getUnit(s2, foe.id), 'physical').amount).toBe(before + 3);
    // Magic doesn't use it up; an Attack does
    activate(s2, a2);
    const r2 = applyTurn(s2, { unitId: a2.id, to: a2.pos, facing: 0, command: { type: 'attack', target: hex(5, 3) } });
    expect(r2.events.find((e) => e.type === 'damage')).toMatchObject({ amount: before + 3 });
    expect(getUnit(r2.state, ally.id).empowered).toBeUndefined();
    // the caster may Empower itself; a second Empower doesn't stack
    const s3 = r2.state;
    activate(s3, getUnit(s3, kindle.id));
    s3.sides[0].mana = 50;
    const self = { unitId: kindle.id, to: getUnit(s3, kindle.id).pos, facing: 0 as const, command: { type: 'magic' as const, ability: 'empower', target: getUnit(s3, kindle.id).pos } };
    expect(validateTurn(s3, self)).toBeNull();
    const r3 = applyTurn(s3, self);
    expect(getUnit(r3.state, kindle.id).empowered).toBe(3);
    activate(r3.state, getUnit(r3.state, kindle.id));
    expect(getUnit(applyTurn(r3.state, { ...self, to: getUnit(r3.state, kindle.id).pos }).state, kindle.id).empowered).toBe(3);
  });
});
