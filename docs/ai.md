# How the AI decides

This explains how the computer opponent picks its moves. It describes the code in `src/ai/ai.ts` as it is now. The numbers mentioned here are the defaults in `AI_WEIGHTS`, so if you change the weights, trust the code over this page.

## The short version

The AI never plans a whole turn. Each time it is its turn, it:

1. Lists every legal thing the active Unit could do: each hex it can end on, combined with each Command it could give there (wait, attack, cast a Magic ability, or summon).
2. Gives every one of those options a score.
3. Picks the highest score, with a seeded tie-break if several share it.

The Summoner and the Summons use the same machinery. The only real difference is which Commands are on the list, and where the score pushes the Unit. The three questions you asked are answered by one scoring pass, not three separate decisions. The Summoner's "summon" option is just one of the candidates, and it wins only if its score beats the others.

It also never chooses *which* Unit acts. The turn order comes from the rules (the Unit whose turn it is, see `activeUnit`). The AI only decides what that Unit does.

There is one optional extra step. On **Hard**, it plays out its best few options before committing (see the end of this page).

## What the AI can see, and what it cannot

The AI reads the full match state: every Unit, their HP, Facing and timeline position, the Stones and who owns them, Mana, the Time Limit, and the map. It uses the rules engine itself to preview outcomes, so it knows exactly what damage an attack would do, whether a shot is blocked, and which Units a spell would kill.

It does not plan beyond its own turn. The only look ahead is a **threat estimate**: for each candidate position, it asks how much damage each enemy could deal before this Unit's next turn. Those enemies are the ones who will act first on the timeline, and the estimate is a rough worst case, not a full simulation.

## 1. Choosing what a Unit does

For each candidate (hex, Command), the AI adds up a score from these parts:

**Good things**

- **Damage** to enemies, scaled by the target's value. Units are valued by cost and HP. Summoners are worth more. Each point of damage is worth `damage` (10) × the target's value.
- **Kills** get a large bonus on top of the damage. Killing an enemy Summon is worth `kill` (60) × its value. Killing an enemy Summoner is worth `killSummoner` (100,000), which is effectively "win the game."
- **Setting up a kill.** If the hit doesn't kill but leaves the target low enough that an ally can finish it before it acts again, that counts for part of a kill (`setupKill`, 0.3).
- **Healing** allies is valued a little less than damage (`heal`, 7).
- **Breaking Obstacles** is valued by how many enemies would then be able to reach you. Each one that breaking the Obstacle would open up is worth `obstacleOpening` (25), scaled by how much of its HP this hit takes. This is what makes the AI break a wall that blocks its only shot.
- **Stones.** Standing on a Stone you don't own is worth `capture` (45), more if the enemy holds it. Standing on a Stone you already own is worth a little, more for a wounded Unit (Stone Heal). Stones are valued for their Mana, the same at every hour: **the AI never plays for the Time Limit**, and nothing in its scoring rewards running out the clock.
- **Water.** When a Magic ability changes the Water Level, the AI counts which Units it would strand. Stranding an enemy is good (`strandEnemy`, 30 × value). Stranding an ally is bad (`strandAlly`, 35).
- **Summoning** is scored in its own section below.

**Bad things**

- **Friendly fire.** Damage to its own Units is penalised at 14 × value per point, which is more than the same damage dealt to an enemy is worth.
- **Mana spent.** Casting a Magic ability or Summoning costs `manaSpend` (0.25) per point of Mana, unless the Mana would overflow the cap anyway. Spending free Mana is never penalised. If the AI is **saving up** for a better Summon (see section 2), each point spent out of that reserve costs `reserveSpend` (0.6) more.
- **Time.** Every candidate pays `delay` (0.15) per unit of timeline delay its action causes. Slower actions are a little worse.
- **Threat.** The AI estimates the damage enemies could deal to this Unit at its end position before its next turn, capped at its current HP, and charges `threat` (9) × value for it. For a Summon the charge is shaped and scaled:
  - **Sized to toughness.** The charge follows the share of its HP the Unit would lose, on a curve (`hurtCurve` 0.5: half linear, half quadratic). Scrapes a Unit can absorb cost little, and damage that nearly kills it costs the most. A Rook barely minds a 2-damage poke; a 1-HP Summon minds everything.
  - **Bolder when ahead.** The charge is divided by the side's push (see Position).
  - If the threat would kill it, there is an extra penalty: `deathRisk` (70) × value for a Summon, or `summonerDeathRisk` (5,000) for a Summoner. The Summoner's threat is never shaped or scaled.

