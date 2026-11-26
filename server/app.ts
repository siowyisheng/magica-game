// The Online Match server: introduces two players (WebSocket signalling for their
// direct connection) and receives Match Reports. It never sees the moves.
//
// HTTP (JSON):
//   GET  /api/health                      wake-up / liveness
//   POST /api/register {name}             → {playerId, key}
//   POST /api/name {playerId,key,name}
//   POST /api/games {playerId,key}        → {gameId}
//   POST /api/reports {playerId,key,report} → {status}
//   POST /api/history {playerId,key}      → {matches}
//   POST /api/replay {playerId,key,gameId} → {report}
// WebSocket /ws?playerId=&key=: {t:'join',gameId} then {t:'signal',data} both ways.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { WebSocketServer, type WebSocket } from 'ws';
import { addGame, addPlayer, addReport, gamesOf, getGame, getPlayer, renamePlayer, reportsOf, seatJoiner, type Db } from './db';
import { comparisonKey, resultStatus, type MatchReport } from '../src/online/report';
import type { ClientMsg, ServerMsg } from '../src/online/protocol';

/** Largest request body accepted (a long match's report is ~60 KB of JSON). */
const MAX_BODY = 1_000_000;
/** Requests per minute per address. */
const RATE_PER_MIN = 120;
const NAME_MAX = 24;
/** Game IDs: 6 letters and digits, without look-alikes. */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const cleanName = (n: unknown) => (typeof n === 'string' ? n.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX) : '') || 'Player';

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Options {
  db: Db;
  /** Clock (tests move it). */
  now?: () => number;
}

