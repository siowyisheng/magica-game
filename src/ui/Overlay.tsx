import { useEffect, useRef } from 'react';
import { activeUnit, type Command, type Unit, previewEffects } from '../rules';
import { hoverQuick, useGame } from '../store';
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
  const hoverUnitId = useGame((s) => s.hoverUnitId);
  const choose = useGame((s) => s.choose);

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
  type Tag = { unit: Unit; effect: ReturnType<typeof previewEffects>[number]; label?: string; note?: string };
  const tags: Tag[] = [];
  const quick = hoverQuick({ match, phase, hoverHex, hoverUnitId });
  if (u && quick) {
    const { attack, magic } = quick.plans;
    if (attack) {
      const e = previewEffects(match, { unitId: u.id, to: attack.dest, facing: u.facing, command: { type: 'attack', target: quick.target.pos } });
      for (const ef of e) if (ef.unitId === quick.target.id) tags.push({ unit: quick.target, effect: ef, label: 'Attack' });
    }
    if (magic) {
      const e = previewEffects(match, {
        unitId: u.id,
        to: magic.dest,
        facing: u.facing,
        command: { type: 'magic', ability: magic.ability.id, target: quick.target.pos },
      });
      for (const ef of e)
        tags.push({
          unit: match.units.find((x) => x.id === ef.unitId)!,
          effect: ef,
          label: magic.ability.name,
          note: magic.affordable ? undefined : `needs ${magic.ability.manaCost}◆`,
        });
    }
  }
  if (u && phase.kind === 'target' && hoverHex) {
    const command: Command =
      phase.command === 'attack'
        ? { type: 'attack', target: hoverHex }
        : { type: 'magic', ability: phase.command.magic, target: hoverHex };
    for (const e of previewEffects(match, { unitId: u.id, to: phase.to, facing: phase.facing, command })) {
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
      {[...new Set(tags.map((t) => t.unit.id))].map((id) => (
        <div key={`tag${id}`} className="anchor top" data-anchor={`tag:${id}`}>
          <div className="center-bottom tag-stack">
            {tags
              .filter((t) => t.unit.id === id)
              .map((t, i) => (
                <DamageTag key={i} effect={t.effect} label={t.label} note={t.note} />
              ))}
          </div>
        </div>
      ))}
      {phase.kind === 'quickChoice' && (
        <div
          className="anchor top interactive"
          data-anchor={`unit:${phase.targetId}`}
          onContextMenu={(e) => {
            e.preventDefault();
            rightClick();
          }}
        >
          <div className="window command-menu quick-menu" onPointerDown={(e) => e.stopPropagation()}>
            <button onClick={() => choose('attack')}>Attack</button>
            <button onClick={() => choose('magic')}>
              {phase.magic.ability.name} <span className="cost">{phase.magic.ability.manaCost}◆</span>
            </button>
            <div className="hint">Right-click: back</div>
          </div>
        </div>
      )}
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
