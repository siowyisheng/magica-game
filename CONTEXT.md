# magica

A rules-deterministic, turn-based hex tactics game in which two Summoners fight with elemental Summons. This glossary fixes the vocabulary used by the rules, the AI and the UI.

## Units

**Unit**:
Any piece on the map that takes turns. Every Unit has exactly 10 HP.
_Avoid_: Piece, character, monster

**Summoner**:
The single leader Unit of each Side. It casts several Magic Abilities and is the only Unit that can Summon. When it dies, its Side loses.
_Avoid_: Master, hero, commander

**Summon**:
A Unit that a Summoner brings onto the map. One of 28 kinds, seven per Element. Each has exactly one Magic Ability.
_Avoid_: Monster, minion, creature

**Side**:
One of the two opposing players (human or AI) and every Unit they control.
_Avoid_: Team, faction, player (when meaning the group of Units)

## Stats

**Attack (ATK)**: Contributes to the damage dealt by the Attack Command.
**Defense (DEF)**: Reduces damage taken from the Attack Command.
**Magic Power (MP)**: Contributes to the damage or healing of the Magic Command. For a Summoner it is also the key factor in Mana generation.
**Magic Defense (MDF)**: Reduces damage taken from the Magic Command.
**Speed (SPD)**: Decides how soon a Unit acts again (see Action Value). The average is about 10, and most Units fall between 8 and 15.
**Move (MOV)**: The Move Points a Unit can spend in one turn.

**Move Type**:
A way of moving: Walk, Slow, Fly, Swim or Wade. A Unit can have several Move Types and uses the cheapest one that applies when it enters each hex.
_Avoid_: Movement class

## Elements

**Element**:
One of Fire, Air, Earth or Water. Each Summon has one Element. A Summoner has none.

**Counter**:
Fire counters Air, Air counters Earth, Earth counters Water, and Water counters Fire. A Counter does ×2 damage; being Countered does ×0.5. Opposite Elements (Fire–Earth, Air–Water) are neutral.
_Avoid_: Weakness, advantage

## Turns and time

**Game Clock**:
The match's 24-hour in-game time. One minute of Game Clock equals one point of Action Value. In the scaffold it starts at 06:00.

**Action Value (AV)**:
How many Game Clock minutes are left before a Unit acts next. The Unit with the lowest AV acts.
_Avoid_: Initiative, ticks, ATB

**Base Delay**:
The AV a Unit gets after a turn in which it only Waits. It depends only on Speed.

**Turn Delay**:
The AV a Unit gets after its turn: the Base Delay, plus half the Base Delay for each of Move, Attack, Magic and Summon that it used, rounded at the end. A new Summon enters with the Turn Delay of a Move followed by an Attack.

**Action Timeline**:
The UI list of upcoming turns in the order the AV system gives. While a Command is hovered but not yet confirmed, the acting Unit's icon is shown where that Command's Turn Delay would place it.
_Avoid_: Turn order bar, queue

**Time of Day**:
Day runs 08:00–16:00 and Night 20:00–04:00. The hours between are Neutral.

**Alignment**:
Whether a Summon is tied to Day, to Night, or to neither. It gets stat bonuses at its aligned Time of Day and penalties at the opposite one.

## Turn structure

**Command**:
What a Unit does after it Moves, or after it chooses not to: Wait, Attack, Magic or Summon. Choosing a Facing comes before the Command.
_Avoid_: Action (when meaning a menu choice)

**Attack Ability** / **Magic Ability**:
The rules for a Unit's Attack or Magic Command: minimum and maximum range, valid targets and effects. Summons have one Magic Ability; Summoners have several.
_Avoid_: Skill, spell (as a code term)

**Stranded**:
A Unit that starts its turn on a hex none of its Move Types may enter. It takes 1 damage and can only Wait.

## Facing and damage

**Facing**:
One of the six hex directions a Unit faces.

**Facing Modifier**:
A damage multiplier based on the angle between a defender's Facing and the direction the hit comes from: ×1.0 at 0°, ×1.2 at 60°, ×1.6 at 120° and ×2.0 at 180°, interpolated for angles in between. It applies to both Attack and Magic.
_Avoid_: Backstab bonus, flanking

**Damage Preview**:
The exact result of a Command against a target, shown before the Command is confirmed.

## Terrain

**Height**:
How high a hex is. Walk and Slow can climb at most 1 Height per hex they move, at +1 Move Point; going down 1 Height is free. Fly ignores Height.

**Water Level**:
The map's water surface Height. Spells can raise or lower it. A hex 1 below the Water Level is **Shallow Water**; a hex 2 or more below it is **Deep Water**.

**Plain**:
The default ground. Entering it costs 1 Move Point for Walk or Fly and 2 for Slow. It gives no defense bonus.

**Rough**:
Hard ground. Entering it costs 1 Move Point for Fly, 2 for Walk and 3 for Slow. It gives a 20% defense bonus.

**Magic Stone**:
A special hex. A Unit standing on it takes less damage, and it raises Mana generation for the Side that controls it.
