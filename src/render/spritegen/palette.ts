// Material colours for a kind and Side.

import { makeRamp, hsl, type Palette, type Ramp } from './shade';

export type SideId = 0 | 1;
export type ElementKey = 'fire' | 'air' | 'earth' | 'water' | null;

const ELEMENT: Record<string, string> = { fire: '#e8622c', air: '#9fd6ea', earth: '#b48a3a', water: '#3a78d8' };

const DEFAULTS: Record<string, string> = {
  skin: '#f7d6bd',
  hair: '#5a3a2a',
  iris: '#3f8fd8',
  bone: '#efe6cf',
  metal: '#b9c3d2',
  gold: '#e9bf45',
  wood: '#8a5a34',
  bark: '#6e4a30',
  stone: '#8e8780',
  rock: '#6f6862',
  leaf: '#5fae4a',
  cloth: '#efe7d8',
  dark: '#2c2836',
  white: '#f4f6fb',
  cloud: '#e6edf7',
  water: '#63c1f2',
  ice: '#bfeeff',
  crystal: '#9fe6ff',
  shell: '#c98a4a',
  pink: '#f2a6c4',
  red: '#d8443a',
  flame: '#ff7a14',
  phoenix: '#ff6a2a',
  lava: '#ff6a1a',
  spark: '#ffe46a',
  coral: '#ff7f6a',
  glow: '#b98cff',
};

const GLOSSY = new Set(['metal', 'gold', 'crystal', 'ice', 'water', 'shell', 'gem', 'sideGloss']);

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The Side Colour family for a kind: main, dark and light variants. */
export function sideColors(side: SideId, kindId: string) {
  const shift = (hashStr(kindId) % 17) - 8;
  const h = side === 0 ? 128 + shift : 356 + shift * 0.6;
  return {
    side: hsl(h, side === 0 ? 0.46 : 0.58, side === 0 ? 0.45 : 0.5),
    side2: hsl(h + (side === 0 ? 10 : -6), side === 0 ? 0.42 : 0.52, side === 0 ? 0.3 : 0.34),
    sideL: hsl(h - (side === 0 ? 8 : -12), side === 0 ? 0.5 : 0.62, side === 0 ? 0.66 : 0.7),
  };
}

export function paletteFor(kindId: string, side: SideId, element: ElementKey, overrides: Record<string, string> = {}): Palette {
  const sc = sideColors(side, kindId);
  const el = element ? ELEMENT[element] : '#c9b8f0';
  const base: Record<string, string> = {
    ...DEFAULTS,
    ...sc,
    sideGloss: sc.sideL,
    elem: el,
    elem2: el,
    ...overrides,
  };
  const cache = new Map<string, Ramp>();
  return (mat: string) => {
    let r = cache.get(mat);
    if (r) return r;
    const emissive = mat.endsWith('*');
    const key = emissive ? mat.slice(0, -1) : mat;
    const color = key.startsWith('#') ? key : base[key] ?? '#ff00ff';
    r = makeRamp(color, emissive, GLOSSY.has(key));
    cache.set(mat, r);
    return r;
  };
}
