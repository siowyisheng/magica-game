import { alignmentPercent, kindOf, type SideId } from '../rules';
import { useGame } from '../store';
import { ELEMENT_COLORS, SIDE_COLORS } from '../render/sprites';
import { AnimatedSprite } from './AnimatedSprite';

/** Large detail card for the summon being hovered (or placed) in the Summon flow. */
export function SummonCard() {
  const match = useGame((s) => s.match);
  const phase = useGame((s) => s.phase);
  const hoverSummon = useGame((s) => s.hoverSummon);
  const kindId = phase.kind === 'menu' && phase.sub === 'summon' ? hoverSummon : phase.kind === 'summonDir' ? phase.summonKind : null;
  const active = match.units.find((u) => u.id === match.activeUnitId);
  if (!kindId || !active) return null;
  const k = kindOf(kindId);
  const side = active.side as SideId;
  const pct = alignmentPercent(k.alignment, match.clock);
  const m = k.magic[0];
  return (
    <div className="window summon-card">
      <div className="sc-head">
        <AnimatedSprite kind={k.id} side={side} className="sc-sprite" />
        <div>
          <div className="sc-name" style={{ color: SIDE_COLORS[side] }}>{k.name}</div>
          <div className="muted">{k.role}</div>
          {k.element && <div style={{ color: ELEMENT_COLORS[k.element], textTransform: 'capitalize' }}>{k.element}</div>}
          {k.alignment !== 'none' && (
            <div>
              {k.alignment}-aligned
              {pct !== 100 && <span className={pct > 100 ? 'good' : 'bad'}> (now {pct > 100 ? '+' : ''}{pct - 100}%)</span>}
            </div>
          )}
          <div>
            Cost <b>{k.cost}</b>◆ · upkeep {k.cost / 8}/h
          </div>
        </div>
      </div>
      <div className="sc-stats">
        <span>ATK</span><b>{k.stats.atk}</b>
        <span>DEF</span><b>{k.stats.def}</b>
        <span>MP</span><b>{k.stats.mp}</b>
        <span>MDF</span><b>{k.stats.mdf}</b>
        <span>SPD</span><b>{k.stats.spd}</b>
        <span>MOV</span><b>{k.stats.mov}</b>
      </div>
      <div className="sc-row">Move: {k.moveTypes.join(' + ')}</div>
      <div className="sc-row">
        Attack: range {k.attack.minRange}–{k.attack.maxRange}, power {k.attack.power}
      </div>
      {m && m.kind !== 'water' && (
        <div className="sc-row">
          {m.name} ({m.manaCost}◆): {m.kind} {m.targets}, range {m.minRange}–{m.maxRange}
          {m.radius ? ', area 1' : ''}, power {m.power}
        </div>
      )}
    </div>
  );
}
