import { describe, expect, it } from 'vitest';
import { TRACKS, composeTrack, degreeMidi, pickNextTrack, trackScore, clashes } from './tracks';
import { turnCues, battleTension } from './cues';
import { createMatch, activeUnit, applyTurn, type TurnAction } from '../rules';
import { planTurnAnim } from '../anim';
import { generateRandomMap as makeTestMap } from '../rules';

/** A fixed random map (the same every run): Scaffold Ford is gone. */
const TEST_MAP = makeTestMap(20261127);

describe('music tracks', () => {
  it('has five tracks with distinct ids', () => {
    expect(TRACKS).toHaveLength(5);
    expect(new Set(TRACKS.map((t) => t.id)).size).toBe(5);
  });

  it('composes deterministically, with every pitched note in the track scale', () => {
    for (const t of TRACKS) {
      const a = composeTrack(t);
      expect(composeTrack(t)).toEqual(a);
      expect(a.steps).toBe(t.form.length * 8 * 16);
      const inScale = new Set<number>();
      for (let d = -40; d < 40; d++) inScale.add(((degreeMidi(t, d) - t.root) % 12 + 12) % 12);
      for (const n of a.notes) {
        expect(n.step).toBeGreaterThanOrEqual(0);
        expect(n.step).toBeLessThan(a.steps);
        if (['lead', 'bass', 'pad', 'arp'].includes(n.voice)) {
          expect(inScale.has(((n.midi - t.root) % 12 + 12) % 12)).toBe(true);
          expect(n.midi).toBeGreaterThan(20);
          expect(n.midi).toBeLessThan(100);
        }
      }
      expect(a.notes.some((n) => n.voice === 'lead')).toBe(true);
    }
  });
});

describe('smart shuffle', () => {
  const seq = () => {
    let i = 0;
    return () => ((i++ * 0.618034) % 1);
  };
  const night = { timeOfDay: 'night' as const, tension: 0.3 };

  it('never repeats the last two tracks', () => {
    const rand = seq();
    const history: string[] = [];
    for (let i = 0; i < 60; i++) {
      const t = pickNextTrack(TRACKS, history, { timeOfDay: i % 20 < 10 ? 'day' : 'night', tension: (i % 7) / 7 }, rand);
      expect(t.id).not.toBe(history[history.length - 1]);
      expect(t.id).not.toBe(history[history.length - 2]);
      history.push(t.id);
    }
    // all five get played over a long session
    expect(new Set(history).size).toBe(5);
  });

  it('favours tracks that fit the Time of Day and tension', () => {
    const counts: Record<string, number> = {};
    let x = 0;
    const rand = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 2000; i++) {
      const t = pickNextTrack(TRACKS, [], night, rand);
      counts[t.id] = (counts[t.id] ?? 0) + 1;
    }
    expect(counts.tide).toBeGreaterThan(counts.dawn ?? 0);
    expect(counts.vigil).toBeGreaterThan(counts.wind ?? 0);
    expect(trackScore(TRACKS.find((t) => t.id === 'tide')!, night)).toBeGreaterThan(trackScore(TRACKS.find((t) => t.id === 'dawn')!, night));
  });

  it('flags a day track at night as clashing', () => {
    expect(clashes(TRACKS.find((t) => t.id === 'dawn')!, night)).toBe(true);
    expect(clashes(TRACKS.find((t) => t.id === 'tide')!, night)).toBe(false);
  });
});

describe('turn sound cues', () => {
  it('plays a step per hex moved and nothing before the move', () => {
    const m = createMatch(TEST_MAP, { ai: [false, true], seed: 1 });
    const u = activeUnit(m)!;
    const to = { q: u.pos.q, r: u.pos.r - 2 };
    const action: TurnAction = { unitId: u.id, to, facing: u.facing, command: { type: 'wait' } };
    const { events } = applyTurn(m, action);
    const anim = planTurnAnim(m, action, 0, false);
    const cues = turnCues(m, action, anim, events, 0);
    const steps = cues.filter((c) => c.sfx.name === 'step');
    expect(steps.length).toBeGreaterThanOrEqual(2);
    expect(cues.every((c) => c.at >= 0 && c.at <= anim.duration + 1000)).toBe(true);
  });

  it('rates a fresh match as calm', () => {
    const m = createMatch(TEST_MAP, { ai: [false, true], seed: 1 });
    expect(battleTension(m)).toBeLessThan(0.4);
  });
});
