// Small Web Audio synthesis primitives. Everything is generated at runtime:
// no audio files. Functions take any BaseAudioContext so tracks and effects
// can also be rendered offline.

export type Ctx = BaseAudioContext;

export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

const noiseBuffers = new WeakMap<Ctx, AudioBuffer>();

/** 2 s of white noise, shared per context. */
export function noiseBuffer(ctx: Ctx): AudioBuffer {
  let b = noiseBuffers.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    let seed = 1234567;
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (seed / 0x3fffffff) - 1;
    }
    noiseBuffers.set(ctx, b);
  }
  return b;
}

/** A decaying stereo noise impulse response for a small hall. */
export function reverbImpulse(ctx: Ctx, seconds = 2.2, decay = 3): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let seed = 99991 + ch * 7;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      d[i] = ((seed / 0x3fffffff) - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return b;
}

/** Attack / hold / exponential release envelope on a gain param. */
function envelope(g: GainNode, t: number, peak: number, attack: number, dur: number, release: number) {
  const p = g.gain;
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(peak, t + attack);
  p.setValueAtTime(peak, t + Math.max(attack, dur));
  p.exponentialRampToValueAtTime(0.0001, t + Math.max(attack, dur) + release);
}

export interface ToneOpts {
  freq: number;
  /** Glide to this frequency over the note. */
  freqEnd?: number;
  type?: OscillatorType;
  t: number;
  dur: number;
  gain: number;
  attack?: number;
  release?: number;
  detune?: number;
  /** Lowpass cutoff (Hz); none when absent. */
  cutoff?: number;
  cutoffEnd?: number;
  q?: number;
  /** -1..1 */
  pan?: number;
  /** Vibrato depth in cents and rate in Hz. */
  vibrato?: [number, number];
}

export function tone(ctx: Ctx, dest: AudioNode, o: ToneOpts): void {
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, o.t);
  if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), o.t + o.dur);
  if (o.detune) osc.detune.value = o.detune;
  const attack = o.attack ?? 0.005;
  const release = o.release ?? 0.08;
  const g = ctx.createGain();
  envelope(g, o.t, o.gain, attack, o.dur, release);
  let node: AudioNode = osc;
  if (o.cutoff) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = o.q ?? 0.7;
    f.frequency.setValueAtTime(o.cutoff, o.t);
    if (o.cutoffEnd) f.frequency.exponentialRampToValueAtTime(o.cutoffEnd, o.t + o.dur + release);
    node.connect(f);
    node = f;
  }
  if (o.vibrato) {
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = o.vibrato[1];
    lg.gain.value = o.vibrato[0];
    lfo.connect(lg).connect(osc.detune);
    lfo.start(o.t);
    lfo.stop(o.t + o.dur + release + 0.05);
  }
  node.connect(g);
  connectPanned(ctx, g, dest, o.pan);
  osc.start(o.t);
  osc.stop(o.t + o.dur + release + 0.05);
}

export interface NoiseOpts {
  t: number;
  dur: number;
  gain: number;
  attack?: number;
  release?: number;
  filter?: BiquadFilterType;
  freq?: number;
  freqEnd?: number;
  q?: number;
  pan?: number;
}

export function noise(ctx: Ctx, dest: AudioNode, o: NoiseOpts): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = o.filter ?? 'lowpass';
  f.Q.value = o.q ?? 0.8;
  f.frequency.setValueAtTime(o.freq ?? 2000, o.t);
  if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, o.t + o.dur);
  const g = ctx.createGain();
  const release = o.release ?? 0.05;
  envelope(g, o.t, o.gain, o.attack ?? 0.003, o.dur, release);
  src.connect(f).connect(g);
  connectPanned(ctx, g, dest, o.pan);
  // random offset so repeated hits don't sound identical
  src.start(o.t, (o.t * 7.13) % 1.5);
  src.stop(o.t + o.dur + release + 0.05);
}

function connectPanned(ctx: Ctx, node: AudioNode, dest: AudioNode, pan?: number) {
  if (pan && 'createStereoPanner' in ctx) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(p).connect(dest);
  } else node.connect(dest);
}

/** A short pitched drum (kick / tom). */
export function drum(ctx: Ctx, dest: AudioNode, t: number, freq: number, gain: number, dur = 0.18) {
  tone(ctx, dest, { freq: freq * 2.5, freqEnd: freq, type: 'sine', t, dur: dur * 0.3, gain, attack: 0.002, release: dur });
}
