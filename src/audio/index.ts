// Audio system: one AudioContext with music and effects buses, started on the
// first user gesture (browsers block audio before that). Listens to the game
// store and to DOM interactions; the rules and the store know nothing of it.

import { create } from 'zustand';
import { activeUnit, timeOfDay, type MatchState, type SideId } from '../rules';
import { useGame, onGameSignal, type Phase } from '../store';
import { MusicPlayer } from './music';
import { playSfx, type Sfx } from './sfx';
import { reverbImpulse } from './synth';
import { turnCues, battleTension } from './cues';
import type { Track } from './tracks';

interface AudioSettings {
  music: number;
  sfx: number;
  muted: boolean;
}

interface AudioStore extends AudioSettings {
  track: string | null;
  setMusic: (v: number) => void;
  setSfx: (v: number) => void;
  toggleMute: () => void;
  skipTrack: () => void;
}

const KEY = 'magica.audio';
function loadSettings(): AudioSettings {
  const d: AudioSettings = { music: 0.6, sfx: 0.8, muted: false };
  try {
    return { ...d, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return d;
  }
}

let engine: Engine | null = null;

export const useAudio = create<AudioStore>((set, get) => {
  const save = () => {
    const { music, sfx, muted } = get();
    try {
      localStorage.setItem(KEY, JSON.stringify({ music, sfx, muted }));
    } catch {
      /* storage unavailable */
    }
    engine?.applyVolumes();
  };
  return {
    ...loadSettings(),
    track: null,
    setMusic: (v) => (set({ music: v }), save()),
    setSfx: (v) => (set({ sfx: v }), save()),
    toggleMute: () => (set({ muted: !get().muted }), save()),
    skipTrack: () => engine?.music.skip(),
  };
});

class Engine {
  ctx: AudioContext;
  master: GainNode;
  musicBus: GainNode;
  sfxBus: GainNode;
  music: MusicPlayer;

  constructor() {
    this.ctx = new AudioContext();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    const reverb = ctx.createConvolver();
    reverb.buffer = reverbImpulse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    reverb.connect(wet).connect(this.master);
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    for (const bus of [this.musicBus, this.sfxBus]) {
      bus.connect(this.master);
      bus.connect(reverb);
    }
    this.music = new MusicPlayer(ctx, this.musicBus);
    this.music.onTrackChange = (t: Track | null) => useAudio.setState({ track: t?.name ?? null });
    this.applyVolumes();
  }

  applyVolumes() {
    const { music, sfx, muted } = useAudio.getState();
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(muted ? 0 : 1, now, 0.05);
    // perceptual curve
    this.musicBus.gain.setTargetAtTime(music * music * 0.8, now, 0.05);
    this.sfxBus.gain.setTargetAtTime(sfx * sfx, now, 0.05);
    if (music > 0 && !muted) this.music.start();
    else this.music.stop();
  }

  play(s: Sfx, delayMs = 0) {
    if (this.ctx.state !== 'running' || useAudio.getState().sfx === 0) return;
    playSfx(this.ctx, this.sfxBus, s, this.ctx.currentTime + 0.005 + delayMs / 1000);
  }
}

/** Sound effects for the store's phase changes (map clicks, right-clicks). */
function phaseDepth(p: Phase): number {
  switch (p.kind) {
    case 'idle':
      return -1;
    case 'move':
      return 0;
    case 'menu':
      return p.sub ? 2 : 1;
    case 'target':
    case 'summonDir':
      return 3;
  }
}

function humanViewer(m: MatchState): SideId | null {
  const humans = ([0, 1] as SideId[]).filter((s) => !m.sides[s].ai);
  return humans.length === 1 ? humans[0] : null;
}

function musicContext(m: MatchState) {
  return { timeOfDay: timeOfDay(m.clock), tension: battleTension(m) };
}

let lastDomClick = 0;

export function installAudio(): void {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return;
  const unlock = () => {
    if (!engine) {
      engine = new Engine();
      engine.music.setContext(musicContext(useGame.getState().match));
      engine.applyVolumes();
    }
    if (engine.ctx.state === 'suspended') void engine.ctx.resume();
  };
  const play = (s: Sfx, delay = 0) => engine?.play(s, delay);

  // Global clicks and hovers on interface controls.
  const CONTROL = 'button, [role="button"], select, input, label, .ghost-badge';
  let hovered: Element | null = null;
  let lastHover = 0;
  document.addEventListener(
    'pointerdown',
    (e) => {
      unlock();
      const el = (e.target as Element | null)?.closest?.(CONTROL);
      if (!el || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return;
      lastDomClick = performance.now();
      play({ name: 'uiClick' });
    },
    true,
  );
  document.addEventListener('keydown', unlock, true);
  document.addEventListener(
    'pointerover',
    (e) => {
      const el = (e.target as Element | null)?.closest?.(CONTROL) ?? null;
      if (el === hovered) return;
      hovered = el;
      const now = performance.now();
      if (!el || (el as HTMLButtonElement).disabled || now - lastHover < 35) return;
      lastHover = now;
      play({ name: 'uiHover' });
    },
    true,
  );
  document.addEventListener('visibilitychange', () => {
    if (!engine) return;
    if (document.hidden) void engine.ctx.suspend();
    else void engine.ctx.resume();
  });

  // Turns, illegal clicks, new matches.
  onGameSignal((sig) => {
    if (!engine) return;
    if (sig.type === 'deny') return play({ name: 'deny' });
    if (sig.type === 'newMatch') return play({ name: 'newMatch' });
    const { before, action, anim, events } = sig;
    const actor = before.units.find((u) => u.id === action.unitId);
    if (actor && !before.sides[actor.side].ai) play({ name: 'confirm' });
    const rate = anim?.rate ?? 1;
    for (const c of turnCues(before, action, anim, events, humanViewer(before))) {
      play(c.sfx, c.at / rate);
      if (c.sfx.name === 'victory' || c.sfx.name === 'defeat') setTimeout(() => engine?.music.duck(3.5), c.at / rate);
    }
  });

  // UI state changes made on the map.
  useGame.subscribe((s, prev) => {
    if (!engine) return;
    if (s.match !== prev.match) engine.music.setContext(musicContext(s.match));
    const quiet = performance.now() - lastDomClick < 120; // a DOM click already sounded
    if (s.inspected.length !== prev.inspected.length && s.phase === prev.phase && s.inspected.length) {
      play({ name: 'toggle', on: s.inspected.length > prev.inspected.length });
    }
    if (s.hoverUnitId !== prev.hoverUnitId && s.hoverUnitId !== null && s.phase.kind !== 'idle') play({ name: 'uiHover' });
    // the human's unit becomes active
    const u = activeUnit(s.match);
    if (s.match.activeUnitId !== prev.match.activeUnitId && u && !s.match.sides[u.side].ai && s.match.winner === null) {
      play({ name: 'yourTurn' }, 150);
    }
    if (s.phase === prev.phase) return;
    const a = s.phase;
    const b = prev.phase;
    if (a.kind === 'idle' || b.kind === 'idle' || quiet) return;
    if (a.kind === 'menu' && b.kind === 'menu' && !a.sub === !b.sub && (a.facing !== b.facing)) return play({ name: 'facing' });
    if (a.kind === 'move' && b.kind === 'move') return play({ name: 'toggle', on: a.selected });
    const da = phaseDepth(a);
    const db = phaseDepth(b);
    if (da > db) play({ name: 'select' });
    else if (da < db) play({ name: 'back' });
  });
}
