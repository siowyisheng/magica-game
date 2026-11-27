import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { openDb } from './db';
import { createApp } from './app';
import { createMatch } from '../src/rules';
import { SECOND_REPORT_WAIT_MS, type MatchReport } from '../src/online/report';
import type { ServerMsg } from '../src/online/protocol';
import { generateRandomMap as makeTestMap } from '../src/rules';

/** A fixed random map (the same every run): Scaffold Ford is gone. */
const TEST_MAP = makeTestMap(20261127);

let close: (() => void) | null = null;
afterEach(() => close?.());

async function start() {
  let t = 1_000_000;
  const db = await openDb(':memory:');
  const server = createApp({ db, now: () => t });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as AddressInfo).port;
  close = () => server.close();
  const api = async (path: string, body?: unknown) => {
    const res = await fetch(`http://localhost:${port}${path}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
    return { status: res.status, data: await res.json() };
  };
  const socket = (p: { playerId: string; key: string }) =>
    new Promise<{ ws: WebSocket; next: () => Promise<ServerMsg> }>((resolve) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws?playerId=${p.playerId}&key=${p.key}`);
      const queue: ServerMsg[] = [];
      const waiting: ((m: ServerMsg) => void)[] = [];
      ws.on('message', (raw) => {
        const m = JSON.parse(String(raw));
        const w = waiting.shift();
        if (w) w(m);
        else queue.push(m);
      });
      ws.on('open', () => resolve({ ws, next: () => new Promise((r) => (queue.length ? r(queue.shift()!) : waiting.push(r))) }));
    });
  return { api, socket, advance: (ms: number) => (t += ms) };
}

describe('online server', () => {
  it('registers players, pairs them with a coin flip, relays set-up, and judges reports', async () => {
    const { api, socket, advance } = await start();
    expect((await api('/api/health')).data).toEqual({ ok: true });
    const a = (await api('/api/register', { name: 'Ann' })).data;
    const b = (await api('/api/register', { name: 'Bo' })).data;
    expect(a.playerId).not.toBe(b.playerId);
    expect((await api('/api/games', { playerId: a.playerId, key: 'wrong' })).status).toBe(401);
    const { gameId } = (await api('/api/games', a)).data;
    expect(gameId).toMatch(/^[A-Z0-9]{6}$/);

    const sa = await socket(a);
    const sb = await socket(b);
    sa.ws.send(JSON.stringify({ t: 'join', gameId }));
    sb.ws.send(JSON.stringify({ t: 'join', gameId: gameId.toLowerCase() }));
    const pa = await sa.next();
    const pb = await sb.next();
    if (pa.t !== 'paired' || pb.t !== 'paired') throw new Error('not paired');
    expect(pa.side + pb.side).toBe(1);
    expect(pa.seed).toBe(pb.seed);
    expect(pa.creator).toBe(true);
    expect(pb.opponent.name).toBe('Ann');
    sa.ws.send(JSON.stringify({ t: 'signal', data: { sdp: 'x' } }));
    expect(await sb.next()).toEqual({ t: 'signal', data: { sdp: 'x' } });

    // a third player can't take a seat
    const c = (await api('/api/register', { name: 'Cy' })).data;
    const sc = await socket(c);
    sc.ws.send(JSON.stringify({ t: 'join', gameId }));
    expect((await sc.next()).t).toBe('error');

    const green = pa.side === 0 ? a : b;
    const red = pa.side === 0 ? b : a;
    const report = (by: typeof a, winner: 0 | 1): MatchReport => ({
      gameId,
      playerId: by.playerId,
      players: [green.playerId, red.playerId],
      result: { winner, reason: 'resign' },
      replay: { initial: createMatch(TEST_MAP), actions: [], times: [], timeouts: [] },
      rules: 'r',
    });
    expect((await api('/api/reports', { ...c, report: report(c, 0) })).status).toBe(403);
    expect((await api('/api/reports', { ...green, report: report(green, 0) })).data.status).toBe('pending');
    expect((await api('/api/history', green)).data.matches[0]).toMatchObject({ gameId, status: 'pending', side: 0, result: { winner: 0 } });
    advance(SECOND_REPORT_WAIT_MS);
    expect((await api('/api/history', red)).data.matches[0].status).toBe('unconfirmed');
    expect((await api('/api/reports', { ...red, report: report(red, 0) })).data.status).toBe('confirmed');
    expect((await api('/api/replay', { ...red, gameId })).data.report.result).toEqual({ winner: 0, reason: 'resign' });
    for (const s of [sa, sb, sc]) s.ws.close();
  });

  it('marks differing reports Contested', async () => {
    const { api, socket } = await start();
    const a = (await api('/api/register', { name: 'A' })).data;
    const b = (await api('/api/register', { name: 'B' })).data;
    const { gameId } = (await api('/api/games', a)).data;
    const sa = await socket(a);
    const sb = await socket(b);
    sa.ws.send(JSON.stringify({ t: 'join', gameId }));
    sb.ws.send(JSON.stringify({ t: 'join', gameId }));
    const pa = await sa.next();
    if (pa.t !== 'paired') throw new Error('not paired');
    const players: [string, string] = pa.side === 0 ? [a.playerId, b.playerId] : [b.playerId, a.playerId];
    const rep = (p: typeof a, winner: 0 | 1): MatchReport => ({ gameId, playerId: p.playerId, players, result: { winner, reason: 'master' }, replay: { initial: createMatch(TEST_MAP), actions: [], times: [], timeouts: [] }, rules: 'r' });
    await api('/api/reports', { ...a, report: rep(a, 0) });
    expect((await api('/api/reports', { ...b, report: rep(b, 1) })).data.status).toBe('contested');
    sa.ws.close();
    sb.ws.close();
  });
});
