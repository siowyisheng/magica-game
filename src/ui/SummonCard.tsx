import { alignmentBonus, kindOf, type SideId } from '../rules';
import { useGame } from '../store';
import { SIDE_COLORS } from '../render/sprites';
import { AnimatedSprite } from './AnimatedSprite';
import { AlignmentIcon, ElementIcon } from './icons';
import { StatGrid, magicText } from './Stats';

/** Detailed stats for one summon kind. */
export function SummonDetail({ kindId, side }: { kindId: string; side: SideId }) {
  const match = useGame((s) => s.match);
  const k = kindOf(kindId);
  const align = alignmentBonus(k.alignment, match.clock);
  const m = k.magic[0];
  return (
    <div className="window summon-card">
      <div className="sc-head">
        <AnimatedSprite kind={k.id} side={side} className="sc-sprite" />
        <div>
          <div className="sc-name" style={{ color: SIDE_COLORS[side] }}>
            {k.name}
          </div>
          <div className="sc-tags">
            {k.element && <ElementIcon element={k.element} size={18} />}
            {k.alignment !== 'none' && <AlignmentIcon alignment={k.alignment} size={18} />}
            {align !== 0 && <span className={align > 0 ? 'good' : 'bad'}>{align > 0 ? '+' : '−'}{Math.abs(align)}</span>}
          </div>
          <div className="muted">{k.role}</div>
          <div>
            Cost <b>{k.cost}</b>◆ · Upkeep <b>{k.cost / 8}</b>
          </div>
        </div>
      </div>
      <StatGrid stats={k.stats} align={align} size={16} />
      <div className="sc-row">Move Type: {k.moveTypes.join(' + ')}</div>
      <div className="sc-row">
        Attack: range {k.attack.range}
        {k.attack.range > 1 ? ` · ${k.attack.trajectory === 'direct' ? 'Direct' : 'High'}` : ''}
      </div>
      {m && (
        <div className="sc-row">
          {m.name} ({m.manaCost}◆): {magicText(m)}
        </div>
      )}
    </div>
  );
}

/** While placing a chosen summon, keep its card visible at the top-left of the board. */
export function SummonCard() {
  const match = useGame((s) => s.match);
  const phase = useGame((s) => s.phase);
  const active = match.units.find((u) => u.id === match.activeUnitId);
  if (phase.kind !== 'summonDir' || !active) return null;
  return (
    <div className="placing-card">
      <SummonDetail kindId={phase.summonKind} side={active.side} />
    </div>
  );
}
