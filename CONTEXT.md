# magica

A rules-deterministic, turn-based hex tactics game in which two Masters fight with elemental Familiars. This glossary fixes the vocabulary used by the rules, the AI and the UI.

## Units

**Unit**:
Any piece on the map that takes turns. Every Unit has exactly 10 HP.
_Avoid_: Piece, character, monster

**Master**:
The single leader Unit of each Side. It has no Magic Abilities and is the only Unit that can Summon; its MP sets its Side's Mana Income. There is no limit on how many Familiars a Side may have on the map. When it dies, its Side loses. Each Side picks one of thirty Masters before the match; they differ in stats, and a few attack at range or have an Element or Alignment. Every Master's stats fit the Stat Budget. Both Sides may pick the same one.
_Avoid_: Summoner, hero, commander

**Loadout**:
A set of exactly 20 of the 40 Familiars: the only Familiars a Side may Summon in a match. It is chosen separately from the Master. Players save Loadouts in the browser; none ship with the game. A Loadout saved when Loadouts were smaller stays saved but can't be played until it is edited to 20. A Side may also take a **random Loadout**: 20 Familiars drawn at random, at least two of them an Element's cheapest Familiar, or one the AI builds for its Master. Both Sides' Loadouts, and the Familiars each one leaves out, are visible to both players during the match.
_Avoid_: Deck, army, roster (as a player-facing term)

**Test Match**:
A match where both Sides may Summon all 40 Familiars, ignoring Loadouts. For trying things out.

**Match Setup**:
The choices made before a match: the map, whether it is a Test Match, and for each Side its Master, its Loadout and whether a person or the AI plays it.

**Pause**:
Stopping a match in place: no turn starts and no Command can be given until it is resumed. The map can still be looked at and Units inspected.

**Replay**:
A recorded match that can be watched back turn by turn, played forward, stepped back or jumped to any turn. Every match is recorded; the most recent ones are kept for a while and a player can save one to keep it. A Replay shows the match with the unit stats and abilities in force when it was played. From any turn of a Replay, the player can **Play from here**: the match continues live from that position, with each Side played by a person or the AI.
_Avoid_: Recording, demo, VOD

**Familiar**:
A Unit that a Master brings onto a hex next to it. The new Familiar faces the way it was summoned, and so does the Master. There are 40 kinds, ten per Element, one at each Cost from 16 to 88 in steps of 8, each with a role (a Stone grabber, a workhorse, a sniper, a healer, a stallbreaker and so on); 19 of them have a Magic Ability.
_Avoid_: Summon (as a noun; "Summon" is the Command), monster, minion, creature

**Side**:
One of the two opposing players (human or AI) and every Unit they control. The Side Colour is green for the human player by default and red for the opponent.
_Avoid_: Team, faction, player (when meaning the group of Units)

## Stats

