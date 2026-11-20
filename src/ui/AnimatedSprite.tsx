import { useEffect, useState } from 'react';
import type { SideId } from '../rules';
import { idleFrameAt, unitFrameUrl } from '../render/sprites';

/** A DOM sprite (88×110) that plays the idle breathing animation. */
export function AnimatedSprite({ kind, side, className }: { kind: string; side: SideId; className?: string }) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const t = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(t);
  }, []);
  return <img className={className} src={unitFrameUrl(kind, side, idleFrameAt(now, 0))} alt="" />;
}
