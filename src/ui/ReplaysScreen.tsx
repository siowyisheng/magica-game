// Replays screen: saved and recent Replays, with Watch, Save, Rename,
// Export, Import and Delete.

import { useRef, useState } from 'react';
import { useGame } from '../store';
import {
  RECENT_LIMIT,
  deleteReplay,
  exportReplayJson,
  importReplayJson,
  listReplays,
  loadReplay,
  replayTitle,
  updateReplay,
  type ReplayMeta,
} from '../replay/replay';
import { unitIconUrl } from '../render/sprites';

const when = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const result = (w: ReplayMeta['winner']) => (w === null ? 'unfinished' : w === 'draw' ? 'draw' : `${w === 0 ? 'Green' : 'Red'} won`);

export function ReplaysScreen() {
  const setScreen = useGame((s) => s.setScreen);
  const openReplay = useGame((s) => s.openReplay);
  const currentId = useGame((s) => s.recording?.id ?? null);
  const [list, setList] = useState(() => listReplays());
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const refresh = () => setList(listReplays());
  const flash = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage((cur) => (cur === m ? null : cur)), 3000);
  };

  const download = (id: string) => {
    const r = loadReplay(id);
    if (!r) return flash('That Replay could not be read');
    const blob = new Blob([exportReplayJson(r)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${replayTitle({ name: r.name, summoners: list.find((m) => m.id === id)!.summoners, mapName: r.initial.map.name }).replace(/[^\w\- ]+/g, '').trim() || 'replay'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const saved = list.filter((m) => m.saved);
  const recent = list.filter((m) => !m.saved);
  const row = (m: ReplayMeta) => (
    <div key={m.id} className="replay-item window">
      <div className="replay-faces">
        {m.summoners.map((k, side) => {
          let src = '';
          try {
            src = unitIconUrl(k, side as 0 | 1);
          } catch {
            /* unknown kind */
          }
          return src ? <img key={side} src={src} alt="" /> : null;
        })}
      </div>
      <div className="replay-text">
        {renaming?.id === m.id ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateReplay(m.id, { name: renaming.name.trim() || null, saved: true });
              setRenaming(null);
              refresh();
            }}
          >
            <input autoFocus value={renaming.name} maxLength={40} onChange={(e) => setRenaming({ id: m.id, name: e.target.value })} />
            <button type="submit">OK</button>
            <button type="button" onClick={() => setRenaming(null)}>Cancel</button>
          </form>
        ) : (
          <b>{replayTitle(m)}</b>
        )}
        <div className="muted small">
          {m.mapName} · {m.turns} turns · {result(m.winner)} · {when(m.updatedAt)}
          {m.id === currentId ? ' · the match in progress' : ''}
        </div>
      </div>
      <div className="btn-row">
        <button className="play" onClick={() => !openReplay(m.id) && flash('That Replay could not be read')} disabled={m.turns === 0}>
          Watch
        </button>
        {!m.saved && (
          <button
            onClick={() => {
              updateReplay(m.id, { saved: true });
              refresh();
              flash('Saved: kept until you delete it');
            }}
            title="Keep this Replay until you delete it"
          >
            Save
          </button>
        )}
        <button onClick={() => setRenaming({ id: m.id, name: m.name ?? '' })} title="Name it (also saves it)">Rename</button>
        <button onClick={() => download(m.id)}>Export</button>
        <button
          onClick={() => {
            if (!window.confirm(`Delete “${replayTitle(m)}”?`)) return;
            deleteReplay(m.id);
            refresh();
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );

  return (
    <div className="devtool">
      <div className="editor-top window">
        <b>Replays</b>
        <span className="muted small">Every match is recorded. The last {RECENT_LIMIT} stay under Recent; Save one to keep it. Kept in this browser.</span>
        {message && <span className="flash">{message}</span>}
        <span className="spacer" />
        <button onClick={() => fileInput.current?.click()}>Import…</button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              importReplayJson(await f.text());
              refresh();
              flash('Imported');
            } catch (err) {
              flash(`Import failed: ${(err as Error).message}`);
            }
          }}
        />
        <button onClick={() => setScreen('game')}>Back to the match</button>
      </div>
      <div className="replay-list">
        <div className="title">Saved</div>
        {saved.length ? saved.map(row) : <div className="muted small">None yet. Save a Recent Replay, or import one.</div>}
        <div className="title">Recent</div>
        {recent.length ? recent.map(row) : <div className="muted small">Matches you play appear here.</div>}
      </div>
    </div>
  );
}
