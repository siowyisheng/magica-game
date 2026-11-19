import { useLayoutEffect, useRef, useState } from 'react';
import { formatClock, kindOf, projectTimeline, timeOfDay, type MatchState } from '../rules';
import { previewDelay, useGame } from '../store';
import { unitIconUrl } from '../render/sprites';

const COUNT = 12;
const ICON = 34;

/** Background segments of Day / Night / Neutral between two clocks. */
function bands(from: number, to: number) {
  const out: { from: number; to: number; tod: string }[] = [];
  let t = from;
  while (t < to) {
    const tod = timeOfDay(t);
    let n = t + 1;
    while (n < to && timeOfDay(n) === tod) n++;
    out.push({ from: t, to: n, tod });
    t = n;
  }
  return out;
}

export function Timeline() {
  const match = useGame((s) => s.match);
  const phase = useGame((s) => s.phase);
  const hoverHex = useGame((s) => s.hoverHex);
  const hoverCommand = useGame((s) => s.hoverCommand);
  const hoverUnitId = useGame((s) => s.hoverUnitId);
  const setHoverUnit = useGame((s) => s.setHoverUnit);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const delay = previewDelay({ match, phase, hoverHex, hoverCommand });
  const entries = projectTimeline(match, COUNT, delay);
  const start = match.clock;
  const end = Math.max(start + 60, ...entries.map((e) => e.clock)) + 10;
  const padL = ICON * 2 + 16;
  const padR = ICON / 2 + 8;
  const x = (c: number) => padL + ((c - start) / (end - start)) * (width - padL - padR);

  // lane assignment to avoid overlap
  const lanes: number[] = [];
  const placed = entries.map((e) => {
    const px = x(e.clock);
    let lane = 0;
    while (lanes[lane] !== undefined && px - lanes[lane] < ICON + 2) lane++;
    lanes[lane] = px;
    return { ...e, px, lane };
  });
  const active = match.activeUnitId;

  const hours: number[] = [];
  for (let h = Math.ceil(start / 60) * 60; h <= end; h += 60) hours.push(h);

  return (
    <div className="timeline window" ref={ref}>
      <div className="tl-axis">
        {bands(start, end).map((b, i) => (
          <div key={i} className={`band ${b.tod}`} style={{ left: x(b.from), width: x(b.to) - x(b.from) }} />
        ))}
        {hours.map((h) => (
          <div key={h} className="hour" style={{ left: x(h) }}>
            <span>{formatClock(h).slice(0, 2)}</span>
          </div>
        ))}
        <div className="now" style={{ left: x(start) }}>
          <span>{formatClock(start)}</span>
        </div>
        {active !== null && <TimelineNow match={match} x={x(start)} hovered={hoverUnitId === active} />}
        {placed.map((e, i) => {
          const u = match.units.find((x) => x.id === e.unitId)!;
          const hovered = hoverUnitId === e.unitId;
          return (
            <div
              key={i}
              className={`tl-entry side${u.side} ${hovered ? 'hovered' : ''} ${e.preview ? 'preview' : ''} ${e.exact ? '' : 'projected'}`}
              style={{ left: e.px - ICON / 2, top: 6 + e.lane * (ICON + 14) }}
              onMouseEnter={() => setHoverUnit(e.unitId)}
              onMouseLeave={() => setHoverUnit(null)}
              title={`${kindOf(u.kind).name} — ${formatClock(e.clock)}${e.exact ? '' : ' (projected)'}`}
            >
              <img src={unitIconUrl(u.kind, u.side)} alt="" />
              <span className="t">{formatClock(e.clock)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineNow({ match, x, hovered }: { match: MatchState; x: number; hovered: boolean }) {
  const setHoverUnit = useGame((s) => s.setHoverUnit);
  const u = match.units.find((v) => v.id === match.activeUnitId);
  if (!u) return null;
  return (
    <div
      className={`tl-entry now-entry side${u.side} ${hovered ? 'hovered' : ''}`}
      style={{ left: x - ICON * 1.5 - 10, top: 6 }}
      onMouseEnter={() => setHoverUnit(u.id)}
      onMouseLeave={() => setHoverUnit(null)}
      title="Acting now"
    >
      <img src={unitIconUrl(u.kind, u.side)} alt="" />
      <span className="t">NOW</span>
    </div>
  );
}
