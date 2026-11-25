// Test helper: give kinds a different Ability for the duration of a test,
// through the local balance layer.

import { getLocalBalance, setLocalBalance } from '../rules';

/** Give `kinds` the Ability `id` (local balance); returns a function that undoes it. */
export function withAbility(kinds: string[], id: string): () => void {
  const before = getLocalBalance();
  const next = JSON.parse(JSON.stringify(before)) as ReturnType<typeof getLocalBalance>;
  for (const k of kinds) next.kinds[k] = { ...(next.kinds[k] ?? {}), abilityId: id };
  setLocalBalance(next);
  return () => setLocalBalance(before);
}
