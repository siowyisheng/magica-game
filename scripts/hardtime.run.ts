// Times Hard turns on mid-game positions.
//   npx vitest run --config scripts/vitest.config.ts scripts/hardtime.run.ts
import { it } from 'vitest';
import { generateRandomMap, applyTurn, createMatch } from '../src/rules';
import { autoLoadout, chooseAction } from '../src/ai/ai';

it('times Hard', () => {
  const lo = autoLoadout('regent', () => 0.3);
  let st = createMatch(generateRandomMap(9), { ai: [true, true], seed: 9, masters: ['regent', 'oni'], rosters: [lo, lo], signatures: [lo[0], lo[1]] });
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
