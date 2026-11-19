# Deterministic rules core with integer math and hex-ring angles

The game rules live in `src/rules/`, a pure TypeScript module that imports nothing from React, three.js or the browser. A match is its starting state plus an ordered log of commands, and a replay must give the same result on every machine. All rules arithmetic uses integers or fixed-point integers, with explicit rounding done once at the end. The only randomness is a seeded PRNG that the AI uses to break ties. This makes possible replays, desync detection in lockstep multiplayer, server-side validation, and later replacing the presentation layer (another renderer or Godot) without touching the rules.

## Consequences

- For ranged hits, the Facing Modifier uses a **hex-ring angle**: the attacker's position around its hex ring relative to the defender. It does not use `Math.atan2`, because floating-point trig is not guaranteed to give the same result on every platform. The two agree at multiples of 60° and differ by a few degrees in between. That difference is accepted on purpose; don't "fix" it with `atan2`.
- Rules state is never iterated in an unordered way: Units are kept in arrays sorted by id.
