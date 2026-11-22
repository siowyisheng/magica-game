import type { Stats } from '../rules';
import { Icon } from './icons';

const ORDER: { key: keyof Stats; icon: 'atk' | 'def' | 'mp' | 'mdf' | 'spd' | 'mov'; aligned: boolean }[] = [
  { key: 'atk', icon: 'atk', aligned: true },
  { key: 'def', icon: 'def', aligned: true },
  { key: 'mp', icon: 'mp', aligned: true },
  { key: 'mdf', icon: 'mdf', aligned: true },
  { key: 'spd', icon: 'spd', aligned: false },
  { key: 'mov', icon: 'mov', aligned: false },
];

/** The six basic stats with their icons; ATK/DEF/MP/MDF show the current Alignment adjustment. */
export function StatGrid({ stats, align = 0, size = 14 }: { stats: Stats; align?: number; size?: number }) {
  return (
    <div className="stat-grid">
      {ORDER.map(({ key, icon, aligned }) => {
        const v = stats[key];
        const shown = aligned ? v + align : v;
        const cls = aligned && align !== 0 ? (align > 0 ? 'good' : 'bad') : '';
        return (
          <span key={key} className="stat">
            <Icon name={icon} size={size} />
            <b className={cls}>{shown}</b>
          </span>
        );
      })}
    </div>
  );
}

import type { MagicAbility } from '../rules';

/** Short rules text for a Magic Ability (no minimum range, no power). */
export function magicText(m: MagicAbility): string {
  if (m.kind === 'water') return `${m.delta > 0 ? 'raise' : 'lower'} the Water Level`;
  if (m.kind === 'damage' && m.burst) return `Burst: hits everything within ${m.radius} (allies too)`;
  return `${m.kind}, range ${m.range}${m.radius ? `, area ${m.radius}` : ''}`;
}
