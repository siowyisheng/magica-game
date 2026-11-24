import { describe, expect, it } from 'vitest';
import { applyTurn, createMatch, hex, SCAFFOLD_MAP, validateTurn, type MapDef, type MapHex } from '../rules';
import { autoLoadout, chooseAction } from './ai';
import { loadoutProblems, kindOf, randomLoadout, mulberry32, FAMILIARS } from '../rules';

describe('AI', () => {
  it('plays legal turns in a headless AI-vs-AI match', () => {
    let st = createMatch(SCAFFOLD_MAP, { ai: [true, true], seed: 7 });
    let turns = 0;
    const t0 = Date.now();
    while (st.winner === null && turns < 300) {
      const a = chooseAction(st);
      expect(validateTurn(st, a)).toBeNull();
      st = applyTurn(st, a).state;
      turns++;
    }
    const familiars = st.units.filter((u) => u.kind !== 'regent').length;
    console.log(`turns=${turns} winner=${st.winner} familiars=${familiars} clock=${st.clock} ms/turn=${((Date.now() - t0) / turns).toFixed(1)} stones=${st.stones.map((s) => s.owner).join(',')}`);
    expect(turns).toBeGreaterThan(10);
  }, 120000);

  it('plays legal turns on a map with Pits and Obstacles', () => {
    const hexes: MapHex[] = SCAFFOLD_MAP.hexes.map((h, i) => (i % 23 === 5 && h.terrain === 'plain' && h.height >= 3 ? { ...h, terrain: 'pit' } : h));
    const free = hexes.filter((h) => h.terrain === 'plain' && h.height >= 3 && !SCAFFOLD_MAP.spawns.some((s) => s.q === h.hex.q && s.r === h.hex.r));
    const map: MapDef = { ...SCAFFOLD_MAP, hexes, obstacles: free.filter((_, i) => i % 9 === 4).map((h, i) => ({ hex: h.hex, def: ([2, 4, 6] as const)[i % 3] })) };
    let st = createMatch(map, { ai: [true, true], seed: 3 });
    expect(st.obstacles.length).toBeGreaterThan(3);
    for (let turns = 0; st.winner === null && turns < 120; turns++) {
      const a = chooseAction(st);
      expect(validateTurn(st, a)).toBeNull();
      st = applyTurn(st, a).state;
    }
  }, 120000);

  it('breaks an Obstacle that blocks its only shot', () => {
    // a corridor: Sling (Direct) behind an Obstacle, the enemy Master beyond
    const hexes: MapHex[] = [];
    for (let r = 0; r < 3; r++) for (let q = 0; q < 9; q++) hexes.push({ hex: hex(q, r), height: 1, terrain: r === 1 ? 'plain' : 'pit' });
    const map: MapDef = { name: 't', hexes, waterLevel: 0, startClock: 360, spawns: [hex(0, 1), hex(8, 1)], spawnFacing: [0, 3], obstacles: [{ hex: hex(4, 1), def: 2 }] };
    const st = createMatch(map, { ai: [true, true] });
    st.units = st.units.filter((u) => u.side === 1);
    st.units.push({ id: 50, kind: 'sling', side: 0, pos: hex(3, 1), facing: 0, hp: 10, av: 0, stranded: false });
    st.units.forEach((u) => { if (u.id !== 50) u.av = 50; });
    st.obstacles[0].hp = 3;
    st.activeUnitId = 50;
    const a = chooseAction(st);
    expect(a.command).toEqual({ type: 'attack', target: hex(4, 1) });
  });

  it('builds valid Auto Loadouts and only summons from its Loadout', () => {
    for (const id of ['regent', 'efreet', 'selkie']) {
      const l = autoLoadout(id, () => 0.3);
      expect(loadoutProblems(l)).toEqual([]);
      const own = kindOf(id).element;
      if (own) expect(l.filter((k) => kindOf(k).element === own).length).toBe(5);
    }
    const heavy = randomLoadout(mulberry32(3));
    let st = createMatch(SCAFFOLD_MAP, { ai: [true, true], seed: 5, rosters: [heavy, heavy] });
    for (let i = 0; i < 80 && st.winner === null; i++) {
      const a = chooseAction(st);
      if (a.command.type === 'summon') expect(heavy).toContain(a.command.kind);
      st = applyTurn(st, a).state;
    }
  }, 60000);
});

