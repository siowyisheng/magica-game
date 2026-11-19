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
| `src/store.ts` | UI state machine (move → command → target → facing). It produces one `TurnAction` for the rules. |
| `src/render/` | three.js scene: isometric orthographic camera, hex columns, water, stones, highlights, procedural billboard sprites, and a pixelation pass (low-DPR canvas upscaled with nearest-neighbour). |
| `src/ui/` | Action Timeline, info panel, command menu, damage preview, and the floating HP/AV overlay. |

## Controls

- **Left-click**: choose a destination (or click the unit itself to stay), then a command, a target, and a facing.
- **Right-click**: go back a step (in the command menu this cancels the move).
- **Right-drag**: pan. **Mouse wheel**: zoom.
- Hover a timeline entry to highlight its unit, or hover a unit to highlight its timeline entries.
- While hovering a destination or command, the acting unit's icon jumps to its previewed slot on the timeline.
- Options panel: toggle the HP/AV bars, change pixel size, switch Red to hotseat, or make Green an AI.

## Scaffold simplifications

- All Summon names, stats and costs are placeholders: data in `src/rules/data/summons.ts`.
- Timeline entries after a unit's next turn are *projections* that assume a Move + Attack turn. They are drawn dotted.
- There are no animations beyond position easing, and no sound, status effects, line of sight or Tauri packaging yet.