export function createApp({ db, now = Date.now }: Options): Server {
  const hits = new Map<string, { at: number; n: number }>();
  const limited = (ip: string) => {
    const t = now();
    const h = hits.get(ip);
    if (!h || t - h.at > 60_000) {
      hits.set(ip, { at: t, n: 1 });
      if (hits.size > 10_000) hits.clear();
      return false;
    }
    return ++h.n > RATE_PER_MIN;
  };

  const auth = async (body: Record<string, unknown>) => {
    const id = typeof body.playerId === 'string' ? body.playerId : '';
    const key = typeof body.key === 'string' ? body.key : '';
    const p = id && key ? await getPlayer(db, id) : null;
    if (!p || p.key_hash !== sha(key)) throw new HttpError(401, 'unknown player or wrong key');
    return p;
  };

  const routes: Record<string, (body: Record<string, unknown>) => Promise<unknown>> = {
    'GET /api/health': async () => ({ ok: true }),
    'POST /api/register': async (body) => {
      const playerId = `p_${randomBytes(9).toString('base64url')}`;
      const key = randomBytes(24).toString('base64url');
      await addPlayer(db, playerId, sha(key), cleanName(body.name));
      return { playerId, key };
    },
    'POST /api/name': async (body) => {
      const p = await auth(body);
      await renamePlayer(db, p.id, cleanName(body.name));
      return { ok: true };
    },
    'POST /api/games': async (body) => {
      const p = await auth(body);
      for (let i = 0; i < 5; i++) {
        const id = Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');
        if (await getGame(db, id)) continue;
        await addGame(db, id, p.id, randomInt(1, 2 ** 31 - 1), now());
        return { gameId: id };
      }
      throw new HttpError(500, 'could not make a Game ID');
    },
    'POST /api/reports': async (body) => {
      const p = await auth(body);
      const report = body.report as MatchReport | undefined;
      if (!report || typeof report !== 'object' || !report.replay || !report.result) throw new HttpError(400, 'not a Match Report');
      const game = await getGame(db, String(report.gameId));
      if (!game || !game.joiner) throw new HttpError(404, 'unknown game');
      if (p.id !== game.creator && p.id !== game.joiner) throw new HttpError(403, 'not your game');
      const red = game.green === game.creator ? game.joiner : game.creator;
      if (report.playerId !== p.id || report.players?.[0] !== game.green || report.players?.[1] !== red) throw new HttpError(400, 'the report names the wrong players');
      const key = sha(comparisonKey(report));
      const others = await reportsOf(db, game.id);
      // identical to the other player's report: keep one copy
      const same = others.some((o) => o.player_id !== p.id && o.compare_key === key && o.body);
      await addReport(db, game.id, p.id, key, same ? null : gzipSync(JSON.stringify(report)), now());
      return { status: await statusOf(game.id) };
    },
    'POST /api/history': async (body) => {
      const p = await auth(body);
      const games = await gamesOf(db, p.id);
      const matches = [];
      for (const g of games) {
        const other = g.creator === p.id ? g.joiner! : g.creator;
        const op = await getPlayer(db, other);
        const reports = await reportsOf(db, g.id);
        const mine = reports.find((r) => r.player_id === p.id) ?? reports[0];
        const body = mine && bodyOf(reports, mine);
        matches.push({
          gameId: g.id,
          created: g.created,
          opponent: { id: other, name: op?.name ?? 'Player' },
          side: g.green === p.id ? 0 : 1,
          result: body?.result ?? null,
          status: reports.length ? resultStatus(reports.map((r) => r.compare_key), reports[0].submitted, now()) : 'pending',
          reported: reports.some((r) => r.player_id === p.id),
        });
      }
      return { matches };
    },
    'POST /api/replay': async (body) => {
      const p = await auth(body);
      const game = await getGame(db, String(body.gameId));
      if (!game || (p.id !== game.creator && p.id !== game.joiner)) throw new HttpError(404, 'unknown game');
      const reports = await reportsOf(db, game.id);
      const mine = reports.find((r) => r.player_id === p.id) ?? reports[0];
      if (!mine) throw new HttpError(404, 'no report yet');
      return { report: bodyOf(reports, mine) };
    },
  };

  /** A stored report's content (an identical second report points at the first). */
  const bodyOf = (reports: Awaited<ReturnType<typeof reportsOf>>, r: (typeof reports)[number]): MatchReport | null => {
    const src = r.body ? r : reports.find((o) => o.compare_key === r.compare_key && o.body);
    if (!src?.body) return null;
    return JSON.parse(gunzipSync(Buffer.from(src.body as ArrayBuffer)).toString('utf8'));
  };

  const statusOf = async (gameId: string) => {
    const reports = await reportsOf(db, gameId);
    return resultStatus(
      reports.map((r) => r.compare_key),
      reports[0]?.submitted ?? now(),
      now(),
    );
  };

  const send = (res: ServerResponse, status: number, data: unknown) => {
    res.writeHead(status, {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    });
    res.end(JSON.stringify(data));
  };

  const readBody = (req: IncomingMessage) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      let size = 0;
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => {
        size += c.length;
        if (size > MAX_BODY) {
          reject(new HttpError(413, 'too large'));
          req.destroy();
        } else chunks.push(c);
      });
      req.on('end', () => {
        if (!chunks.length) return resolve({});
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          reject(new HttpError(400, 'bad JSON'));
        }
      });
      req.on('error', reject);
    });

  const server = createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? '';
    if (limited(ip)) return send(res, 429, { error: 'too many requests' });
    const path = (req.url ?? '/').split('?')[0];
    const route = routes[`${req.method} ${path}`];
    if (!route) return send(res, 404, { error: 'not found' });
    try {
      const body = req.method === 'POST' ? await readBody(req) : {};
      send(res, 200, await route(body));
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      send(res, status, { error: e instanceof Error ? e.message : 'error' });
    }
  });

  // ---- signalling: pair the two players of a game and pass their connection set-up along
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64_000 });
  /** Game ID → the connected sockets by Player ID. */
  const rooms = new Map<string, Map<string, WebSocket>>();
  /** Games already paired once (a later pairing is a rejoin). */
  const paired = new Set<string>();
  const wsSend = (ws: WebSocket, m: ServerMsg) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(m));

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url ?? '/', 'http://x');
    let player: { id: string; name: string } | null = null;
    try {
      const p = await auth({ playerId: url.searchParams.get('playerId'), key: url.searchParams.get('key') });
      player = { id: p.id, name: p.name };
    } catch {
      wsSend(ws, { t: 'error', message: 'unknown player or wrong key' });
      return ws.close();
    }
    let gameId: string | null = null;
    const other = () => {
      const room = gameId ? rooms.get(gameId) : undefined;
      return room ? [...room.entries()].find(([id]) => id !== player!.id)?.[1] : undefined;
    };
    ws.on('message', async (raw) => {
      let m: ClientMsg;
      try {
        m = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (m.t === 'signal') {
        const o = other();
        if (o) wsSend(o, { t: 'signal', data: m.data });
        return;
      }
      if (m.t !== 'join') return;
      // joining again (same game): pair afresh, to rebuild a dropped direct connection
      if (gameId && String(m.gameId).toUpperCase() !== gameId) return;
      const g = await getGame(db, String(m.gameId).toUpperCase());
      if (!g) return wsSend(ws, { t: 'error', message: 'No game with that ID' });
      if (g.creator !== player!.id && g.joiner !== player!.id) {
        if (g.joiner) return wsSend(ws, { t: 'error', message: 'That game already has two players' });
        // the joiner takes the second seat; a coin flip makes one of them Green
        const green = randomInt(2) ? g.creator : player!.id;
        if (!(await seatJoiner(db, g.id, player!.id, green))) return wsSend(ws, { t: 'error', message: 'That game already has two players' });
      }
      gameId = g.id;
      const room = rooms.get(g.id) ?? new Map<string, WebSocket>();
      room.set(player!.id, ws);
      rooms.set(g.id, room);
      const game = (await getGame(db, g.id))!;
      if (room.size === 2 && game.joiner && game.green) {
        const rejoin = paired.has(g.id);
        paired.add(g.id);
        for (const [id, sock] of room) {
          const oppId = id === game.creator ? game.joiner : game.creator;
          const op = await getPlayer(db, oppId);
          wsSend(sock, { t: 'paired', gameId: g.id, side: game.green === id ? 0 : 1, seed: game.seed, creator: id === game.creator, opponent: { id: oppId, name: op?.name ?? 'Player' }, rejoin });
        }
      }
    });
    ws.on('close', () => {
      if (!gameId) return;
      const room = rooms.get(gameId);
      if (room?.get(player!.id) !== ws) return;
      room.delete(player!.id);
      const o = other() ?? [...(room?.values() ?? [])][0];
      if (o) wsSend(o, { t: 'opponent-left' });
      if (room && room.size === 0) rooms.delete(gameId);
    });
  });

  return server;
}
