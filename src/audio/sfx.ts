// Sound effects, all synthesized. Each takes the audio time to play at.

import type { Element } from '../rules';
import { drum, noise, tone, midiToHz, type Ctx } from './synth';

export type StepKind = 'walk' | 'wade' | 'swim' | 'fly' | 'slow';

export type Sfx =
  | { name: 'uiClick' }
  | { name: 'uiHover' }
  | { name: 'select' }
  | { name: 'back' }
  | { name: 'deny' }
  | { name: 'toggle'; on: boolean }
  | { name: 'facing' }
  | { name: 'confirm' }
  | { name: 'step'; kind: StepKind; heavy: boolean }
  | { name: 'flap'; soft: boolean }
  | { name: 'land'; heavy: boolean }
  | { name: 'swing' }
  | { name: 'impact'; amount: number; magic: boolean }
  | { name: 'arrow' }
  | { name: 'cast'; element: Element | null; heal: boolean }
  | { name: 'heal'; stone: boolean }
  | { name: 'death' }
  | { name: 'summonCharge' }
  | { name: 'summonAppear'; element: Element | null }
  | { name: 'capture'; mine: boolean }
  | { name: 'water'; rise: boolean }
  | { name: 'hour' }
  | { name: 'yourTurn' }
  | { name: 'stranded' }
  | { name: 'dawn' }
  | { name: 'dusk' }
  | { name: 'victory' }
  | { name: 'defeat' }
  | { name: 'newMatch' };

const v = (x: number, spread = 0.06) => x * (1 + (Math.random() * 2 - 1) * spread);

/** Notes as MIDI numbers, played as a quick arpeggio. */
function arpeggio(ctx: Ctx, out: AudioNode, t: number, notes: number[], gap: number, o: { type?: OscillatorType; gain?: number; dur?: number } = {}) {
  notes.forEach((m, i) =>
    tone(ctx, out, { freq: midiToHz(m), type: o.type ?? 'triangle', t: t + i * gap, dur: o.dur ?? 0.12, gain: o.gain ?? 0.12, release: 0.25 }),
  );
}

const ELEMENT_ROOT: Record<Element, number> = { fire: 69, air: 76, earth: 57, water: 64 };

