# Tuning the AI's weights by self-play

`scripts/tune/tune.ts` tunes the move scorer's weights (`AI_WEIGHTS` in
`src/ai/ai.ts`, see [ai.md](ai.md)) by playing the AI against itself, and
checks the result against the defaults. This is step 2 of
[ai-roadmap.md](ai-roadmap.md). It runs on your own machine: it needs many
games, far more than the 32-game arena used for regular changes.

## What it does

**SPSA** (simultaneous perturbation stochastic approximation, the method
behind Stockfish's tuning). Each iteration:

1. Every tuned weight is nudged up or down at random by the same relative
   step (±15% at the start, shrinking slowly): a "+" set and a "−" set.
2. The two sets play each other on random matchups (random Masters, Loadouts
   half auto and half random; by default half on Scaffold Ford and half on
   random maps, `--maps`), each setup twice with sides swapped. Tuning on
   many maps keeps the weights from fitting one map.
3. Every weight moves a little toward the set that won.

Weights are tuned as multipliers on their defaults, so they all move in
relative terms whatever their scale, within ¼× to 4× the default (shares
such as `hurtCurve` never above 1). The 35 tuned weights are listed in
`scripts/tune/params.ts`. Structural ones (`killMaster`, `masterDeathRisk`)
and counts (`screenTop`, `alignmentHours`) are left alone. Only the Normal AI
plays; the Hard AI uses the same weights.

## Before you start

- Node 20 or later, and `npm install` in the repository.
- **Your balance.** The game in your browser plays with your local stat
  edits, which Node can't see. Give the tuner any replay file you saved from
  the game (`--balance my-replay.json`): it reads the balance stored in it.
  Without `--balance`, it tunes on the repository's balance
  (`src/rules/data/overrides.json`).

## Running it

```bash
npm run tune -- tune --iterations 2000 --balance path/to/a-replay.json
```

**On Windows**, if `npm run` mangles a path with spaces (`ENOENT … ^C:\…^`), build once and
run Node directly instead:

```bash
npm run tune:build
```

```bash
node dist-tune/tune.mjs tune --iterations 2000 --balance "C:\path\to\a replay.json"
```

- Uses every CPU core but one. Change with `--workers N`.
- Prints one line per iteration: the games won by "+" and "−", the time it
  took, an ETA, and the three weights that have moved most so far ("most
  moved": furthest from their defaults since the run began, resumes included;
  `kill ×1.08` means 8% above the default).
- Writes to `tune-out/` (or `--out DIR`): `tuned-weights.json` (the current
  best guess, rewritten every iteration), `checkpoint.json` and `log.jsonl`.
- **Safe to stop** (Ctrl+C) at any time. Continue with the same command plus
  `--resume`.

How long: a game takes about 1–10 s on one core (3 s is typical), and each
iteration plays 8 games (`--pairs 4`). 2,000 iterations is 16,000 games:
roughly 2 hours on 8 cores, or 4 on 4 cores. Use the ETA on the first few
dozen lines to judge, and shorten with `--iterations` if needed.

## Seeing the change in weights

```bash
node dist-tune/tune.mjs report
```

Lists every tuned weight with its default, its tuned value and the change in
percent, biggest change first. It reads `tune-out/tuned-weights.json` (or
`--out DIR`, or `--weights FILE`), so it works while a run is going.

## Checking the result

```bash
npm run tune -- validate --weights tune-out/tuned-weights.json --pairs 200 --balance path/to/a-replay.json
```

Plays the tuned weights against the defaults: 400 games on matchups drawn
separately from the ones used in tuning. It prints the score with its 95% range, and
the same in Elo. At 400 games the range is about ±5 points: a score whose
range stays above 50% is a real improvement.

## What to send back

1. `tune-out/tuned-weights.json`
2. The last ~20 lines of the tuning output.
3. The `VALIDATE` line.
4. `tune-out/log.jsonl` (optional; it shows how the weights moved).

With those, the tuned values go into `AI_WEIGHTS` if validation shows a real
gain, and get checked with the usual arena run and tests.

## Options

| Option | Default | |
|---|---|---|
| `--iterations N` | 1000 | SPSA iterations |
| `--pairs N` | 4 (validate: 200) | setups per iteration, each played twice |
| `--workers N` | cores − 1 | parallel games |
| `--out DIR` | `tune-out` | where results go |
| `--balance FILE` | none | a replay (or balance) `.json` with your stats |
| `--resume` | | continue from `DIR/checkpoint.json` |
| `--weights FILE` | | validate / report: the weights to test or show |
| `--seed N` | 1 | different seeds give different matchups |
| `--maps M` | mixed | `scaffold`, `random` (a new random map per setup) or `mixed` (half each) |
| `--c F` | 0.15 | starting size of the random nudge (relative) |
| `--a F` | 0.03 | starting size of the update step |
| `--max-turns N` | 1000 | a game this long counts as a draw |

## When to re-tune

Tuned weights stay valid through ordinary stat edits: the scorer reads stats
directly. Re-tune (once tuned values are in `AI_WEIGHTS`, the tuner starts from them, which is quicker) when
something changes what a concept is worth, such as Stone income or how tough
Masters are. A new kind of ability needs a scoring term written first; then
it can be added to `params.ts` and tuned.
