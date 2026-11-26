import { useMemo } from 'react';
import {
  abilityDisplayName,
  activeUnit,
  classOf,
  CLASS_NAME,
  alignmentBonus,
  coverAt,
  dayOf,
  formatClock,
  kindOf,
  manaIncome,
  nextIncomeAt,
  signatureStatOf,
  mapHexAt,
  stonesControlled,
  surfaceOf,
  timeOfDay,
  upkeep,
  INCOME_MULTIPLIER,
  MANA_MAX,
  STONE_BASE,
  type SideId,
} from '../rules';
import { type HpBarsMode, useGame } from '../store';
import { useOnline } from '../online/session';
import { makePlan } from '../ai/plan';
import { SIDE_COLORS, unitIconUrl } from '../render/sprites';
import { AlignmentIcon, ClassIcon, ElementIcon, Icon } from './icons';
import { StatGrid, abilityText, hiddenStat } from './Stats';
import { SignatureStar } from './LoadoutView';
import { useAudio } from '../audio';
import { listMaps } from '../maps/library';
import { fromMapDef, useEditor } from '../editor/editorStore';

const SIDE_NAME = ['Green', 'Red'];

export function InfoPanel() {
  const match = useGame((s) => s.match);
  const hoverUnitId = useGame((s) => s.hoverUnitId);
  const hoverHex = useGame((s) => s.hoverHex);
  const hpBars = useGame((s) => s.hpBars);
  const showPlans = useGame((s) => s.showPlans);
  const setShowPlans = useGame((s) => s.setShowPlans);
  const setHpBars = useGame((s) => s.setHpBars);
  const setAi = useGame((s) => s.setAi);
  const watching = useGame((s) => s.replay !== null);
  const online = useOnline((s) => s.stage !== null);
  const newMatch = useGame((s) => s.newMatch);
  const log = useGame((s) => s.log);
  const aiThinking = useGame((s) => s.aiThinking);

  const tod = timeOfDay(match.clock);
  const shown =
    match.units.find((u) => u.id === hoverUnitId) ??
    (hoverHex ? match.units.find((u) => u.pos.q === hoverHex.q && u.pos.r === hoverHex.r) : undefined) ??
    activeUnit(match) ??
    undefined;
  const mh = hoverHex ? mapHexAt(match.map, hoverHex) : undefined;
  const obstacle =
    match.obstacles.find((o) => o.id === hoverUnitId) ??
    (hoverHex ? match.obstacles.find((o) => o.pos.q === hoverHex.q && o.pos.r === hoverHex.r) : undefined);

  return (
    <div className="info">
      <div className="window">
        <div className="title">Battle</div>
        <div className="clock">
          <Icon name={tod} size={18} /> {formatClock(match.clock)}
          <span className="muted"> day {dayOf(match.clock)} · {tod}</span>
        </div>
        <div className="muted">Water Level {match.waterLevel} (range {match.minWaterLevel}–{match.maxWaterLevel})</div>
        <div className="muted small" title="At the Time Limit the Side with more Magic Stones wins; if level, more total HP; else a draw">
          Time Limit {formatClock(match.timeLimit)} day {dayOf(match.timeLimit)} · {Math.max(0, Math.ceil((match.timeLimit - match.clock) / 60))} h left
        </div>
        {([0, 1] as SideId[]).map((side) => {
          return (
            <div key={side} className="side-row">
              <div className="side-name" style={{ color: SIDE_COLORS[side] }}>
                {SIDE_NAME[side]} {match.sides[side].ai ? `(AI${match.sides[side].aiLevel === 'hard' ? ', Hard' : ''})` : '(Human)'}
                {!match.sides[side].roster && <span className="muted small"> · Test match</span>}
                {aiThinking && activeUnit(match)?.side === side && <span className="muted"> thinking…</span>}
              </div>
              <ManaBars side={side} />
              {showPlans && match.sides[side].ai && match.winner === null && <AiPlanLine side={side} />}
            </div>
          );
        })}
      </div>

      {obstacle ? (
        <div className="window">
          <div className="title">Obstacle</div>
          <div className="hp-bar big">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={i < obstacle.hp ? 'on grey' : ''} />
            ))}
          </div>
          <div>
            <Icon name="def" /> {obstacle.def} · <Icon name="mdf" /> {obstacle.def}
          </div>
          <div className="muted small">Blocks movement and Direct shots; Fly passes over; High shots arc over. Takes ×1 damage from every side.</div>
        </div>
      ) : (
        shown && <UnitCard unitId={shown.id} />
      )}

      {mh && (
        <div className="window">
          <div className="title">Terrain</div>
          <div>
            {mh.terrain === 'pit'
              ? 'Pit (only Fly crosses)'
              : `${mh.terrain === 'stone' ? 'Magic Stone' : mh.terrain === 'rough' ? 'Rough' : 'Plain'} · height ${mh.height} · ${surfaceOf(mh, match.waterLevel)}`}
          </div>
          <div className="muted">Cover {coverAt(match, mh.hex) > 0 ? `−${coverAt(match, mh.hex)} damage taken` : 'none'}</div>
        </div>
      )}

      <div className="window">
        <div className="title">Options</div>
        <label title="Show what each AI Side is trying to do: its Posture, Front, summon Needs and Reserve">
          <input type="checkbox" checked={showPlans} onChange={(e) => setShowPlans(e.target.checked)} /> Show AI plans
        </label>
        <label>
          Floating HP bars{' '}
          <select value={hpBars} onChange={(e) => setHpBars(e.target.value as HpBarsMode)}>
            <option value="damaged">When damaged</option>
            <option value="always">Always</option>
            <option value="off">Off (no AV bars either)</option>
          </select>
        </label>
        {!watching && !online && (
          <>
            <label>
              <input type="checkbox" checked={match.sides[1].ai} onChange={(e) => setAi(1, e.target.checked)} /> Red is AI (off = hotseat)
            </label>
            <label>
              <input type="checkbox" checked={match.sides[0].ai} onChange={(e) => setAi(0, e.target.checked)} /> Green is AI
            </label>
          </>
        )}
        <SoundOptions />
        {!online && (
          <div className="btn-row">
            <button onClick={() => useGame.getState().setSetupOpen(true)}>New match…</button>
            <button onClick={newMatch} title="Same map and Masters">Rematch</button>
          </div>
        )}
        <div className="btn-row">
          <button onClick={() => useGame.getState().setScreen('online')} title="Play someone on another computer">
            Online…
          </button>
        </div>
        <div className="btn-row">
          <button onClick={() => useGame.getState().setLoadoutsOpen(true)} title="Both Sides' Master and Loadout">View Loadouts</button>
          <button onClick={() => useGame.getState().setScreen('loadouts')}>Edit Loadouts</button>
        </div>
        <div className="btn-row">
          <button onClick={openEditor}>Map Editor</button>
          <button onClick={() => useGame.getState().setScreen('dev')}>Dev tools</button>
        </div>
        <div className="btn-row">
          <button onClick={() => useGame.getState().setScreen('replays')}>Replays…</button>
        </div>
        <div className="muted small">Wheel: zoom · Right-drag: pan · Right-click: back / cancel move</div>
      </div>

      <div className="window log">
        <div className="title">Log</div>
        {log.slice(0, 12).map((l, i) => (
          <div key={i} className={i === 0 ? '' : 'muted'}>{l}</div>
        ))}
      </div>
    </div>
  );
}

