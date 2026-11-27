// Everything an Online Match adds on top of the board: waiting for the other
// player, the hidden picks, the Planning Phase, both clocks, Pauses left, Resign,
// a dropped connection, and the result with its report.

import { useEffect, useState } from 'react';
import { MASTERS, type SideId } from '../rules';
import { isPlayable, listLoadouts } from '../loadouts/library';
import { resolveLoadout, useGame } from '../store';
import { SIDE_COLORS, unitIconUrl } from '../render/sprites';
import { ABANDON_MS, clockFace, describeTime, formatSeconds, PAUSES_PER_PLAYER, PAUSE_MAX_MS } from '../online/clock';
import { canClaimAbandon, claimAbandon, leaveOnline, lockPick, readyUp, resign, useOnline } from '../online/session';
import { HideOmittedToggle, LoadoutStrip, useHideOmitted } from './LoadoutView';
import { MasterInfo } from './MatchSetup';

const SIDE_NAME = ['Green', 'Red'];

/** Re-render every `ms` (for countdowns). */
function useNow(ms = 200): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function OnlinePanel() {
  const stage = useOnline((s) => s.stage);
  if (!stage) return null;
  if (stage === 'connecting' || stage === 'waiting' || stage === 'linking' || stage === 'failed') return <Connecting />;
  if (stage === 'picking') return <Picking />;
  return (
    <>
      {stage === 'planning' && <Planning />}
      <Clocks />
      <Connection />
    </>
  );
}

function Leave({ label = 'Leave' }: { label?: string }) {
  return (
    <button
      onClick={() => {
        leaveOnline();
        useGame.getState().newMatch();
      }}
    >
      {label}
    </button>
  );
}

function Connecting() {
  const { stage, gameId, error, creator } = useOnline();
  const link = gameId ? `${location.origin}${location.pathname}?join=${gameId}` : '';
  return (
    <div className="modal-back">
      <div className="window online-modal">
        <div className="title">Online Match</div>
        {stage === 'connecting' && <div>Reaching the server… (a sleeping server can take a minute to wake)</div>}
        {stage === 'waiting' && (
          <>
            {creator ? <div>Send this Game ID to the other player:</div> : <div>Joining…</div>}
            <div className="game-code">{gameId}</div>
            {creator && (
              <div className="btn-row">
                <button onClick={() => navigator.clipboard?.writeText(gameId!)}>Copy ID</button>
                <button onClick={() => navigator.clipboard?.writeText(link)}>Copy link</button>
              </div>
            )}
            <div className="muted small">Waiting for the other player…</div>
          </>
        )}
        {stage === 'linking' && <div>Connecting to the other player…</div>}
        {stage === 'failed' && <div className="bad">{error}</div>}
        <div className="btn-row end">
          <Leave label={stage === 'failed' ? 'Back' : 'Cancel'} />
        </div>
      </div>
    </div>
  );
}

