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

describe('summon animation', () => {
  it('plays a summon step at the target hex', () => {
    const s = createMatch(flatMap(6, 6));
    const me = getUnit(s, s.activeUnitId!);
    const a = planTurnAnim(s, { unitId: me.id, to: me.pos, facing: 1, command: { type: 'summon', kind: 'imp', dir: 1 } }, 0, true);
    expect(a.steps.map((x) => x.kind)).toEqual(['summon']);
    const st = a.steps[0];
    expect(st.kind === 'summon' && st.target).toEqual(hex(me.pos.q + 1, me.pos.r - 1));
    expect(a.duration).toBeGreaterThan(1000);
  });
});

describe('capture animation', () => {
  it('plays a capture step when the actor ends its turn on a stone it does not control', () => {
    const map = flatMap(6, 6);
    map.hexes = map.hexes.map((h) => (h.hex.q === 1 && h.hex.r === 4 ? { ...h, terrain: 'stone' as const } : h));
    const s = createMatch(map);
    const me = getUnit(s, s.activeUnitId!); // (0,5)
    const a = planTurnAnim(s, { unitId: me.id, to: hex(1, 4), facing: 1, command: { type: 'wait' } }, 0);
    expect(a.steps.map((x) => x.kind)).toEqual(['move', 'capture']);
    s.stones[0].owner = me.side;
    const b = planTurnAnim(s, { unitId: me.id, to: hex(1, 4), facing: 1, command: { type: 'wait' } }, 0);
    expect(b.steps.map((x) => x.kind)).toEqual(['move']);
  });
});

describe('flying moves', () => {
  it('marks Fly units’ moves as flights, timed as rise + straight glide + descent, with wing sounds', async () => {
    const { FLY_RISE_MS, FLY_LAND_MS, MS_PER_HEX, moveDurationMs } = await import('./anim');
    const { turnCues } = await import('./audio/cues');
    const s = createMatch(flatMap(8, 8));
    const me = getUnit(s, s.activeUnitId!);
    s.units = s.units.map((u) => (u.id === me.id ? { ...u, kind: 'hawk' } : u));
    const action = { unitId: me.id, to: hex(3, 5), facing: 0 as const, command: { type: 'wait' as const } };
    const a = planTurnAnim(s, action, 0);
    const mv = a.steps[0];
    expect(mv.kind === 'move' && mv.fly).toBe(true);
    if (mv.kind !== 'move') return;
    // straight-line distance, not route length
    expect(mv.t1 - mv.t0).toBe(FLY_RISE_MS + FLY_LAND_MS + MS_PER_HEX * 3);
    expect(moveDurationMs('golem', mv.path)).toBe(MS_PER_HEX * (mv.path.length - 1));
    const cues = turnCues(s, action, a, [], 0).map((c) => c.sfx.name);
    expect(cues[0]).toBe('step');
    expect(cues).toContain('land');
    expect(cues).not.toContain('impact');
  });
});
