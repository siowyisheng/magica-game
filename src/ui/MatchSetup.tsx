// Match Setup dialog: the map, and for each Side its Summoner (or Random)
// and whether a person or the AI plays it.

import { useState } from 'react';
import { INCOME_MULTIPLIER, STONE_BASE, SUMMONERS, type SideId } from '../rules';
import { listMaps } from '../maps/library';
import { listLoadouts } from '../loadouts/library';
import { LoadoutStrip } from './LoadoutView';
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
  const setScreen = useGame((s) => s.setScreen);
  const maps = listMaps();
  const loadouts = listLoadouts();
  if (!open) return null;
  const mapId = maps.some((m) => m.id === setup.mapId) ? setup.mapId : maps[0].id;
  const update = (f: (s: Setup) => Setup) =>
    setSetup((s) => f({ ...s, summoners: [...s.summoners] as [string, string], loadouts: [...s.loadouts] as [string, string], ai: [...s.ai] as [boolean, boolean] }));
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
        <label className="dev-check" title="Both Sides may Summon all 28 Summons, ignoring Loadouts">
          <input type="checkbox" checked={setup.test} onChange={(e) => update((s) => ({ ...s, test: e.target.checked }))} /> Test match (all 28 Summons for both Sides)
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
                {setup.ai[side] && (
                  <>
                    <span className="spacer" />
                    {(['normal', 'hard'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        className={`tool ${(setup.aiLevels?.[side] ?? 'normal') === lvl ? 'on' : ''}`}
                        title={lvl === 'hard' ? 'Plays out its best options a few turns ahead before choosing' : 'Scores every option one turn ahead'}
                        onClick={() =>
                          update((s) => {
                            const levels = [...(s.aiLevels ?? ['normal', 'normal'])] as ['normal' | 'hard', 'normal' | 'hard'];
                            levels[side] = lvl;
                            return { ...s, aiLevels: levels };
                          })
                        }
                      >
                        {lvl === 'hard' ? 'Hard' : 'Normal'}
                      </button>
                    ))}
                  </>
                )}
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
              {!setup.test && (
                <>
                  <label className="slider">
                    <span>Loadout</span>
                    <select value={setup.loadouts[side]} onChange={(e) => update((s) => ((s.loadouts[side] = e.target.value), s))}>
                      <option value="random">Random starter</option>
                      <option value="random18" title="18 Summons drawn at random, at least 2 of them an Element's cheapest">Random (any 18 Summons)</option>
                      <option value="auto">Auto (built for the Summoner)</option>
                      {loadouts.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                          {l.starter ? ' (starter)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  {(() => {
                    const l = loadouts.find((x) => x.id === setup.loadouts[side]);
                    return l ? <LoadoutStrip summons={l.summons} side={side} /> : <div className="muted small">Chosen when the match starts.</div>;
                  })()}
                </>
              )}
            </div>
          ))}
        </div>
        <div className="btn-row end">
          <button
            onClick={() => {
              setOpen(false);
              setScreen('loadouts');
            }}
          >
            Edit Loadouts…
          </button>
          <span className="spacer" />
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
        <span className="muted small"> Mana Income {STONE_BASE * INCOME_MULTIPLIER * k.stats.mp}/h before Stones</span>
      </div>
      <StatGrid stats={k.stats} />
    </div>
  );
}
