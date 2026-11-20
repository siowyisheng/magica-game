# magica

A rules-deterministic, turn-based hex tactics game in the spirit of Vantage Master. This repo is a **scaffold** built with React, three.js (react-three-fiber) and Vite.

- Vocabulary: [`CONTEXT.md`](./CONTEXT.md)
- Architecture decision: [`docs/adr/0001-deterministic-rules-core.md`](./docs/adr/0001-deterministic-rules-core.md)
- Background: [`handoff-magica-engine-and-art.md`](./handoff-magica-engine-and-art.md)

```bash
npm install
npm run dev      # play at http://localhost:5173
npm test         # rules + headless AI-vs-AI match
npm run build
```

## Layout

| Path | What |
| --- | --- |
| `src/rules/` | Pure TypeScript rules core: no React, three.js or DOM, integer math only. Hex math, terrain and movement (Move Types, Height, Water Level, ZOC), combat (damage = 3 × ATK/DEF or MP/MDF × Element × hex-ring Facing Modifier × cover × Alignment; abilities have only a maximum range and no power), AV / Turn Delay, Mana, Summoning, Capture, Stranded, Stone Heal, timeline projection. |
| `src/rules/data/` | Tuning tables (Base Delay by Speed, Mana and cover constants), the Summoner and the 28 placeholder Summons. |
| `src/rules/maps/scaffold.ts` | The fixed 15×13 map with 7 Magic Stones and a river (Water Level 2). |
| `src/ai/ai.ts` | One-ply, timeline-aware AI. It scores every reachable hex × Command × target, including the threat from enemies who act before its next turn. Weights live in `AI_WEIGHTS`. |
| `src/store.ts` | UI state machine (move → command menu with facing → target). It produces one `TurnAction` for the rules. |
| `src/render/` | three.js scene: orthographic camera, themed hex columns (`themes.ts`, `Terrain.tsx`), Pits, Obstacles, water, stones, highlights, and the unit sprites, rendered from small 3D part models into cel-shaded pixel art (`spritegen/`). |
| `src/editor/` | The map editor screen and its state (draft, tools, mirroring, undo / redo). |
| `src/maps/` | Map library: built-in maps plus your own, saved in the browser, with JSON import / export. |
| `src/anim.ts` | Pure turn-animation plan (slide along path, melee wind-up and bonk, projectiles, hit shake). The board samples it, and the store applies the new state when it ends. |
| `src/audio/` | Procedural music and sound effects (Web Audio; no audio files): five composed tracks with a smart shuffle, a synthesized effect for every action, and the hooks that time them to the turn animations. |
| `src/ui/` | Action Timeline, info panel, command menu, damage preview, and the floating HP/AV overlay. |

## Controls

- On your turn the acting unit is **selected**. A white line traces the outer edge of its Move Range. Units it can act on right now get a coloured sprite outline: red for Attack, blue for Magic, flashing red/blue for both, green for a heal.
- **Left-click** a blue hex to move there (or the unit itself to stay), which opens the command menu. While the menu is open, left-click the map to set Facing for Wait. Attack and Magic always face the target.
- **Hover a unit in reach** to see translucent ghosts at the hexes it would Attack (A) and cast Magic (M) from (best Facing Modifier, then farthest, then not moving), a yellow outline around every hex it could act from, and both previews. **Left-click** it to move there and act. If both Attack and Magic are possible, you pick one.
- **Right-click a unit** to toggle its ranges (up to 3; they clear when the turn ends): its Move Range in a pale line of its Side colour, Attack Reach as a red dashed line, Magic Reach as a blue dashed line. Right-click elsewhere, or left-click outside the ranges, to deselect. Then click anywhere to select the unit again.
- **Right-click** in menus goes back a step (in the command menu it cancels the move; while placing a summon it returns to the summon list).
- **Right-drag**: pan. **Mouse wheel**: zoom.
- The Action Timeline floats over the top of the board. It shows the acting unit and the next 15 actions in order, not scaled by time, with faint hour marks. Entries slide to their new places after each turn and while a command is previewed.
- Hover a timeline entry to highlight its unit, or hover a unit to highlight its timeline entries.
- While hovering a destination or command, the acting unit's icon jumps to its previewed slot on the timeline.
- Options panel: toggle the HP/AV bars, switch Red to hotseat, make Green an AI, pick the map for New match, or open the Map Editor. Music and Sound volume sliders, Mute, the current track and a next-track button (saved between visits).

## Maps

- **Terrain:** Plain, Rough, Magic Stone and **Pit** (only Fly crosses; nobody stands on it; never fills with water), plus water by depth.
- **Obstacles:** neutral objects with 10 HP and DEF = MDF of 5, 10 or 15. They block ground movement and Direct shots; Fly passes over and High shots arc over. Either side can break them.
- **Trajectory:** every ranged Attack or Magic is **High** (arcs over everything) or **Direct** (needs a Clear Angle past every other Unit and Obstacle, allies included). A blocked Direct shot shows "No clear shot".
- **Themes:** Meadow, Desert, Ruins, Tundra and Volcanic. Each has two looks for Plain and Rough, a Pit and three Obstacles. Plain is always flat, Rough always has raised clutter, a Pit is always a hole, and bigger Obstacles have more Defense.
- **Map Editor** (Options → Map Editor):
  - Tools (keys 1–9): Plain, Rough, Pit, Magic Stone, Height (click raises, right-click lowers), Obstacle (pick 5 / 10 / 15), Look (auto / A / B), and the two spawns (click a spawn again to turn it). Drag to paint; right-click does the opposite of the tool.
  - Settings: name, Theme, size (7–21 × 7–21), starting Water Level and start time. Mirror copies every edit top ↔ bottom.
  - Undo / Redo (Ctrl+Z / Ctrl+Y), live problem list, Save / Save as new / Delete, Export / Import JSON, and Play this map.
  - Your maps are kept in this browser. Built-in maps can't be overwritten: saving one makes your own copy.

## Sound

Audio starts with your first click or key press, because browsers block it before that.

- **Music**: five tracks: *Dawn March* (day), *Highland Wind* (day), *Moonlit Tide* (night, calm), *Stone Vigil* (night, tense) and *Ember Skirmish* (any time, intense). Each plays for about 2½ minutes, then the shuffle picks the next. It never repeats either of the last two tracks, and it favours tracks that suit the Time of Day and how tense the battle is (units close to enemies, a hurt Summoner). If the mood clearly changes (dusk falls during a day track, a fight breaks out during a calm one), it crossfades early at a bar line.
- **Effects**: clicks and hovers on every control; select / back / deny / facing ticks on the map; footsteps that depend on how the unit moves (walk, wade, swim, fly) and its weight; melee swings and impacts scaled by damage, a clink for 0 damage, arrows, a cast sound per element, heals, deaths; the summoning charge and appearance; the capture bell (major when you capture, minor when the enemy does); Rise / Ebb; the hourly Mana chime; your turn starting; Stranded; dawn and dusk; victory and defeat (the music ducks under them). Effects are timed to the turn animations.

## Scaffold simplifications

- All Summon names, stats and costs are placeholders: data in `src/rules/data/summons.ts`.
- Timeline entries after a unit's next turn are *projections* that assume a Move + Attack turn. They are drawn dotted.
- Animations are simple (slides, bonks, projectiles). There's no sound, status effects, line of sight or Tauri packaging yet.