function Picking() {
  const { mySide, locked, opponent, map, time } = useOnline();
  const [master, setMaster] = useState(MASTERS[0].id);
  const [choice, setChoice] = useState<string>('random');
  const loadouts = listLoadouts().filter(isPlayable);
  const side = (mySide ?? 0) as SideId;
  const theirs = (1 - side) as SideId;
  const mine = locked[side];
  return (
    <div className="modal-back">
      <div className="window online-modal picking">
        <div className="title">
          You play <span style={{ color: SIDE_COLORS[side] }}>{SIDE_NAME[side]}</span>
          {side === 0 ? ' (you move first)' : ''} against {opponent?.name} · {map?.name} · {describeTime(time)}
        </div>
        <div className="muted small">Pick your Master and Loadout. The other player sees them only once both are locked in.</div>
        <div className="master-grid">
          {MASTERS.map((k) => (
            <button key={k.id} disabled={mine} className={`master-pick ${master === k.id ? 'on' : ''}`} onClick={() => setMaster(k.id)}>
              <img src={unitIconUrl(k.id, side)} alt="" />
              <span>{k.name}</span>
            </button>
          ))}
        </div>
        <MasterInfo id={master} />
        <label className="slider">
          <span>Loadout</span>
          <select disabled={mine} value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="random">Random</option>
            <option value="auto">Auto (built for the Master)</option>
            {loadouts.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <div className="btn-row end">
          <span className="muted small">{locked[theirs] ? `${opponent?.name} is locked in` : `${opponent?.name} is choosing…`}</span>
          <span className="spacer" />
          <Leave />
          <button
            disabled={mine}
            onClick={() => {
              const l = resolveLoadout(choice, master);
              void lockPick({ master, familiars: l.familiars, signature: l.signature });
            }}
          >
            {mine ? 'Locked in' : 'Lock in'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Planning() {
  const { planningEndsAt, ready, mySide, picks, opponent, me } = useOnline();
  const now = useNow();
  const [hide, setHide] = useHideOmitted();
  const side = (mySide ?? 0) as SideId;
  return (
    <div className="online-planning window">
      <div className="title">
        Planning · {formatSeconds((planningEndsAt ?? now) - now)}
        <span className="spacer" />
        <button disabled={ready[side]} onClick={readyUp}>
          {ready[side] ? 'Ready ✓' : 'Ready'}
        </button>
      </div>
      <div className="planning-sides">
        {([0, 1] as SideId[]).map((s) => (
          <div key={s}>
            <div className="side-name" style={{ color: SIDE_COLORS[s] }}>
              {SIDE_NAME[s]} · {s === side ? (me?.name ?? 'You') : opponent?.name} {ready[s] ? '✓' : ''}
            </div>
            {picks[s] && (
              <>
                <MasterInfo id={picks[s]!.master} />
                <LoadoutStrip familiars={picks[s]!.familiars} signature={picks[s]!.signature} side={s} hideOmitted={hide} />
              </>
            )}
          </div>
        ))}
      </div>
      <HideOmittedToggle hide={hide} setHide={setHide} />
    </div>
  );
}

function Clocks() {
  const { banks, elapsed, mySide, me, opponent, pause, pausesUsed, stage, result, report, time } = useOnline();
  const match = useGame((s) => s.match);
  useNow(250);
  const active = match.units.find((u) => u.id === match.activeUnitId);
  const mover = stage === 'playing' && match.winner === null && active ? active.side : null;
  const side = (mySide ?? 0) as SideId;
  const name = (s: SideId) => (s === side ? (me?.name ?? 'You') : (opponent?.name ?? 'Opponent'));
  return (
    <div className="online-clocks window">
      {([0, 1] as SideId[]).map((s) => {
        const face = mover === s ? clockFace(banks[s], elapsed, time) : { timer: null, bank: banks[s], out: banks[s] === 0 };
        return (
          <div key={s} className={`clock ${mover === s ? 'on' : ''}`}>
            <span className="who" style={{ color: SIDE_COLORS[s] }}>
              {name(s)}
            </span>
            {face.timer !== null && <span className={`timer ${face.timer <= 3000 ? 'low' : ''}`}>{formatSeconds(face.timer)}</span>}
            <span className={`bank ${face.bank <= 10_000 ? 'low' : ''}`} title="Time Bank">
              +{formatSeconds(face.bank)}
            </span>
            <span className="muted small" title="Pauses left">
              ⏸{PAUSES_PER_PLAYER - pausesUsed[s]}
            </span>
          </div>
        );
      })}
      {pause && <div className="muted small">Paused by {name(pause.by)} · resumes by itself in {formatSeconds(PAUSE_MAX_MS - (Date.now() - pause.at))}</div>}
      {stage === 'playing' && !result && (
        <div className="btn-row">
          <button
            onClick={() => {
              if (window.confirm('Resign this match?')) resign();
            }}
          >
            Resign
          </button>
        </div>
      )}
      {result && (
        <div className="online-result">
          <b>{result.winner === 'draw' ? 'Draw' : result.winner === side ? 'You won' : 'You lost'}</b>
          <span className="muted small">
            {' '}
            · {result.reason === 'master' ? 'a Master fell' : result.reason === 'timeLimit' ? 'Time Limit' : result.reason === 'resign' ? 'resigned' : 'abandoned'}
          </span>
          <div className="small">
            Report: {report === 'sending' ? 'sending…' : report === 'error' ? 'couldn’t send (it will be retried next time)' : report === 'confirmed' ? 'Confirmed' : report === 'contested' ? 'Contested' : report === 'unconfirmed' ? 'Unconfirmed' : 'sent, waiting for the other report'}
          </div>
          <div className="btn-row">
            <Leave />
          </div>
        </div>
      )}
    </div>
  );
}

function Connection() {
  const { connected, goneSince, stage, opponent } = useOnline();
  const now = useNow(500);
  if (connected || stage === 'ended' || !goneSince) return null;
  const left = ABANDON_MS - (now - goneSince);
  return (
    <div className="online-banner window">
      <b>{opponent?.name ?? 'The other player'} is disconnected.</b>{' '}
      {left > 0 ? (
        <span className="muted">Their turns Time Out. If they’re not back in {formatSeconds(left)}, you can claim the win.</span>
      ) : (
        <button disabled={!canClaimAbandon()} onClick={claimAbandon}>
          Claim the win
        </button>
      )}
    </div>
  );
}

/** Names of a Side's Master and player for other views (e.g. the Game Over box). */
export function onlineName(side: SideId): string | null {
  const s = useOnline.getState();
  if (!s.stage || s.mySide === null) return null;
  return side === s.mySide ? (s.me?.name ?? 'You') : (s.opponent?.name ?? 'Opponent');
}
