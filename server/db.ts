// Storage for players, games and Match Reports. libSQL: a local SQLite file in
// development (DATABASE_URL=file:magica.db), Turso in production
// (DATABASE_URL=libsql://..., DATABASE_AUTH_TOKEN=...), ':memory:' in tests.

import { createClient, type Client } from '@libsql/client';

export interface Db {
  client: Client;
}

export async function openDb(url = process.env.DATABASE_URL ?? 'file:magica.db', authToken = process.env.DATABASE_AUTH_TOKEN): Promise<Db> {
  const client = createClient({ url, ...(authToken ? { authToken } : {}) });
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, key_hash TEXT NOT NULL, name TEXT NOT NULL, created INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, creator TEXT NOT NULL, joiner TEXT, green TEXT, seed INTEGER NOT NULL, created INTEGER NOT NULL)`,
      // body: the gzipped report; NULL when it is identical to the other player's (stored once)
      `CREATE TABLE IF NOT EXISTS reports (game_id TEXT NOT NULL, player_id TEXT NOT NULL, compare_key TEXT NOT NULL, body BLOB, submitted INTEGER NOT NULL, PRIMARY KEY (game_id, player_id))`,
      `CREATE INDEX IF NOT EXISTS games_creator ON games (creator)`,
      `CREATE INDEX IF NOT EXISTS games_joiner ON games (joiner)`,
    ],
    'write',
  );
  return { client };
}

export interface PlayerRow {
  id: string;
  key_hash: string;
  name: string;
}

export interface GameRow {
  id: string;
  creator: string;
  joiner: string | null;
  green: string | null;
  seed: number;
  created: number;
}

export interface ReportRow {
  game_id: string;
  player_id: string;
  compare_key: string;
  body: Uint8Array | ArrayBuffer | null;
  submitted: number;
}

export async function getPlayer(db: Db, id: string): Promise<PlayerRow | null> {
  const r = await db.client.execute({ sql: 'SELECT id, key_hash, name FROM players WHERE id = ?', args: [id] });
  return (r.rows[0] as unknown as PlayerRow) ?? null;
}

export async function addPlayer(db: Db, id: string, keyHash: string, name: string): Promise<void> {
  await db.client.execute({ sql: 'INSERT INTO players (id, key_hash, name, created) VALUES (?, ?, ?, ?)', args: [id, keyHash, name, Date.now()] });
}

export async function renamePlayer(db: Db, id: string, name: string): Promise<void> {
  await db.client.execute({ sql: 'UPDATE players SET name = ? WHERE id = ?', args: [name, id] });
}

export async function getGame(db: Db, id: string): Promise<GameRow | null> {
  const r = await db.client.execute({ sql: 'SELECT id, creator, joiner, green, seed, created FROM games WHERE id = ?', args: [id] });
  const row = r.rows[0] as unknown as GameRow | undefined;
  return row ? { ...row, seed: Number(row.seed), created: Number(row.created) } : null;
}

export async function addGame(db: Db, id: string, creator: string, seed: number, at = Date.now()): Promise<void> {
  await db.client.execute({ sql: 'INSERT INTO games (id, creator, seed, created) VALUES (?, ?, ?, ?)', args: [id, creator, seed, at] });
}

/** Seat the joining player and fix who is Green, unless someone else took the seat first. */
export async function seatJoiner(db: Db, id: string, joiner: string, green: string): Promise<boolean> {
  const r = await db.client.execute({ sql: 'UPDATE games SET joiner = ?, green = ? WHERE id = ? AND joiner IS NULL', args: [joiner, green, id] });
  return r.rowsAffected === 1;
}

export async function gamesOf(db: Db, player: string): Promise<GameRow[]> {
  const r = await db.client.execute({
    sql: 'SELECT id, creator, joiner, green, seed, created FROM games WHERE (creator = ? OR joiner = ?) AND joiner IS NOT NULL ORDER BY created DESC LIMIT 100',
    args: [player, player],
  });
  return r.rows.map((x) => ({ ...(x as unknown as GameRow), seed: Number(x.seed), created: Number(x.created) }));
}

export async function reportsOf(db: Db, gameId: string): Promise<ReportRow[]> {
  const r = await db.client.execute({ sql: 'SELECT game_id, player_id, compare_key, body, submitted FROM reports WHERE game_id = ? ORDER BY submitted', args: [gameId] });
  return r.rows.map((x) => ({ ...(x as unknown as ReportRow), submitted: Number(x.submitted) }));
}

export async function addReport(db: Db, gameId: string, playerId: string, compareKey: string, body: Uint8Array | null, at = Date.now()): Promise<boolean> {
  const r = await db.client.execute({
    sql: 'INSERT OR IGNORE INTO reports (game_id, player_id, compare_key, body, submitted) VALUES (?, ?, ?, ?, ?)',
    args: [gameId, playerId, compareKey, body, at],
  });
  return r.rowsAffected === 1;
}