function UnitCard({ unitId }: { unitId: number }) {
  const match = useGame((s) => s.match);
  const u = match.units.find((x) => x.id === unitId);
  if (!u) return null;
  const k = kindOf(u);
  const align = alignmentBonus(k.alignment, match.clock);
  return (
    <div className="window">
      <div className="title" style={{ color: SIDE_COLORS[u.side] }}>
        {k.element && <ElementIcon element={k.element} />} {k.name}{' '}
        {k.alignment !== 'none' && <AlignmentIcon alignment={k.alignment} />}
        {align !== 0 && <span className={`small ${align > 0 ? 'good' : 'bad'}`}> {align > 0 ? '+' : '−'}{Math.abs(align)}</span>}
        {u.signature && (
          <span className="small" title={`Signature: +1 ${signatureStatOf(k).toUpperCase()}`}>
            {' '}
            <SignatureStar size={12} />
          </span>
        )}
      </div>
      <div className="unit-card">
        <img src={unitIconUrl(u.kind, u.side)} alt="" />
        <div>
          <div className="hp-bar big">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={i < u.hp ? (u.side === 0 ? 'on green' : 'on red') : ''} />
            ))}
          </div>
          <div className="muted">AV {u.av}{u.stranded ? ' · STRANDED' : ''}</div>
          <div className="muted">Move Type: {k.moveTypes.join(' + ')}</div>
        </div>
      </div>
      <StatGrid stats={k.stats} align={align} atkBonus={u.empowered ?? 0} hide={hiddenStat(k)} boosted={u.signature ? signatureStatOf(k) : undefined} />
      {!!u.empowered && <div className="good small">Empowered: +{u.empowered} ATK until its next physical hit</div>}
      <div className="muted small">
        {!k.isMaster && (
          <>
            <ClassIcon kind={k} size={12} /> {CLASS_NAME[classOf(k)]} ·{' '}
          </>
        )}
        {abilityDisplayName(k)}: {abilityText(k.ability)}
      </div>
      {!k.isMaster && <div className="muted small">Cost {k.cost}◆ · Upkeep {k.cost / 8}</div>}
    </div>
  );
}

