import { formatClock, kindOf, projectTimeline, timeOfDay } from '../rules';
import { previewDelay, useGame } from '../store';
import { unitIconUrl } from '../render/sprites';

/** Upcoming actions shown after the acting unit. */
const UPCOMING = 15;
const SLOT = 62;

interface Slot {
  key: string;
  unitId: number;
  clock: number;
  now: boolean;
  exact: boolean;
  preview: boolean;
}

/**
 * One row of floating unit sprites in action order (not scaled by time).
 * Each unit's n-th appearance keeps the key `id#n`, so entries slide to their
 * new slot after every turn and while a command is being previewed.
 */
export function Timeline() {
  const match = useGame((s) => s.match);
  const phase = useGame((s) => s.phase);
  const hoverHex = useGame((s) => s.hoverHex);
  const hoverCommand = useGame((s) => s.hoverCommand);
  const hoverUnitId = useGame((s) => s.hoverUnitId);
  const setHoverUnit = useGame((s) => s.setHoverUnit);

  const delay = previewDelay({ match, phase, hoverHex, hoverCommand });
  const seen = new Map<number, number>();
  const nextKey = (id: number) => {
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    return `${id}#${n}`;
  };
  const slots: Slot[] = [];
  if (match.activeUnitId !== null) {
    slots.push({ key: nextKey(match.activeUnitId), unitId: match.activeUnitId, clock: match.clock, now: true, exact: true, preview: false });
  }
  for (const e of projectTimeline(match, UPCOMING, delay)) {
    slots.push({ key: nextKey(e.unitId), unitId: e.unitId, clock: e.clock, now: false, exact: e.exact, preview: e.preview });
  }

  // Faint hour marks between consecutive actions that cross an hour (for Mana planning).
  const hours: { key: number; index: number }[] = [];
  for (let i = 1; i < slots.length; i++) {
    const h0 = Math.floor(slots[i - 1].clock / 60);
    const h1 = Math.floor(slots[i].clock / 60);
    if (h1 > h0) hours.push({ key: h1, index: i });
  }

  return (
    <div className="timeline" style={{ width: SLOT * slots.length + 16 }}>
      {hours.map((h) => (
        <div key={`h${h.key}`} className="tl-hour" style={{ left: 8 + h.index * SLOT - 1 }}>
          <span>{formatClock(h.key * 60).slice(0, 2)}</span>
        </div>
      ))}
      {slots.map((s, i) => {
        const u = match.units.find((x) => x.id === s.unitId);
        if (!u) return null;
        const tod = timeOfDay(s.clock);
        return (
          <div
            key={s.key}
            className={[
              'tl-entry',
              `side${u.side}`,
              s.now ? 'now' : '',
              s.exact ? '' : 'projected',
              s.preview ? 'preview' : '',
              hoverUnitId === s.unitId ? 'hovered' : '',
            ].join(' ')}
            style={{ left: 8 + i * SLOT }}
            onMouseEnter={() => setHoverUnit(s.unitId)}
            onMouseLeave={() => setHoverUnit(null)}
            title={`${kindOf(u.kind).name} — ${formatClock(s.clock)}${s.exact ? '' : ' (projected)'}`}
          >
            <img src={unitIconUrl(u.kind, u.side)} alt="" />
            <span className={`t ${tod}`}>{s.now ? 'NOW' : formatClock(s.clock)}</span>
          </div>
        );
      })}
    </div>
  );
}
