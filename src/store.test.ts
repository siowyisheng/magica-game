import { withSpells } from './testing/spells';
import { onTestFinished, describe, expect, it, beforeEach, vi } from 'vitest';
import { closestFacing, quickPlans, useGame } from './store';
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
    useGame.setState({ animate: false, setup: { mapId: 'builtin:scaffold-ford', test: true, masters: ['regent', 'regent'], loadouts: ['random', 'random'], ai: [false, true] } });
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

  it('attack via the menu turns the attacker toward its target', () => {
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
    expect(getUnit(after.match, me.id).facing).toBe(1); // NE, toward the foe
    expect(after.match.activeUnitId).not.toBe(me.id);
  });
});

describe('selection, quick actions and range toggles', () => {
  beforeEach(() => {
    useGame.setState({ animate: false, setup: { mapId: 'builtin:scaffold-ford', test: true, masters: ['regent', 'regent'], loadouts: ['random', 'random'], ai: [false, true] } });
    useGame.getState().newMatch();
  });

  const placeFoe = (dq: number, dr: number) => {
    const m = useGame.getState().match;
    const me = activeUnit(m)!;
    const foe = m.units.find((x) => x.side !== me.side)!;
    const units = m.units.map((x) => (x.id === foe.id ? { ...x, pos: hex(me.pos.q + dq, me.pos.r + dr), facing: 1 as const } : x));
    useGame.setState({ match: { ...m, units } });
    return { me, foe: getUnit(useGame.getState().match, foe.id) };
  };

  it('left-clicking a unit in Magic Reach (Bolt) moves to the chosen hex and casts', () => {
    onTestFinished(withSpells());
    // find a spot out of melee reach but within Bolt reach
    let found: ReturnType<typeof placeFoe> | null = null;
    for (const [dq, dr] of [[0, -6], [1, -6], [2, -6], [0, -5], [3, -6], [-1, -5], [2, -7]]) {
      const c = placeFoe(dq, dr);
      const p = quickPlans(useGame.getState().match, c.me, c.foe);
      if (!p.attack && p.magic) {
        found = c;
        break;
      }
    }
    expect(found).not.toBeNull();
    const { me, foe } = found!;
    const plans = quickPlans(useGame.getState().match, me, foe);
    expect(plans.attack).toBeNull();
    expect(plans.magic).not.toBeNull();
    const mana = useGame.getState().match.sides[me.side].mana;
    useGame.getState().clickHex(foe.pos);
    const after = useGame.getState().match;
    expect(after.activeUnitId).not.toBe(me.id);
    expect(getUnit(after, me.id).pos).toEqual(plans.magic!.dest);
    expect(after.sides[me.side].mana).toBeLessThan(mana);
  });

  it('offers a choice when both Attack and Magic can hit the target', () => {
    onTestFinished(withSpells());
    const { foe } = placeFoe(2, -2);
    useGame.getState().clickHex(foe.pos);
    expect(useGame.getState().phase.kind).toBe('quickChoice');
    useGame.getState().rightClick();
    expect(useGame.getState().phase).toEqual({ kind: 'move', selected: true });
    useGame.getState().clickHex(foe.pos);
    const actorId = useGame.getState().match.activeUnitId;
    useGame.getState().choose('attack');
    expect(useGame.getState().match.activeUnitId).not.toBe(actorId);
  });

  it('deselects on an out-of-range click or right-click, and reselects on any click', () => {
    useGame.getState().clickHex(hex(50, 50));
    expect(useGame.getState().phase).toEqual({ kind: 'move', selected: false });
    useGame.getState().clickHex(hex(50, 50));
    expect(useGame.getState().phase).toEqual({ kind: 'move', selected: true });
    useGame.getState().setHoverHex(hex(50, 50));
    useGame.getState().rightClick();
    expect(useGame.getState().phase).toEqual({ kind: 'move', selected: false });
    useGame.getState().rightClick();
    expect(useGame.getState().phase).toEqual({ kind: 'move', selected: true });
  });

  it('right-click toggles other units’ ranges (max 3, oldest dropped) and clears when the turn ends', () => {
    const m = useGame.getState().match;
    const me = activeUnit(m)!;
    const extra = [201, 202, 203].map((id, i) => ({ ...me, id, kind: 'imp', side: 1 as const, pos: hex(i, 0), av: 500 }));
    useGame.setState({ match: { ...m, units: [...m.units, ...extra] } });
    const foe = m.units.find((x) => x.side !== me.side)!;
    for (const id of [foe.id, 201, 202, 203]) {
      useGame.getState().setHoverUnit(id);
      useGame.getState().rightClick();
    }
    expect(useGame.getState().inspected).toEqual([201, 202, 203]);
    useGame.getState().setHoverUnit(202);
    useGame.getState().rightClick();
    expect(useGame.getState().inspected).toEqual([201, 203]);
    expect(useGame.getState().phase).toEqual({ kind: 'move', selected: true });
    useGame.getState().setHoverUnit(null);
    useGame.getState().clickHex(me.pos);
    useGame.getState().choose('wait');
    expect(useGame.getState().inspected).toEqual([]);
  });
});

