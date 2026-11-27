import { powerStat, statusesOf, type Ability, type Stats, type UnitKind } from '../rules';
import { Icon } from './icons';

const ORDER: { key: keyof Stats; icon: 'atk' | 'def' | 'mp' | 'mdf' | 'spd' | 'mov'; aligned: boolean }[] = [
  { key: 'atk', icon: 'atk', aligned: true },
  { key: 'def', icon: 'def', aligned: true },
  { key: 'mp', icon: 'mp', aligned: true },
  { key: 'mdf', icon: 'mdf', aligned: true },
  { key: 'spd', icon: 'spd', aligned: false },
  { key: 'mov', icon: 'mov', aligned: false },
];

/** Short stat names, for text. */
export const STAT_NAME: Record<keyof Stats, string> = { atk: 'ATK', def: 'DEF', mp: 'MP', mdf: 'MDF', spd: 'SPD', mov: 'MOV' };

/**
 * The basic stats with their icons; ATK/DEF/MP/MDF show the current Alignment
 * adjustment. `hide` leaves one out (a Familiar's unused ATK or MP);
 * `boosted` marks the stat its Signature Bonus raised (already in `stats`).
 */
export function StatGrid({ stats, align = 0, size = 14, atkBonus = 0, hide, boosted }: { stats: Stats; align?: number; size?: number; atkBonus?: number; hide?: keyof Stats; boosted?: keyof Stats }) {
  return (
    <div className="stat-grid">
      {ORDER.filter(({ key }) => key !== hide).map(({ key, icon, aligned }) => {
        const v = stats[key];
        const bonus = key === 'atk' ? atkBonus : 0;
        const shown = (aligned ? v + align : v) + bonus;
        const net = (aligned ? align : 0) + bonus + (key === boosted ? 1 : 0);
        const cls = net !== 0 ? (net > 0 ? 'good' : 'bad') : '';
        return (
          <span key={key} className={`stat ${key === boosted ? 'sig' : ''}`} title={key === boosted ? 'Signature Bonus: +1' : undefined}>
            <Icon name={icon} size={size} />
            <b className={cls}>{shown}</b>
          </span>
        );
      })}
    </div>
  );
}


/** The stat a Familiar's grid leaves out: the one its Ability doesn't use (Masters show both: MP sets Mana Income). */
export function hiddenStat(k: UnitKind): keyof Stats | undefined {
  if (k.isMaster) return undefined;
  return powerStat(k) === 'atk' ? 'mp' : 'atk';
}

/** Short rules text for an Ability (no power: that comes from the user's ATK or MP). */
export function abilityText(m: Ability): string {
  if (m.kind === 'water') return `${m.delta > 0 ? 'raise' : 'lower'} the Water Level`;
  const st = statusesOf(m);
  const hexText = st.hex ? `Hex (−${st.hex.amount} MDF for ${st.hex.minutes / 60} h)` : '';
  const riders = m.kind === 'damage' ? [hexText, st.entangle ? 'Entangle' : ''].filter(Boolean).join(' + ') : '';
  const plus = riders ? ` + ${riders} on enemies hit` : '';
  if (m.kind === 'damage' && m.burst) return `${m.power === 'atk' ? 'physical ' : ''}Burst: hits everything within ${m.radius} (allies too)${plus}`;
  const traj = m.range > 1 ? ` · ${m.trajectory === 'direct' ? 'Direct' : 'High'}` : '';
  const where = `range ${m.range}${m.radius ? `, area ${m.radius}` : ''}${traj}`;
  if (m.kind === 'empower') return `+${m.amount ?? 3} ATK to an ally or itself until its next physical hit, range ${m.range}`;
  if (m.kind === 'hex') return `${hexText} on enemies, ${where}`;
  if (m.kind === 'entangle') return `Entangle enemies (no movement on their next turn), ${where}`;
  const what = m.kind === 'heal' ? 'heal' : m.power === 'atk' ? 'physical damage' : 'magic damage';
  return `${what}, ${where}${plus}`;
}
