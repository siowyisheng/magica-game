import { describe, expect, it } from 'vitest';
import { applyTurn, createMatch, SCAFFOLD_MAP, validateTurn } from '../rules';
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
});
