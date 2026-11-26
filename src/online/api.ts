// The online server's HTTP API, and this browser's Player ID.

import type { MatchReport, MatchResult, ResultStatus } from './report';

/** Where the server is: VITE_MAGICA_SERVER at build time, else a local one in development. */
export const SERVER_URL: string = (import.meta.env?.VITE_MAGICA_SERVER as string | undefined) ?? 'http://localhost:8787';

export function wsUrl(path: string): string {
  return SERVER_URL.replace(/^http/, 'ws') + path;
}

export interface Identity {
  playerId: string;
  key: string;
  name: string;
}

const ID_KEY = 'magica.online.identity';

export function loadIdentity(): Identity | null {
  try {
    const x = JSON.parse(localStorage.getItem(ID_KEY) ?? 'null');
    return x && typeof x.playerId === 'string' && typeof x.key === 'string' ? x : null;
  } catch {
    return null;
  }
}

function saveIdentity(id: Identity) {
  localStorage.setItem(ID_KEY, JSON.stringify(id));
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(SERVER_URL + path, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `server error ${res.status}`);
  return data as T;
}

/** Wake the server (a free host sleeps when idle and takes a while to start). */
export function wake(): Promise<boolean> {
  return call('/api/health').then(
    () => true,
    () => false,
  );
}

/** This browser's Player ID, made on first use; renames it when `name` differs. */
export async function ensureIdentity(name: string): Promise<Identity> {
  const n = name.trim() || 'Player';
  let id = loadIdentity();
  if (!id) {
    const r = await call<{ playerId: string; key: string }>('/api/register', { name: n });
    id = { ...r, name: n };
    saveIdentity(id);
  } else if (id.name !== n) {
    await call('/api/name', { playerId: id.playerId, key: id.key, name: n });
    id = { ...id, name: n };
    saveIdentity(id);
  }
  return id;
}

export async function createGame(id: Identity): Promise<string> {
  return (await call<{ gameId: string }>('/api/games', { playerId: id.playerId, key: id.key })).gameId;
}

export async function submitReport(id: Identity, report: MatchReport): Promise<ResultStatus> {
  return (await call<{ status: ResultStatus }>('/api/reports', { playerId: id.playerId, key: id.key, report })).status;
}

export interface HistoryEntry {
  gameId: string;
  created: number;
  opponent: { id: string; name: string };
  side: 0 | 1;
  result: MatchResult | null;
  status: ResultStatus;
  reported: boolean;
}

export async function history(id: Identity): Promise<HistoryEntry[]> {
  return (await call<{ matches: HistoryEntry[] }>('/api/history', { playerId: id.playerId, key: id.key })).matches;
}

export async function fetchReport(id: Identity, gameId: string): Promise<MatchReport> {
  return (await call<{ report: MatchReport }>('/api/replay', { playerId: id.playerId, key: id.key, gameId })).report;
}
