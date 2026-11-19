import {
  activeUnit,
  alignmentPercent,
  coverPercent,
  dayOf,
  formatClock,
  kindOf,
  manaIncome,
  mapHexAt,
  stonesControlled,
  surfaceOf,
  timeOfDay,
  upkeep,
  MANA_MAX,
  type SideId,
} from '../rules';
import { useGame } from '../store';
import { SIDE_COLORS, unitIconUrl } from '../render/sprites';
import { AlignmentIcon, ElementIcon, Icon } from './icons';
import { StatGrid, magicText } from './Stats';

const SIDE_NAME = ['Green', 'Red'];

export function InfoPanel() {
  const match = useGame((s) => s.match);
  const hoverUnitId = useGame((s) => s.hoverUnitId);
  const hoverHex = useGame((s) => s.hoverHex);
  const showHpBars = useGame((s) => s.showHpBars);
  const toggleHpBars = useGame((s) => s.toggleHpBars);
  const pixelSize = useGame((s) => s.pixelSize);
  const setPixelSize = useGame((s) => s.setPixelSize);
  const setAi = useGame((s) => s.setAi);
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

  return (
    <div className="info">
      <div className="window">
        <div className="title">Battle</div>
        <div className="clock">
          <Icon name={tod} size={18} /> {formatClock(match.clock)}
          <span className="muted"> day {dayOf(match.clock)} · {tod}</span>
        </div>
        <div className="muted">Water Level {match.waterLevel} (range {match.minWaterLevel}–{match.maxWaterLevel})</div>
        {([0, 1] as SideId[]).map((side) => {
          const inc = manaIncome(match, side);
          return (
            <div key={side} className="side-row">
              <div className="side-name" style={{ color: SIDE_COLORS[side] }}>
                {SIDE_NAME[side]} {match.sides[side].ai ? '(AI)' : '(Human)'}
                {aiThinking && activeUnit(match)?.side === side && <span className="muted"> thinking…</span>}
              </div>
              <div className="mana">
                <div className="mana-bar"><div style={{ width: `${(match.sides[side].mana / MANA_MAX) * 100}%` }} /></div>
                <span>{match.sides[side].mana}/{MANA_MAX}</span>
              </div>
              <div className="muted">
                ◆ {stonesControlled(match, side)} stones · income {inc >= 0 ? '+' : ''}{inc}/h (upkeep {upkeep(match, side)})
              </div>
            </div>
          );
        })}
      </div>

      {shown && <UnitCard unitId={shown.id} />}

      {mh && (
        <div className="window">
          <div className="title">Terrain</div>
          <div>
            {mh.terrain === 'stone' ? 'Magic Stone' : mh.terrain === 'rough' ? 'Rough' : 'Plain'} · height {mh.height} ·{' '}
            {surfaceOf(mh, match.waterLevel)}
          </div>
          <div className="muted">Defense bonus {coverPercent(match, mh.hex)}%</div>
        </div>
      )}

      <div className="window">
        <div className="title">Options</div>
        <label><input type="checkbox" checked={showHpBars} onChange={toggleHpBars} /> Floating HP / AV bars</label>
        <label>
          <input type="checkbox" checked={match.sides[1].ai} onChange={(e) => setAi(1, e.target.checked)} /> Red is AI (off = hotseat)
        </label>
        <label>
          <input type="checkbox" checked={match.sides[0].ai} onChange={(e) => setAi(0, e.target.checked)} /> Green is AI
        </label>
        <label>
          Pixel size{' '}
          <select value={pixelSize} onChange={(e) => setPixelSize(Number(e.target.value))}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>{n}×</option>
            ))}
          </select>
        </label>
        <button onClick={newMatch}>New match</button>
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
  const k = kindOf(u.kind);
  const pct = alignmentPercent(k.alignment, match.clock);
  return (
    <div className="window">
      <div className="title" style={{ color: SIDE_COLORS[u.side] }}>
        {k.element && <ElementIcon element={k.element} />} {k.name}{' '}
        {k.alignment !== 'none' && <AlignmentIcon alignment={k.alignment} />}
        {pct !== 100 && <span className={`small ${pct > 100 ? 'good' : 'bad'}`}> {pct > 100 ? '+' : ''}{pct - 100}%</span>}
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
      <StatGrid stats={k.stats} pct={pct} />
      <div className="muted small">Attack: range {k.attack.range}</div>
      {k.magic.map((m) => (
        <div key={m.id} className="muted small">
          {m.name} ({m.manaCost}◆): {magicText(m)}
        </div>
      ))}
      {!k.isSummoner && <div className="muted small">Cost {k.cost}◆ · Upkeep {k.cost / 8}</div>}
    </div>
  );
}
