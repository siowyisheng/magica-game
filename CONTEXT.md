# magica

A rules-deterministic, turn-based hex tactics game in which two Masters fight with elemental Familiars. This glossary fixes the vocabulary used by the rules, the AI and the UI.

## Units

**Unit**:
Any piece on the map that takes turns. Every Unit has exactly 10 HP.
_Avoid_: Piece, character, monster

**Master**:
The single leader Unit of each Side. Its Ability is a physical one (a Strike, or a Shot or Lob for the few that attack at range), and it is the only Unit that can Summon; its MP sets its Side's Mana Income. A Side may have only one of each Familiar on the map at once, except its Signature (up to 3). When it dies, its Side loses. Each Side picks one of thirty Masters before the match; they differ in stats, and a few attack at range or have an Element or Alignment. Every Master's stats fit the Stat Budget. Both Sides may pick the same one.
_Avoid_: Summoner, hero, commander

**Loadout**:
A set of exactly 20 of the 40 Familiars: the only Familiars a Side may Summon in a match. It is chosen separately from the Master. Players save Loadouts in the browser; none ship with the game. One of the 20 is its Signature. A Loadout saved when Loadouts were smaller, or before Signatures existed, stays saved but can't be played until it is edited to 20 with a Signature. A Side may also take a **random Loadout**: 20 Familiars drawn at random, at least two of them an Element's cheapest Familiar, with a random Signature, or one the AI builds for its Master (its Signature also picked at random). Both Sides' Loadouts, their Signatures, and the Familiars each one leaves out, are visible to both players during the match.
_Avoid_: Deck, army, roster (as a player-facing term)

**Signature Familiar** (or **Signature**):
The one Familiar of a Loadout that its Side may have up to 3 of on the map at once (every other Familiar is limited to one). Each copy gets its **Signature Bonus**: +1 to one stat fixed for that Familiar (ATK, DEF, MP, MDF, Speed or Move). Its Cost and Upkeep are unchanged.
_Avoid_: Favourite, ace

**Test Match**:
A match where both Sides may Summon all 40 Familiars, ignoring Loadouts, as many of each as they like; there is no Signature. For trying things out.

**Match Setup**:
The choices made before a match: the map, whether it is a Test Match, and for each Side its Master, its Loadout and whether a person or the AI plays it.

**Pause**:
Stopping a match in place: no turn starts and no Command can be given until it is resumed. The map can still be looked at and Units inspected. In an Online Match either player may Pause (3 times each per match) and either may resume; a Pause ends by itself after 2 minutes, and the Time Bank and Turn Timer stop while it lasts.

## Online play

**Online Match**:
A match between two people on different machines, connected directly to each other. A player creates one and shares its **Game ID** (as a code or link); the other joins with it. Each picks a Master and Loadout unseen by the other; both are revealed together, and a coin flip decides who is Green (who moves first). The map is chosen by the creator (a Random Map comes from a seed both share). Online Matches always use the stats the game ships with, and both players must be on the same version. Each player's moves travel straight to the other; the server only introduces the two and receives Match Reports.
_Avoid_: Multiplayer game, lobby, room (as player-facing terms)

**Player ID**:
Who a player is online: an identity made once in their browser and kept there, with a display name they choose. There are no accounts.

**Planning Phase**:
The first 30 seconds of an Online Match, before any turn: both players see the map, both Masters with their stats, and both Loadouts with their Signatures. Nothing can be changed. It ends early when both players are **Ready**. No time is used from either Time Bank.

**Turn Timer**:
The 10 seconds each turn of an Online Match is given for free. Unused seconds are lost; once they run out, the Time Bank drains. The timer stops while a turn's animation plays.

