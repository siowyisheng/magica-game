import { useEffect, useRef } from 'react';
import { activeUnit, type Command, type Unit, previewEffects } from '../rules';
import { hoverQuick, useGame } from '../store';
import { anchorPositions } from '../render/anchors';
import { CommandMenu } from './CommandMenu';
import { DamageTag } from './DamageTag';
import { SummonDetail } from './SummonCard';

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
  const hoverSummon = useGame((s) => s.hoverSummon);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const root = ref.current;
      if (root) {
        const W = root.clientWidth;
        const H = root.clientHeight;
        // The summon detail card floats beside the hovered tile, never cut off.
        const card = root.querySelector<HTMLElement>('.summon-card-float');
        const tile = root.querySelector<HTMLElement>('.summon-tile.hovered');
        if (card) {
          if (!tile) card.style.visibility = 'hidden';
          else {
            const rb = root.getBoundingClientRect();
            const tr = tile.getBoundingClientRect();
            const cw = card.offsetWidth;
            const ch = card.offsetHeight;
            const m = 8;
            let x = tr.right - rb.left + 6;
            if (x + cw > W - m) x = tr.left - rb.left - 6 - cw;
            x = Math.max(m, Math.min(x, W - cw - m));
            const y = Math.max(m, Math.min(tr.top - rb.top + tr.height / 2 - ch / 2, H - ch - m));
            card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
            card.style.visibility = 'visible';
          }
        }
        root.querySelectorAll<HTMLElement>('[data-anchor]').forEach((el) => {
          const p = anchorPositions.get(el.dataset.anchor!);
          if (!p) {
            el.style.visibility = 'hidden';
            return;
          }
          el.style.visibility = 'visible';
          if (el.dataset.clamp === undefined) {
            el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
            return;
          }
          // Menus: open beside the anchor, flip to the other side if needed, never cut off.
          const child = el.firstElementChild as HTMLElement | null;
          const w = child?.offsetWidth ?? 0;
          const h = child?.offsetHeight ?? 0;
          const gap = 36;
          const margin = 8;
          let x = p.x + gap;
          const flip = x + w > W - margin;
          if (flip) x = p.x - gap - w;
          x = Math.max(margin, Math.min(x, W - w - margin));
          const y = Math.max(margin, Math.min(p.y - h / 2, H - h - margin));
          el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
          if ((el.dataset.flip === '1') !== flip) el.dataset.flip = flip ? '1' : '0';
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
      {quick?.plans.attack && (
        <div className="anchor" data-anchor="ghost:A">
          <div className="ghost-badge a">A</div>
        </div>
      )}
      {quick?.plans.magic && (
        <div className="anchor" data-anchor="ghost:M">
          <div className="ghost-badge m">M</div>
        </div>
      )}
      {phase.kind === 'menu' && phase.sub === 'summon' && hoverSummon && u && (
        <div className="summon-card-float">
          <SummonDetail kindId={hoverSummon} side={u.side} />
        </div>
      )}
      {phase.kind === 'quickChoice' && (
        <div
          className="anchor top interactive"
          data-anchor={`unit:${phase.targetId}`}
          data-clamp=""
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
          data-clamp=""
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