The threat estimate is smarter than "worst-case damage":

- Each enemy is considered only if it acts before this Unit's next turn. A Summoner also looks one enemy round further ahead (`summonerSecondRound`).
- A fast enemy may get several turns in before this Unit acts again. If it can't hit this Unit this turn, the AI still checks whether it could walk over and hit it in time.
- **Trades.** An enemy that my side can finish before it acts again pays for its hit: its threat is cut by up to `tradeCredit` (50%), in proportion to how much of its HP my allies can deal in time. An advance is judged as an exchange, not just as damage taken.
- An enemy attacks only one target. A Summon is charged with its **share** of each enemy: the damage the enemy would deal to it, weighted against everything else that enemy could hit (by damage², so it leans toward its best target), and never less than 25% (`threatShareMin`). Summoners always carry full threat, because enemies always go after them.

**Position**

Every candidate also gets a position score for where it ends up. This is not about the Command itself:

- **Push from a lead.** The side's lead is its share of HP-weighted material, plus 0.08 per Stone ahead, plus a little for Mana. The push is 1 + `leadPush` (3) × lead, between 1 and `maxPush` (2.5). It multiplies every Summon's pull toward objectives and divides its fear of damage, so a side that is ahead attacks rather than sits.
- **A shared target.** Each turn the side picks one target: the enemy Summoner, when ahead by more than `focusLead` (0.15) or when any Summon could reach it within two moves; otherwise the enemy-held or free Stone nearest the Summons as a group. Summons converge on it instead of each drifting to its own nearest objective.
- **Summons** are pulled by `approach` (3) × push × distance. Half of that pull goes toward the nearest objective (enemy Units and Stones not held), and half (`focus`), doubled, goes toward the shared target.
- **Summoners** set their posture from the matchup:
  - **Fragility.** The AI works out how many hits from the three strongest enemies would kill the Summoner, using the real damage formula. It then scales the keep-away bonus, `summonerSafety` (8) per hex of distance to the nearest enemy up to 7 hexes, by `postureHits` (4) ÷ that number, clamped to ×0.35–1.5. A Summoner that takes 4 hits to kill keeps the standard distance, a glass cannon keeps further back, and a tank stands closer.
  - **Aggression.** A Summoner that is durable (more than 3 hits to kill) and hits enemy Summons hard (more than 1.5 damage per hit) is also pulled toward objectives, like a Summon. The pull is scaled by both, up to `summonerAggression` × `approach`. Its attacks then compete normally; the Summoner death-risk penalty still vetoes anything that would get it killed.

**Screening (Zone of Control)**

After all candidates are scored, the best 8 destinations (`screenTop`) are re-scored with ZOC in mind. Ground enemies must stop when they enter this Unit's ZOC, so the AI recomputes the reach of every enemy near the destination, or near the Unit's current hex, with the Unit standing at the destination. It then recomputes the threat to each ally. Threat removed from allies, weighted by their value (the Summoner counts most), is a bonus of `screen` (0.6) × `threat`. A screen given up by moving away is a cost. If the re-sorted best destination hasn't been re-scored yet, it is re-scored too (up to 3 rounds).

**Facing**

After a Unit moves, the AI picks the Facing that leaves it the least exposed. If two are equally safe, it prefers to face the nearest enemy. An Attack or Magic Command forces the Unit to face its target, so the AI scores that forced Facing instead.

## 2. Choosing a Summon (the Summoner's summon option)

Summoning is decided in two steps.

**Step one: which Summons are worth considering.** Before looking at placements, the AI ranks every Summon kind it can afford and that is in its Loadout. Each gets a value:

- Starts at `summonBase` (40).
- Adds `summonCostValue` (0.45) × cost, so more expensive Summons are a little more attractive.
- Adds `summonCounter` (18) × an element score. Every enemy Unit counts, including an enemy Summoner with an Element. Each one is weighted by its value (an average Summon ≈ 1, a Summoner 1.5) and by its distance from the Summoner, fading to nothing at `summonRadius` (12) hexes.
  - Countering an enemy adds to the score, and being countered by one subtracts.
  - An enemy already countered by own Summons near it adds less: it is divided by 1 + their nearness.
  - An enemy that counters own Summons near it adds more: `summonProtect` (0.5) × their nearness.
