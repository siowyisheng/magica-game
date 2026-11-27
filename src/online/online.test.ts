import { describe, expect, it } from 'vitest';
import { banksAfter, clockFace, spend, TIME_BANK_MS, TURN_TIMER_MS, turnAllowance } from './clock';
import { canonical, comparisonKey, resultStatus, SECOND_REPORT_WAIT_MS, type MatchReport } from './report';
import { commitPick, rulesFingerprint, verifyPick } from './fingerprint';
import { createMatch } from '../rules';
import { generateRandomMap as makeTestMap } from '../rules';

/** A fixed random map (the same every run): Scaffold Ford is gone. */
const TEST_MAP = makeTestMap(20261127);

describe('Online clock', () => {
  it('drains the Time Bank only past the free Turn Timer', () => {
    expect(spend(TIME_BANK_MS, 4_000)).toBe(TIME_BANK_MS);
    expect(spend(TIME_BANK_MS, TURN_TIMER_MS + 2_500)).toBe(TIME_BANK_MS - 2_500);
    expect(spend(1_000, TURN_TIMER_MS + 5_000)).toBe(0);
    expect(turnAllowance(0)).toBe(TURN_TIMER_MS);
    expect(banksAfter([{ side: 0, ms: 15_000 }, { side: 1, ms: 3_000 }, { side: 0, ms: 12_000 }])).toEqual([TIME_BANK_MS - 7_000, TIME_BANK_MS]);
  });

  it('shows the Turn Timer, then the Bank, and says when both are out', () => {
    expect(clockFace(30_000, 2_000)).toEqual({ timer: 8_000, bank: 30_000, out: false });
    expect(clockFace(30_000, 12_000)).toEqual({ timer: 0, bank: 28_000, out: false });
    expect(clockFace(0, 10_000).out).toBe(true);
  });
});

describe('Match Reports', () => {
  const report = (over: Partial<MatchReport> = {}): MatchReport => ({
    gameId: 'g1',
    playerId: 'a',
    players: ['a', 'b'],
    result: { winner: 0, reason: 'master' },
    replay: { initial: createMatch(TEST_MAP), actions: [], times: [1200], timeouts: [] },
    rules: 'r',
    ...over,
  });

  it('compares results, positions and turns, not who reported or how long turns took', () => {
    const a = report();
    const b = report({ playerId: 'b', replay: { ...a.replay, times: [1500] } });
    expect(comparisonKey(a)).toBe(comparisonKey(b));
    expect(comparisonKey(report({ result: { winner: 1, reason: 'master' } }))).not.toBe(comparisonKey(a));
    expect(comparisonKey(report({ replay: { ...a.replay, actions: [{ unitId: 1, to: { q: 0, r: 0 }, facing: 0, command: { type: 'wait' } }] } }))).not.toBe(comparisonKey(a));
  });

  it('is Confirmed when both agree, Contested when they differ, Unconfirmed when one never comes', () => {
    expect(resultStatus(['x', 'x'], 0, 1)).toBe('confirmed');
    expect(resultStatus(['x', 'y'], 0, 1)).toBe('contested');
    expect(resultStatus(['x'], 0, 1)).toBe('pending');
    expect(resultStatus(['x'], 0, SECOND_REPORT_WAIT_MS)).toBe('unconfirmed');
  });

  it('writes the same JSON for the same value whatever the key order', () => {
    expect(canonical({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(canonical({ a: [{ c: 3, d: 2 }], b: 1 }));
  });
});

describe('hidden picks and the rules fingerprint', () => {
  const pick = { master: 'regent', familiars: ['imp', 'clod'], signature: 'imp' };

  it('reveals a pick that matches its commitment, and rejects a changed one', async () => {
    const c = await commitPick(pick, 'salt1');
    expect(await verifyPick(pick, 'salt1', c)).toBe(true);
    expect(await verifyPick({ ...pick, master: 'lich' }, 'salt1', c)).toBe(false);
    expect(await verifyPick(pick, 'salt2', c)).toBe(false);
  });

  it('gives the same fingerprint for the same rules', async () => {
    expect(await rulesFingerprint()).toBe(await rulesFingerprint());
  });
});
