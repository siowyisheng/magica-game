// Match Setup dialog: the map, and for each Side its Summoner (or Random)
// and whether a person or the AI plays it.

import { useState } from 'react';
import { SUMMONERS, type SideId } from '../rules';
import { listMaps } from '../maps/library';
import { useGame, type MatchSetup as Setup } from '../store';
import { SIDE_COLORS, unitIconUrl } from '../render/sprites';
import { StatGrid } from './Stats';
import { AlignmentIcon, ElementIcon } from './icons';

const SIDE_NAME = ['Green', 'Red'];

export function MatchSetupDialog() {
  const open = useGame((s) => s.setupOpen);
  const saved = useGame((s) => s.setup);
  const setOpen = useGame((s) => s.setSetupOpen);
  const start = useGame((s) => s.startFromSetup);
  const [setup, setSetup] = useState<Setup>(saved);
  const maps = listMaps();
  if (!open) return null;
  const mapId = maps.some((m) => m.id === setup.mapId) ? setup.mapId : maps[0].id;
  const update = (f: (s: Setup) => Setup) => setSetup((s) => f({ ...s, summoners: [...s.summoners] as [string, string], ai: [...s.ai] as [boolean, boolean] }));
  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="window match-setup">
        <div className="title">New match</div>
        <label className="slider">
          <span>Map</span>
          <select value={mapId} onChange={(e) => update((s) => ({ ...s, mapId: e.target.value }))}>
            {maps.map((m) => (
              <option key={m.id} value={m.id}>
                {m.map.name}
                {m.builtin ? ' (built-in)' : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="setup-sides">
          {([0, 1] as SideId[]).map((side) => (
            <div key={side} className="setup-side">
              <div className="side-name" style={{ color: SIDE_COLORS[side] }}>
                {SIDE_NAME[side]}
              </div>
              <div className="btn-row">
                {(['Human', 'AI'] as const).map((who) => (
                  <button
                    key={who}
                    className={`tool ${setup.ai[side] === (who === 'AI') ? 'on' : ''}`}
                    onClick={() => update((s) => ((s.ai[side] = who === 'AI'), s))}
                  >
                    {who}
                  </button>
                ))}
              </div>
              <div className="summoner-grid">
                <button
                  className={`summoner-pick ${setup.summoners[side] === 'random' ? 'on' : ''}`}
                  onClick={() => update((s) => ((s.summoners[side] = 'random'), s))}
                  title="A random Summoner"
                >
                  <span className="random-mark">?</span>
                  <span>Random</span>
                </button>
                {SUMMONERS.map((k) => (
                  <button
                    key={k.id}
                    className={`summoner-pick ${setup.summoners[side] === k.id ? 'on' : ''}`}
                    onClick={() => update((s) => ((s.summoners[side] = k.id), s))}
                  >
                    <img src={unitIconUrl(k.id, side)} alt="" />
                    <span>{k.name}</span>
                  </button>
                ))}
              </div>
              <SummonerInfo id={setup.summoners[side]} />
            </div>
          ))}
        </div>
        <div className="btn-row end">
          <button onClick={() => setOpen(false)}>Cancel</button>
          <button className="play" onClick={() => start({ ...setup, mapId })}>
            Start
          </button>
        </div>
      </div>
    </div>
  );
}

function SummonerInfo({ id }: { id: string }) {
  const k = SUMMONERS.find((x) => x.id === id);
  if (!k) return <div className="muted small summoner-info">A Summoner picked at random when the match starts.</div>;
  return (
    <div className="summoner-info">
      <div>
        <b>{k.name}</b> {k.element && <ElementIcon element={k.element} />} {k.alignment !== 'none' && <AlignmentIcon alignment={k.alignment} />}
        <span className="muted small"> Mana Income {2 * k.stats.mp}/h before Stones</span>
      </div>
      <StatGrid stats={k.stats} pct={100} />
    </div>
  );
}