describe('never playing for time', () => {
  it('values a position the same whatever the hour: Stones count for their Mana, not the Time Limit', async () => {
    const { evaluate } = await import('./ai');
    const { createMatch, SCAFFOLD_MAP } = await import('../rules');
    const s = createMatch(SCAFFOLD_MAP);
    s.stones = s.stones.map((st, i) => ({ ...st, owner: i % 3 === 0 ? 1 : 0 }));
    const early = evaluate(s, 0);
    const late = evaluate({ ...s, clock: s.timeLimit - 30 }, 0);
    expect(late).toBe(early);
  });
});

describe('healers', () => {
  it('kills the healer that keeps an unkillable enemy Master up, instead of poking the Master', () => {
    const hexes: MapHex[] = [];
    for (let r = 0; r < 8; r++) for (let q = 0; q < 8; q++) hexes.push({ hex: hex(q, r), height: 1, terrain: 'plain' });
    const map: MapDef = { name: 't', hexes, waterLevel: 0, startClock: 18 * 60, spawns: [hex(0, 7), hex(7, 0)], spawnFacing: [0, 3] };
    // a tough enemy Master (Templar, DEF 14): the Wolf can't kill it this turn, and the Mender heals more than the Wolf deals
    const s = createMatch(map, { masters: ['regent', 'templar'] });
    const mine = s.units.find((u) => u.side === 0)!;
    const theirs = s.units.find((u) => u.side === 1)!;
    mine.pos = hex(0, 7);
    theirs.pos = hex(4, 3);
    theirs.hp = 10;
    const mender = { id: 900, kind: 'undine', side: 1 as const, pos: hex(5, 3), facing: 3 as const, hp: 9, av: 5, stranded: false };
    const wolf = { id: 901, kind: 'wolf', side: 0 as const, pos: hex(4, 5), facing: 1 as const, hp: 10, av: 0, stranded: false };
    s.units.push(mender, wolf);
    for (const u of s.units) if (u.id !== wolf.id) u.av = Math.max(u.av, 5);
    s.activeUnitId = wolf.id;
    s.sides[1].mana = 60;
    const a = chooseAction(s);
    expect(validateTurn(s, a)).toBeNull();
    expect(a.command.type).toBe('attack');
    expect(a.command.type === 'attack' && a.command.target).toEqual(mender.pos);
  });
});

describe('Stones and pointless hits', () => {
  it('never Attacks or casts damage that deals 0', () => {
    let st = createMatch(SCAFFOLD_MAP, { ai: [true, true], seed: 11 });
    for (let turns = 0; st.winner === null && turns < 200; turns++) {
      const me = st.units.find((u) => u.id === st.activeUnitId)!;
      const a = chooseAction(st);
      const r = applyTurn(st, a);
      const c = a.command;
      const damaging = c.type === 'attack' || (c.type === 'magic' && kindOf(me.kind).magic.find((m) => m.id === c.ability)?.kind === 'damage');
      if (damaging) {
        const hurt = r.events.some((e) => e.type === 'damage' && e.amount > 0 && (st.units.find((u) => u.id === e.unitId)?.side ?? -1) !== me.side);
        expect(hurt, `${me.kind} ${JSON.stringify(c)}`).toBe(true);
      }
      st = r.state;
    }
  }, 60000);

  it('steps onto its own empty Stone when an enemy could take it next turn', () => {
    const hexes: MapHex[] = [];
    for (let r = 0; r < 5; r++) for (let q = 0; q < 14; q++) hexes.push({ hex: hex(q, r), height: 1, terrain: q === 4 && r === 2 ? 'stone' : 'plain' });
    const map: MapDef = { name: 't', hexes, waterLevel: 0, startClock: 600, spawns: [hex(0, 4), hex(13, 0)], spawnFacing: [0, 3] };
    const st = createMatch(map, { ai: [true, true] });
    st.stones[0].owner = 0;
    st.units.push({ id: 50, kind: 'imp', side: 0, pos: hex(2, 2), facing: 0, hp: 10, av: 0, stranded: false });
    st.units.push({ id: 51, kind: 'clod', side: 1, pos: hex(8, 2), facing: 3, hp: 10, av: 30, stranded: false });
    st.units.forEach((u) => { if (u.id !== 50) u.av = Math.max(u.av, 30); });
    st.activeUnitId = 50;
    expect(chooseAction(st).to).toEqual(hex(4, 2));
  });
});