**Attack (ATK)**: Contributes to the damage dealt by the Attack Command. ATK, DEF, MP and MDF are small numbers (about 0–10) on the same scale as HP: a point of ATK is a point of damage.
**Defense (DEF)**: Reduces damage taken from the Attack Command.
**Magic Power (MP)**: Contributes to the damage or healing of the Magic Command (a heal restores as much HP as the healer's MP). A Familiar with no Magic Ability has MP 0, since MP does nothing without one. For a Master it is also the key factor in Mana generation.
**Magic Defense (MDF)**: Reduces damage taken from the Magic Command.
**Speed (SPD)**: Decides how soon a Unit acts again (see Action Value). The average is about 10, and most Units fall between 8 and 15.
**Move (MOV)**: The Move Points a Unit can spend in one turn.

**Stat Budget**:
The hidden exchange rate that keeps Masters balanced: each stat is priced in Magic Power, and every Master's stats add up to the same total. Speed and Move are dear, Defense and Magic Defense cheaper, and Attack is priced by how far it reaches (Move plus Attack range): free for a slow melee Master, dearer with every extra hex of Move or range. Magic Defense has a floor: Magic reaches further than most Attacks, so a Master keeps Magic Defense of at least 3, and at most one Master may have 2.
_Avoid_: Point buy, stat total

**Move Type**:
A way of moving: Walk, Slow, Fly, Swim or Wade. A Unit can have several Move Types and uses the cheapest one that applies when it enters each hex. Slow only ever comes paired with Swim: it marks swimmers that move with difficulty on land.
_Avoid_: Movement class

**Move Range**:
The hexes a Unit can end its move on this turn.

**Attack Reach** / **Magic Reach**:
Every hex a Unit could hit with its Attack Ability (or targeted Magic Ability) from some hex in its Move Range. Magic Reach is shown whether or not the Mana is available.
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
The AV a Unit gets after its turn: the Base Delay, plus half the Base Delay for each of Move, Attack, Magic and Summon that it used, rounded at the end. A new Familiar enters with the Turn Delay of a Move followed by an Attack.

**Action Timeline**:
The UI list of upcoming turns in the order the AV system gives. While a Command is hovered but not yet confirmed, the acting Unit's icon is shown where that Command's Turn Delay would place it.
_Avoid_: Turn order bar, queue

**Time of Day**:
Day runs 08:00–16:00 and Night 20:00–04:00. The hours between are Neutral.

**Time Limit**:
A match ends 72 Game Clock hours after it starts if no Master has fallen. The Side controlling more Magic Stones then wins; if they are level, the Side with more total HP across its Units; if that is level too, the match is a draw.

**Alignment**:
Whether a Familiar is tied to Day, to Night, or to neither. At its aligned Time of Day its ATK, DEF, MP and MDF are 1 higher; at the opposite one they are 1 lower. Speed and Move are never changed by Alignment.

## Turn structure

**Command**:
What a Unit does after it Moves, or after it chooses not to: Wait, Attack, Magic or Summon. The player chooses Facing only for Wait. Attack and Magic turn the Unit to face its target (the Unit attacked, or the hex the Magic was aimed at), and Summon turns the Master toward the summoned hex.
_Avoid_: Action (when meaning a menu choice)

**Attack Ability** / **Magic Ability**:
The rules for a Unit's Attack or Magic Command: a range (a maximum only, with no minimum), an area and an effect. Damaging abilities only ever hit enemies and Obstacles, never the user or allies, except a Burst. Heals hit allies and may include the caster. Areas reach 1 hex around the aimed hex (2 for a Burst). A High area spell's splash comes from the hex it lands on, so Facing for the Units around it is measured from there. Abilities have no power of their own: their strength comes only from the user's ATK or MP. 19 of the 40 Familiars have one Magic Ability and the rest have none (units that already attack at range usually don't need one); Masters have none.
_Avoid_: Skill, spell (as a code term)

**Burst**:
A damaging Magic Ability centred on the caster, with no range: it hits every Unit and Obstacle within 1 or 2 hexes, allies included, but never the caster.
_Avoid_: Nova, self-AoE

**Trajectory**:
How a ranged Attack or Magic Ability (range above 1) travels. **High** arcs over everything and always reaches a target in range. **Direct** flies straight and needs a Clear Angle. Abilities with range 1 have no Trajectory.
_Avoid_: Fire mode, arc type

**Clear Angle**:
Whether a Direct shot can reach its target. Seen from above, every Unit and Obstacle is a body of a standard size at its hex centre, and the shot is a small projectile. The angle is clear when some straight line from the shooter to any point across the target's body passes every other body, allies included. Height, Pits, water and Magic Stones never block.

**Stranded**:
A Unit that starts its turn on a hex none of its Move Types may enter. It takes 1 damage, then may move by its normal rules into hexes it can enter, and then act as usual. If it stays where it is, it can only Wait.

## Facing and damage

**Facing**:
One of the six hex directions a Unit faces.

**Facing Bonus**:
A flat amount added to damage by the angle between a defender's Facing and the direction the hit comes from: under 90° (Front) +0, 90° up to 120° (Flank) +1, 120° and more (Back) +2. So an adjacent hit from the front or a front side adds 0, from a rear side or from behind +2. It applies to both Attack and Magic.
_Avoid_: Backstab bonus, flanking

**Damage**:
Attacker's ATK − defender's DEF + Element Bonus + Facing Bonus − the defender's terrain cover; MP and MDF for Magic. Alignment changes the stats first. A result of 0 or less deals 0: there is no minimum. It is not limited by the defender's remaining HP (the Damage Number shows it all), but HP never drops below 0. For example, ATK 5 against DEF 1 with a Counter from behind deals 5 − 1 + 4 + 2 = 10.

