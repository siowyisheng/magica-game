import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activeUnit, getLocalBalance, kindOf, setLocalBalance, type MatchState } from '../rules';

// in-memory localStorage for node
const mem = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};

const { useGame } = await import('../store');
const lib = await import('./replay');

const SETUP = { mapId: 'builtin:scaffold-ford', test: true, masters: ['regent', 'regent'] as [string, string], loadouts: ['random', 'random'] as [string, string] };

/** Play `n` AI turns of a fresh AI vs AI match (no animation). */
function playAi(n: number) {
  useGame.setState({ animate: false, anim: null, aiThinking: false });
  useGame.getState().startFromSetup({ ...SETUP, ai: [true, true] });
  for (let i = 0; i < n && useGame.getState().match.winner === null; i++) {
    useGame.getState().tickAi();
    vi.advanceTimersByTime(500);
  }
}

const sameBoard = (a: MatchState, b: MatchState) => {
  const strip = (m: MatchState) => JSON.stringify({ ...m, sides: m.sides.map(({ ai: _ai, ...rest }) => rest) });
  return strip(a) === strip(b);
};

describe('Replays', () => {
  beforeEach(() => {
    mem.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    useGame.getState().exitReplay();
    vi.useRealTimers();
  });

  it('records every turn and replays to the same positions, forward and back', () => {
    playAi(12);
    const live = useGame.getState().match;
    const rec = useGame.getState().recording!;
    expect(rec.actions.length).toBe(12);
    expect(lib.listReplays().map((m) => m.id)).toContain(rec.id);

    expect(useGame.getState().openReplay(rec.id)).toBe(true);
    const r = () => useGame.getState().replay!;
    expect(r().index).toBe(0);
    expect(sameBoard(useGame.getState().match, rec.initial)).toBe(true);
    useGame.getState().replaySeek(12);
    expect(sameBoard(useGame.getState().match, live)).toBe(true);
    useGame.getState().replayStep(-1);
    expect(r().index).toBe(11);
    useGame.getState().replayStep(1); // animate forward one turn
    expect(r().index).toBe(12);
    expect(sameBoard(useGame.getState().match, live)).toBe(true);

    // playing runs through the turns on its own
    useGame.getState().replaySeek(0);
    useGame.getState().replayTogglePlay();
    for (let i = 0; i < 40 && r().playing; i++) {
      useGame.getState().tickReplay();
      vi.advanceTimersByTime(500);
    }
    expect(r().index).toBe(12);
    expect(r().playing).toBe(false);

    // nothing can be commanded while watching, and the AI stays still
    useGame.getState().replaySeek(3);
    useGame.getState().tickAi();
    vi.advanceTimersByTime(1000);
    expect(r().index).toBe(3);

    // leaving restores the live match
    useGame.getState().exitReplay();
    expect(useGame.getState().match).toBe(live);
    expect(useGame.getState().replay).toBeNull();
  });

  it('plays back with the stats in force when the match was played', () => {
    const before = getLocalBalance();
    try {
      playAi(4);
      const id = useGame.getState().recording!.id;
      const atk = kindOf('imp').stats.atk;
      setLocalBalance({ kinds: { imp: { stats: { ...kindOf('imp').stats, atk: atk + 7 } } }, abilities: {} });
      expect(kindOf('imp').stats.atk).toBe(atk + 7);
      useGame.getState().openReplay(id);
      expect(kindOf('imp').stats.atk).toBe(atk);
      useGame.getState().exitReplay();
      expect(kindOf('imp').stats.atk).toBe(atk + 7);
    } finally {
      setLocalBalance(before);
    }
  });

  it('stops with a notice at a turn that is no longer legal', () => {
    playAi(6);
    const id = useGame.getState().recording!.id;
    const r = lib.loadReplay(id)!;
    r.actions[3] = { ...r.actions[3], unitId: 9999 };
    lib.storeReplay(r);
    useGame.getState().openReplay(id);
    useGame.getState().replaySeek(6);
    const v = useGame.getState().replay!;
    expect(v.index).toBe(3);
    expect(v.error).toMatch(/Turn 4 can't be replayed/);
  });

  it('Play from here continues the position live with the chosen players', () => {
    playAi(8);
    const id = useGame.getState().recording!.id;
    useGame.getState().openReplay(id);
    useGame.getState().replaySeek(5);
    const pos = useGame.getState().match;
    useGame.getState().playFromHere([false, false]);
    const s = useGame.getState();
    expect(s.replay).toBeNull();
    expect(sameBoard(s.match, pos)).toBe(true);
    expect(s.match.sides.map((x) => x.ai)).toEqual([false, false]);
    expect(s.phase.kind).toBe('move');
    expect(s.recording!.id).not.toBe(id);
    expect(lib.loadReplay(id)!.actions.length).toBe(8); // the Replay itself is unchanged
    // the new match records from the takeover position
    const u = activeUnit(s.match)!;
    s.clickHex(u.pos);
    useGame.getState().choose('wait');
    const rec = useGame.getState().recording!;
    expect(rec.actions.length).toBe(1);
    expect(sameBoard(rec.initial, pos)).toBe(true);
  });

  it('Pause stops AI turns and Commands until resumed', () => {
    useGame.setState({ animate: false, anim: null, aiThinking: false });
    useGame.getState().startFromSetup({ ...SETUP, ai: [false, true] });
    const u = activeUnit(useGame.getState().match)!;
    useGame.getState().togglePause();
    useGame.getState().clickHex(u.pos);
    useGame.getState().choose('wait');
    expect(useGame.getState().recording!.actions.length).toBe(0);
    useGame.getState().togglePause();
    useGame.getState().clickHex(u.pos);
    useGame.getState().choose('wait');
    expect(useGame.getState().recording!.actions.length).toBe(1);
    // now the AI's turn: paused, it waits
    useGame.getState().togglePause();
    useGame.getState().tickAi();
    vi.advanceTimersByTime(2000);
    expect(useGame.getState().recording!.actions.length).toBe(1);
    useGame.getState().togglePause();
    useGame.getState().tickAi();
    vi.advanceTimersByTime(2000);
    expect(useGame.getState().recording!.actions.length).toBe(2);
  });
});

describe('Replay storage', () => {
  beforeEach(() => mem.clear());

  it('keeps the last 10 Recent Replays and every saved one', () => {
    const m = useGame.getState().match;
    const made = Array.from({ length: 14 }, (_, i) => {
      const r = { ...lib.newReplay(m, { kinds: {}, abilities: {} }), id: `r${i}`, updatedAt: 1000 + i, saved: i < 2 };
      lib.storeReplay(r);
      return r;
    });
    const list = lib.listReplays();
    expect(list.filter((x) => x.saved).map((x) => x.id).sort()).toEqual(['r0', 'r1']);
    expect(list.filter((x) => !x.saved)).toHaveLength(lib.RECENT_LIMIT);
    expect(lib.loadReplay('r2')).toBeNull(); // oldest Recent dropped with its body
    expect(lib.loadReplay(made[13].id)).not.toBeNull();
  });

  it('exports and imports a Replay as a new saved one', () => {
    const m = useGame.getState().match;
    const r = { ...lib.newReplay(m, { kinds: {}, abilities: {} }), name: 'Close one' };
    const text = lib.exportReplayJson(r);
    const imported = lib.importReplayJson(text);
    expect(imported.id).not.toBe(r.id);
    expect(imported.saved).toBe(true);
    expect(lib.listReplays()[0].name).toBe('Close one');
    expect(() => lib.importReplayJson('{"format":"other"}')).toThrow();
    // recorded before one Ability per Unit: Attack / Magic Commands can't be watched
    const old = { ...r, actions: [{ unitId: 1, to: { q: 0, r: 0 }, facing: 0, command: { type: 'attack', target: { q: 1, r: 0 } } }] };
    expect(() => lib.importReplayJson(JSON.stringify({ format: 'magica-replay', version: 1, replay: old }))).toThrow(/one Ability/);
    expect(lib.replayProblem(old as never)).toMatch(/one Ability/);
  });
});
