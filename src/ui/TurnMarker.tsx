// The Turn Marker: a floating gem over the Unit whose turn it is. Gold when a person
// at this screen plays it; grey for the AI, the online opponent and in Replays. It
// drops in when the turn starts and lifts away when the Command is confirmed.

import { useEffect, useState } from 'react';
import { activeUnit } from '../rules';
import { onlineSide, useGame } from '../store';

/** How long the marker takes to lift away. */
const LEAVE_MS = 260;

export function TurnMarker() {
  const match = useGame((s) => s.match);
  const anim = useGame((s) => s.anim);
  const replay = useGame((s) => s.replay);
  const u = activeUnit(match);
  const mine = (): boolean => {
    if (!u || replay || match.sides[u.side].ai) return false;
    const side = onlineSide();
    return side === null || side === u.side;
  };
  const want = u && match.winner === null && !anim ? { id: u.id, gold: mine() } : null;
  const [shown, setShown] = useState<{ id: number; gold: boolean; leaving: boolean } | null>(null);

  useEffect(() => {
    if (shown && !shown.leaving && (!want || want.id !== shown.id)) {
      // lift away, then (maybe) drop onto the next Unit
      setShown({ ...shown, leaving: true });
      return;
    }
    if (shown?.leaving) {
      const t = setTimeout(() => setShown(null), LEAVE_MS);
      return () => clearTimeout(t);
    }
    if (want && (!shown || shown.gold !== want.gold)) setShown({ ...want, leaving: false });
  }, [want?.id, want?.gold, shown]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!shown) return null;
  return (
    <div key={shown.id} className="anchor" data-anchor={`mark:${shown.id}`} data-sticky="">
      <div className="center-bottom">
        <div className={`turn-marker ${shown.gold ? 'gold' : 'grey'} ${shown.leaving ? 'leaving' : ''}`} style={{ animationDuration: shown.leaving ? `${LEAVE_MS}ms` : undefined }}>
          <svg width="30" height="34" viewBox="0 0 30 34" aria-hidden>
            <defs>
              <linearGradient id="tm-face" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="var(--tm-hi)" />
                <stop offset="0.55" stopColor="var(--tm-mid)" />
                <stop offset="1" stopColor="var(--tm-lo)" />
              </linearGradient>
            </defs>
            {/* a downward-pointing gem */}
            <path d="M3 4 L27 4 L15 31 Z" fill="url(#tm-face)" stroke="var(--tm-edge)" strokeWidth="2" strokeLinejoin="round" />
            <path d="M8 6 L15 6 L12.5 15 Z" fill="#ffffff" opacity="0.65" />
          </svg>
        </div>
      </div>
    </div>
  );
}