- An **aligned** Summon's value is scaled by its Alignment over the next `alignmentHours` (8) game hours. Each hour adds +1 if it falls in its own Time of Day, −1 if in the opposite one, and 0 if Neutral. The average moves the value by up to ±`alignmentValue` (15%).
- Subtracts `summonNegativeIncome` (35) if it would leave the Summoner's Mana income negative after the Summon's upkeep (cost ÷ 8 per turn).

Only the top 4 affordable ones are kept. Ties go to the cheaper Summon.

**Saving up.** The ranking also covers Summons the AI can't afford yet. If the best of those is worth at least `saveMargin` (1.25) × the best affordable one, and current income will pay for it within `saveHours` (2) hours, its Cost becomes a **reserve**. Any Magic or Summon that would dip into the reserve pays `reserveSpend` per point dipped. Good attacks and kills still win; marginal spending doesn't.

**Step two: where to put it.** For each of those 4 kinds, the AI tries each of the six neighbouring hexes of the Summoner's end position. Any hex that is legal to place on becomes a candidate, scored with:

- the kind's ranked value (above), added to the score;
- a penalty of 0.5 per hex of distance from the new Summon to the enemy Summoner, so the AI prefers to place Summons toward the enemy;
- a small bonus of `capture × 0.4` if the hex is a Stone the AI doesn't own.

The Summon then gets the usual threat and death-risk treatment, with its Facing set to the direction it was placed in.

In practice, the AI summons when a Summon is worth more than the Mana it costs and nothing better is on offer. It holds back when a clearly better Summon is close to affordable. Counter-picking the enemy's elements near the Summoner, and the Time of Day for aligned Summons, decide which Summon it chooses.

## 3. Choosing what a Summon does

A Summon can't summon, so its candidates are only waits, attacks, and Magic abilities (plus where it stands). It is scored exactly as above:

- Damage and kills from the actual preview of the rules engine.
- Its own threat and death risk at the destination.
- Position: approaching objectives, staying on Stones, and standing on a Stone it doesn't own.
- Mana and delay costs.

A Summon with a good attack will usually take it. The interesting part is what it does when there's no good attack. Then the position score decides. It walks toward the closest enemy, a Stone it can capture, or the enemy Summoner, while keeping an eye on where enemies could hit it next turn. The threat term is scaled by the Summon's value and capped at its current HP, so a badly wounded Summon is less exposed to the penalty in absolute terms, but a fresh threat that would finish it still weighs heavily.

## Normal and Hard

- **Normal** takes the single best-scoring candidate. Ties are broken with a random number from a seed based on the match's RNG state and the turn number, so the same match always plays out the same way.
- **Hard** takes the top 5 distinct, legal candidates and plays each out (the playouts skip the screening re-score to stay within the time budget). After each one, every Unit plays Normal until this Unit's next turn (at most 6 turns). Each resulting position is then rated with `evaluate()`, which compares HP-weighted material, Summoners, Stones (a fixed weight for their Mana, never more as the Time Limit nears) and Mana. The best-rated first move wins. The candidate's own score only breaks near-ties.

Hard is therefore only a few turns deeper in a rough sense. It sees how the next few turns play out with the AI's own policy, not how the opponent would respond. That's the design limit of the current version.

## Why it's deterministic

Every decision is a pure function of the match state. There is no `Math.random`, no clock, and no hidden state, so the same match gives the same moves on every machine. That matters for replays and lockstep multiplayer. The only randomness is the seeded tie-break. (`autoLoadout` is different: it uses a random source, which is why it takes one as an argument.)

## Tuning and testing

- All weights live in `AI_WEIGHTS` at the top of `src/ai/ai.ts`.
- `src/ai/ai.test.ts` checks that the AI plays legal turns, handles Pits and Obstacles, breaks blocking Obstacles, and builds valid Auto Loadouts.
- `scripts/selfplay.run.ts` runs headless AI-vs-AI games and reports statistics, for tuning.
- `scripts/arena.run.ts` pits the current AI against the frozen copy in `scripts/baseline/ai.ts`, with sides swapped in each pair. Use it to check whether a change really makes the AI stronger.
- `scripts/bench.run.ts` profiles `chooseAction` on mid-game positions if it gets slow, and `scripts/hardtime.run.ts` times Hard turns.