describe('Plan: Defend (docs/ai-plan.md)', () => {
  const setup = (mana: number) => {
    const hexes: MapHex[] = [];
    for (let r = 0; r < 10; r++) for (let q = 0; q < 12; q++) hexes.push({ hex: hex(q, r), height: 1, terrain: 'plain' });
    const map: MapDef = { name: 't', hexes, waterLevel: 0, startClock: 600, spawns: [hex(1, 8), hex(10, 1)], spawnFacing: [0, 3] };
    const roster = FAMILIARS.map((k) => k.id).filter((id) => kindOf(id).element !== 'air').slice(0, 20);
    // a harmless enemy Master (Hermit), so the Vortex is the danger
    const st = createMatch(map, { ai: [true, true], masters: ['regent', 'hermit'], rosters: [roster, roster] });
    const me = st.units.find((u) => u.side === 0)!;
    // a Vortex two turns from killing the Regent, on an otherwise empty board
    st.units.push({ id: 77, kind: 'djinn', side: 1, pos: hex(7, 4), facing: 3, hp: 10, av: 20, stranded: false });
    st.units.forEach((u) => { if (u.id !== me.id) u.av = Math.max(u.av, 20); });
    me.av = 0;
    st.activeUnitId = me.id;
    st.sides[0].mana = mana;
    return st;
  };

  it('sees the Vortex as a threat and summons a Fire answer at once', async () => {
    const { makePlan } = await import('./plan');
    const st = setup(100);
    const p = makePlan(st, 0);
    expect(p.dominant).toBe('defend');
    expect(kindOf(p.threats[0].unit.kind).id).toBe('djinn');
    const a = chooseAction(st);
    expect(a.command.type).toBe('summon');
    if (a.command.type === 'summon') expect(kindOf(a.command.kind).element).toBe('fire');
  });

  it('with only 40 Mana, still summons a Fire answer (not a cheaper non-answer)', () => {
    const a = chooseAction(setup(40));
    expect(a.command.type).toBe('summon');
    if (a.command.type === 'summon') expect(kindOf(a.command.kind).element).toBe('fire');
  });
});

describe('Plan: Defend on a Magic Stone', () => {
  it('holds a Stone (cover and heal) under a moderate threat instead of running', () => {
    const hexes: MapHex[] = [];
    for (let r = 0; r < 12; r++) for (let q = 0; q < 14; q++) hexes.push({ hex: hex(q, r), height: 1, terrain: q === 4 && r === 7 ? 'stone' : 'plain' });
    const map: MapDef = { name: 't', hexes, waterLevel: 0, startClock: 600, spawns: [hex(4, 7), hex(13, 0)], spawnFacing: [0, 3] };
    // the enemy Master is slow and weak (Lich: ATK 5, Move 3), so the Salamander is the danger
    const st = createMatch(map, { ai: [true, true], masters: ['oracle', 'lich'], rosters: [[], []] });
    st.stones[0].owner = 0;
    const me = st.units.find((u) => u.side === 0)!;
    me.hp = 7;
    st.units.push({ id: 77, kind: 'salamander', side: 1, pos: hex(9, 5), facing: 3, hp: 10, av: 20, stranded: false });
    st.units.forEach((u) => { if (u.id !== me.id) u.av = Math.max(u.av, 20); });
    me.av = 0;
    st.activeUnitId = me.id;
    expect(chooseAction(st).to).toEqual(hex(4, 7));
  });
});

describe('a hurt Master in a replayed match (Duelist vs Warlock)', () => {
  it('hits the Comet its Cinder can finish before it acts, instead of running', async () => {
    const { readFileSync } = await import('node:fs');
    const { applyTemporaryBalance, endTemporaryBalance } = await import('../rules');
    const r = JSON.parse(readFileSync(new URL('./fixtures/comet-vs-warlock.replay.json', import.meta.url), 'utf8')).replay;
    applyTemporaryBalance(r.balance);
    try {
      let st = r.initial;
      // to Red's 4th turn: its Warlock at 6 HP, the Comet next to it, its Cinder acting before the Comet
      for (const a of r.actions.slice(0, 4)) st = applyTurn(st, a).state;
      const a = chooseAction(st);
      expect(a.unitId).toBe(2);
      expect(a.command).toEqual({ type: 'attack', target: { q: 6, r: 2 } });
    } finally {
      endTemporaryBalance();
    }
  });
});

