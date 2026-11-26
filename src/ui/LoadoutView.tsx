// A Loadout shown as its Familiars in Element rows (cheapest first), the ones
// it leaves out darkened or hidden and its Signature starred. Used in the Match
// Setup, the in-match Loadouts view and the Loadout builder.

import { useState } from 'react';
import { ELEMENTS, FAMILIARS, kindOf, signatureStatOf, type SideId } from '../rules';
import { ELEMENT_COLORS, unitIconUrl } from '../render/sprites';
import { ClassIcon, Icon } from './icons';
import { STAT_NAME } from './Stats';
import { useGame } from '../store';

/** The Signature's star. */
export function SignatureStar({ size = 12 }: { size?: number }) {
  return <Icon name="signature" size={size} />;
}

const HIDE_KEY = 'magica.hideOmitted';
/** Whether Loadout views hide the Familiars a Loadout leaves out (remembered in this browser; hidden by default). */
export function useHideOmitted(): [boolean, (v: boolean) => void] {
  const [hide, setHide] = useState(() => {
    try {
      return localStorage.getItem(HIDE_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const set = (v: boolean) => {
    setHide(v);
    try {
      localStorage.setItem(HIDE_KEY, v ? '1' : '0');
    } catch {
      /* storage unavailable */
    }
  };
  return [hide, set];
}

/** A checkbox for hiding the Familiars a Loadout leaves out. */
export function HideOmittedToggle({ hide, setHide }: { hide: boolean; setHide: (v: boolean) => void }) {
  return (
    <label className="dev-check small">
      <input type="checkbox" checked={!hide} onChange={(e) => setHide(!e.target.checked)} /> Show left-out Familiars
    </label>
  );
}

export function LoadoutStrip({
  familiars,
  signature = null,
  side,
  onToggle,
  onSignature,
  onHover,
  big = false,
  hideOmitted = false,
}: {
  /** Ids in the Loadout; null = all (Test Match). */
  familiars: string[] | null;
  /** The Loadout's Signature (marked with a star). */
  signature?: string | null;
  side: SideId;
  onToggle?: (id: string) => void;
  /** Right-click: make this Familiar the Signature. */
  onSignature?: (id: string) => void;
  onHover?: (id: string | null) => void;
  big?: boolean;
  /** Show only the Familiars in the Loadout. */
  hideOmitted?: boolean;
}) {
  const inSet = (id: string) => !familiars || familiars.includes(id);
  return (
    <div className={`loadout-strip ${big ? 'big' : ''}`}>
      {ELEMENTS.map((e) => {
        const row = FAMILIARS.filter((s) => s.element === e && (!hideOmitted || inSet(s.id)))
          .slice()
          .sort((a, b) => a.cost - b.cost);
        if (!row.length) return null;
        return (
          <div key={e} className="loadout-row" style={{ borderColor: `${ELEMENT_COLORS[e]}88` }}>
            {row.map((s) => {
              const sig = s.id === signature;
              return (
                <div
                  key={s.id}
                  role={onToggle ? 'button' : undefined}
                  className={`loadout-tile ${inSet(s.id) ? 'in' : 'out'} ${sig ? 'sig' : ''} ${onToggle ? 'clickable' : ''}`}
                  title={`${s.name} · ${s.cost}◆${sig ? ` · Signature (+1 ${STAT_NAME[signatureStatOf(s)]})` : ''}${inSet(s.id) ? '' : ' · not in this Loadout'}`}
                  style={{ background: `${ELEMENT_COLORS[e]}${inSet(s.id) ? '30' : '10'}` }}
                  onClick={onToggle ? () => onToggle(s.id) : undefined}
                  onContextMenu={
                    onSignature
                      ? (ev) => {
                          ev.preventDefault();
                          onSignature(s.id);
                        }
                      : undefined
                  }
                  onMouseEnter={onHover ? () => onHover(s.id) : undefined}
                  onMouseLeave={onHover ? () => onHover(null) : undefined}
                >
                  <img src={unitIconUrl(s.id, side)} alt="" />
                  <span className="cls">
                    <ClassIcon kind={s} size={big ? 12 : 9} />
                  </span>
                  {sig && (
                    <span className="sig-star">
                      <SignatureStar size={big ? 13 : 10} />
                    </span>
                  )}
                  {big && <span className="nm">{s.name}</span>}
                  {big && !sig && <span className="cost">{s.cost}</span>}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/** In-match view of both Sides' Master and Loadout, one above the other. */
export function LoadoutsModal() {
  const open = useGame((s) => s.loadoutsOpen);
  const setOpen = useGame((s) => s.setLoadoutsOpen);
  const match = useGame((s) => s.match);
  const [hide, setHide] = useHideOmitted();
  if (!open) return null;
  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="window loadouts-modal">
        <div className="title">Loadouts</div>
        <div className="loadouts-stack">
          {([0, 1] as SideId[]).map((side) => {
            const master = match.units.find((u) => u.side === side && kindOf(u).isMaster);
            const roster = match.sides[side].roster ?? null;
            const sig = roster ? match.sides[side].signature ?? null : null;
            return (
              <div key={side}>
                <div className="side-name" style={{ color: side === 0 ? 'var(--green)' : 'var(--red)' }}>
                  {side === 0 ? 'Green' : 'Red'} · {master ? kindOf(master).name : 'Master fallen'}
                  {sig && (
                    <span className="muted small">
                      {' '}
                      · <SignatureStar size={10} /> {kindOf(sig).name} (+1 {STAT_NAME[signatureStatOf(kindOf(sig))]})
                    </span>
                  )}
                  {!roster && <span className="muted small"> · Test match: all Familiars</span>}
                </div>
                <LoadoutStrip familiars={roster} signature={sig} side={side} big hideOmitted={hide} />
              </div>
            );
          })}
        </div>
        <div className="btn-row end">
          <HideOmittedToggle hide={hide} setHide={setHide} />
          <span className="spacer" />
          <button onClick={() => setOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}
