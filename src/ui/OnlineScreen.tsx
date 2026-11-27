// The Online screen: your name, create or join an Online Match, rejoin the last
// one, and your Online History.

import { useEffect, useState } from 'react';
import { getRepoBalance } from '../rules';
import { listMaps, RANDOM_MAP_ID, mapFor } from '../maps/library';
import { useGame } from '../store';
import { fetchReport, history, loadIdentity, wake, SERVER_URL, type HistoryEntry } from '../online/api';
import { currentGame, rejoinOnline, startOnline, useOnline } from '../online/session';
import { newReplay, storeReplay } from '../replay/replay';
import { DEFAULT_TIME, formatSeconds, TIME_BANK_CHOICES_MS, TURN_TIMER_CHOICES_MS } from '../online/clock';

const NAME_KEY = 'magica.online.name';
const STATUS_TEXT = { confirmed: 'Confirmed', unconfirmed: 'Unconfirmed', contested: 'Contested', pending: 'Waiting for reports' } as const;
const REASON_TEXT = { master: 'Master fell', timeLimit: 'Time Limit', resign: 'Resigned', abandon: 'Abandoned' } as const;

/** A Game ID passed in the page's link (?join=ABC123). */
export function joinCodeFromUrl(): string | null {
  return new URLSearchParams(location.search).get('join');
}

export function OnlineScreen() {
  const setScreen = useGame((s) => s.setScreen);
  const stage = useOnline((s) => s.stage);
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? loadIdentity()?.name ?? '');
  const [code, setCode] = useState(() => joinCodeFromUrl() ?? '');
  const [mapId, setMapId] = useState(RANDOM_MAP_ID);
  const [turnMs, setTurnMs] = useState(DEFAULT_TIME.turnMs);
  const [bankMs, setBankMs] = useState(DEFAULT_TIME.bankMs);
  const [server, setServer] = useState<'waking' | 'up' | 'down'>('waking');
  const [past, setPast] = useState<HistoryEntry[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const rejoin = currentGame();

  // wake the server as soon as this screen opens (a free host sleeps when idle)
  useEffect(() => {
    let live = true;
    void wake().then((ok) => live && setServer(ok ? 'up' : 'down'));
    const id = loadIdentity();
    if (id) void history(id).then((h) => live && setPast(h), () => live && setPast([]));
    else setPast([]);
    return () => {
      live = false;
    };
  }, []);

  const go = async (f: () => Promise<unknown>) => {
    localStorage.setItem(NAME_KEY, name.trim());
    setScreen('game');
    await f();
  };
  const openPast = async (e: HistoryEntry) => {
    const id = loadIdentity();
    if (!id) return;
    try {
      const r = await fetchReport(id, e.gameId);
      const replay = { ...newReplay(r.replay.initial, getRepoBalance()), actions: r.replay.actions, winner: r.result.winner, name: `Online vs ${e.opponent.name} (${e.gameId})` };
      storeReplay(replay);
      if (!useGame.getState().openReplay(replay.id)) setMessage('That Replay can’t be watched on this version.');
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  const ready = name.trim().length > 0 && server !== 'down';
  return (
    <div className="devtool online-screen">
      <div className="editor-top window">
        <b>Online</b>
        <span className="muted small">
          {server === 'waking' ? 'Waking the server (it can take a minute)…' : server === 'up' ? 'Server ready' : `Can’t reach the server (${SERVER_URL})`}
        </span>
        <span className="spacer" />
        {message && <span className="flash">{message}</span>}
        <button onClick={() => setScreen('game')}>Back to game</button>
      </div>
      <div className="online-body">
        <div className="window">
          <div className="title">You</div>
          <label className="dev-field">
            <span>Name</span>
            <input value={name} maxLength={24} placeholder="Your name" onChange={(e) => setName(e.target.value)} />
          </label>
          {stage && <div className="muted small">You’re in an Online Match. Starting another leaves it.</div>}
        </div>
        <div className="window">
          <div className="title">Create a match</div>
          <label className="dev-field">
            <span>Map</span>
            <select value={mapId} onChange={(e) => setMapId(e.target.value)}>
              {listMaps().map((m) => (
                <option key={m.id} value={m.id}>
                  {m.map.name}
                </option>
              ))}
              <option value={RANDOM_MAP_ID}>Random map</option>
            </select>
          </label>
          <label className="dev-field">
            <span>Turn Timer</span>
            <select value={turnMs} onChange={(e) => setTurnMs(Number(e.target.value))}>
              {TURN_TIMER_CHOICES_MS.map((ms) => (
                <option key={ms} value={ms}>
                  {ms / 1000} s a turn
                </option>
              ))}
            </select>
          </label>
          <label className="dev-field">
            <span>Time Bank</span>
            <select value={bankMs} onChange={(e) => setBankMs(Number(e.target.value))}>
              {TIME_BANK_CHOICES_MS.map((ms) => (
                <option key={ms} value={ms}>
                  {ms ? formatSeconds(ms) : 'None'}
                </option>
              ))}
            </select>
          </label>
          <button disabled={!ready} onClick={() => go(() => startOnline({ name, map: mapFor(mapId), time: { turnMs, bankMs } }))}>
            Create
          </button>
          <div className="muted small">You’ll get a Game ID to send to the other player.</div>
        </div>
        <div className="window">
          <div className="title">Join a match</div>
          <label className="dev-field">
            <span>Game ID</span>
            <input value={code} maxLength={6} placeholder="ABC123" onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </label>
          <button disabled={!ready || code.trim().length !== 6} onClick={() => go(() => startOnline({ name, gameId: code }))}>
            Join
          </button>
          {rejoin && (
            <div className="btn-row">
              <button disabled={!ready} onClick={() => go(() => rejoinOnline(name))}>
                Rejoin {rejoin.gameId}
              </button>
            </div>
          )}
        </div>
        <div className="window online-history">
          <div className="title">Online History</div>
          {past === null && <div className="muted small">Loading…</div>}
          {past?.length === 0 && <div className="muted small">No Online Matches yet.</div>}
          {past?.map((e) => (
            <div key={e.gameId} className="history-row">
              <span className="mono">{e.gameId}</span>
              <span>vs {e.opponent.name}</span>
              <span className={e.result ? (e.result.winner === e.side ? 'good' : e.result.winner === 'draw' ? '' : 'bad') : 'muted'}>
                {e.result ? (e.result.winner === 'draw' ? 'Draw' : e.result.winner === e.side ? 'Won' : 'Lost') + ` · ${REASON_TEXT[e.result.reason]}` : 'No report'}
              </span>
              <span className={`status ${e.status}`}>{STATUS_TEXT[e.status]}</span>
              <span className="muted small">{new Date(e.created).toLocaleString()}</span>
              {e.result && <button onClick={() => openPast(e)}>Replay</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
