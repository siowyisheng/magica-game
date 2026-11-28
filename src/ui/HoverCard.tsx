// The hover card: the details of whatever the pointer is on (a Unit on the map, an
// Obstacle, or a Familiar in a Master's Loadout). It docks at the middle of the left
// or right edge, whichever is away from what it describes, like the summon card.

import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import {
  abilityDisplayName,
  alignmentBonus,
  classOf,
  CLASS_NAME,
  formatClock,
  kindOf,
  signatureStatOf,
  type SideId,
} from '../rules';
import { useGame } from '../store';
import { anchorPositions } from '../render/anchors';
import { SIDE_COLORS, unitIconUrl } from '../render/sprites';
import { AlignmentIcon, ClassIcon, ElementIcon, Icon } from './icons';
import { StatGrid, abilityText, hiddenStat } from './Stats';
import { SignatureStar } from './LoadoutView';
import { FamiliarDetail } from './FamiliarCard';

/** A Familiar hovered in a Master's Loadout (outside the map). */
export const useLoadoutHover = create<{ kind: { id: string; side: SideId; signature: boolean } | null }>(() => ({ kind: null }));

export function HoverCard() {
  const match = useGame((s) => s.match);
  const phase = useGame((s) => s.phase);
  const hoverUnitId = useGame((s) => s.hoverUnitId);
  const hoverHex = useGame((s) => s.hoverHex);
  const fromLoadout = useLoadoutHover((s) => s.kind);
  const ref = useRef<HTMLDivElement>(null);

  const at = (h: { q: number; r: number } | null, p: { q: number; r: number }) => !!h && h.q === p.q && h.r === p.r;
  const unit = fromLoadout ? undefined : (match.units.find((u) => u.id === hoverUnitId) ?? match.units.find((u) => at(hoverHex, u.pos)));
  const obstacle = fromLoadout || unit ? undefined : (match.obstacles.find((o) => o.id === hoverUnitId) ?? match.obstacles.find((o) => at(hoverHex, o.pos)));
  const anchorId = unit?.id ?? obstacle?.id ?? null;

  // dock away from what it describes; while a summon is being placed its card has the far edge, so take the near one
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const el = ref.current;
      const w = el?.parentElement?.clientWidth ?? 0;
      if (el && w) {
        let right: boolean | null = null;
        if (fromLoadout) right = fromLoadout.side === 0; // the Loadout hangs from that Side's corner
        else if (anchorId !== null) {
          const p = anchorPositions.get(`unit:${anchorId}`);
          if (p) right = p.x < w / 2;
        }
        const g = useGame.getState();
        const active = g.match.units.find((u) => u.id === g.match.activeUnitId);
        const placing = g.phase.kind === 'summonDir' && active ? anchorPositions.get(`unit:${active.id}`) : undefined;
        if (placing) right = placing.x >= w / 2;
        if (right !== null) el.classList.toggle('right', right);
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [fromLoadout, anchorId]);

  // the summon menu shows its own card for the Familiar under the pointer
  if (phase.kind === 'menu' && phase.sub === 'summon') return null;
  let body: React.ReactNode = null;
  if (fromLoadout) body = <FamiliarDetail kindId={fromLoadout.id} side={fromLoadout.side} signature={fromLoadout.signature} />;
  else if (unit) body = <UnitCard unitId={unit.id} />;
  else if (obstacle)
    body = (
      <div className="window hover-obstacle">
        <div className="title">Obstacle</div>
        <div className="hp-bar big">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={i < obstacle.hp ? 'on grey' : ''} />
          ))}
        </div>
        <div>
          <Icon name="def" /> {obstacle.def} · <Icon name="mdf" /> {obstacle.def}
        </div>
        <div className="muted small">Blocks movement and Direct shots; Fly passes over; High shots arc over.</div>
      </div>
    );
  if (!body) return null;
  return (
    <div className="hover-card" ref={ref}>
      {body}
    </div>
  );
}

export function UnitCard({ unitId }: { unitId: number }) {
  const match = useGame((s) => s.match);
  const u = match.units.find((x) => x.id === unitId);
  if (!u) return null;
  const k = kindOf(u);
  const align = alignmentBonus(k.alignment, match.clock);
  return (
    <div className="window summon-card">
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
      {u.hex && (
        <div className="small hexed">
          <Icon name="hex" size={12} /> Hexed: −{u.hex.amount} MDF until {formatClock(u.hex.until)}
        </div>
      )}
      {u.entangled && (
        <div className="small entangled">
          <Icon name="entangle" size={12} /> Entangled: can’t move on its next turn
        </div>
      )}
      <div className="muted small">
        <ClassIcon kind={k} size={12} /> {k.isMaster ? 'Master' : CLASS_NAME[classOf(k)]} · {abilityDisplayName(k)}: {abilityText(k.ability)}
      </div>
      {!k.isMaster && <div className="muted small">Cost {k.cost}◆ · Upkeep {k.cost / 8}</div>}
    </div>
  );
}
