import { describe, expect, it } from 'vitest';
import { planTurnAnim } from './anim';
import { createMatch, getUnit, hex, type MapDef, type MapHex } from './rules';

function flatMap(w: number, h: number): MapDef {
  const hexes: MapHex[] = [];
  for (let r = 0; r < h; r++) for (let q = 0; q < w; q++) hexes.push({ hex: hex(q, r), height: 1, terrain: 'plain' });
  return { name: 't', hexes, waterLevel: 0, startClock: 360, spawns: [hex(0, h - 1), hex(w - 1, 0)], spawnFacing: [0, 3] };
}

describe('turn animation plan', () => {
  it('slides along the path, then bonks for melee attacks', () => {
    const s = createMatch(flatMap(6, 6));
    const me = getUnit(s, s.activeUnitId!); // (0,5)
    const foe = s.units.find((u) => u.side === 1)!;
    foe.pos = hex(3, 5);
    const a = planTurnAnim(s, { unitId: me.id, to: hex(2, 5), facing: 0, command: { type: 'attack', target: hex(3, 5) } }, 0);
    expect(a.steps.map((x) => x.kind)).toEqual(['move', 'melee', 'hit']);
    const mv = a.steps[0];
    expect(mv.kind === 'move' && mv.path).toEqual([hex(0, 5), hex(1, 5), hex(2, 5)]);
  });

  it('fires a projectile for ranged attacks and magic; skips the move when already previewed', () => {
    const s = createMatch(flatMap(8, 8));
    const me = getUnit(s, s.activeUnitId!); // (0,7)
    const foe = s.units.find((u) => u.side === 1)!;
    foe.pos = hex(3, 6);
    const a = planTurnAnim(s, { unitId: me.id, to: hex(1, 7), facing: 0, command: { type: 'magic', ability: 'bolt', target: hex(3, 6) } }, 0, true);
    expect(a.steps.map((x) => x.kind)).toEqual(['projectile', 'hit']);
    const p = a.steps[0];
    expect(p.kind === 'projectile' && p.style).toBe('orb');
  });
});