**Time Bank**:
Each player's pool of extra thinking time in an Online Match: 60 seconds at the start, drained only once a turn's Turn Timer has run out, never refilled.
_Avoid_: Reserve (the AI's Mana held back), Time Limit (the 72 Game Clock hours a match lasts), Game Clock

**Timeout**:
What happens when both the Turn Timer and the Time Bank run out: the Unit Waits where it stands, as if its player had chosen Wait. The match goes on; every later turn of that player Times Out after its 10 seconds.

**Resign**:
Giving up an Online Match: the other player wins at once.

**Abandon**:
A player who has been disconnected from an Online Match for 2 minutes has Abandoned it: the other player may claim the win. Until then, the absent player's turns Time Out and they may rejoin with the Game ID.

**Match Report**:
What each player's game sends the server when an Online Match ends: the Game ID, both Player IDs, the result (the winner, or a draw, and how it ended: a Master fell, the Time Limit, a Resign or an Abandon) and the Replay, with the time each turn took. The server stores the reports and gives the match a **result status**: **Confirmed** when both reports agree (on the result, the starting position and every turn; turn times may differ a little), **Contested** when they differ (one player is assumed to be cheating; resolving it comes later), **Unconfirmed** when only one arrives in time. The server doesn't check the Replay itself. A player's **Online History** lists their Online Matches with the opponent, result and result status, and opens each Replay.


**Replay**:
A recorded match that can be watched back turn by turn, played forward, stepped back or jumped to any turn. Every match is recorded; the most recent ones are kept for a while and a player can save one to keep it. A Replay shows the match with the unit stats and abilities in force when it was played. From any turn of a Replay, the player can **Play from here**: the match continues live from that position, with each Side played by a person or the AI.
_Avoid_: Recording, demo, VOD

**Familiar**:
A Unit that a Master brings onto a hex next to it, at most 1 Height above or below the Master (water counts at the Water Level). The new Familiar faces the way it was summoned, and so does the Master. There are 40 kinds, ten per Element, one at each Cost from 16 to 88 in steps of 8. Each has exactly one Ability, which sets its Class, and uses ATK or MP, never both.
_Avoid_: Summon (as a noun; "Summon" is the Command), monster, minion, creature

**Class**:
What a Familiar does when it Acts, worked out from its Ability and shown by an icon wherever it appears (the word only in detailed views): **Fighter** (an Ability labelled Attack that hits with ATK against DEF), **Caster** (labelled Attack, hitting with MP against MDF), **Healer** (labelled Heal) or **Support** (labelled Buff, such as Empower, or Debuff). A Familiar uses ATK or MP, never both; the stat it doesn't use is 0 and isn't shown.
_Avoid_: Role, archetype, type (Move Type is something else)

**Side**:
One of the two opposing players (human or AI) and every Unit they control. The Side Colour is green for the human player by default and red for the opponent.
_Avoid_: Team, faction, player (when meaning the group of Units)

## Stats

**Attack (ATK)**: Contributes to the damage of a physical Ability. ATK, DEF, MP and MDF are small numbers (about 0–10) on the same scale as HP: a point of ATK is a point of damage. A Caster, Healer or Support has ATK 0.
**Defense (DEF)**: Reduces damage taken from physical hits.
**Magic Power (MP)**: Contributes to the damage or healing of a magical Ability (a heal restores as much HP as the healer's MP). A Fighter has MP 0, since MP does nothing for it. For a Master it is also the key factor in Mana generation.
**Magic Defense (MDF)**: Reduces damage taken from magical hits.
**Speed (SPD)**: Decides how soon a Unit acts again (see Action Value). Familiars run from about 1 to 7 and Masters from about 4 to 11; 0 is the slowest there is. (Speed was once 6 higher for the same delays.)
**Move (MOV)**: The Move Points a Unit can spend in one turn.

**Stat Budget**:
The hidden exchange rate that keeps Masters balanced: each stat is priced in Magic Power, and every Master's stats add up to the same total. Speed and Move are dear, Defense and Magic Defense cheaper, and Attack is priced by how far it reaches (Move plus Attack range): free for a slow melee Master, dearer with every extra hex of Move or range. Magic Defense has a floor: Magic reaches further than most Attacks, so a Master keeps Magic Defense of at least 3, and at most one Master may have 2.
_Avoid_: Point buy, stat total

**Move Type**:
A way of moving: Walk, Slow, Fly, Swim or Wade. A Unit can have several Move Types and uses the cheapest one that applies when it enters each hex. Slow only ever comes paired with Swim: it marks swimmers that move with difficulty on land. Wade only steps into or out of Shallow Water at a **Wade Entry**.
_Avoid_: Movement class

**Move Range**:
The hexes a Unit can end its move on this turn.

**Reach**:
Every hex a Unit's Ability could reach from some hex in its Move Range: drawn in red for a physical Ability, in blue for a magical one.
_Avoid_: Threat range, attack range (when meaning after moving)

## Elements

**Element**:
One of Fire, Air, Earth or Water. Each Familiar has one Element. Most Masters have none; four have one.

**Counter**:
Fire counters Air, Air counters Earth, Earth counters Water, and Water counters Fire. Opposite Elements (Fire–Earth, Air–Water) are neutral.

**Element Bonus**:
A flat amount added to damage by how the attacker's Element stands against the defender's: a Counter +4, neutral 0, the same Element 0, being Countered −4. Masters and Familiars are treated alike: a unit with no Element is neutral to everything. An Obstacle is hit as neutral.
_Avoid_: Weakness, advantage

## Turns and time

**Game Clock**:
The match's 24-hour in-game time. One minute of Game Clock equals one point of Action Value. In the scaffold it starts at 06:00.

**Action Value (AV)**:
How many Game Clock minutes are left before a Unit acts next. The Unit with the lowest AV acts. Masters start a match with their Base Delay, as if they had just Waited.
_Avoid_: Initiative, ticks, ATB

**Base Delay**:
The AV a Unit gets after a turn in which it only Waits. It depends only on Speed.

**Turn Delay**:
The AV a Unit gets after its turn: the Base Delay, plus half the Base Delay for each of Move, Act and Summon that it used, rounded at the end. A new Familiar enters with the Turn Delay of a Move followed by an Attack.

**Action Timeline**:
The UI list of upcoming turns in the order the AV system gives. While a Command is hovered but not yet confirmed, the acting Unit's icon is shown where that Command's Turn Delay would place it.
_Avoid_: Turn order bar, queue

**Time of Day**:
Day runs 08:00–16:00 and Night 20:00–04:00. The hours between are Neutral.

**Time Limit**:
A match ends 72 Game Clock hours after it starts if no Master has fallen. The Side controlling more Magic Stones then wins; if they are level, the Side with more total HP across its Units; if that is level too, the match is a draw.

**Alignment**:
Whether a Unit is tied to Day, to Night, or to neither. At its aligned Time of Day its ATK, DEF, MP and MDF are 1 higher; at the opposite one they are 1 lower. Speed and Move are never changed by Alignment. A Master's Alignment also changes its Side's Mana Income, since that follows its MP.

## Turn structure

**Command**:
What a Unit does after it Moves, or after it chooses not to: Wait, **Act** (use its Ability; the button shows the Ability's label: Attack, Heal, Buff or Debuff) or Summon. The player chooses Facing only for Wait. Acting turns the Unit to face where it aimed (except a Burst, aimed at its own hex), and Summon turns the Master toward the summoned hex.
_Avoid_: Action (when meaning a menu choice), Attack and Magic (as Commands: since one Ability per Unit there is only Act)

**Ability**:
The one thing a Unit does when it Acts; every Unit has exactly one, shared from a library (editing one changes every Unit that uses it). It has a range (a maximum only, with no minimum), an area, an effect, and for damage a **power**: physical (ATK against DEF; Strike, Shot and Lob are the plain ones) or magical (MP against MDF). It also has a **label**, the Act button's name: Attack, Heal, Buff or Debuff. A Unit may give its Ability its own name (Harpoon for a Shot, say). Abilities are free: they cost no Mana. Damaging abilities only ever hit enemies and Obstacles, never the user or allies, except a Burst. Heals and Empower hit allies and may include the user. Areas reach 1 hex around the aimed hex (2 for a Burst). Facing is always measured from the attacker's hex, for every Unit an area hits. Abilities have no power of their own: their strength comes only from the user's ATK or MP.
_Avoid_: Skill, spell (as a code term), Magic Ability (every Ability is an Ability, physical ones too)

**Burst**:
A damaging Ability centred on its user, with no range: it hits every Unit and Obstacle within 1 or 2 hexes, allies included, but never the caster.
_Avoid_: Nova, self-AoE

**Trajectory**:
How a ranged Ability (range above 1) travels. **High** arcs over everything and always reaches a target in range. **Direct** flies straight and needs a Clear Angle. Abilities with range 1 have no Trajectory; they reach a neighbouring Unit (enemy or ally) only when its hex is at most 1 Height above or below the user's (water counts at the Water Level). A ranged ability used on a neighbour ignores Height.
_Avoid_: Fire mode, arc type

**Clear Angle**:
Whether a Direct shot can reach its target. Seen from above, every Unit and Obstacle is a body at its hex centre, and the shot is a small projectile. For blocking, a Unit's body is wide (most of its hex), so Units screen what stands behind them; an Obstacle's is smaller. The angle is clear when some straight line from the shooter to any point across the target's body passes every other body, allies included. Terrain blocks too: any hex in the way whose top is 2 or more Heights above the shooter's hex (water counts at the Water Level) is a wall filling that hex. Pits, and hexes less than 2 above the shooter, never block.

**Wade Entry**:
The edge between a land hex and a Shallow Water hex exactly 1 Height below it, like a beach. A Unit that wades (and cannot swim) steps into and out of Shallow Water only across a Wade Entry; anywhere else the bank is too high. On a Random Map at least half of every body of water's shore is Wade Entries.
_Avoid_: Beach, ramp

**Stranded**:
A Unit that starts its turn on a hex none of its Move Types may enter. It takes 1 damage, then may move by its normal rules into hexes it can enter, and then act as usual. If it stays where it is, it can only Wait.

## Facing and damage

**Facing**:
One of the six hex directions a Unit faces.

**Facing Bonus**:
A flat amount added to damage by the angle between a defender's Facing and the direction the hit comes from: under 90° (Front) +0, 90° up to 150° (Flank) +1, 150° and more (Back) +2. So an adjacent hit from the front or a front side adds 0, from a rear side +1, and from directly behind +2. It applies to both Attack and Magic.
_Avoid_: Backstab bonus, flanking

**Damage**:
Attacker's ATK − defender's DEF + Element Bonus + Facing Bonus − the defender's terrain cover; MP and MDF for a magical hit. Alignment changes the stats first. A result of 0 or less deals 0: there is no minimum. It is not limited by the defender's remaining HP (the Damage Number shows it all), but HP never drops below 0. For example, ATK 5 against DEF 1 with a Counter from behind deals 5 − 1 + 4 + 2 = 10.

**Empower**:
A Buff Ability (Kindle's) that targets one friendly Unit within range 1, the user included, and gives it +3 ATK until its next physical hit. The Unit is then **Empowered**, and shows a golden aura: the bonus counts in the damage previews of its hits, and its next physical hit uses it up. A second Empower before then doesn't stack. It helps only Units that hit with ATK.

**Damage Preview**:
The exact result of a Command against a target, shown before the Command is confirmed, as a Damage Number over each target.

**Damage Number**:
The floating amount of damage (or healing) a Command does to one target: shown in the Damage Preview, and popped briefly again the moment the hit lands. A target's HP changes at that moment, not when the turn ends; a unit brought to 0 HP fades out then.

## Terrain

**Height**:
How high a hex is. Walk and Slow can climb at most 1 Height per hex they move, at +1 Move Point; going down 1 Height is free. Fly ignores Height.

**Water Level**:
The map's water surface Height. No unit can change it at present: Rise and Ebb, which change it by one step at a time from 1 below its starting value to 1 above it, are defined but no unit has them. Every map with Deep Water keeps some at the lowest level (a map may have only Shallow Water), and the highest level floods at most 40% of the map. On maps with no water, neither spell can be cast. A hex 1 below the Water Level is **Shallow Water**; a hex 2 or more below it is **Deep Water**.

**Plain**:
The default ground. Entering it costs 1 Move Point for Walk or Fly and 2 for Slow. It gives no defense bonus.

**Rough**:
Hard ground. Entering it costs 1 Move Point for Fly, 2 for Walk and 3 for Slow. It takes 1 off every hit.

**Magic Stone**:
A hex type of its own, never Rough, though it may be under water. A Unit standing on it takes 1 less damage from every hit. The Side that controls it gains more Mana.
_Avoid_: Crystal, pedestal

**Stone Heal**:
Any Unit that starts its turn on a Magic Stone, whoever controls it, heals 1 HP, up to 10. A Stranded Unit takes the Stranded damage first. It is shown as the turn starts: a green glow rises from the Stone and a green Damage Number (1) pops; nothing shows when the Unit was already at full HP.

**Capture**:
A Unit that ends its turn on a Magic Stone gives control of the Stone to its Side. Being Summoned onto a Stone does not count. Control lasts until an enemy Unit Captures it, including while the Stone is under water.

**Pit**:
A hex type of its own that no Unit can stand on, drawn as a missing hex. Only Fly can cross it. It never fills with water and does not count for the Water Level rules. It does not block a shot.
_Avoid_: Chasm, hole, void (as the rules term)

**Obstacle**:
A neutral map object placed on dry Plain or Rough at the start of a match. No Unit can stand on its hex, and only Fly can cross it. It blocks Direct shots but not High ones. Both Sides may hit it with any damaging Ability, areas included; it cannot be healed and exerts no ZOC. It has 10 HP like a Unit, no Element and no Facing, and its Defense and Magic Defense are equal: 2, 4 or 6. Destroyed at 0 HP, leaving the hex beneath. It stays, and keeps blocking, if water rises over it.
_Avoid_: Wall, prop, blocker

**Random Map**:
A map generated from a seed, the same map for the same seed. 16–21 hexes wide and 13–21 tall, with the Masters starting opposite each other (near the SW and NE corners on 40% of maps, at 8 and 2 o'clock on 30%, at 9 and 3 o'clock on 30%, on maps at least 18 wide, as seen from the centre) and everything mirrored through the centre point, so both Sides get the same map. Pits bite into its edges (and sometimes its middle), so each map has its own outline. Every tile touches at least 3 other tiles that aren't Pits, so there are no stray hexes or thin spurs. Its Heights run from 1 (Shallow Water) to 4. It has plateaus at Height 4 with 2-Height cliffs on most sides and steps up on the rest, and on about a quarter of maps a pair of **pillars**: one or two hexes 2 above everything around them, which only Fly reaches. It has 7–12 Magic Stones, each 2–9 hexes from its nearest other Stone, most often 4 or 5 (about a third at 4, a quarter at 5, then fewer the further out, and a few as close as 2 or 3), never on the map's edge (next to a missing hex or a Pit), with at least a third of them on or near the symmetry line (about as far from one Master as from the other). About one Stone in five (the centre one included) sits in Shallow Water, at most a third of them, so only Units that Wade, Swim or Fly can take it; every Master can. About two maps in three have an odd number of Stones; those have 1, 3 or 5 exactly on the symmetry line, one of them on the centre hex. It also has 3–10 Obstacles per Side, a random Theme, and always some water, all Shallow, in varying amounts and shapes: one large lake, a few lakes, many small pools, a thin river through the middle with fords, or thin streams, sometimes with a second, smaller kind as well. A walking Unit can always reach the other Master, every dry Stone and every dry hex but the pillars; a wading one can reach every Stone.
_Avoid_: Procedural map, generated level

**Theme**:
The look of a map: two visual variants each for Plain and Rough, and one Obstacle design for each Defense value (2, 4, 6). Each hex's variant is picked from its position unless the map sets it. Water looks the same in every Theme. A Theme changes only appearance, never rules.

**Zone of Control (ZOC)**:
The hexes next to a Unit that the Unit itself could move into. An opposing Unit that enters a ZOC must stop there for that turn. Fly Units ignore ZOC. A Unit that starts its turn in a ZOC may leave it.

## Economy

**Mana**:
A Side's resource for summoning. Abilities are free, so Mana only pays for Summons (and Upkeep comes out of Income). It is gained at the start of every Game Clock hour.

**Mana Income**:
What a Side gains each hour: 2 × (2 + Magic Stones controlled) × Master MP (with Alignment, at the Time of Day of that hour mark), minus the Upkeep of its Familiars. Mana never drops below 0 or rises above 120.

**Cost**:
The Mana needed to Summon a Familiar: a multiple of 8, from 16 to 88; each Element has exactly one Familiar at each Cost. It reflects the Familiar's power: its stats (Move most of all), Fly and its Ability (a ranged physical one, or a magical one by its shape), priced from a reference set of Familiars treated as balanced.

**Upkeep**:
A Familiar's hourly drain on its Side's Mana Income. It is always its Cost ÷ 8.

## AI

**Plan**:
What an AI Side is trying to do this turn: its Posture, its Front, its summon Needs, its Reserve and each Familiar's Job. Worked out fresh every turn from the board, and shown on screen for AI Sides.

**Posture**:
The blend of aims behind a Plan: Defend (the Master could die within about two turns), Expand (take unclaimed Stones first), Contest (take Stones where the Side is locally stronger), Squeeze (ahead on income with its Stones safe: hold and push patiently) and Kill (overwhelmingly ahead: go for the enemy Master).

**Front**:
The hex an AI Side works toward: usually a Stone it doesn't hold; the enemy Master when going for the kill; the threatening enemy when defending. The Master stays behind the Front, so the Familiars it summons appear near it.

**Need**:
What the next Familiar should be good at (grabbing Stones, answering a particular enemy, healing, holding, hunting the Master, fighting), with a weight from the Posture. A Familiar's summon value is how well it fits the Needs, less what its Cost is worth: never its Cost for its own sake.

**Reserve**:
Mana an AI Side keeps back so that it can still summon an answer to the most dangerous Familiar the opponent could summon next.

**Job**:
The one objective an AI Side gives each of its Familiars: a Stone to take or guard, an enemy to hunt, or the Front.
