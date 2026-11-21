// Times Hard turns on mid-game positions.
//   npx vitest run --config scripts/vitest.config.ts scripts/hardtime.run.ts
import { it } from 'vitest';
import { SCAFFOLD_MAP, STARTER_LOADOUTS, applyTurn, createMatch } from '../src/rules';
import { chooseAction } from '../src/ai/ai';

it('times Hard', () => {
  const lo = [...STARTER_LOADOUTS[0].summons];
  let st = createMatch(SCAFFOLD_MAP, { ai: [true, true], seed: 9, summoners: ['regent', 'oni'], rosters: [lo, lo] });
  const times: number[] = [];
  for (let t = 0; t < 160 && st.winner === null; t++) {
    const t0 = performance.now();
    const a = chooseAction(st, undefined, t >= 60 && t % 4 === 0 ? 'hard' : 'normal');
    if (t >= 60 && t % 4 === 0) times.push(performance.now() - t0);
    st = applyTurn(st, a).state;
  }
  times.sort((a, b) => a - b);
  console.log(`HARD n=${times.length} median ${times[times.length >> 1]?.toFixed(0)} ms, p90 ${times[Math.floor(times.length * 0.9)]?.toFixed(0)} ms, max ${times[times.length - 1]?.toFixed(0)} ms`);
});