export function playSfx(ctx: Ctx, out: AudioNode, s: Sfx, t: number): void {
  switch (s.name) {
    case 'uiClick':
      tone(ctx, out, { freq: v(1400, 0.03), freqEnd: 900, type: 'square', t, dur: 0.012, gain: 0.05, release: 0.03, cutoff: 4000 });
      return;
    case 'uiHover':
      tone(ctx, out, { freq: v(2200, 0.02), type: 'sine', t, dur: 0.01, gain: 0.018, release: 0.02 });
      return;
    case 'select':
      tone(ctx, out, { freq: 660, type: 'triangle', t, dur: 0.04, gain: 0.1, release: 0.06 });
      tone(ctx, out, { freq: 990, type: 'triangle', t: t + 0.045, dur: 0.05, gain: 0.09, release: 0.08 });
      return;
    case 'back':
      tone(ctx, out, { freq: 700, freqEnd: 420, type: 'triangle', t, dur: 0.07, gain: 0.09, release: 0.06 });
      return;
    case 'deny':
      tone(ctx, out, { freq: 180, type: 'square', t, dur: 0.06, gain: 0.05, release: 0.04, cutoff: 900 });
      tone(ctx, out, { freq: 150, type: 'square', t: t + 0.08, dur: 0.07, gain: 0.05, release: 0.05, cutoff: 900 });
      return;
    case 'toggle':
      tone(ctx, out, { freq: s.on ? 520 : 780, freqEnd: s.on ? 780 : 520, type: 'sine', t, dur: 0.06, gain: 0.08, release: 0.05 });
      return;
    case 'facing':
      tone(ctx, out, { freq: v(880, 0.04), type: 'sine', t, dur: 0.015, gain: 0.05, release: 0.03 });
      return;
    case 'confirm':
      arpeggio(ctx, out, t, [72, 79], 0.05, { gain: 0.09, dur: 0.05 });
      return;
    case 'step':
      switch (s.kind) {
        case 'walk':
        case 'slow':
          drum(ctx, out, t, v(s.heavy ? 55 : 90, 0.1), s.heavy ? 0.22 : 0.12, 0.08);
          noise(ctx, out, { t, dur: 0.02, gain: 0.03, filter: 'lowpass', freq: 1200, release: 0.04 });
          return;
        case 'wade':
          noise(ctx, out, { t, dur: 0.06, gain: 0.12, filter: 'bandpass', freq: v(1100), freqEnd: 600, q: 1.5, release: 0.08 });
          return;
        case 'swim':
          noise(ctx, out, { t, dur: 0.1, gain: 0.13, filter: 'bandpass', freq: v(700), freqEnd: 1300, q: 2, release: 0.1 });
          tone(ctx, out, { freq: v(500, 0.15), freqEnd: 900, type: 'sine', t: t + 0.03, dur: 0.04, gain: 0.03, release: 0.03 });
          return;
        case 'fly':
          noise(ctx, out, { t, dur: 0.08, gain: 0.16, filter: 'bandpass', freq: v(500), freqEnd: 250, q: 0.8, attack: 0.03, release: 0.06 });
          return;
      }
      return;
    case 'flap':
      noise(ctx, out, { t, dur: 0.07, gain: s.soft ? 0.08 : 0.16, filter: 'bandpass', freq: v(450), freqEnd: 220, q: 0.8, attack: 0.025, release: 0.06 });
      return;
    case 'land':
      drum(ctx, out, t, v(s.heavy ? 60 : 95, 0.08), s.heavy ? 0.2 : 0.1, 0.1);
      noise(ctx, out, { t, dur: 0.05, gain: 0.06, filter: 'lowpass', freq: 900, release: 0.08 });
      return;
    case 'swing':
      noise(ctx, out, { t, dur: 0.12, gain: 0.2, filter: 'bandpass', freq: 600, freqEnd: 3000, q: 1.2, attack: 0.05, release: 0.04 });
      return;
    case 'impact': {
      const hard = Math.min(1, s.amount / 6);
      if (s.amount <= 0) {
        // a glancing clink: no damage
        tone(ctx, out, { freq: 1900, type: 'square', t, dur: 0.02, gain: 0.04, release: 0.12, cutoff: 5000 });
        return;
      }
      drum(ctx, out, t, s.magic ? 80 : 60, 0.2 + 0.25 * hard, 0.16 + 0.1 * hard);
      noise(ctx, out, { t, dur: 0.05 + 0.05 * hard, gain: 0.1 + 0.1 * hard, filter: 'lowpass', freq: 2500 + 2500 * hard, freqEnd: 500, release: 0.1 });
      return;
    }
    case 'arrow':
      noise(ctx, out, { t, dur: 0.2, gain: 0.12, filter: 'bandpass', freq: 4000, freqEnd: 1500, q: 3, attack: 0.02, release: 0.05 });
      tone(ctx, out, { freq: 300, freqEnd: 140, type: 'triangle', t, dur: 0.03, gain: 0.06, release: 0.05 });
      return;
    case 'cast': {
      if (s.heal) {
        arpeggio(ctx, out, t, [72, 76, 79, 84], 0.06, { type: 'sine', gain: 0.07, dur: 0.15 });
        return;
      }
      const root = s.element ? ELEMENT_ROOT[s.element] : 72;
      switch (s.element) {
        case 'fire':
          noise(ctx, out, { t, dur: 0.35, gain: 0.09, filter: 'lowpass', freq: 600, freqEnd: 3500, attack: 0.05, release: 0.2 });
          tone(ctx, out, { freq: midiToHz(root - 12), freqEnd: midiToHz(root + 12), type: 'sawtooth', t, dur: 0.3, gain: 0.04, cutoff: 1500, release: 0.1 });
          return;
        case 'air':
          noise(ctx, out, { t, dur: 0.4, gain: 0.24, filter: 'bandpass', freq: 400, freqEnd: 5000, q: 4, attack: 0.1, release: 0.15 });
          return;
        case 'earth':
          drum(ctx, out, t, 40, 0.25, 0.4);
          noise(ctx, out, { t, dur: 0.3, gain: 0.07, filter: 'lowpass', freq: 400, freqEnd: 150, release: 0.2 });
          return;
        case 'water':
          for (let i = 0; i < 4; i++) {
            tone(ctx, out, { freq: v(midiToHz(root + i * 3), 0.05), freqEnd: midiToHz(root + i * 3 + 7), type: 'sine', t: t + i * 0.06, dur: 0.05, gain: 0.06, release: 0.04 });
          }
          return;
        default:
          arpeggio(ctx, out, t, [root, root + 7, root + 12], 0.04, { type: 'square', gain: 0.05, dur: 0.06 });
          tone(ctx, out, { freq: midiToHz(root + 12), freqEnd: midiToHz(root + 24), type: 'sine', t, dur: 0.25, gain: 0.05 });
          return;
      }
    }
    case 'heal':
      arpeggio(ctx, out, t, s.stone ? [84, 91] : [79, 84, 88], 0.07, { type: 'sine', gain: s.stone ? 0.05 : 0.08, dur: 0.12 });
      return;
    case 'death':
      tone(ctx, out, { freq: 330, freqEnd: 60, type: 'sawtooth', t, dur: 0.6, gain: 0.12, cutoff: 1200, cutoffEnd: 200, release: 0.2 });
      noise(ctx, out, { t: t + 0.1, dur: 0.4, gain: 0.05, filter: 'lowpass', freq: 1500, freqEnd: 200, release: 0.2 });
      return;
    case 'summonCharge':
      tone(ctx, out, { freq: 200, freqEnd: 800, type: 'sine', t, dur: 0.45, gain: 0.06, attack: 0.2, vibrato: [30, 9] });
      noise(ctx, out, { t, dur: 0.45, gain: 0.03, filter: 'bandpass', freq: 800, freqEnd: 4000, q: 3, attack: 0.3 });
      return;
    case 'summonAppear': {
      const root = s.element ? ELEMENT_ROOT[s.element] : 72;
      arpeggio(ctx, out, t, [root, root + 4, root + 7, root + 12, root + 16], 0.05, { type: 'triangle', gain: 0.07, dur: 0.2 });
      tone(ctx, out, { freq: midiToHz(root - 12), type: 'sine', t, dur: 0.5, gain: 0.08, attack: 0.05, release: 0.6 });
      return;
    }
    case 'capture':
      // a bell chord, major for the player's side, minor for the opponent
      for (const [i, m] of (s.mine ? [72, 76, 79, 84] : [72, 75, 79, 84]).entries()) {
        tone(ctx, out, { freq: midiToHz(m), type: 'sine', t: t + i * 0.03, dur: 0.05, gain: 0.08, release: 1.2 });
        tone(ctx, out, { freq: midiToHz(m) * 2.76, type: 'sine', t: t + i * 0.03, dur: 0.02, gain: 0.02, release: 0.5 });
      }
      return;
    case 'water':
      noise(ctx, out, { t, dur: 1.0, gain: 0.08, filter: 'lowpass', freq: s.rise ? 300 : 1500, freqEnd: s.rise ? 1500 : 300, attack: 0.3, release: 0.4 });
      tone(ctx, out, { freq: s.rise ? 110 : 220, freqEnd: s.rise ? 220 : 110, type: 'sine', t, dur: 1.0, gain: 0.08, attack: 0.2, release: 0.3 });
      return;
    case 'hour':
      tone(ctx, out, { freq: midiToHz(88), type: 'sine', t, dur: 0.02, gain: 0.04, release: 0.4 });
      tone(ctx, out, { freq: midiToHz(95), type: 'sine', t: t + 0.08, dur: 0.02, gain: 0.03, release: 0.5 });
      return;
    case 'yourTurn':
      arpeggio(ctx, out, t, [67, 72, 76], 0.07, { type: 'triangle', gain: 0.06, dur: 0.07 });
      return;
    case 'stranded':
      tone(ctx, out, { freq: 300, freqEnd: 200, type: 'square', t, dur: 0.15, gain: 0.04, cutoff: 800, release: 0.1 });
      noise(ctx, out, { t, dur: 0.1, gain: 0.04, filter: 'bandpass', freq: 900, q: 2 });
      return;
    case 'dawn':
      arpeggio(ctx, out, t, [64, 67, 71, 76, 79], 0.12, { type: 'sine', gain: 0.06, dur: 0.3 });
      return;
    case 'dusk':
      arpeggio(ctx, out, t, [76, 71, 67, 64, 59], 0.14, { type: 'sine', gain: 0.06, dur: 0.3 });
      return;
    case 'victory':
      arpeggio(ctx, out, t, [60, 64, 67, 72], 0.12, { type: 'square', gain: 0.07, dur: 0.1 });
      arpeggio(ctx, out, t + 0.55, [72, 76, 79, 84], 0.0, { type: 'triangle', gain: 0.07, dur: 1.0 });
      drum(ctx, out, t + 0.55, 60, 0.3, 0.4);
      return;
    case 'defeat':
      arpeggio(ctx, out, t, [67, 63, 60, 55], 0.25, { type: 'triangle', gain: 0.08, dur: 0.3 });
      tone(ctx, out, { freq: midiToHz(43), type: 'sawtooth', t: t + 0.75, dur: 1.2, gain: 0.05, cutoff: 600, release: 0.8 });
      return;
    case 'newMatch':
      arpeggio(ctx, out, t, [60, 67, 72], 0.08, { type: 'square', gain: 0.05, dur: 0.06 });
      return;
  }
}