/**
 * Mana, gross income and upkeep as stacked bars on one Mana scale (0–120).
 * The income bar is marked at base income and at each stone; numbers appear on hover.
 */
function ManaBars({ side }: { side: SideId }) {
  const match = useGame((s) => s.match);
  const master = match.units.find((u) => u.side === side && kindOf(u).isMaster);
  const mk = master ? kindOf(master) : null;
  // Mana per Stone-hour, with the Master's Alignment at the next hour mark
  const mp = mk ? INCOME_MULTIPLIER * Math.max(0, mk.stats.mp + alignmentBonus(mk.alignment, nextIncomeAt(match.clock))) : 0;
  const stones = stonesControlled(match, side);
  const base = STONE_BASE * mp;
  const gross = (STONE_BASE + stones) * mp;
  const up = upkeep(match, side);
  const net = manaIncome(match, side);
  const pct = (v: number) => `${Math.min(100, (v / MANA_MAX) * 100)}%`;
  const marks: number[] = [];
  for (let i = 0; i < stones; i++) if (base + i * mp < MANA_MAX) marks.push(base + i * mp);
  return (
    <div className="mana-stack">
      <div className="mana">
        <div className="mana-bar">
          <div style={{ width: pct(match.sides[side].mana) }} />
        </div>
        <span>
          {match.sides[side].mana}/{MANA_MAX}
        </span>
      </div>
      <div className="sub-bar income">
        <div className="fill" style={{ width: pct(gross) }} />
        {marks.map((m) => (
          <div key={m} className="mark" style={{ left: pct(m) }} />
        ))}
        {gross > MANA_MAX && <span className="over">»</span>}
      </div>
      <div className="sub-bar upkeep">
        <div className="fill" style={{ width: pct(up) }} />
        {up > MANA_MAX && <span className="over">»</span>}
      </div>
      <div className="mana-tip">
        Income +{gross} (base {base} + {stones} stone{stones === 1 ? '' : 's'} × {mp}) · Upkeep −{up} · Net {net >= 0 ? '+' : ''}
        {net}/h
      </div>
    </div>
  );
}

/** Open the editor on the map the current match is played on. */
function openEditor() {
  const g = useGame.getState();
  const m = listMaps().find((x) => x.id === g.mapId);
  const ed = useEditor.getState();
  if (!ed.dirty) ed.load(m ? fromMapDef(m.map, m.id, m.builtin) : fromMapDef(g.match.map, null, false));
  g.setScreen('editor');
}

function SoundOptions() {
  const { music, sfx, muted, track, setMusic, setSfx, toggleMute, skipTrack } = useAudio();
  return (
    <div className="sound-options">
      <label className="slider">
        <span>Music</span>
        <input type="range" min={0} max={1} step={0.05} value={music} onChange={(e) => setMusic(Number(e.target.value))} />
      </label>
      <label className="slider">
        <span>Sound</span>
        <input type="range" min={0} max={1} step={0.05} value={sfx} onChange={(e) => setSfx(Number(e.target.value))} />
      </label>
      <div className="now-playing">
        <label><input type="checkbox" checked={muted} onChange={toggleMute} /> Mute</label>
        <span className="muted small track-name" title="Now playing">{track && !muted && music > 0 ? `♪ ${track}` : ''}</span>
        <button className="small-btn" onClick={skipTrack} disabled={!track || muted || music === 0} title="Next track">⏭</button>
      </div>
    </div>
  );
}

/** One line: what an AI Side is trying to do (docs/ai-plan.md). */
function AiPlanLine({ side }: { side: SideId }) {
  const match = useGame((s) => s.match);
  const text = useMemo(() => makePlan(match, side).text, [match, side]);
  return <div className="ai-plan small" title="The AI's Plan this turn">{text}</div>;
}
