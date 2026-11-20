// Music player: schedules a composed track with a lookahead timer, loops it,
// and hands over to the next track chosen by the smart shuffle.

import { noise, tone, drum, midiToHz } from './synth';
import { TRACKS, type Track, type Composition, type MusicContext, composeTrack, pickNextTrack, clashes } from './tracks';

const LOOKAHEAD = 0.25;
/** Play a track for at least this long before moving on at a loop end. */
const MIN_PLAY_SEC = 150;
/** Earliest switch when the mood clashes (dawn / dusk, a sudden fight). */
const MIN_PLAY_BEFORE_CLASH = 40;

const compositions = new Map<string, Composition>();
export function compositionFor(t: Track): Composition {
  let c = compositions.get(t.id);
  if (!c) compositions.set(t.id, (c = composeTrack(t)));
  return c;
}

/** Play one note of a track into `out`. */
export function playNote(ctx: BaseAudioContext, out: AudioNode, track: Track, n: Composition['notes'][number], t: number, stepSec: number) {
  const dur = n.len * stepSec;
  switch (n.voice) {
    case 'lead':
      tone(ctx, out, {
        freq: midiToHz(n.midi),
        type: track.lead.type,
        t,
        dur: dur * 0.85,
        gain: 0.09 * n.vel * (track.lead.type === 'sawtooth' ? 0.8 : track.lead.type === 'square' ? 0.7 : 1.4),
        attack: 0.01,
        release: 0.12,
        cutoff: track.lead.type === 'triangle' ? undefined : 2600,
        vibrato: track.lead.vibrato && dur > 0.3 ? [12, 5.5] : undefined,
        pan: 0.1,
      });
      break;
    case 'pad':
      tone(ctx, out, {
        freq: midiToHz(n.midi),
        type: track.pad,
        t,
        dur: dur * 0.95,
        gain: (track.pad === 'sawtooth' ? 0.022 : 0.04) * n.vel,
        attack: Math.min(0.4, dur * 0.3),
        release: 0.5,
        cutoff: track.pad === 'sine' ? undefined : 900,
        detune: (n.midi % 3) * 6 - 6,
        pan: ((n.midi % 5) - 2) * 0.2,
      });
      break;
    case 'bass':
      tone(ctx, out, { freq: midiToHz(n.midi), type: 'triangle', t, dur: dur * 0.8, gain: 0.16 * n.vel, attack: 0.005, release: 0.08 });
      break;
    case 'arp':
      tone(ctx, out, {
        freq: midiToHz(n.midi + 12),
        type: track.energy > 0.5 ? 'square' : 'sine',
        t,
        dur: dur * 0.5,
        gain: (track.energy > 0.5 ? 0.025 : 0.04) * n.vel,
        release: 0.15,
        cutoff: 3000,
        pan: (n.step % 4) / 2 - 0.75,
      });
      break;
    case 'kick':
      drum(ctx, out, t, 50, 0.32 * n.vel, 0.22);
      break;
    case 'snare':
      noise(ctx, out, { t, dur: 0.05, gain: 0.11 * n.vel, filter: 'bandpass', freq: 1800, q: 0.6, release: 0.12 });
      tone(ctx, out, { freq: 190, freqEnd: 150, type: 'triangle', t, dur: 0.04, gain: 0.07 * n.vel, release: 0.06 });
      break;
    case 'hat':
      noise(ctx, out, { t, dur: 0.015, gain: 0.04 * n.vel, filter: 'highpass', freq: 7000, release: 0.03, pan: 0.25 });
      break;
  }
}

interface Playing {
  track: Track;
  comp: Composition;
  gain: GainNode;
  /** Audio time at which the current loop started. */
  loopStart: number;
  /** Index of the next note to schedule in the current loop. */
  next: number;
  startedAt: number;
}

export class MusicPlayer {
  private playing: Playing | null = null;
  private fading: Playing[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private history: string[] = [];
  private context: MusicContext = { timeOfDay: 'neutral', tension: 0.3 };
  onTrackChange: (t: Track | null) => void = () => {};

  constructor(private ctx: AudioContext, private out: AudioNode, private rand: () => number = Math.random) {}

  get current(): Track | null {
    return this.playing?.track ?? null;
  }

  setContext(c: MusicContext) {
    this.context = c;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 50);
    if (!this.playing) this.begin(pickNextTrack(TRACKS, this.history, this.context, this.rand), this.ctx.currentTime + 0.1);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.playing) this.fadeOut(this.playing, 1);
    this.playing = null;
    this.onTrackChange(null);
  }

  /** Move to another track now (crossfade). */
  skip() {
    const now = this.ctx.currentTime;
    if (this.playing) this.fadeOut(this.playing, 2);
    this.begin(pickNextTrack(TRACKS, this.history, this.context, this.rand), now + 0.6);
  }

  /** Briefly duck the music (under a victory sting, say). */
  duck(seconds: number, level = 0.25) {
    const p = this.playing;
    if (!p) return;
    const g = p.gain.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(level, now + 0.3);
    g.setValueAtTime(level, now + seconds);
    g.linearRampToValueAtTime(1, now + seconds + 1.5);
  }

  private begin(track: Track, at: number) {
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(1, at + 1.5);
    gain.connect(this.out);
    this.playing = { track, comp: compositionFor(track), gain, loopStart: at, next: 0, startedAt: at };
    this.history.push(track.id);
    if (this.history.length > 12) this.history.shift();
    this.onTrackChange(track);
  }

  private fadeOut(p: Playing, seconds: number) {
    const now = this.ctx.currentTime;
    p.gain.gain.cancelScheduledValues(now);
    p.gain.gain.setValueAtTime(p.gain.gain.value, now);
    p.gain.gain.linearRampToValueAtTime(0.0001, now + seconds);
    this.fading.push(p);
    setTimeout(() => {
      p.gain.disconnect();
      this.fading = this.fading.filter((x) => x !== p);
    }, (seconds + 0.5) * 1000);
  }

  private tick() {
    const p = this.playing;
    if (!p) return;
    const now = this.ctx.currentTime;
    const horizon = now + LOOKAHEAD;
    const { comp } = p;
    // switch early when the mood clearly clashes, at a bar line
    if (now - p.startedAt > MIN_PLAY_BEFORE_CLASH && clashes(p.track, this.context)) {
      const step = Math.floor((now - p.loopStart) / comp.stepSec);
      if (step % 16 === 15) {
        this.fadeOut(p, 3);
        this.begin(pickNextTrack(TRACKS, this.history, this.context, this.rand), now + 1.5);
        return;
      }
    }
    for (;;) {
      if (p.next >= comp.notes.length) {
        const loopEnd = p.loopStart + comp.steps * comp.stepSec;
        if (loopEnd > horizon) return;
        if (loopEnd - p.startedAt >= MIN_PLAY_SEC) {
          // hand over to the next track one beat after this one ends
          this.fadeOut(p, 1.5);
          this.begin(pickNextTrack(TRACKS, this.history, this.context, this.rand), loopEnd + comp.stepSec * 4);
          return;
        }
        p.loopStart = loopEnd;
        p.next = 0;
      }
      const n = comp.notes[p.next];
      const t = p.loopStart + n.step * comp.stepSec;
      if (t > horizon) return;
      if (t >= now - 0.02) playNote(this.ctx, p.gain, p.track, n, Math.max(t, now), comp.stepSec);
      p.next++;
    }
  }
}
