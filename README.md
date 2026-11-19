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
| `src/rules/` | Pure TypeScript rules core: no React, three.js or DOM, integer math only. Hex math, terrain and movement (Move Types, Height, Water Level, ZOC), combat (ratio damage, Element, hex-ring Facing Modifier, cover, Alignment), AV / Turn Delay, Mana, Summoning, Capture, Stranded, Stone Heal, timeline projection. |
| `src/rules/data/` | Tuning tables (Base Delay by Speed, Mana and cover constants), the Summoner and the 28 placeholder Summons. |
| `src/rules/maps/scaffold.ts` | The fixed 15×13 map with 7 Magic Stones and a river (Water Level 2). |
| `src/ai/ai.ts` | One-ply, timeline-aware AI. It scores every reachable hex × Command × target, including the threat from enemies who act before its next turn. Weights live in `AI_WEIGHTS`. |
| `src/store.ts` | UI state machine (move → command menu with facing → target). It produces one `TurnAction` for the rules. |
| `src/render/` | three.js scene: isometric orthographic camera, hex columns, water, stones, highlights, procedural billboard sprites, and a pixelation pass (low-DPR canvas upscaled with nearest-neighbour). |
| `src/anim.ts` | Pure turn-animation plan (slide along path, melee wind-up and bonk, projectiles, hit shake). The board samples it, and the store applies the new state when it ends. |
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
- Options panel: toggle the HP/AV bars, change pixel size, switch Red to hotseat, or make Green an AI.

## Scaffold simplifications

- All Summon names, stats and costs are placeholders: data in `src/rules/data/summons.ts`.
- Timeline entries after a unit's next turn are *projections* that assume a Move + Attack turn. They are drawn dotted.
- Animations are simple (slides, bonks, projectiles). There's no sound, status effects, line of sight or Tauri packaging yet.
