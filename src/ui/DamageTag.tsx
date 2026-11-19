import type { Effect } from '../rules';

const pct = (n: number) => `${n >= 0 ? '+' : ''}${n}%`;

export function DamageTag({ effect }: { effect: Effect }) {
  if (effect.kind === 'heal') {
    return <div className="dmg-tag heal">+{effect.amount} HP</div>;
  }
  const b = effect.breakdown!;
  return (
    <div className={`dmg-tag ${effect.lethal ? 'lethal' : ''}`}>
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
