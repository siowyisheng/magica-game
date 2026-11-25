import {
  abilityDisplayName,
  abilityLabel,
  abilityTargetHexes,
  activeUnit,
  canCastWater,
  canStandOn,
  DIRS,
  ELEMENTS,
  kindOf,
  LABEL_TEXT,
  mapHexAt,
  neighbor,
  inRoster,
  FAMILIARS,
  unitAt,
  type MatchState,
  type Hex,
  type UnitKind,
} from '../rules';
import { useGame } from '../store';
import { ELEMENT_COLORS, unitIconUrl } from '../render/sprites';
import { ClassIcon } from './icons';

function canSummonAny(match: MatchState, unitId: number, to: Hex, sk: UnitKind): boolean {
  return DIRS.some((d) => {
    const h = neighbor(to, d);
    const mh = mapHexAt(match.map, h);
    const occ = unitAt(match, h);
    return !!mh && canStandOn(sk, mh, match.waterLevel) && (!occ || occ.id === unitId);
  });
}

export function CommandMenu() {
  const match = useGame((s) => s.match);
  const phase = useGame((s) => s.phase);
  const choose = useGame((s) => s.choose);
  const setHoverCommand = useGame((s) => s.setHoverCommand);
  const setHoverSummon = useGame((s) => s.setHoverSummon);
  const hoverSummon = useGame((s) => s.hoverSummon);
  const u = activeUnit(match);
  if (!u || phase.kind !== 'menu') return null;
  const kind = kindOf(u.kind);
  // A Stranded unit that stays put can only Wait.
  const stuck = u.stranded && phase.to.q === u.pos.q && phase.to.r === u.pos.r;
  const to = phase.to;
  const mana = match.sides[u.side].mana;
  const ab = kind.ability;
  const canAct = !stuck && (ab.kind === 'water' ? canCastWater(match, ab.delta) : abilityTargetHexes(match, u, to).length > 0);
  const hover = (c: Parameters<typeof setHoverCommand>[0]) => ({
    onMouseEnter: () => setHoverCommand(c),
    onMouseLeave: () => setHoverCommand(null),
  });
  const stop = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation();

  const body = (() => {
    if (phase.sub === 'summon') {
      return (
        <div className="summon-panel">
          <div className="summon-grid">
            {ELEMENTS.map((e) => (
              <div key={e} className="summon-row">
                {FAMILIARS.filter((s) => s.element === e && inRoster(match, u.side, s.id))
                  .slice()
                  .sort((a, b) => a.cost - b.cost)
                  .map((s) => {
                    const ok = mana >= s.cost && canSummonAny(match, u.id, to, s);
                    // a div, not a disabled button, so hover (and the detail card) works even when unaffordable
                    return (
                      <div
                        key={s.id}
                        role="button"
                        aria-disabled={!ok}
                        className={`summon-tile ${ok ? '' : 'disabled'} ${hoverSummon === s.id ? 'hovered' : ''}`}
                        style={{ background: `${ELEMENT_COLORS[e]}2e`, borderColor: `${ELEMENT_COLORS[e]}66` }}
                        onClick={() => ok && choose({ summon: s.id })}
                        onMouseEnter={() => {
                          setHoverCommand('summon');
                          setHoverSummon(s.id);
                        }}
                        onMouseLeave={() => {
                          setHoverCommand(null);
                          setHoverSummon(null);
                        }}
                      >
                        <img src={unitIconUrl(s.id, u.side)} alt="" />
                        <span className="cls"><ClassIcon kind={s} size={12} /></span>
                        <span className="nm">{s.name}</span>
                        <span className="cost">{s.cost}</span>
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      );
    }
    return (
      <>
        <button onClick={() => choose('wait')} {...hover('wait')}>Wait</button>
        <button disabled={!canAct} onClick={() => choose('act')} {...hover('act')} title={abilityDisplayName(kind)}>
          <ClassIcon kind={kind} size={12} /> {LABEL_TEXT[abilityLabel(ab)]}
        </button>
        {kind.isMaster && (
          <button disabled={stuck} onClick={() => choose({ sub: 'summon' })} {...hover('summon')}>Summon ▸</button>
        )}
      </>
    );
  })();

  return (
    <div className="window command-menu" onPointerDown={stop} onPointerMove={stop} onContextMenu={(e) => e.preventDefault()}>
      <div className="title">{phase.sub ? 'Summon' : kind.name}</div>
      {body}
      <div className="hint">Right-click: back</div>
    </div>
  );
}
