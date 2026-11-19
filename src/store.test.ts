import { describe, expect, it, beforeEach } from 'vitest';
import { closestFacing, useGame } from './store';
import { activeUnit, getUnit, hex } from './rules';

describe('closestFacing', () => {
  it('picks the hex direction with the closest angle', () => {
    const o = hex(0, 0);
    expect(closestFacing(o, hex(3, 0))).toBe(0); // E
    expect(closestFacing(o, hex(2, -2))).toBe(1); // NE
    expect(closestFacing(o, hex(-3, 0))).toBe(3); // W
    expect(closestFacing(o, hex(0, 3))).toBe(5); // SE
    expect(closestFacing(o, hex(3, -1))).toBe(0); // ~19° above E → E
  });
});

describe('facing is set while the command menu is open', () => {
  beforeEach(() => {
    useGame.setState({ animate: false });
    useGame.getState().newMatch();
  });

  it('left-click on the map sets facing; Wait commits immediately with it', () => {
    const s = useGame.getState();
    const u = activeUnit(s.match)!;
    s.clickHex(u.pos); // stay → menu
    expect(useGame.getState().phase.kind).toBe('menu');
    useGame.getState().clickHex(hex(u.pos.q - 3, u.pos.r)); // to the W
    const p = useGame.getState().phase;
    expect(p.kind === 'menu' && p.facing).toBe(3);
    useGame.getState().choose('wait');
    const after = useGame.getState();
    expect(getUnit(after.match, u.id).facing).toBe(3);
    expect(after.match.activeUnitId).not.toBe(u.id);
  });

  it('attack commits on target click, keeping the menu facing', () => {
    const s = useGame.getState();
    const m = s.match;
    const me = activeUnit(m)!;
    const foe = m.units.find((x) => x.side !== me.side)!;
    const units = m.units.map((x) => (x.id === foe.id ? { ...x, pos: hex(me.pos.q + 1, me.pos.r - 1) } : x));
    useGame.setState({ match: { ...m, units } });
    useGame.getState().clickHex(me.pos);
    useGame.getState().clickHex(hex(me.pos.q - 2, me.pos.r)); // face W, away from foe
    useGame.getState().choose('attack');
    useGame.getState().clickHex(hex(me.pos.q + 1, me.pos.r - 1));
    const after = useGame.getState();
    expect(getUnit(after.match, me.id).facing).toBe(3);
    expect(after.match.activeUnitId).not.toBe(me.id);
  });
});