**Damage Preview**:
The exact result of a Command against a target, shown before the Command is confirmed, as a Damage Number over each target.

**Damage Number**:
The floating amount of damage (or healing) a Command does to one target: shown in the Damage Preview, and popped briefly again the moment the hit lands. A target's HP changes at that moment, not when the turn ends; a unit brought to 0 HP fades out then.

## Terrain

**Height**:
How high a hex is. Walk and Slow can climb at most 1 Height per hex they move, at +1 Move Point; going down 1 Height is free. Fly ignores Height.

**Water Level**:
The map's water surface Height. No unit can change it at present: Rise and Ebb, which change it by one step at a time from 1 below its starting value to 1 above it, are defined but no unit has them. Every map with water keeps some Deep Water at the lowest level, and the highest level floods at most 40% of the map. On maps with no water, neither spell can be cast. A hex 1 below the Water Level is **Shallow Water**; a hex 2 or more below it is **Deep Water**.

**Plain**:
The default ground. Entering it costs 1 Move Point for Walk or Fly and 2 for Slow. It gives no defense bonus.

**Rough**:
Hard ground. Entering it costs 1 Move Point for Fly, 2 for Walk and 3 for Slow. It takes 1 off every Attack and Magic hit.

**Magic Stone**:
A hex type of its own, never Rough, though it may be under water. A Unit standing on it takes 1 less damage from every hit. The Side that controls it gains more Mana.
_Avoid_: Crystal, pedestal

**Stone Heal**:
Any Unit that starts its turn on a Magic Stone, whoever controls it, heals 1 HP, up to 10. A Stranded Unit takes the Stranded damage first.

**Capture**:
A Unit that ends its turn on a Magic Stone gives control of the Stone to its Side. Being Summoned onto a Stone does not count. Control lasts until an enemy Unit Captures it, including while the Stone is under water.

**Pit**:
A hex type of its own that no Unit can stand on: a chasm, a lava pool, spikes, whatever the Theme draws. Only Fly can cross it. It never fills with water and does not count for the Water Level rules. It does not block a shot.
_Avoid_: Chasm, hole, void (as the rules term)

**Obstacle**:
A neutral map object placed on dry Plain or Rough at the start of a match. No Unit can stand on its hex, and only Fly can cross it. It blocks Direct shots but not High ones. Both Sides may Attack it or hit it with damaging Magic, area Magic included; it cannot be healed and exerts no ZOC. It has 10 HP like a Unit, no Element and no Facing, and its Defense and Magic Defense are equal: 2, 4 or 6. Destroyed at 0 HP, leaving the hex beneath. It stays, and keeps blocking, if water rises over it.
_Avoid_: Wall, prop, blocker

**Theme**:
The look of a map: two visual variants each for Plain and Rough, one for Pit, and one Obstacle design for each Defense value (2, 4, 6). Each hex's variant is picked from its position unless the map sets it. Water looks the same in every Theme. A Theme changes only appearance, never rules.

**Zone of Control (ZOC)**:
The hexes next to a Unit that the Unit itself could move into. An opposing Unit that enters a ZOC must stop there for that turn. Fly Units ignore ZOC. A Unit that starts its turn in a ZOC may leave it.

## Economy

**Mana**:
A Side's shared resource for summoning and for every Magic Ability its Units cast, Masters' and Familiars' alike. It is gained at the start of every Game Clock hour.

**Mana Income**:
What a Side gains each hour: 2 × (2 + Magic Stones controlled) × Master MP, minus the Upkeep of its Familiars. Mana never drops below 0 or rises above 120.

**Cost**:
The Mana needed to Summon a Familiar: a multiple of 8, from 16 to 88; each Element has exactly one Familiar at each Cost. It reflects the Familiar's power: its stats (Move most of all), Fly, a ranged Attack and its Magic Ability, priced from a reference set of Familiars treated as balanced.

**Upkeep**:
A Familiar's hourly drain on its Side's Mana Income. It is always its Cost ÷ 8.
