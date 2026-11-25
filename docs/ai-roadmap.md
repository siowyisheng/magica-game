# AI roadmap: toward a stronger AI

How the AI could get stronger beyond hand-tuning the move scorer
([ai.md](ai.md)) and the Plan ([ai-plan.md](ai-plan.md)), and in particular
whether an AlphaZero-style approach (a neural network trained by self-play,
guiding a tree search) is worth it. This is an assessment, not a design: edit
it when one of these steps is taken or the numbers change.

## Where the AI is now

The AI scores every candidate move with hand-written rules: damage, kills,
Stones, a pull toward objectives, and an estimate of the danger at the end
position. About 100 weights, all set by hand and checked with 32 arena games
against the previous version.

Most of the bugs found in replays have been the danger estimate getting a
detail of the rules wrong, not the weights being off:

- an enemy's Mana Income landing before it acts (so it could cast after all);
- turn-order ties with an enemy turn;
- the hex a Unit leaves still counted as blocked;
- a Familiar about to be summoned not counted as blocking a Direct shot;
- a hit the Master can't outrun landing a second time.

Each was fixed by hand, with a regression test from the replay. A search that
plays out the enemy's actual replies with the real rules gets all of these
right without modelling them.

## Measured costs

On the development machine (4 CPU cores, no GPU), Scaffold Ford, mid-game:

| | |
|---|---|
| Candidate moves per turn (after the scorer's pruning) | about 270 |
| Turns per game | 50–400 |
| `applyTurn` per second, one core | about 13,600 |
| Move scorer (`rankCandidates`), per turn | about 21 ms |

## Full AlphaZero: not viable now

**What fits.** Magica is a two-player, perfect-information game (both Loadouts
are visible) with deterministic rules. Turn order by readiness rather than
alternation doesn't matter to a tree search. The rules engine is separate
from the display, and self-play and arena harnesses exist.

**What makes it expensive.**

1. **Volume.** AlphaZero runs hundreds of search steps per move, each calling
   the network, over hundreds of thousands to millions of self-play games.
   Roughly: 100 turns × 400 steps × ~1 ms per step ≈ 40 s per game per core;
   a million games is hundreds of core-days before the network's own cost.
   Low-search variants (Gumbel AlphaZero, 16–32 steps per move) cut that by
   10–25×, which is still weeks on 4 cores. Realistic only with the rules
   ported to a fast language (Rust, C++ or WASM) and a rented GPU machine.
2. **The game is still changing.** Stats, Familiars and rules are still being
   tuned. A trained network learns one balance; every balance pass makes it
   stale and needs another training run. The hand-written scorer adapts on
   its own, because it reads the damage formula and the stats directly.
3. **Long games, varied boards.** Credit has to flow back over hundreds of
   turns, and the input varies: maps, 40 Familiars, 30 Masters, Elements,
   Day/Night, Water Level, a varying number of units. A board encoding that
   copes with this is real research work, not a port.

## Recommended path, cheapest first

1. **Search instead of a hand-modelled danger estimate.** *Tried first as a
   cheap test: Hard trying the enemy's top 3 replies instead of one scored 41%
   against today's Hard (32 games) at 2.3× the thinking time; see ai.md. The
   leaf judgement (`evaluate()`) needs to improve first (step 3).* MCTS (or a deeper
   version of the Hard AI's lookahead) with the current scorer's top 10–20
   candidates as the move prior and `evaluate()` as the value: AlphaZero's
   search without the learning. It replaces the class of bugs above with the
   real rules. The main question is fitting it into a time budget per turn.
   Cost: days.
2. **Automatic weight tuning.** Tune the ~100 weights by self-play with SPSA
   or CMA-ES. This needs thousands of games per comparison, not 32: at 32
   games, swings of ±10 points between runs of the same AI are common, so a
   real 5% gain can't be told from noise. It would run as an offline job,
   outside the 32-games-per-step rule for regular changes.
   **Built:** `npm run tune`, see [tuning.md](tuning.md).
3. **A learned value function.** Train a small network on self-play
   positions and results to predict the winner, and use it in place of
   `evaluate()` in the search from step 1. This is the useful half of
   AlphaZero and much cheaper: it trains without a search inside the
   self-play loop. It can run in the browser (ONNX Runtime Web or
   TensorFlow.js).
4. **Full AlphaZero, once the balance is stable.** Port the rules engine,
   reuse the network from step 3, and replace the scorer as the move prior.

Step 1 goes straight at the kind of mistakes found in replays and is within
reach in this codebase. Hold off on step 4 until the game's design settles.
