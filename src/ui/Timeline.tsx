import { compareTurnOrder, formatClock, kindOf, timeOfDay, turnDelay, type SideId } from '../rules';
import { previewDelay, useGame } from '../store';
import { unitIconUrl } from '../render/sprites';

const SLOT = 62;

interface Slot {
  key: string;
  kind: string;
  side: SideId;
  unitId: number | null;
  clock: number;
  now: boolean;
  preview: boolean;
  ghost: boolean;
}

/**
 * One row of floating unit sprites, each unit once, in the order they act
 * next (not scaled by time). Keys are unit ids, so entries slide to their new
 * slot after every turn and while a command is previewed. A would-be Summon
 * appears as a ghost.
 */
export function Timeline() {
  const match = useGame((s) => s.match);
  const phase = useGame((s) => s.phase);
  const hoverHex = useGame((s) => s.hoverHex);
  const hoverCommand = useGame((s) => s.hoverCommand);
  const hoverUnitId = useGame((s) => s.hoverUnitId);
  const hoverSummon = useGame((s) => s.hoverSummon);
  const setHoverUnit = useGame((s) => s.setHoverUnit);

  const active = match.activeUnitId;
  const ghostKind = phase.kind === 'summonDir' ? phase.summonKind : phase.kind === 'menu' && phase.sub === 'summon' ? hoverSummon : null;
  const activeUnit = match.units.find((u) => u.id === active);
  const delay = ghostKind && activeUnit
    ? turnDelay(kindOf(activeUnit.kind), phase.kind !== 'idle' && 'to' in phase && (phase.to.q !== activeUnit.pos.q || phase.to.r !== activeUnit.pos.r), true)
    : previewDelay({ match, phase, hoverHex, hoverCommand, hoverUnitId });

  type Row = Slot & { av: number; spd: number; id: number };
  const rows: Row[] = match.units.map((u) => {
    const k = kindOf(u.kind);
    const isActive = u.id === active;
    const av = isActive ? (delay ?? -1) : u.av; // acting unit stays first unless previewing
    return {
      key: `u${u.id}`,
      kind: u.kind,
      side: u.side,
      unitId: u.id,
      clock: match.clock + Math.max(0, av),
      now: isActive && delay === undefined,
      preview: isActive && delay !== undefined,
      ghost: false,
      av,
      spd: k.stats.spd,
      id: u.id,
    };
  });
  if (ghostKind && activeUnit) {
    const gk = kindOf(ghostKind);
    const av = turnDelay(gk, true, true);
    rows.push({
      key: 'ghost',
      kind: ghostKind,
      side: activeUnit.side,
      unitId: null,
      clock: match.clock + av,
      now: false,
      preview: false,
      ghost: true,
      av,
      spd: gk.stats.spd,
      id: match.nextUnitId,
    });
  }
  rows.sort(compareTurnOrder);

  // Faint hour marks between consecutive actions that cross an hour (for Mana planning).
  const hours: { key: number; index: number }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const h0 = Math.floor(rows[i - 1].clock / 60);
    const h1 = Math.floor(rows[i].clock / 60);
    if (h1 > h0) hours.push({ key: h1, index: i });
  }

  return (
    <div className="timeline" style={{ width: SLOT * rows.length + 16 }}>
      {hours.map((h) => (
        <div key={`h${h.key}`} className="tl-hour" style={{ left: 8 + h.index * SLOT - 4 }}>
          <span>{formatClock(h.key * 60).slice(0, 2)}</span>
        </div>
      ))}
      {rows.map((s, i) => {
        const tod = timeOfDay(s.clock);
        return (
          <div
            key={s.key}
            className={[
              'tl-entry',
              `side${s.side}`,
              s.now ? 'now' : '',
              s.preview ? 'preview' : '',
              s.ghost ? 'ghost' : '',
              s.unitId !== null && hoverUnitId === s.unitId ? 'hovered' : '',
            ].join(' ')}
            style={{ left: 8 + i * SLOT }}
            onMouseEnter={() => s.unitId !== null && setHoverUnit(s.unitId)}
            onMouseLeave={() => setHoverUnit(null)}
            title={`${kindOf(s.kind).name}${s.ghost ? ' (would be summoned)' : ''} — ${formatClock(s.clock)}`}
          >
            <img src={unitIconUrl(s.kind, s.side)} alt="" />
            <span className={`t ${tod}`}>{s.now ? 'NOW' : formatClock(s.clock)}</span>
          </div>
        );
      })}
    </div>
  );
}
