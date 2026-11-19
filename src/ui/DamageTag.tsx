import type { Effect } from '../rules';

const pct = (n: number) => `${n >= 0 ? '+' : ''}${n}%`;

export function DamageTag({ effect, label, note }: { effect: Effect; label?: string; note?: string }) {
  if (effect.kind === 'heal') {
    return (
      <div className="dmg-tag heal">
        {label && <div className="lbl">{label}</div>}+{effect.amount} HP
        {note && <div className="row bad">{note}</div>}
      </div>
    );
  }
  const b = effect.breakdown!;
  return (
    <div className={`dmg-tag ${effect.lethal ? 'lethal' : ''}`}>
      {label && <div className="lbl">{label}</div>}
      {note && <div className="row bad">{note}</div>}
      <div className="big">
        {effect.amount === 0 ? '0' : `−${effect.amount}`}
        {effect.lethal && <span className="ko"> KO</span>}
        <span className="after"> → {effect.hpBefore - effect.amount}/10</span>
      </div>
      {effect.amount === 0 && <div className="row muted">no effect</div>}
      <div className="row">base {b.base.toFixed(2)}</div>
      {b.element !== 1 && <div className={`row ${b.element > 1 ? 'good' : 'bad'}`}>element ×{b.element}</div>}
      <div className={`row ${b.facing > 1 ? 'good' : ''}`}>facing ×{b.facing.toFixed(2)} ({Math.round(b.facingAngle)}°)</div>
      {b.cover > 0 && <div className="row bad">cover −{b.cover}%</div>}
      {b.attackerAlign !== 100 && <div className="row">attacker {pct(b.attackerAlign - 100)}</div>}
      {b.defenderAlign !== 100 && <div className="row">defender {pct(b.defenderAlign - 100)}</div>}
    </div>
  );
}
