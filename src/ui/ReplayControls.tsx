// In-match controls: the Pause button, the Replay playback bar and the
// Play from here dialog.

import { useState } from 'react';
import { useGame } from '../store';
import { SIDE_COLORS } from '../render/sprites';
import { replayTitle, metaOf } from '../replay/replay';

/** Pause / Resume for a live match (Space). */
export function PauseButton() {
  const paused = useGame((s) => s.paused);
  const replay = useGame((s) => s.replay);
  const winner = useGame((s) => s.match.winner);
  const toggle = useGame((s) => s.togglePause);
  if (replay || winner !== null) return null;
  return (
    <button className={`pause-btn ${paused ? 'on' : ''}`} onClick={toggle} title="Pause / Resume (Space)">
      {paused ? '▶ Resume' : '❚❚ Pause'}
    </button>
  );
}

export function PausedBanner() {
  const paused = useGame((s) => s.paused);
  const replay = useGame((s) => s.replay);
  if (!paused || replay) return null;
  return <div className="paused-banner">Paused · Space or Resume to continue</div>;
}

const SPEEDS = [1, 2, 4] as const;

export function ReplayBar() {
  const r = useGame((s) => s.replay);
  const winner = useGame((s) => s.match.winner);
  const g = useGame.getState;
  if (!r) return null;
  const total = r.replay.actions.length;
  return (
    <div className="replay-bar window">
      <div className="replay-row">
        <b className="replay-name">{replayTitle(metaOf(r.replay))}</b>
        <span className="muted small">
          Turn {r.index} / {total}
          {winner !== null && r.index === total ? ` · ${winner === 'draw' ? 'Draw' : `${winner === 0 ? 'Green' : 'Red'} wins`}` : ''}
        </span>
        <span className="spacer" />
        <button onClick={() => g().setTakeoverOpen(true)} title="Continue this position as a live match">
          Play from here…
        </button>
        <button onClick={() => g().exitReplay()}>Exit Replay</button>
      </div>
      <div className="replay-row">
        <button onClick={() => g().replaySeek(0)} title="Back to the start">⏮</button>
        <button onClick={() => g().replayStep(-1)} disabled={r.index === 0} title="One turn back">⏪</button>
        <button className="play" onClick={() => g().replayTogglePlay()} title="Play / Pause (Space)">
          {r.playing ? '❚❚' : '▶'}
        </button>
        <button onClick={() => g().replayStep(1)} disabled={r.index >= r.cursor.playable} title="One turn forward">⏩</button>
        <button onClick={() => g().replaySeek(r.cursor.playable)} title="To the end">⏭</button>
        <input
          className="replay-scrub"
          type="range"
          min={0}
          max={total}
          value={r.index}
          onChange={(e) => g().replaySeek(Number(e.target.value))}
        />
        {SPEEDS.map((sp) => (
          <button key={sp} className={`tool ${r.speed === sp ? 'on' : ''}`} onClick={() => g().replaySetSpeed(sp)}>
            {sp}×
          </button>
        ))}
      </div>
      {r.error && <div className="bad small">{r.error}</div>}
    </div>
  );
}

/** Play from here: who plays each Side once the match goes live. */
export function TakeoverDialog() {
  const r = useGame((s) => s.replay);
  if (!r?.takeover) return null;
  return <TakeoverForm />;
}

function TakeoverForm() {
  const r = useGame((s) => s.replay)!;
  const [ai, setAi] = useState<[boolean, boolean]>(() => [r.replay.initial.sides[0].ai, r.replay.initial.sides[1].ai]);
  const g = useGame.getState;
  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && g().setTakeoverOpen(false)}>
      <div className="window takeover">
        <div className="title">Play from turn {r.index}</div>
        <div className="muted small">The match continues live from this position. The Replay itself is kept as it is.</div>
        {([0, 1] as const).map((side) => (
          <div key={side} className="btn-row">
            <span className="side-name" style={{ color: SIDE_COLORS[side], width: 60 }}>
              {side === 0 ? 'Green' : 'Red'}
            </span>
            {(['Human', 'AI'] as const).map((who) => (
              <button
                key={who}
                className={`tool ${ai[side] === (who === 'AI') ? 'on' : ''}`}
                onClick={() => setAi((a) => (side === 0 ? [who === 'AI', a[1]] : [a[0], who === 'AI']))}
              >
                {who}
              </button>
            ))}
          </div>
        ))}
        <div className="btn-row end">
          <button onClick={() => g().setTakeoverOpen(false)}>Cancel</button>
          <button className="play" onClick={() => g().playFromHere(ai)}>
            Start
          </button>
        </div>
      </div>
    </div>
  );
}
