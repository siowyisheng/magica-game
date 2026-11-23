// Test helper: Summoners have no Magic Abilities, so tests that need one
// attach it for the duration of the test through the local balance layer.

import { getLocalBalance, setLocalBalance } from '../rules';

/** Give `kinds` the abilities `ids` (local balance); returns a function that undoes it. */
export function withSpells(kinds: string[] = ['regent'], ids: string[] = ['bolt', 'rise', 'ebb']): () => void {
  const before = getLocalBalance();
  const next = JSON.parse(JSON.stringify(before)) as ReturnType<typeof getLocalBalance>;
  for (const k of kinds) next.kinds[k] = { ...(next.kinds[k] ?? {}), magicIds: [...ids] };
  setLocalBalance(next);
  return () => setLocalBalance(before);
}
