// A Loadout shown as all the Familiars in Element rows (cheapest first), the
// ones it leaves out darkened. Used in the Match Setup, the in-match
// Loadouts view and the Loadout builder.

import { ELEMENTS, FAMILIARS, kindOf, type SideId } from '../rules';
import { ELEMENT_COLORS, unitIconUrl } from '../render/sprites';
import { useGame } from '../store';

export function LoadoutStrip({
  familiars,
  side,
  onToggle,
  onHover,
  big = false,
}: {
  /** Ids in the Loadout; null = all (Test Match). */
  familiars: string[] | null;
  side: SideId;
  onToggle?: (id: string) => void;
  onHover?: (id: string | null) => void;
  big?: boolean;
}) {
  const inSet = (id: string) => !familiars || familiars.includes(id);
  return (
    <div className={`loadout-strip ${big ? 'big' : ''}`}>
      {ELEMENTS.map((e) => (
        <div key={e} className="loadout-row" style={{ borderColor: `${ELEMENT_COLORS[e]}88` }}>
          {FAMILIARS.filter((s) => s.element === e)
            .slice()
            .sort((a, b) => a.cost - b.cost)
            .map((s) => (
              <div
                key={s.id}
                role={onToggle ? 'button' : undefined}
                className={`loadout-tile ${inSet(s.id) ? 'in' : 'out'} ${onToggle ? 'clickable' : ''}`}
                title={`${s.name} · ${s.cost}◆${inSet(s.id) ? '' : ' · not in this Loadout'}`}
                style={{ background: `${ELEMENT_COLORS[e]}${inSet(s.id) ? '30' : '10'}` }}
                onClick={onToggle ? () => onToggle(s.id) : undefined}
                onMouseEnter={onHover ? () => onHover(s.id) : undefined}
                onMouseLeave={onHover ? () => onHover(null) : undefined}
              >
                <img src={unitIconUrl(s.id, side)} alt="" />
                {big && <span className="nm">{s.name}</span>}
                {big && <span className="cost">{s.cost}</span>}
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

/** In-match view of both Sides' Master and Loadout. */
export function LoadoutsModal() {
  const open = useGame((s) => s.loadoutsOpen);
  const setOpen = useGame((s) => s.setLoadoutsOpen);
  const match = useGame((s) => s.match);
  if (!open) return null;
  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="window loadouts-modal">
        <div className="title">Loadouts</div>
        <div className="setup-sides">
          {([0, 1] as SideId[]).map((side) => {
            const master = match.units.find((u) => u.side === side && kindOf(u.kind).isMaster);
            const roster = match.sides[side].roster ?? null;
            return (
              <div key={side}>
                <div className="side-name" style={{ color: side === 0 ? 'var(--green)' : 'var(--red)' }}>
                  {side === 0 ? 'Green' : 'Red'} · {master ? kindOf(master.kind).name : 'Master fallen'}
                  {!roster && <span className="muted small"> · Test match: all Familiars</span>}
                </div>
                <LoadoutStrip familiars={roster} side={side} big />
              </div>
            );
          })}
        </div>
        <div className="btn-row end">
          <button onClick={() => setOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}