Run the scripts with the commands given in each file's header comment.

## Known gaps

These are places where the AI's behaviour doesn't match what a good human player would do. Each was checked against the code as it is now.

### 1. It doesn't save Mana for a later Summon (fixed)

*Fixed:* Summoning now pays for its Mana like Magic does, and the AI keeps a reserve for a clearly better Summon it can afford within 2 hours (see section 2). The text below describes the old behaviour.

Summon ranking only considers Summons the Summoner can afford *right now* (`s.cost <= myMana`). Nothing reserves Mana for a stronger Summon that becomes affordable a turn or two later, so the AI will spend Mana on a cheap Summon or Magic ability and leave itself short for the key Summon.

It's also worse than that for Summons specifically. Casting a Magic ability pays `manaSpend` (0.25 per point of Mana). Summoning doesn't pay that cost at all: the summon branch only adds the Summon's ranked value, which favours more expensive Summons (`cost × 0.45`). So from the AI's point of view, spending Mana on a Summon is free. The only deterrent is the income check (`summonNegativeIncome`), which fires only when the Summon would drive income negative.

The Hard lookahead doesn't fix this. It plays out six turns using the same Normal policy, which also has no concept of saving.

### 2. The Summon choice only looks at enemies within 8 hexes of the Summoner (mostly fixed)

*Mostly fixed:* every enemy now counts, weighted by value and distance, and own Summons near each enemy are taken into account (see section 2). What's left is that the ranking still happens before placement, so it doesn't consider where the Summon will actually stand. The text below describes the old behaviour.

The element-counter term in Summon ranking only counts enemies within 8 hexes of the Summoner's current position (`hexDistance(u.pos, me.pos) > 8`). Enemies further away are ignored entirely, even if they are about to arrive. Within that radius, each enemy counts the same (±1), regardless of distance or whether it's a real threat. The ranking is also decided before any placement, so it doesn't consider where the Summon will actually stand.

### 3. Threat is counted per Unit, not per group (improved)

*Improved:* the fixed 70% discount is replaced by each enemy's computed share across everything it could hit (see section 1). Allies that have already moved forward now take part of the threat. What's left is that Units that haven't moved yet are still counted where they stand now. The text below describes the old behaviour.

When the AI scores a position, it totals up every enemy that could act before this Unit's next turn and could reach it, each counted once at its maximum damage against this Unit. That matches the rule that an enemy attacks once per turn, so the idea that each enemy can only strike one Unit is partly built in.

What's missing is the joint view. The AI scores each Unit's end position on its own, so it doesn't see that if its whole group advances, the enemy's attacks are split across all of those Units and each Unit faces less than the sum it's charged for. The only adjustment for this is `threatShare` (0.7), which applies when an enemy has a better target elsewhere. That's a fixed discount, not a calculation of how the enemy would actually spread its attacks.

The result is that the AI treats an advance as more dangerous than it is, and tends to hold back. The exception is the Summoner, which gets full threat and no discount, because enemies always go for it.

### 4. It doesn't use Zone of Control to screen fragile Units (fixed for the moving Unit)

*Fixed for the moving Unit:* the best destinations are re-scored with enemy reach recomputed around the Unit's new position, so a tank is rewarded for standing between enemies and the Summoner or the backline, and penalised for walking out of a screen (see "Screening" in section 1). What's left: screens that other Units will set up later in the round are not foreseen. The text below describes the old behaviour.

The rules have Zone of Control: ground units must stop when they enter an enemy's ZOC (`enemyZoc` in `src/rules/terrain.ts`). The AI respects this when it works out its own movement and when it works out where enemies can reach.

But the threat calculation uses enemy reach computed from the board *before* the AI's turn. A screen the AI sets up this turn doesn't reduce the threat to fragile Units that move later, or to the unit that moves into the screen. So the AI can't see that a tank in front can protect an artillery or Summoner behind it, and it won't deliberately advance several Units to cover each other. Its positioning is driven by per-Unit scores, so coordinated screening only happens by accident.
