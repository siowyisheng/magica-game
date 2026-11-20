import { describe, expect, it } from 'vitest';
import { applyTurn, createMatch, hex, SCAFFOLD_MAP, validateTurn, type MapDef, type MapHex } from '../rules';
import { chooseAction } from './ai';

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
    const summons = st.units.filter((u) => u.kind !== 'summoner').length;
    console.log(`turns=${turns} winner=${st.winner} summons=${summons} clock=${st.clock} ms/turn=${((Date.now() - t0) / turns).toFixed(1)} stones=${st.stones.map((s) => s.owner).join(',')}`);
    expect(turns).toBeGreaterThan(10);
  }, 120000);

  it('plays legal turns on a map with Pits and Obstacles', () => {
    const hexes: MapHex[] = SCAFFOLD_MAP.hexes.map((h, i) => (i % 23 === 5 && h.terrain === 'plain' && h.height >= 3 ? { ...h, terrain: 'pit' } : h));
    const free = hexes.filter((h) => h.terrain === 'plain' && h.height >= 3 && !SCAFFOLD_MAP.spawns.some((s) => s.q === h.hex.q && s.r === h.hex.r));
    const map: MapDef = { ...SCAFFOLD_MAP, hexes, obstacles: free.filter((_, i) => i % 9 === 4).map((h, i) => ({ hex: h.hex, def: ([5, 10, 15] as const)[i % 3] })) };
    let st = createMatch(map, { ai: [true, true], seed: 3 });
    expect(st.obstacles.length).toBeGreaterThan(3);
    for (let turns = 0; st.winner === null && turns < 120; turns++) {
      const a = chooseAction(st);
      expect(validateTurn(st, a)).toBeNull();
      st = applyTurn(st, a).state;
    }
  }, 120000);

  it('breaks an Obstacle that blocks its only shot', () => {
    // a corridor: Sling (Direct) behind an Obstacle, the enemy Summoner beyond
    const hexes: MapHex[] = [];
    for (let r = 0; r < 3; r++) for (let q = 0; q < 9; q++) hexes.push({ hex: hex(q, r), height: 1, terrain: r === 1 ? 'plain' : 'pit' });
    const map: MapDef = { name: 't', hexes, waterLevel: 0, startClock: 360, spawns: [hex(0, 1), hex(8, 1)], spawnFacing: [0, 3], obstacles: [{ hex: hex(4, 1), def: 5 }] };
    const st = createMatch(map, { ai: [true, true] });
    st.units = st.units.filter((u) => u.side === 1);
    st.units.push({ id: 50, kind: 'sling', side: 0, pos: hex(3, 1), facing: 0, hp: 10, av: 0, stranded: false });
    st.units.forEach((u) => { if (u.id !== 50) u.av = 50; });
    st.obstacles[0].hp = 3;
    st.activeUnitId = 50;
    const a = chooseAction(st);
    expect(a.command).toEqual({ type: 'attack', target: hex(4, 1) });
  });
});
