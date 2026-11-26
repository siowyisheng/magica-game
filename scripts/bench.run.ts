// Profile chooseAction on mid-game states: node CPU profile via inspector-less sampling of hot functions.
import { it } from 'vitest';
import { Session } from 'node:inspector/promises';
import { writeFileSync } from 'node:fs';
import { SCAFFOLD_MAP, applyTurn, createMatch } from '../src/rules';
import { autoLoadout, chooseAction } from '../src/ai/ai';

it('bench', async () => {
  const lo = autoLoadout('regent', () => 0.3);
  let st = createMatch(SCAFFOLD_MAP, { ai: [true, true], seed: 9, masters: ['regent', 'templar'], rosters: [lo, lo], signatures: [lo[0], lo[1]] });
  for (let i = 0; i < 60 && st.winner === null; i++) st = applyTurn(st, chooseAction(st)).state;
  const session = new Session();
  session.connect();
  await session.post('Profiler.enable');
  await session.post('Profiler.start');
  const t = Date.now();
  let n = 0;
  for (let i = 0; i < 80 && st.winner === null; i++, n++) st = applyTurn(st, chooseAction(st)).state;
  const { profile } = await session.post('Profiler.stop');
  process.stdout.write(`BENCH ${((Date.now() - t) / n).toFixed(1)} ms/turn\n`);
  // self time per function
  const self = new Map<string, number>();
  const dt = profile.timeDeltas ?? [];
  const byId = new Map(profile.nodes.map((nd) => [nd.id, nd]));
  (profile.samples ?? []).forEach((id, i) => {
    const nd = byId.get(id)!;
    const k = `${nd.callFrame.functionName || '(anon)'} ${nd.callFrame.url.split('/').slice(-2).join('/')}:${nd.callFrame.lineNumber}`;
    self.set(k, (self.get(k) ?? 0) + (dt[i] ?? 0));
  });
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  process.stdout.write(top.map(([k, v]) => `  ${(v / 1000).toFixed(0)}ms ${k}`).join('\n') + '\n');
  writeFileSync('/dev/null', '');
});
