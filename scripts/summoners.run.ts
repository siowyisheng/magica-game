// Generate the Summoner roster: tries seeds and prints the most diverse one
// as data for src/rules/data/summoner.ts.
//   npx vitest run --config scripts/vitest.config.ts scripts/summoners.run.ts
import { it } from 'vitest';
import { budgetError, generateRoster, rosterSpread, STAT_BUDGET } from '../src/rules/statgen';
import { SUMMONER_NAMES } from '../src/rules/data/summonerNames';

it('generates the roster', () => {
  let best = { seed: 0, spread: -1 };
  for (let seed = 1; seed <= Number(process.env.SEEDS ?? 300); seed++) {
    const spread = rosterSpread(generateRoster(seed, SUMMONER_NAMES));
    if (spread > best.spread) best = { seed, spread };
  }
  const roster = generateRoster(best.seed, SUMMONER_NAMES);
  console.log(`seed ${best.seed}, min distance ${best.spread.toFixed(2)}; budget total ${STAT_BUDGET.total.toFixed(2)}`);
  for (const r of roster) {
    const s = r.stats;
    console.log(
      `  ['${r.name.toLowerCase()}', '${r.name}', [${s.atk}, ${s.def}, ${s.mp}, ${s.mdf}, ${s.spd}, ${s.mov}], ${r.range}${r.trajectory ? `, '${r.trajectory}'` : r.element || r.alignment !== 'none' ? ', undefined' : ''}${r.element ? `, '${r.element}'` : r.alignment !== 'none' ? ', null' : ''}${r.alignment !== 'none' ? `, '${r.alignment}'` : ''}], // ${budgetError(s, r.range) >= 0 ? '+' : ''}${budgetError(s, r.range).toFixed(2)} · ${r.look}`,
    );
  }
});
