import { useEffect, useRef } from 'react';
import { activeUnit, type Command, type Unit, previewEffects } from '../rules';
import { useGame } from '../store';
import { anchorPositions } from '../render/anchors';
import { CommandMenu } from './CommandMenu';
import { DamageTag } from './DamageTag';

/** DOM layer over the canvas; children with data-anchor follow 3D anchors. */
export function Overlay() {
  const ref = useRef<HTMLDivElement>(null);
  const match = useGame((s) => s.match);
  const phase = useGame((s) => s.phase);
  const hoverHex = useGame((s) => s.hoverHex);
  const showHpBars = useGame((s) => s.showHpBars);
  const rightClick = useGame((s) => s.rightClick);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const root = ref.current;
      if (root) {
        root.querySelectorAll<HTMLElement>('[data-anchor]').forEach((el) => {
          const p = anchorPositions.get(el.dataset.anchor!);
          if (p) {
            el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
            el.style.visibility = 'visible';
          } else el.style.visibility = 'hidden';
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const u = activeUnit(match);
  const tags: { unit: Unit; effect: ReturnType<typeof previewEffects>[number] }[] = [];
  if (u && phase.kind === 'target' && hoverHex) {
    const command: Command =
      phase.command === 'attack'
        ? { type: 'attack', target: hoverHex }
        : { type: 'magic', ability: phase.command.magic, target: hoverHex };
    for (const e of previewEffects(match, { unitId: u.id, to: phase.to, facing: u.facing, command })) {
      const t = match.units.find((x) => x.id === e.unitId);
      if (t) tags.push({ unit: t, effect: e });
    }
  }

  return (
    <div className="overlay" ref={ref}>
      {showHpBars &&
        match.units.map((unit) => (
          <div key={unit.id} className="anchor" data-anchor={`unit:${unit.id}`}>
            <div className="center-bottom">
              <UnitBars unit={unit} />
            </div>
          </div>
        ))}
      {tags.map(({ unit, effect }) => (
        <div key={`tag${unit.id}`} className="anchor top" data-anchor={`tag:${unit.id}`}>
          <div className="center-bottom">
            <DamageTag effect={effect} />
          </div>
        </div>
      ))}
      {phase.kind === 'menu' && (
        <div
          className="anchor top interactive"
          data-anchor="menu"
          onContextMenu={(e) => {
            e.preventDefault();
            rightClick();
          }}
        >
          <CommandMenu />
        </div>
      )}
    </div>
  );
}

function UnitBars({ unit }: { unit: Unit }) {
  const av = Math.max(0, unit.av);
  const main = Math.min(av, 60) / 60;
  const over = Math.min(Math.max(av - 60, 0), 60) / 60;
  return (
    <div className="unit-bars">
      <div className="hp-bar">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={i < unit.hp ? (unit.side === 0 ? 'on green' : 'on red') : ''} />
        ))}
      </div>
      <div className="av-bar" title={`AV ${av}`}>
        <div className="av-fill" style={{ width: `${main * 100}%` }} />
        <div className="av-over" style={{ width: `${over * 100}%` }} />
      </div>
    </div>
  );
}
