import {
  activeUnit,
  attackTargets,
  canCastWater,
  canStandOn,
  DIRS,
  ELEMENTS,
  getUnit,
  kindOf,
  magicTargetHexes,
  mapHexAt,
  MAX_SUMMONS,
  neighbor,
  summonCount,
  SUMMONS,
  unitAt,
  type MatchState,
  type Hex,
  type UnitKind,
} from '../rules';
import { useGame } from '../store';
import { ELEMENT_COLORS, unitIconUrl } from '../render/sprites';
import { SummonDetail } from './SummonCard';

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
  const to = phase.to;
  const mana = match.sides[u.side].mana;
  const moved = { ...u, pos: to };
  const view = { ...match, units: match.units.map((x) => (x.id === u.id ? moved : x)) };
  const canAttack = attackTargets(view, getUnit(view, u.id), to).length > 0;
  const hover = (c: Parameters<typeof setHoverCommand>[0]) => ({
    onMouseEnter: () => setHoverCommand(c),
    onMouseLeave: () => setHoverCommand(null),
  });
  const stop = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation();

  const body = (() => {
    if (phase.sub === 'magic') {
      return kind.magic.map((ab) => {
        const usable =
          mana >= ab.manaCost &&
          (ab.kind === 'water' ? canCastWater(match, ab.delta) : magicTargetHexes(match, u, ab, to).length > 0);
        return (
          <button key={ab.id} disabled={!usable} onClick={() => choose({ magic: ab.id })} {...hover('magic')}>
            {ab.name} <span className="cost">{ab.manaCost}◆</span>
          </button>
        );
      });
    }
    if (phase.sub === 'summon') {
      const full = summonCount(match, u.side) >= MAX_SUMMONS;
      return (
        <div className="summon-panel">
          <div className="summon-grid">
            {ELEMENTS.map((e) => (
              <div key={e} className="summon-col">
                {SUMMONS.filter((s) => s.element === e)
                  .slice()
                  .sort((a, b) => a.cost - b.cost)
                  .map((s) => {
                    const ok = !full && mana >= s.cost && canSummonAny(match, u.id, to, s);
                    // a div, not a disabled button, so hover (and the detail card) works even when unaffordable
                    return (
                      <div
                        key={s.id}
                        role="button"
                        aria-disabled={!ok}
                        className={`summon-tile ${ok ? '' : 'disabled'}`}
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
                        <span className="nm">{s.name}</span>
                        <span className="cost">{s.cost}</span>
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
          <div className="summon-detail-slot">{hoverSummon && <SummonDetail kindId={hoverSummon} side={u.side} />}</div>
        </div>
      );
    }
    return (
      <>
        <button onClick={() => choose('wait')} {...hover('wait')}>Wait</button>
        <button disabled={u.stranded || !canAttack} onClick={() => choose('attack')} {...hover('attack')}>Attack</button>
        {kind.isSummoner ? (
          <button disabled={u.stranded} onClick={() => choose({ sub: 'magic' })} {...hover('magic')}>Magic ▸</button>
        ) : (
          (() => {
            const ab = kind.magic[0];
            const usable =
              !u.stranded &&
              mana >= ab.manaCost &&
              (ab.kind === 'water' ? canCastWater(match, ab.delta) : magicTargetHexes(match, u, ab, to).length > 0);
            return (
              <button disabled={!usable} onClick={() => choose({ magic: ab.id })} {...hover('magic')}>
                {ab.name} <span className="cost">{ab.manaCost}◆</span>
              </button>
            );
          })()
        )}
        {kind.isSummoner && (
          <button disabled={u.stranded} onClick={() => choose({ sub: 'summon' })} {...hover('summon')}>Summon ▸</button>
        )}
      </>
    );
  })();

  return (
    <div className="window command-menu" onPointerDown={stop} onPointerMove={stop} onContextMenu={(e) => e.preventDefault()}>
      <div className="title">{phase.sub ? (phase.sub === 'magic' ? 'Magic' : 'Summon') : kind.name}</div>
      {body}
      <div className="hint">Right-click: back</div>
    </div>
  );
}