describe('a Master judging hits by when they land (Gorgon vs Herald)', () => {
  it("doesn't step next to a Wyrm whose Meteor the next hour's Income pays for", async () => {
    const { readFileSync } = await import('node:fs');
    const { applyTemporaryBalance, endTemporaryBalance } = await import('../rules');
    const r = JSON.parse(readFileSync(new URL('./fixtures/gorgon-vs-herald.replay.json', import.meta.url), 'utf8')).replay;
    applyTemporaryBalance(r.balance);
    try {
      let st = r.initial;
      // 9:48: the Herald's side has 0 Mana, but its Income lands at 10:00, before its Wyrm and Sling act
      for (const a of r.actions.slice(0, 28)) st = applyTurn(st, a).state;
      expect(st.sides[1].mana).toBe(0);
      const a = chooseAction(st);
      expect(a.unitId).toBe(1);
      expect(a.to).not.toEqual({ q: 5, r: 6 }); // there, Sling 3 + Meteor 7 kill it
    } finally {
      endTemporaryBalance();
    }
  });
});

describe('a safe Master stages forward (Lamia vs Oracle)', () => {
  it('moves toward its objective from a back corner when no enemy is near', async () => {
    const { readFileSync } = await import('node:fs');
    const { applyTemporaryBalance, endTemporaryBalance, hexDistance } = await import('../rules');
    const { makePlan } = await import('./plan');
    const r = JSON.parse(readFileSync(new URL('./fixtures/lamia-vs-oracle.replay.json', import.meta.url), 'utf8')).replay;
    applyTemporaryBalance(r.balance);
    try {
      let st = r.initial;
      // 19:51: the Lamia at full HP in its back corner, well ahead, every enemy far off
      for (const a of r.actions.slice(0, 150)) st = applyTurn(st, a).state;
      const me = st.units.find((u: { id: number }) => u.id === st.activeUnitId)!;
      expect(me.id).toBe(1);
      const plan = makePlan(st, 0);
      expect(plan.posture.defend).toBe(0);
      const a = chooseAction(st);
      expect(hexDistance(a.to, plan.objective!)).toBeLessThanOrEqual(hexDistance(me.pos, plan.objective!) - 3);
    } finally {
      endTemporaryBalance();
    }
  });
});

describe('a Familiar counting enemy turns that tie with its own (Lancer vs Oracle)', () => {
  it("doesn't end where a Hydra acting twice first kills it", async () => {
    const { readFileSync } = await import('node:fs');
    const { applyTemporaryBalance, endTemporaryBalance } = await import('../rules');
    const r = JSON.parse(readFileSync(new URL('./fixtures/lancer-vs-oracle.replay.json', import.meta.url), 'utf8')).replay;
    applyTemporaryBalance(r.balance);
    try {
      let st = r.initial;
      // 10:25: the Taurus's next turn (11:07) ties with the Hydra's second, which the Hydra wins on Speed
      for (const a of r.actions.slice(0, 32)) st = applyTurn(st, a).state;
      const a = chooseAction(st);
      expect(a.unitId).toBe(18);
      expect(a.to).not.toEqual({ q: 12, r: 6 }); // there, the Hydra's hit (10) kills it
    } finally {
      endTemporaryBalance();
    }
  });
});

