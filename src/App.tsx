import { useEffect } from 'react';
import { Board } from './render/Board';
import { Timeline } from './ui/Timeline';
import { InfoPanel } from './ui/InfoPanel';
import { FamiliarCard } from './ui/FamiliarCard';
import { Hud } from './ui/Hud';
import { useGame } from './store';
import { activeUnit, isBurst, kindOf } from './rules';
import { MapEditor } from './editor/MapEditor';
import { DevTool } from './dev/DevTool';
import { MatchSetupDialog } from './ui/MatchSetup';
import { LoadoutEditor } from './ui/LoadoutEditor';
import { LoadoutsModal } from './ui/LoadoutView';
import { PauseButton, PausedBanner, ReplayBar, TakeoverDialog } from './ui/ReplayControls';
import { ReplaysScreen } from './ui/ReplaysScreen';
import { OnlineScreen, joinCodeFromUrl } from './ui/OnlineScreen';
import { OnlinePanel } from './ui/OnlinePanel';
import { useOnline } from './online/session';

function PhaseHint() {
  const phase = useGame((s) => s.phase);
  const match = useGame((s) => s.match);
  const u = activeUnit(match);
  const watching = useGame((s) => s.replay !== null);
  if (match.winner !== null || watching) return null;
  if (!u) return null;
  const who = `${u.side === 0 ? 'Green' : 'Red'} ${kindOf(u).name}`;
  const text: Record<string, string> = {
    idle: `${who} is acting…`,
    move:
      phase.kind === 'move' && !phase.selected
        ? `${who} deselected: click anywhere (or right-click) to select it again`
        : `${who}${u.stranded ? ' (Stranded: move to act)' : ''}: click inside the yellow outline to move, the unit to stay, or a unit in range to act · right-click a unit to show its ranges`,
    menu: u.stranded && phase.kind === 'menu' && phase.to.q === u.pos.q && phase.to.r === u.pos.r
      ? `${who} is Stranded: staying put allows only Wait (right-click to move instead)`
      : `${who}: left-click the map to set facing, then choose a command (right-click cancels the move)`,
    target: isBurst(kindOf(u).ability) ? `${who}: click anywhere in the outlined area to set off the Burst (right-click: back)` : `${who}: hover a target to preview, click to confirm`,
    summonDir: `${who}: click a highlighted adjacent hex to summon (right-click: back to the list)`,
  };
  return <div className="phase-hint">{text[phase.kind]}</div>;
}

function GameOver() {
  const match = useGame((s) => s.match);
  const newMatch = useGame((s) => s.newMatch);
  const watching = useGame((s) => s.replay !== null);
  const recordingId = useGame((s) => s.recording?.id);
  const online = useOnline((s) => s.stage !== null);
  // an Online Match shows its result with its clocks
  if (match.winner === null || watching || online) return null;
  return (
    <div className="game-over">
      <div className="window">
        <h2>{match.winner === 'draw' ? 'Draw' : `${match.winner === 0 ? 'Green' : 'Red'} wins`}</h2>
        {match.clock >= match.timeLimit && (
          <div className="muted">
            Time Limit reached: Magic Stones {match.stones.filter((s) => s.owner === 0).length}–{match.stones.filter((s) => s.owner === 1).length}
          </div>
        )}
        <button onClick={newMatch}>Rematch</button>
        {recordingId && <button onClick={() => useGame.getState().openReplay(recordingId)}>Watch Replay</button>}
        <button onClick={() => useGame.getState().setScreen('replays')}>Replays…</button>
        <button onClick={() => useGame.getState().setSetupOpen(true)}>New match…</button>
      </div>
    </div>
  );
}

export function App() {
  const version = useGame((s) => s.version);
  const tickAi = useGame((s) => s.tickAi);
  const match = useGame((s) => s.match);
  const screen = useGame((s) => s.screen);
  const paused = useGame((s) => s.paused);
  const replay = useGame((s) => s.replay);
  const anim = useGame((s) => s.anim);
  useEffect(() => {
    if (screen !== 'game') return;
    tickAi();
    useGame.getState().tickReplay();
  }, [version, match, tickAi, screen, paused, replay?.playing, replay?.index, anim]);
  // a shared link (?join=ABC123) opens the Online screen with the Game ID filled in
  useEffect(() => {
    if (joinCodeFromUrl()) useGame.getState().setScreen('online');
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || useGame.getState().screen !== 'game') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      e.preventDefault();
      useGame.getState().togglePause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (screen === 'editor') return <MapEditor />;
  if (screen === 'replays') return <ReplaysScreen />;
  if (screen === 'online') return <OnlineScreen />;
  if (screen === 'loadouts')
    return (
      <>
        <LoadoutEditor />
        <MatchSetupDialog />
      </>
    );
  if (screen === 'dev')
    return (
      <>
        <DevTool />
        <MatchSetupDialog />
      </>
    );
  return (
    <div className="app">
      <div className="main">
        <div className="board">
          <Board />
          <Hud />
          <Timeline />
          <FamiliarCard />
          <PhaseHint />
          <PauseButton />
          <PausedBanner />
          <ReplayBar />
          <GameOver />
          <OnlinePanel />
        </div>
        <InfoPanel />
      </div>
      <MatchSetupDialog />
      <LoadoutsModal />
      <TakeoverDialog />
    </div>
  );
}
