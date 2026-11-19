import { useEffect } from 'react';
import { Board } from './render/Board';
import { Timeline } from './ui/Timeline';
import { InfoPanel } from './ui/InfoPanel';
import { SummonCard } from './ui/SummonCard';
import { useGame } from './store';
import { activeUnit, kindOf } from './rules';

function PhaseHint() {
  const phase = useGame((s) => s.phase);
  const match = useGame((s) => s.match);
  const u = activeUnit(match);
  if (match.winner !== null) return null;
  if (!u) return null;
  const who = `${u.side === 0 ? 'Green' : 'Red'} ${kindOf(u.kind).name}`;
  const text: Record<string, string> = {
    idle: `${who} is acting…`,
    move:
      phase.kind === 'move' && !phase.selected
        ? `${who} deselected: click anywhere (or right-click) to select it again`
        : `${who}: click a blue hex to move, the unit to stay, or a unit in range to act · right-click a unit to show its ranges`,
    quickChoice: `${who}: choose Attack or Magic (right-click: back)`,
    menu: u.stranded
      ? `${who} is Stranded: left-click the map to set facing, then Wait`
      : `${who}: left-click the map to set facing, then choose a command (right-click cancels the move)`,
    target: `${who}: hover a target to preview, click to confirm`,
    summonDir: `${who}: click a highlighted adjacent hex to summon (right-click: back to the list)`,
  };
  return <div className="phase-hint">{text[phase.kind]}</div>;
}

function GameOver() {
  const match = useGame((s) => s.match);
  const newMatch = useGame((s) => s.newMatch);
  if (match.winner === null) return null;
  return (
    <div className="game-over">
      <div className="window">
        <h2>{match.winner === 0 ? 'Green' : 'Red'} wins</h2>
        <button onClick={newMatch}>New match</button>
      </div>
    </div>
  );
}

export function App() {
  const version = useGame((s) => s.version);
  const tickAi = useGame((s) => s.tickAi);
  const match = useGame((s) => s.match);
  useEffect(() => {
    tickAi();
  }, [version, match, tickAi]);
  return (
    <div className="app">
      <div className="main">
        <div className="board">
          <Board />
          <Timeline />
          <SummonCard />
          <PhaseHint />
          <GameOver />
        </div>
        <InfoPanel />
      </div>
    </div>
  );
}
