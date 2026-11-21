// Generate the Summon roster from the slots: prints the roster, and writes
// the data rows for src/rules/data/summons.ts to scripts/summons.out.txt
// (seed 2 is the shipped roster; set SEED=0 to search the first 20 seeds).
//   SEED=2 npx vitest run --config scripts/vitest.config.ts scripts/summons.run.ts
import { it } from 'vitest';
import { generateSummonRoster, lastRosterScore, predictCost, SUMMON_COST, REFERENCE_SUMMONS } from '../src/rules/summongen';
import { SUMMON_NAMES, SUMMON_SLOTS } from '../src/rules/data/summonSlots';

export const RULES = {
  withMagic: 18,
  alignments: { fire: { day: 2, night: 1 }, earth: { day: 2, night: 1 }, water: { day: 1, night: 2 }, air: { day: 1, night: 2 } },
} as const;

it('generates the Summons', () => {
  console.log('model', Object.fromEntries(Object.entries(SUMMON_COST).map(([k, v]) => [k, +v.toFixed(2)])));
  console.log('refs', REFERENCE_SUMMONS.filter((r) => !r.excluded).map((r) => `${r.name} ${(predictCost(r) - r.cost).toFixed(0)}`).join(', '));
  let seed = Number(process.env.SEED ?? 2);
  if (!seed) {
    // choose the best-scoring of the first 20 seeds
    let best = -Infinity;
    for (let k = 1; k <= 20; k++) {
      try {
        generateSummonRoster(k, SUMMON_SLOTS, SUMMON_NAMES, RULES, 400);
      } catch {
        continue; // no roster met the rules for this seed
      }
      if (lastRosterScore > best) (best = lastRosterScore), (seed = k);
    }
  }
  const roster = generateSummonRoster(seed, SUMMON_SLOTS, SUMMON_NAMES, RULES, 400);
  console.log(`seed ${seed}, score ${lastRosterScore.toFixed(1)}`);
  for (const g of roster) {
    const s = g.stats;
    const m = g.magic ? `${g.magic.kind}${g.magic.burst ? ' burst' : ''} r${g.magic.range}${g.magic.radius ? ` a${g.magic.radius}` : ''}${g.magic.trajectory ? ` ${g.magic.trajectory}` : ''} ${g.magic.manaCost}mp` : '-';
    console.log(`${g.element.padEnd(5)} ${String(g.cost).padStart(2)} ${g.id.padEnd(7)} ${g.name.padEnd(7)} ${g.alignment.padEnd(5)} ${g.role.padEnd(12)} ${[s.atk, s.def, s.mp, s.mdf, s.spd, s.mov].join('/').padEnd(18)} ${g.moveTypes.join('+').padEnd(10)} atk ${g.attack.range}${g.attack.trajectory ? ' ' + g.attack.trajectory : ''} | ${m} | from ${g.from} | model ${predictCost(g).toFixed(0)}`);
  }
});

/** Magic Ability names by Element and shape; a different spec of the same shape takes the next name. */
const SPELL_NAMES: Record<string, Record<string, string[]>> = {
  fire: { bolt: ['Fire Bolt', 'Sunlance'], lob: ['Fireball', 'Cinderfall'], burst1: ['Flashfire'], burst2: ['Inferno'], heal: ['Rekindle'] },
  air: { bolt: ['Wind Lance', 'Gale Shot', 'Lightning'], lob: ['Thunderclap', 'Downburst'], burst1: ['Gust Ring'], burst2: ['Cyclone'], heal: ['Soothing Breeze'] },
  earth: { bolt: ['Stone Spike', 'Meteor'], lob: ['Boulder', 'Rockfall'], burst1: ['Shockwave'], burst2: ['Earthquake'], heal: ['Verdant Mend', 'Mossbalm'] },
  water: { bolt: ['Water Jet', 'Tidal Lance'], lob: ['Hailstorm', 'Downpour'], burst1: ['Riptide'], burst2: ['Maelstrom'], heal: ['Healing Rain', 'Mending Tide'] },
};

it('writes the Summon data', async () => {
  const { writeFileSync } = await import('node:fs');
  const roster = generateSummonRoster(Number(process.env.SEED ?? 2), SUMMON_SLOTS, SUMMON_NAMES, RULES, 400);
  const specs = new Map<string, string>(); // spec key → name
  const used = new Map<string, number>(); // element:shape → names used
  const rows = roster.map((g) => {
    const s = g.stats;
    let magic = 'null';
    if (g.magic) {
      const m = g.magic;
      const shape = m.kind === 'heal' ? 'heal' : m.burst ? `burst${m.radius}` : m.radius ? 'lob' : 'bolt';
      const key = JSON.stringify([g.element, m]);
      let name = specs.get(key);
      if (!name) {
        const k = `${g.element}:${shape}`;
        const i = used.get(k) ?? 0;
        name = SPELL_NAMES[g.element][shape][i] ?? `${SPELL_NAMES[g.element][shape][0]} ${i + 1}`;
        used.set(k, i + 1);
        specs.set(key, name);
      }
      const fields = [`name: '${name}'`, `kind: '${m.kind}'`, `range: ${m.range}`, `radius: ${m.radius}`, `manaCost: ${m.manaCost}`];
      if (m.trajectory && m.range > 1) fields.push(`trajectory: '${m.trajectory}'`);
      if (m.burst) fields.push('burst: true');
      magic = `{ ${fields.join(', ')} }`;
    }
    const attack = g.attack.range > 1 ? `[${g.attack.range}, '${g.attack.trajectory ?? 'high'}']` : '[1]';
    return `  ['${g.id}', '${g.name}', '${g.element}', ${g.cost}, '${g.alignment}', '${g.role}', [${[s.atk, s.def, s.mp, s.mdf, s.spd, s.mov].join(', ')}], [${g.moveTypes.map((t) => `'${t}'`).join(', ')}], ${attack}, ${magic}], // from ${g.from}, model ${predictCost(g).toFixed(0)}`;
  });
  writeFileSync('scripts/summons.out.txt', rows.join('\n') + '\n');
});