describe('choosing a summon hex', () => {
  it('selects the valid adjacent hex closest in angle to the cursor, even through crowded hexes', async () => {
    const { summonDirToward, validSummonDirs } = await import('./store');
    useGame.setState({ animate: false, setup: { mapId: 'builtin:scaffold-ford', test: true, masters: ['regent', 'regent'], loadouts: ['random', 'random'], ai: [false, true] } });
    useGame.getState().newMatch();
    const m = useGame.getState().match;
    const me = activeUnit(m)!;
    // block the NE neighbour's lower neighbours (SW and SE of it) and the E neighbour
    const ne = hex(me.pos.q + 1, me.pos.r - 1);
    const blockers = [hex(me.pos.q + 1, me.pos.r), hex(me.pos.q + 2, me.pos.r - 1)].map((pos, i) => ({ ...me, id: 400 + i, kind: 'imp', pos }));
    const state = { ...m, units: [...m.units, ...blockers] };
    const valid = validSummonDirs(state, me.id, me.pos, 'imp');
    expect(valid).toContain(1);
    // cursor over a blocker two hexes away still lands on the NE hex
    expect(summonDirToward(state, me.id, me.pos, 'imp', hex(me.pos.q + 2, me.pos.r - 1))).toBe(1);
    expect(summonDirToward(state, me.id, me.pos, 'imp', ne)).toBe(1);
    expect(summonDirToward(state, me.id, me.pos, 'imp', me.pos)).toBeNull();
  });
});

describe('quick action animation', () => {
  it('slides the unit from its own hex (the move is animated, not skipped)', () => {
    useGame.setState({ animate: true });
    useGame.getState().newMatch();
    const m = useGame.getState().match;
    const me = activeUnit(m)!;
    const foe = m.units.find((x) => x.side !== me.side)!;
    const units = m.units.map((x) => (x.id === foe.id ? { ...x, pos: hex(me.pos.q + 2, me.pos.r - 3), facing: 1 as const } : x));
    useGame.setState({ match: { ...m, units } });
    const q = quickPlans(useGame.getState().match, me, getUnit(useGame.getState().match, foe.id));
    useGame.getState().clickHex(hex(me.pos.q + 2, me.pos.r - 3));
    if (useGame.getState().phase.kind === 'quickChoice') useGame.getState().choose('attack');
    const anim = useGame.getState().anim;
    expect(anim).not.toBeNull();
    const mv = anim!.steps.find((s) => s.kind === 'move');
    expect(mv && mv.kind === 'move' && mv.path[0]).toEqual(me.pos);
    expect(q.attack).not.toBeNull();
    useGame.setState({ animate: false, anim: null });
  });
});

describe('handing a Side to a person', () => {
  it('keeps an AI box unticked during a turn animation instead of re-ticking it', () => {
    vi.useFakeTimers();
    try {
      useGame.setState({ animate: true, anim: null, aiThinking: false });
      useGame.getState().startFromSetup({ mapId: 'builtin:scaffold-ford', test: true, masters: ['regent', 'regent'], loadouts: ['random', 'random'], ai: [true, true] });
      for (let i = 0; i < 40 && !useGame.getState().anim; i++) {
        useGame.getState().tickAi();
        vi.advanceTimersByTime(500);
      }
      expect(useGame.getState().anim).not.toBeNull();
      useGame.getState().setAi(0, false);
      useGame.getState().setAi(1, false);
      vi.advanceTimersByTime(10000);
      const s = useGame.getState();
      expect(s.anim).toBeNull();
      expect(s.match.sides.map((x) => x.ai)).toEqual([false, false]);
      expect(s.phase.kind).toBe('move');
    } finally {
      useGame.setState({ animate: false, anim: null });
      vi.useRealTimers();
    }
  });
});