describe("a Master counting a hit it can't outrun twice (Savage vs Ronin)", () => {
  it("doesn't step into the reach of a Savage that would hit it again before it can escape", async () => {
    const { readFileSync } = await import('node:fs');
    const { applyTemporaryBalance, endTemporaryBalance } = await import('../rules');
    const r = JSON.parse(readFileSync(new URL('./fixtures/savage-vs-ronin.replay.json', import.meta.url), 'utf8')).replay;
    applyTemporaryBalance(r.balance);
    try {
      // 6:21, the first turn: the Savage (Move 5, Direct range 5) hits for 6 at (6,3), then again
      // before the Ronin (Move 3) can get out of its reach
      const a = chooseAction(r.initial);
      expect(a.unitId).toBe(2);
      expect(a.to).not.toEqual({ q: 6, r: 3 });
    } finally {
      endTemporaryBalance();
    }
  });

  it('summons a Familiar into the line of a Direct shot that would kill it', async () => {
    const { readFileSync } = await import('node:fs');
    const { applyTemporaryBalance, endTemporaryBalance } = await import('../rules');
    const r = JSON.parse(readFileSync(new URL('./fixtures/savage-vs-ronin.replay.json', import.meta.url), 'utf8')).replay;
    applyTemporaryBalance(r.balance);
    try {
      // 7:03, the replay's own line: the Ronin at 5 HP, every hex it can reach in the Savage's reach
      let st = r.initial;
      for (const a of r.actions.slice(0, 2)) st = applyTurn(st, a).state;
      const a = chooseAction(st);
      expect(a.command.type).toBe('summon');
      // the Savage's next turn: it can no longer shoot the Ronin
      const after = applyTurn(st, a).state;
      const savage = after.units.find((u: { kind: string }) => u.kind === 'savage')!;
      const ronin = after.units.find((u: { kind: string }) => u.kind === 'ronin')!;
      expect(ronin).toBeDefined();
      const shot = chooseAction(after);
      expect(shot.unitId).toBe(savage.id);
      if (shot.command.type === 'attack') expect(shot.command.target).not.toEqual(ronin.pos);
    } finally {
      endTemporaryBalance();
    }
  });
});

describe('vacated hexes, turn-order ties and Stone holders (Hermit vs Lich)', () => {
  const at = async (n: number) => {
    const { readFileSync } = await import('node:fs');
    const { applyTemporaryBalance } = await import('../rules');
    const r = JSON.parse(readFileSync(new URL('./fixtures/hermit-vs-lich.replay.json', import.meta.url), 'utf8')).replay;
    applyTemporaryBalance(r.balance);
    let st = r.initial;
    for (const a of r.actions.slice(0, n)) st = applyTurn(st, a).state;
    return st;
  };
  const done = async () => (await import('../rules')).endTemporaryBalance();

  it('counts the hex a Unit leaves as open to the enemy (the Halo leaving its Stone)', async () => {
    try {
      const st = await at(64);
      const a = chooseAction(st);
      // at (10,1) the Hydra steps onto the Stone it leaves and hits it: that's no refuge
      expect(a.unitId).toBe(20);
      expect(a.to).not.toEqual({ q: 10, r: 1 });
    } finally {
      await done();
    }
  });

  it('settles a tie with an enemy turn by the turn order: a faster Hydra kills the Comet first', async () => {
    try {
      const st = await at(55);
      const a = chooseAction(st);
      expect(a.unitId).toBe(27);
      expect(a.command).toEqual({ type: 'attack', target: { q: 4, r: 6 } });
    } finally {
      await done();
    }
  });

  it('kills the Comet holding an enemy Stone', async () => {
    try {
      const st = await at(48);
      const a = chooseAction(st);
      expect(a.unitId).toBe(27);
      expect(a.command).toEqual({ type: 'attack', target: { q: 4, r: 6 } });
    } finally {
      await done();
    }
  });
});

describe('the light scorer (for Hard\'s playouts)', () => {
  it('scores the same moves, cheaper, and Hard plays a legal move with it', async () => {
    const { rankCandidates, AI_WEIGHTS, LOOKAHEAD } = await import('./ai');
    const st = createMatch(SCAFFOLD_MAP, { ai: [true, true], seed: 3, masters: ['regent', 'lich'], rosters: [randomLoadout(mulberry32(1)), randomLoadout(mulberry32(2))] });
    let s = st;
    for (let i = 0; i < 12 && s.winner === null; i++) s = applyTurn(s, chooseAction(s, undefined, 'normal')).state;
    const full = rankCandidates(s, AI_WEIGHTS).candidates;
    const light = rankCandidates(s, AI_WEIGHTS, { light: true }).candidates;
    // the same moves are on the list (only their scores are rougher)
    expect(new Set(light.map((c) => `${c.action.to.q},${c.action.to.r}:${JSON.stringify(c.action.command)}`)).size).toBe(new Set(full.map((c) => `${c.action.to.q},${c.action.to.r}:${JSON.stringify(c.action.command)}`)).size);
    expect(LOOKAHEAD.light).toBe(true);
    const a = chooseAction(s, undefined, 'hard');
    expect(validateTurn(s, a)).toBeNull();
  });
});
