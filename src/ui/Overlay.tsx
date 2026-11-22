import { useEffect, useRef, useState } from 'react';
import { MAX_HP, activeUnit, type Command, type Target, type Unit, previewEffects, targetById, targetAt, isObstacle, hexDistance, kindOf, trajectoryOf, primaryMagic } from '../rules';
import { blockedShot, hoverQuick, useGame } from '../store';
import { anchorPositions } from '../render/anchors';
import { CommandMenu } from './CommandMenu';
import { DamageNumber, DamageTag } from './DamageTag';
import { animElapsed, type Impact } from '../anim';

/** How long a Damage Number stays up after impact (fade in, hold, fade out). */
const POP_MS = 800;
import { SummonDetail } from './SummonCard';

/** DOM layer over the canvas; children with data-anchor follow 3D anchors. */
export function Overlay() {
  const ref = useRef<HTMLDivElement>(null);
  const match = useGame((s) => s.match);
  const phase = useGame((s) => s.phase);
  const hoverHex = useGame((s) => s.hoverHex);
  const hpBars = useGame((s) => s.hpBars);
  const showHpBars = hpBars !== 'off';
  const hpShown = (hp: number) => hpBars === 'always' || hp < MAX_HP;
  const rightClick = useGame((s) => s.rightClick);
  const hoverUnitId = useGame((s) => s.hoverUnitId);
  const choose = useGame((s) => s.choose);
  const hoverSummon = useGame((s) => s.hoverSummon);
  const anim = useGame((s) => s.anim);
  // HP shown from each impact on, until the turn's result replaces the state
  const [struck, setStruck] = useState<Map<number, number>>(() => new Map());
  // Damage Numbers popping after impacts; they outlive the turn
  const [pops, setPops] = useState<{ key: string; impact: Impact }[]>([]);
  const fired = useRef(new Set<string>());
  useEffect(() => {
    if (!anim) setStruck((m) => (m.size ? new Map() : m));
  }, [anim]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const a = useGame.getState().anim;
      if (a) {
        const t = animElapsed(a);
        a.impacts.forEach((imp, i) => {
          const key = `${a.start}:${i}`;
          if (t < imp.t || fired.current.has(key)) return;
          fired.current.add(key);
          setStruck((m) => new Map(m).set(imp.unitId, imp.hpAfter));
          setPops((p) => [...p, { key, impact: imp }]);
          setTimeout(() => {
            setPops((p) => p.filter((x) => x.key !== key));
            fired.current.delete(key);
          }, POP_MS + 50);
        });
      }
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
            // sticky: a Damage Number stays where its unit was (e.g. after a KO)
            if (el.dataset.sticky === undefined || !el.style.transform) el.style.visibility = 'hidden';
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
  type Tag = { unit: Target; effect?: ReturnType<typeof previewEffects>[number]; label?: string; note?: string };
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
          unit: targetById(match, ef.unitId)!,
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
    const effects = previewEffects(match, { unitId: u.id, to: phase.to, facing: phase.facing, command });
    for (const e of effects) {
      const t = targetById(match, e.unitId);
      if (t) tags.push({ unit: t, effect: e });
    }
    // in range but blocked: say so
    const t = targetAt(match, hoverHex);
    if (!effects.length && t && t.id !== u.id) {
      const k = kindOf(u.kind);
      const ab = phase.command === 'attack' ? k.attack : k.magic.find((m) => m.id === (phase.command as { magic: string }).magic);
      if (ab && 'range' in ab && trajectoryOf(ab) === 'direct' && hexDistance(phase.to, hoverHex) <= ab.range) {
        tags.push({ unit: t, note: 'No clear shot' });
      }
    }
  }
  // quick-action hover on a target that only a blocked Direct shot could reach
  if (u && !quick && phase.kind === 'move' && phase.selected) {
    const t = (hoverUnitId !== null ? targetById(match, hoverUnitId) : undefined) ?? (hoverHex ? targetAt(match, hoverHex) : undefined);
    if (t && t.id !== u.id && (isObstacle(t) || t.side !== u.side || primaryMagic(u)?.kind === 'heal') && blockedShot(match, u, t)) {
      tags.push({ unit: t, note: 'No clear shot' });
    }
  }

  const perUnit = new Map<number, number>();
  for (const t of tags) perUnit.set(t.unit.id, (perUnit.get(t.unit.id) ?? 0) + 1);

  return (
    <div className="overlay" ref={ref}>
      {showHpBars &&
        match.units.filter((unit) => struck.get(unit.id) !== 0).map((unit) => (
          <div key={unit.id} className="anchor" data-anchor={`unit:${unit.id}`}>
            <div className="center-bottom">
              <UnitBars unit={unit} hp={struck.get(unit.id) ?? unit.hp} showHp={hpShown(struck.get(unit.id) ?? unit.hp)} />
            </div>
          </div>
        ))}
      {showHpBars &&
        match.obstacles.filter((o) => struck.get(o.id) !== 0 && hpShown(struck.get(o.id) ?? o.hp)).map((o) => (
          <div key={o.id} className="anchor" data-anchor={`unit:${o.id}`}>
            <div className="center-bottom">
              <div className="unit-bars">
                <div className="hp-bar obstacle">
                  {Array.from({ length: 10 }, (_, i) => (
                    <span key={i} className={i < (struck.get(o.id) ?? o.hp) ? 'on grey' : ''} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      {[...new Set(tags.map((t) => t.unit.id))].map((id) => (
        <div key={`tag${id}`} className="anchor top" data-anchor={`tag:${id}`}>
          <div className="center-bottom tag-stack">
            {tags
              .filter((t) => t.unit.id === id)
              .map((t, i) => (
                t.effect ? <DamageTag key={i} effect={t.effect} label={(perUnit.get(id) ?? 0) > 1 ? t.label : undefined} note={t.note} /> : <div key={i} className="dmg-tag blocked">{t.note}</div>
              ))}
          </div>
        </div>
      ))}
      {pops.map(({ key, impact }) => (
        <div key={`pop${key}`} className="anchor top" data-anchor={`tag:${impact.unitId}`} data-sticky="">
          <div className="center-bottom">
            <div className="dmg-pop" style={{ animationDuration: `${POP_MS}ms` }}>
              <DamageNumber kind={impact.kind} amount={impact.amount} lethal={impact.lethal} />
            </div>
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

function UnitBars({ unit, hp, showHp }: { unit: Unit; hp: number; showHp: boolean }) {
  const av = Math.max(0, unit.av);
  const main = Math.min(av, 60) / 60;
  const over = Math.min(Math.max(av - 60, 0), 60) / 60;
  return (
    <div className="unit-bars">
      {showHp && (
        <div className="hp-bar">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={i < hp ? (unit.side === 0 ? 'on green' : 'on red') : ''} />
          ))}
        </div>
      )}
      <div className="av-bar" title={`AV ${av}`}>
        <div className="av-fill" style={{ width: `${main * 100}%` }} />
        <div className="av-over" style={{ width: `${over * 100}%` }} />
      </div>
    </div>
  );
}
