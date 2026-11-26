# Online play

Two players on different machines play an **Online Match** (see `CONTEXT.md`). Their games
talk directly to each other (a WebRTC data channel). The server only introduces them
and stores the **Match Reports** they send at the end. It never sees or checks the moves.

```
browser A ──── moves (WebRTC data channel) ──── browser B
     \                                            /
      └── introductions (WebSocket) ── server ───┘
      └── Match Reports (HTTP) ────────┘
```

## Pieces

| Path | What |
| --- | --- |
| `src/online/clock.ts` | Turn Timer (10 s), Time Bank (60 s), Planning Phase (30 s), Pause and Abandon limits. Pure. |
| `src/online/report.ts` | The Match Report, what two reports must agree on, and the result status (Confirmed / Contested / Unconfirmed). Shared with the server. |
| `src/online/protocol.ts` | Messages between the two games and between a game and the server. |
| `src/online/fingerprint.ts` | Hash commitments for the hidden picks, and the rules fingerprint both games must share. |
| `src/online/link.ts` | The connection: WebSocket introductions, then the WebRTC data channel (Green offers, Red answers; public STUN, no relay yet). |
| `src/online/session.ts` | The Online Match from one player's side: picks, Planning Phase, turns, clocks, Pause, Resign, Abandon, rejoin, the report. It drives the normal game store. |
| `src/online/api.ts` | The server's HTTP API and this browser's Player ID. |
| `src/ui/OnlineScreen.tsx`, `src/ui/OnlinePanel.tsx` | The Online screen (create, join, rejoin, Online History) and everything shown over the board. |
| `server/` | The server: `app.ts` (HTTP + WebSocket), `db.ts` (libSQL), `main.ts`. |

## How a match runs

1. **Create and join.** The creator asks the server for a **Game ID** and shares it (or a link with `?join=ID`). When the second player joins, the server seats them and flips a coin: one is Green, and Green moves first. It also hands both the same seed.
2. **Connect.** Over the server's WebSocket, the two browsers set up a direct channel. They first swap `hello`: protocol and **rules fingerprint** (format versions plus every Unit's stats and Ability under the shipped balance). If those differ, the match doesn't start. Online Matches always use the shipped balance (`applyTemporaryBalance(getRepoBalance())`); local dev-tool edits are set aside. The creator also sends the map.
3. **Hidden picks.** Each player locks a Master and Loadout by sending only a SHA-256 commitment of the pick plus a random salt. When both are locked, both reveal, and each checks the other's reveal against its commitment.
4. **Planning Phase.** 30 s (no clock), ends early when both are Ready.
5. **Turns.** Each turn travels as `{n, action, ms}`: its index, the `TurnAction`, and the time it took. Both games apply it with the same deterministic rules.
   - **Clock rules:** a turn's clock runs only while no animation plays and the match isn't Paused. The first 10 s are free; after that the Time Bank drains.
   - **Timeouts:** when both run out, the mover's own game plays a Wait (a **Timeout**). If the mover is silent 5 s past their clock, the other game plays the Timeout for them. If that Timeout crosses a late move from the mover, the Timeout stands, and the mover's game rebuilds its position from the move list.
6. **Pause.** Either player may Pause (3 each), either may resume, and a Pause ends by itself after 2 minutes.
7. **Disconnects.** The games ping every 2 s; 8 s of silence counts as a drop, and the games keep asking the server to pair them again.
   - **Rejoin:** a player who reloads uses **Rejoin** on the Online screen. The game that knows more sends a `sync` with the picks and every turn.
   - **Abandon:** after 2 minutes away, the other player can claim the win.
8. **The end.** A Master falls, the Time Limit passes, someone Resigns, or someone Abandons.
   - **Reports:** each game sends a Match Report (Game ID, both Player IDs, result and reason, the Replay with turn times and Timeouts, rules fingerprint).
   - **Status:** the server compares the two on everything except turn times. **Confirmed** if they agree, **Contested** if not, **Unconfirmed** if the second hasn't come 10 minutes after the first.
   - **Storage:** reports are stored gzipped (about 3–5 KB each); an identical second report is stored once.

**Player IDs** have no accounts. On first use the browser registers and keeps `{playerId, key}` in `localStorage`; the key authenticates its reports, and only games the server created with that player in them are accepted.

## Running it locally

```bash
npm run server   # http://localhost:8787, data in ./magica.db
npm run dev      # the game; it looks for the server at http://localhost:8787
```

Open the game in two browser profiles (or one normal and one private window), choose **Online…** in both, create in one and join with the Game ID in the other.

## Deploying (free tiers)

**The server: Render (free web service) and Turso (free database).** Render's free disk is wiped on each deploy, so the reports live in Turso.

1. **Database:** create a Turso database and a token:

   ```bash
   turso db create magica
   ```

   ```bash
   turso db show magica --url
   ```

   ```bash
   turso db tokens create magica
   ```

2. **Server:** on Render, create a Blueprint from this repo (`render.yaml`). It sets up the `magica-server` web service. In its environment, set `DATABASE_URL` (the `libsql://…` URL) and `DATABASE_AUTH_TOKEN`.
3. **The game:** build it with the server's address, then host `dist/` anywhere static (a Render static site, GitHub Pages, Netlify):

   ```bash
   VITE_MAGICA_SERVER=https://magica-server.onrender.com npm run build
   ```

**Free-tier fit.**
- **Sleeping:** Render's free service sleeps after ~15 idle minutes and takes about a minute to wake. The Online screen wakes it as soon as it opens. The server is only needed to start, rejoin and report a match; the moves don't go through it.
- **Storage:** one report is ~3–5 KB gzipped, two per match, and the second is often stored once. Turso's free plan (~5 GB, ~10M row writes a month) holds hundreds of thousands of matches.
- **Requests:** a match makes a handful of HTTP calls and one short WebSocket session per player.

## Not yet

- **Relay:** there is no TURN relay. Players behind strict networks see "Couldn't connect directly". Adding one is a change to `ICE_SERVERS` in `link.ts`.
- **Missing features:** matchmaking, ratings, chat, spectators and rematch.
- **Contested results:** the server stores both reports, but nothing resolves a Contested match yet.
