# Handoff: magica (VMO spiritual successor) — engine and art-asset strategy

## Project context
- **magica**: a rules-deterministic spiritual successor to Vantage Master Online, for Steam on Windows PC.
- Reference gameplay (user screenshot of Vantage Master V2): isometric hex grid, stepped terrain heights, small chunky unit sprites, dark moody palettes, framed UI windows (command menu: Wait/Attack/Magic/Summon, info window, minimap), large anime-style dialog portraits, a storm-sky background. Used for genre/feel only. Do NOT copy, trace or imitate its art.
- No Project docs, specs, ADRs, repos or commits exist yet. Nothing has been built. This conversation produced advice only.
- User: most comfortable with React; wants Tauri packaging; fears being blocked later by not using Godot/Unity. Not good at drawing, no budget for an artist, willing to compromise on graphics and wants high-leverage strategies.

## Decisions / recommendations so far
### Engine
- Stay with **React + a desktop shell**; Godot is the fallback, Unity is not recommended (overkill for this, licensing history).
- Keep the **rules engine a pure, engine-agnostic TypeScript library**: integer math only, seeded PRNG, no wall-clock time, no iteration over unordered collections, event-sourced input log (enables replays, desync checks, server validation, and a later port of the presentation layer).
- **Steam risks with web shells:** Steamworks integration (Electron + `steamworks.js` is more proven; Tauri needs Rust `steamworks-rs`), Steam overlay flakiness with WebView2/Chromium, controller/Steam Deck support, WebView2 dependency. I did NOT verify the current state of Tauri's Steam overlay support; this needs checking.
- Suggested de-risking: a one-week spike (Tauri and Electron) with Steamworks init, one achievement, overlay on, controller test.

### Art (revised after the user said: no artist, can't draw)
- Core idea: let the **rendering pipeline carry consistency**, not hand-drawn art.
- Primary approach: **real-time low-poly 3D in react-three-fiber**, fixed isometric orthographic camera, hex grid, low-res render target upscaled with nearest-neighbor, palette-quantize/posterize + outline + dither shader. Terrain = hex tile kit placed from map data (height = Y offset). Units = rigged glTF with shared animations; faction colors via palette swap/tint. Effects = particle systems.
- Honest trade-off: looks like "3D with a retro filter", not authentic 16-bit sprites. This also nudges the engine question slightly toward Godot 4 (built-in 3D/shaders); the separated rules core keeps that option open.
- Asset sources: CC0 low-poly packs (Kenney, Quaternius, KayKit; pick 1–2 from the same author), Mixamo or bundled animations (verify Adobe terms), kitbashing in Blender, UI built in CSS/React with 9-slice frames + open-licensed pixel font + icons (Kenney / game-icons.net, the latter needs attribution), procedural particle effects, shader-based skies/lightning.
- **Portraits: the one place to use AI**, only for ~10–20 named characters, one tool, a locked prompt template and style reference, a unifying palette/frame filter. Generic units use class icons plus 3D models. Must disclose AI use on the Steam page; check tool commercial terms and Valve's current wording.
- Consistency layer: one lighting rig, one camera, one post-process shader, one master palette, per-biome color grading, a single outline rule, and a **license ledger** (asset, source, license, attribution) from day one.
- Risks: free packs look recognizable ("asset flip"); coverage gaps for creatures; performance on average laptops; slipping in a non-commercial or attribution-required asset; unclear copyright on pure-AI output.
- Fallbacks if the 3D look test fails: (a) bake the same 3D scene to 2D sprite sheets via Blender/script; (b) flat vector/icon style.
- Earlier (superseded) plan, kept only for context: a hired pixel artist for a style bible, terrain kit, UI kit and keystone units, plus a Blender 3D-to-pixel sprite pipeline and a LoRA for portraits. The user rejected hiring.

## Proposed next steps (none started)
1. **Weekend look test** in react-three-fiber: hex grid with height variation, one rigged unit, the pixel/palette shader. User decides whether the look is acceptable.
2. Engine/shell spike (Tauri vs Electron) with Steamworks, overlay, controller.
3. Wire the deterministic rules core to the renderer; selection, move/attack highlights; CSS UI.
4. Build the roster via kitbash + palette swaps; first spell effects; portrait pass.
5. Small vertical slice for a Steam playtest / Coming Soon page.

## Open questions
- Game scope is assumed (2D→now 3D-ish, turn-based hex tactics, online play) and not confirmed with the user: multiplayer model (lockstep vs server-authoritative), single-player campaign, roster size.
- Whether the user accepts the 3D-with-retro-filter look.
- Tauri vs Electron final choice (pending spike).

## Offers already made to the user (unanswered)
- Build the r3f look-test scaffold (hex grid + palette shader).
- Write a license-ledger template and a shortlist of CC0 packs to check first.
- Write a style-bible template / validation script (from the earlier plan).
- Save the plans as a doc in the Project "magica (vmo)".

## Suggested skills for the next agent
- `mattpocock-skills:prototype` for the throwaway look test and the Steam shell spike.
- `mattpocock-skills:research` to verify primary-source facts: Tauri/Electron Steam overlay status, CC0 pack licenses, Mixamo terms, Steam AI-disclosure rules.
- `mattpocock-skills:grill-with-docs` or `mattpocock-skills:domain-modeling` to sharpen the game design and rules vocabulary (glossary/ADRs) before building the rules core.
- `mattpocock-skills:tdd` once building the deterministic rules core (replay/desync tests are a natural fit).
- `mattpocock-skills:to-spec` / `mattpocock-skills:to-tickets` to turn the agreed plan into trackable work.
- `anthropic-skills:frontend-design` if the CSS-based game UI needs visual polish.
