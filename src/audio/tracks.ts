// The five music tracks, as data, and a pure composer that turns a track into
// a looping list of notes. Melodies are generated from each track's seed, so a
// track always sounds the same.

export type Mood = 'day' | 'night' | 'any';

export interface Track {
  id: string;
  name: string;
  /** Time of Day it suits best. */
  mood: Mood;
  /** 0 = calm, 1 = intense; matched against the battle's tension. */
  energy: number;
  bpm: number;
  /** MIDI note of the tonic. */
  root: number;
  /** Seven scale steps in semitones. */
  scale: number[];
  /** Chord scale degree (0-based) per bar, 8 bars per section letter. */
  sections: Record<string, number[]>;
  form: string;
  /** 16-step patterns: 'x' hit, '.' rest. */
  drums: { kick: string; snare: string; hat: string };
  bass: string;
  /** Melody density: notes per bar, roughly. */
  density: number;
  lead: { type: OscillatorType; octave: number; vibrato?: boolean };
  pad: OscillatorType;
  /** Arpeggio in 8ths (true) or none. */
  arp: boolean;
  seed: number;
}

export const TRACKS: Track[] = [
  {
    id: 'dawn',
    name: 'Dawn March',
    mood: 'day',
    energy: 0.45,
    bpm: 100,
    root: 62,
    scale: [0, 2, 3, 5, 7, 9, 10], // D dorian
    sections: { A: [0, 3, 0, 6, 0, 3, 4, 0], B: [3, 3, 0, 0, 6, 6, 4, 4] },
    form: 'AABA',
    drums: { kick: 'x.......x.......', snare: '....x.......x..x', hat: 'x.x.x.x.x.x.x.x.' },
    bass: 'x...x...x...x.x.',
    density: 4,
    lead: { type: 'square', octave: 0 },
    pad: 'triangle',
    arp: false,
    seed: 11,
  },
  {
    id: 'ember',
    name: 'Ember Skirmish',
    mood: 'any',
    energy: 0.9,
    bpm: 138,
    root: 57,
    scale: [0, 2, 3, 5, 7, 8, 11], // A harmonic minor
    sections: { A: [0, 0, 5, 4, 0, 5, 3, 4], B: [5, 3, 0, 4, 5, 6, 4, 4] },
    form: 'AABB',
    drums: { kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx' },
    bass: 'x.xx.xx.x.xx.xx.',
    density: 6,
    lead: { type: 'sawtooth', octave: 1 },
    pad: 'sawtooth',
    arp: true,
    seed: 23,
  },
  {
    id: 'tide',
    name: 'Moonlit Tide',
    mood: 'night',
    energy: 0.2,
    bpm: 70,
    root: 64,
    scale: [0, 2, 3, 5, 7, 8, 10], // E aeolian
    sections: { A: [0, 5, 2, 6, 0, 5, 3, 4], B: [3, 4, 0, 5, 3, 4, 6, 4] },
    form: 'ABAB',
    drums: { kick: 'x...............', snare: '................', hat: '........x.......' },
    bass: 'x.......x.......',
    density: 2.5,
    lead: { type: 'triangle', octave: 0, vibrato: true },
    pad: 'sine',
    arp: true,
    seed: 37,
  },
  {
    id: 'wind',
    name: 'Highland Wind',
    mood: 'day',
    energy: 0.65,
    bpm: 116,
    root: 67,
    scale: [0, 2, 4, 5, 7, 9, 10], // G mixolydian
    sections: { A: [0, 6, 3, 0, 0, 6, 4, 0], B: [3, 3, 0, 0, 6, 6, 4, 4] },
    form: 'AABA',
    drums: { kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx' },
    bass: 'x..x..x.x..x..x.',
    density: 5,
    lead: { type: 'square', octave: 1, vibrato: true },
    pad: 'triangle',
    arp: false,
    seed: 41,
  },
  {
    id: 'vigil',
    name: 'Stone Vigil',
    mood: 'night',
    energy: 0.7,
    bpm: 88,
    root: 60,
    scale: [0, 1, 3, 5, 7, 8, 10], // C phrygian
    sections: { A: [0, 1, 0, 6, 0, 1, 5, 4], B: [5, 4, 1, 0, 5, 6, 1, 0] },
    form: 'AABA',
    drums: { kick: 'x.....x...x.....', snare: '........x.......', hat: '..x...x...x...x.' },
    bass: 'x.....x...x.....',
    density: 3,
    lead: { type: 'triangle', octave: -1 },
    pad: 'sawtooth',
    arp: true,
    seed: 53,
  },
];

export type Voice = 'lead' | 'bass' | 'pad' | 'arp' | 'kick' | 'snare' | 'hat';

export interface Note {
  /** Start, in 16th-note steps from the loop start. */
  step: number;
  /** Length in steps. */
  len: number;
  /** MIDI note (unused for drums). */
  midi: number;
  voice: Voice;
  /** 0..1 */
  vel: number;
}

export interface Composition {
  notes: Note[];
  /** Loop length in steps. */
  steps: number;
  /** Seconds per step. */
  stepSec: number;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** MIDI note of scale degree `deg` (any integer; wraps by octaves). */
export function degreeMidi(track: Track, deg: number): number {
  const oct = Math.floor(deg / 7);
  const i = ((deg % 7) + 7) % 7;
  return track.root + 12 * oct + track.scale[i];
}

const chordTones = (chord: number) => [chord, chord + 2, chord + 4];

/** Snap a melody degree to the nearest tone of the chord. */
function snapToChord(deg: number, chord: number): number {
  let best = deg;
  let bestD = Infinity;
  for (const c of chordTones(chord)) {
    for (const o of [-7, 0, 7]) {
      const cand = c + o;
      const d = Math.abs(cand - deg);
      if (d < bestD) {
        bestD = d;
        best = cand;
      }
    }
  }
  return best;
}

interface Motif {
  /** [step within 2 bars, len, degree offset] */
  notes: [number, number, number][];
}

function makeMotif(r: () => number, density: number): Motif {
  const notes: [number, number, number][] = [];
  const lens = density >= 5 ? [1, 2, 2, 2, 3, 4] : density >= 3.5 ? [2, 2, 3, 4, 4, 6] : [4, 4, 6, 8, 8, 12];
  let step = 0;
  let deg = Math.floor(r() * 5);
  while (step < 32) {
    const len = Math.min(lens[Math.floor(r() * lens.length)], 32 - step);
    if (r() > 0.14 || step === 0) notes.push([step, len, deg]);
    step += len;
    // mostly stepwise motion, occasional leaps
    const move = r();
    deg += move < 0.35 ? 1 : move < 0.7 ? -1 : move < 0.85 ? 2 : move < 0.95 ? -2 : 4 * (r() < 0.5 ? 1 : -1);
    deg = Math.max(-2, Math.min(9, deg));
  }
  return { notes };
}

/** Turn a track into one loop of notes. Pure and deterministic. */
export function composeTrack(track: Track): Composition {
  const r = rng(track.seed);
  const notes: Note[] = [];
  const motifs: Record<string, Motif[]> = {};
  for (const letter of Object.keys(track.sections)) {
    motifs[letter] = [makeMotif(r, track.density), makeMotif(r, track.density)];
  }
  const leadBase = 7 * track.lead.octave + (Object.keys(track.sections).length > 1 ? 0 : 0);
  let bar = 0;
  for (const letter of track.form) {
    const prog = track.sections[letter];
    const [m1, m2] = motifs[letter];
    const lift = letter === 'B' ? 2 : 0; // B sections sit a little higher
    for (let b = 0; b < 8; b++) {
      const chord = prog[b];
      const s0 = (bar + b) * 16;
      // pad: the chord, whole bar
      for (const ct of chordTones(chord)) notes.push({ step: s0, len: 16, midi: degreeMidi(track, ct) - 12, voice: 'pad', vel: 0.5 });
      // bass
      for (let i = 0; i < 16; i++) {
        if (track.bass[i] !== 'x') continue;
        const fifth = i >= 8 && r() < 0.3;
        notes.push({ step: s0 + i, len: 2, midi: degreeMidi(track, chord + (fifth ? 4 : 0)) - 24, voice: 'bass', vel: i % 4 === 0 ? 0.9 : 0.7 });
      }
      // arp in 8ths over the chord
      if (track.arp) {
        const order = [0, 1, 2, 1, 0, 2, 1, 2];
        for (let i = 0; i < 8; i++) notes.push({ step: s0 + i * 2, len: 2, midi: degreeMidi(track, chordTones(chord)[order[i]]), voice: 'arp', vel: i % 2 ? 0.45 : 0.6 });
      }
      // drums; the last bar of each section gets a fill
      const fill = b === 7;
      for (let i = 0; i < 16; i++) {
        if (track.drums.kick[i] === 'x') notes.push({ step: s0 + i, len: 1, midi: 0, voice: 'kick', vel: 1 });
        const sn = track.drums.snare[i] === 'x' || (fill && i >= 12 && track.energy > 0.4);
        if (sn) notes.push({ step: s0 + i, len: 1, midi: 0, voice: 'snare', vel: fill && i >= 12 ? 0.6 + (i - 12) * 0.1 : 0.85 });
        if (track.drums.hat[i] === 'x') notes.push({ step: s0 + i, len: 1, midi: 0, voice: 'hat', vel: i % 4 === 0 ? 0.7 : 0.45 });
      }
    }
    // lead: motif 1 (bars 1-2), motif 1 again over the new chords (3-4),
    // motif 2 (5-6), cadence on the tonic (7-8)
    const place = (m: Motif, startBar: number) => {
      for (const [st, len, deg] of m.notes) {
        const step = st + startBar * 16;
        const chord = prog[Math.floor(step / 16)];
        const d = st % 8 === 0 ? snapToChord(deg + lift, chord) : deg + lift;
        notes.push({ step: bar * 16 + step, len, midi: degreeMidi(track, d + leadBase), voice: 'lead', vel: st % 8 === 0 ? 0.85 : 0.65 });
      }
    };
    place(m1, 0);
    place(m1, 2);
    place(m2, 4);
    const cadence = m2.notes.filter(([st]) => st < 16);
    for (const [st, len, deg] of cadence) {
      const chord = prog[6];
      const d = st % 8 === 0 ? snapToChord(deg + lift, chord) : deg + lift;
      notes.push({ step: bar * 16 + 96 + st, len, midi: degreeMidi(track, d + leadBase), voice: 'lead', vel: 0.65 });
    }
    notes.push({ step: bar * 16 + 112, len: 12, midi: degreeMidi(track, leadBase + (letter === 'B' ? 4 : 0)), voice: 'lead', vel: 0.8 });
    bar += 8;
  }
  notes.sort((a, b) => a.step - b.step);
  return { notes, steps: bar * 16, stepSec: 60 / track.bpm / 4 };
}

// ---------- smart shuffle ----------

export interface MusicContext {
  timeOfDay: 'day' | 'night' | 'neutral';
  /** 0..1 */
  tension: number;
}

/** How well a track suits the moment; higher is better. */
export function trackScore(track: Track, ctx: MusicContext): number {
  let s = 0;
  if (track.mood === 'any') s += 0.6;
  else if (ctx.timeOfDay === 'neutral') s += 0.4;
  else s += track.mood === ctx.timeOfDay ? 1.5 : -1.2;
  s -= 2 * Math.abs(track.energy - ctx.tension);
  return s;
}

/**
 * Pick the next track: never the one just played, the one before it only if
 * nothing else is left, and otherwise a weighted random choice favouring
 * tracks that fit the Time of Day and the battle's tension.
 * `history` is most recent last.
 */
export function pickNextTrack(tracks: Track[], history: string[], ctx: MusicContext, rand: () => number): Track {
  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  let pool = tracks.filter((t) => t.id !== last && t.id !== prev);
  if (!pool.length) pool = tracks.filter((t) => t.id !== last);
  if (!pool.length) pool = tracks;
  // tracks not heard for a while get a small boost
  const recency = (t: Track) => {
    const i = history.lastIndexOf(t.id);
    return i < 0 ? 0.6 : Math.min(0.6, (history.length - 1 - i) * 0.15);
  };
  const weights = pool.map((t) => Math.exp(2 * (trackScore(t, ctx) + recency(t))));
  const total = weights.reduce((a, b) => a + b, 0);
  let x = rand() * total;
  for (let i = 0; i < pool.length; i++) {
    x -= weights[i];
    if (x <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** True when the playing track clearly clashes with the moment (switch early). */
export function clashes(track: Track, ctx: MusicContext): boolean {
  return (track.mood !== 'any' && ctx.timeOfDay !== 'neutral' && track.mood !== ctx.timeOfDay) || Math.abs(track.energy - ctx.tension) > 0.55;
}
