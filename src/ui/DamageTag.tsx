import type { Effect } from '../rules';
import { MAX_HP } from '../rules';

/** Font size of a Damage Number: grows with the amount (square root), capped so all stay readable. */
export function damageNumberSize(amount: number, lethal: boolean): number {
  return Math.round(18 + 10 * Math.sqrt(Math.min(amount, MAX_HP) / MAX_HP)) + (lethal ? 2 : 0);
}

/** The floating number shown in the Damage Preview and again at impact. */
export function DamageNumber({ kind, amount, lethal }: { kind: 'damage' | 'heal'; amount: number; lethal: boolean }) {
  const cls = kind === 'heal' ? 'heal' : amount === 0 ? 'zero' : lethal ? 'lethal' : '';
  return (
    <div className={`dmg-num ${cls}`} style={{ fontSize: damageNumberSize(amount, lethal && kind === 'damage') }}>
      {kind === 'heal' ? `+${amount}` : amount === 0 ? '0' : `−${amount}`}
      {lethal && kind === 'damage' && <span className="ko">KO</span>}
    </div>
  );
}

/** Damage Preview: the Damage Number, plus which Command it is when two are shown, and why it can't be cast. */
export function DamageTag({ effect, label, note }: { effect: Effect; label?: string; note?: string }) {
  return (
    <div className="dmg-tag">
      {label && <div className="lbl">{label}</div>}
      <DamageNumber kind={effect.kind} amount={effect.amount} lethal={effect.lethal} />
      {note && <div className="note">{note}</div>}
    </div>
  );
}
