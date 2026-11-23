# AI plan: a strategic layer over the move scorer

The AI (see [ai.md](ai.md)) scores every candidate turn on its own: damage,
kills, threat, Stones, a pull toward objectives. What it lacked was an
overarching plan: *what is this Side trying to do right now, where, and what
does it need to summon for it?* This document is the design of that layer.
It was agreed with the designer; edit it when the design changes.

The layer is cheap by construction: no search, a few hundred arithmetic
operations per turn, the same answer for the same position (deterministic).
Hard AI keeps its lookahead on top and simply has better candidates to look
ahead with.

## 1. The Plan

Once per turn, before the move scorer runs, `makePlan(state, side)`
(`src/ai/plan.ts`) reads the board and returns a **Plan** for the Side:

- a **Posture**: how much the Side is defending, expanding, contesting,
  squeezing or going for the kill (a blend, not one mode);
- a **Front**: the hex the Side works toward;
- **Needs**: what the next Familiar should be good at, each with a weight;
- a **Reserve**: Mana kept back for an answer to what the opponent could
  summon next;
- **Jobs**: one objective per Familiar;
- the Stones an enemy can really take next turn (for guarding).

The move scorer reads the Plan instead of deciding these things move by
move. The Plan is shown on screen for AI Sides, so its reasoning can be
judged in real games.

## 2. Reading the situation

| Question a player asks | What is computed |
|---|---|
| Am I ahead on income? | Each Side's Mana Income (Stones, upkeep). |
| Ahead on material? | Each Side's units' value × HP. |
| Can something kill my Master soon? | For each enemy: hexes it must close, hits it needs (from the damage formula), so turns to kill my Master; and all enemies together. |
| Which Stones can I get first? | For each Stone, how soon each Side could reach it (its units, or a Familiar summoned next to its Master). |
| Who is stronger there? | For each Stone, the value × HP of each Side's units within 5 hexes. |
| Early or late? | How many Stones are still unclaimed. |

## 3. Posture

Each Posture has a utility from 0 to 1; they are blended, so the behaviour
changes smoothly as the situation does.

- **Defend**: an enemy (or enemies together) can kill the Master within about
  2 turns. 1 at 2 turns or fewer, 0 at 4 or more.
- **Expand**: unclaimed Stones this Side reaches first.
- **Contest**: the default. Take Stones where this Side is locally stronger,
  not where the enemy has just put something big.
- **Squeeze**: ahead on income with own Stones safe: patient, guard more,
  push on without bad trades.
- **Kill**: material lead overwhelming and the enemy Master reachable:
  go straight for it.

Posture adjusts a few existing weights: Squeeze raises guarding and lowers
boldness; Kill raises the push and makes the enemy Master the Front; Defend
makes the Master more careful and stops it moving forward.

## 4. The Front, Master staging and Familiar Jobs

- **Front**: the best objective for the Side: a Stone it doesn't hold (an
  enemy one is worth more: it swings income both ways), scored by gain ×
  local strength ÷ time to reach it; the enemy Master under Kill; the
  threatening enemy under Defend.
- **Master staging (R2)**: every Master is pulled toward the Front, more
  weakly than Familiars. Its Familiars appear next to it, so a forward Master
  summons closer to the objectives. The existing threat check keeps it
  outside what enemies can reach; the flat "stay far from enemies" term no
  longer pushes it back when no enemy can get to it.
- **Summon placement (R3)**: a new Familiar is placed toward the Front, with
  a bonus next to or on a Stone the Side doesn't hold (replacing the old pull
  toward the enemy Master).
- **Jobs**: each Familiar is assigned one objective (a Stone to take or
  guard, an enemy to hunt, or the Front), greedily by time to reach and
  value. Its pull goes to its Job instead of every Familiar chasing one
  shared target.
- **Really threatened Stones (R1)**: an own Stone needs a guard only when an
  enemy can actually end its next move on it (its movement, not a straight
  distance). Units no longer sit on Stones nothing can reach.

## 5. Summoning for a purpose

The old value (a flat base + 0.45 per Mana of Cost + Element counters) is
replaced:

> value = small base + Σ (need × fit) − Cost × Mana price

There is no bias toward expensive Familiars. An expensive one wins only when
its stats serve a need. **Fits** come from stats and the damage formula:

| Need | Raised by | Fit |
|---|---|---|
| **Grab** | Expand, Contest | Move, Fly; cheap. |
| **Answer** an enemy (F1) | Defend (× urgency), a strong enemy near the Front | Damage it deals that enemy (damage formula, Elements included) against damage it takes back. |
| **Heal** | Defend, a hurt Master, no healer of its own | Has a heal. |
| **Hold** | Squeeze | DEF and MDF. |
| **Assassin** | Kill | ATK, Move, Fly. |
| **Fight** | always a little | Damage against the enemies near the Front. |

**Mana price**: the usual spend cost, higher when spending eats into the
Reserve, free when Mana would overflow the cap anyway.

Under Defend:

- **F2 placement**: the answer is placed where it can reach the threat next
  turn, and between the threat and the Master (unless the threat flies).
- **F3 drawing attention**: a new Familiar that answers a threat and can
  reach it takes part of that threat off the Master in the Master's own
  threat score, so summoning counts as defending.
- **F4**: saving up for a better Familiar is suspended.

## 6. The Reserve

Loadouts are visible to both Sides. Each turn:

1. Of the Familiars in the opponent's Loadout that it can afford by my
   Master's next turn (its Mana + income), find the most dangerous to my
   Master if summoned next to its Master (turns to kill, as in §2).
2. If it could kill my Master within about 3 turns, find my cheapest
   Familiar that answers it well (Archon for Vortex).
3. Reserve = that answer's Cost − the income I'll have before I need it.

Spending into the Reserve costs extra (the existing reserve penalty), so the
AI keeps it unless something is worth more (a kill, a Defend emergency).

## 7. Measuring

Each change is judged by 32 arena games against the frozen previous AI
(kept unless clearly worse) and by self-play metrics:

- average distance from the Master to its Front;
- average distance from a newly summoned Familiar to its nearest objective;
- turns a unit spends on an own Stone nothing can take next turn;
- game hour of a Side's first capture of a Stone it didn't hold;
- (for Defend) how often a Master dies within 2 turns of being threatened.

## 8. Build order

The four steps were built together and measured together:

1. Situation reading, Posture, Front and the Plan display.
2. Summon Needs and fits (no Cost bias), the Reserve, F1–F4.
3. R1 (really threatened Stones), R2 (Master staging), R3 (placement),
   Familiar Jobs.
4. Posture weights (Squeeze, Kill, Defend).
