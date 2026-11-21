// The nine new Summoners (Sigil, the rune mage, is in designs.ts). Each has a
// Side-coloured outfit, its own accent colour ('accent'), and one wild
// element that its name points to.

import { type V3, add } from './model';
import { arm, both, eyes, figure, flame, flick, membrane, mouthAt } from './kit';
import type { Design } from './designs';

export const SUMMONER_DESIGNS: Record<string, Design> = {};
const S = SUMMONER_DESIGNS;

// Warden — accent gold. An armoured knight-cleric with a Side-coloured
// tabard, a tower shield and a mace. Wild: a holy lantern floats beside him.
S.warden = {
  palette: { accent: '#ffd24a', iris: '#4a7ad8', hair: '#c88a4a', skin: '#f0cba8' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'metal',
      sleeve: 'metal',
      legs: { mat: 'metal', boot: 'metal' },
      shoulders: 0.11,
      waistY: 0.25,
      headR: 0.12,
      arms: (s) => (s > 0 ? [[0.05, -0.08, 0.04], [0.06, -0.14, 0.1]] : [[-0.05, -0.07, 0.07], [-0.03, -0.09, 0.15]]),
    });
    const { hc, r, waistY, lift } = f;
    // Side-coloured tabard with a gold sun
    m.ell([0, waistY + 0.08 + lift * 0.5, 0.045], [0.07, 0.11, 0.035], 'side');
    m.poly([[-0.06, waistY, 0.07], [0.06, waistY, 0.07], [0.055, waistY - 0.14, 0.06], [-0.055, waistY - 0.14, 0.06]], 'side');
    m.ell([0, waistY + 0.1 + lift * 0.5, 0.082], [0.022, 0.022, 0.008], 'gold');
    both((s) => m.ell([s * 0.11, waistY + 0.16 + lift, 0], [0.06, 0.035, 0.06], 'side2', [0, 0, s * -0.4])); // pauldrons
    // helmet with the visor up and a Side-coloured plume
    const helm = m.group();
    m.ell(add(hc, [0, 0.03, -0.02]), [r * 1.07, r * 0.85, r * 1.02], 'metal', [0, 0, 0], helm);
    m.ell(add(hc, [0, 0.07, 0.06]), [r * 0.95, r * 0.22, r * 0.5], 'metal', [-0.5, 0, 0], helm);
    m.tube([add(hc, [0, 0.12, -0.02]), add(hc, [0, 0.2, -0.08]), add(hc, [0, 0.17, -0.18])], [0.035, 0.03, 0.012], 'side');
    eyes(m, hc, r, 'anime', 'iris', 0.38, -0.2);
    mouthAt(m, hc, r, -0.55);
    // tower shield on the left arm
    const sc: V3 = [-0.17, waistY + 0.08 + lift, 0.13];
    const shield = m.group();
    m.ell(sc, [0.1, 0.17, 0.02], 'side', [0, 0.35, 0], shield);
    m.ell(sc, [0.108, 0.178, 0.015], 'gold', [0, 0.35, 0]);
    m.ell(add(sc, [0.006, 0, 0.012]), [0.018, 0.12, 0.01], 'gold', [0, 0.35, 0]);
    m.ell(add(sc, [0.006, 0.03, 0.012]), [0.07, 0.016, 0.01], 'gold', [0, 0.35, 0]);
    // mace in the right hand
    const hand: V3 = [0.17, waistY + 0.0 + lift, 0.11];
    m.tube([add(hand, [0, -0.04, 0]), add(hand, [0.02, 0.16, 0.02])], [0.012, 0.014], 'wood');
    m.ball(add(hand, [0.02, 0.19, 0.02]), 0.035, 'metal');
    for (const [dx, dy] of [[0.035, 0.19], [-0.015, 0.2], [0.02, 0.225]]) m.spike(add(hand, [0.02, 0.19, 0.02]), add(hand, [dx + (dx > 0.02 ? 0.02 : -0.02), dy + 0.01, 0.02]), 0.012, 'gold');
    // wild: floating holy lantern
    const lc: V3 = add(hc, [0.2, 0.02 + flick(p, 1, 0.015), 0.05]);
    m.tube([add(lc, [0, 0.07, 0]), add(lc, [0, 0.095, 0])], [0.012, 0.006], 'gold');
    m.ell(lc, [0.035, 0.05, 0.035], 'accent*');
    m.ell(add(lc, [0, 0.055, 0]), [0.04, 0.012, 0.04], 'gold');
    m.ell(add(lc, [0, -0.055, 0]), [0.04, 0.012, 0.04], 'gold');
  },
};

// Orrery — accent pale cyan. A stargazer in a Side-coloured robe dotted with
// stars, a crescent-pinned hood and a brass telescope. Wild: little planets
// orbit her head.
S.orrery = {
  palette: { accent: '#b8f4ff', iris: '#8ad8ff', hair: '#f0f0ff', skin: '#f4dccc', brass: '#d8a848' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'side',
      skirt: { mat: 'side', len: 0.27, flare: 1.0, hem: 'brass' },
      shoulders: 0.09,
      waistY: 0.28,
      headR: 0.12,
      arms: (s) => (s > 0 ? [[0.04, -0.03, 0.08], [0.02, 0.03, 0.15]] : [[-0.06, -0.08, 0.05], [-0.07, -0.12, 0.11]]),
    });
    const { hc, r, waistY, lift } = f;
    // stars on the robe
    for (const [x, y, z] of [[0.05, 0.1, 0.13], [-0.07, 0.16, 0.12], [0.1, 0.05, 0.1], [-0.02, 0.06, 0.15], [0.04, waistY + 0.1, 0.07]] as V3[]) m.ball([x, y, z], 0.01, 'accent*');
    eyes(m, hc, r, 'anime', 'iris', 0.4, -0.18);
    mouthAt(m, hc, r, -0.55);
    // long white hair inside a Side-coloured hood with a crescent pin
    const hair = m.group();
    m.ell(add(hc, [0, 0.03, -0.035]), [r * 1.04, r * 0.9, r * 0.95], 'hair', [0, 0, 0], hair);
    m.ell(add(hc, [0, 0.055, 0.065]), [r * 0.85, r * 0.3, r * 0.4], 'hair', [0.45, 0, 0], hair);
    m.tube([add(hc, [0, -0.02, -0.08]), add(hc, [0, -0.16, -0.1]), add(hc, [0, -0.26, -0.08])], [0.07, 0.055, 0.02], 'hair', hair);
    const hood = m.group();
    m.ell(add(hc, [0, 0.03, -0.05]), [r * 1.2, r * 1.1, r * 1.05], 'side2', [0.2, 0, 0], hood);
    m.ell(add(hc, [0, 0.12, 0.05]), [0.025, 0.03, 0.01], 'brass', [0, 0, 0.6]);
    // brass telescope held up to the sky
    const t0: V3 = [0.12, waistY + 0.17 + lift, 0.15];
    m.tube([t0, add(t0, [0.06, 0.12, 0.02]), add(t0, [0.1, 0.22, 0.03])], [0.018, 0.022, 0.026], 'brass');
    m.ball(add(t0, [0.1, 0.22, 0.03]), 0.022, 'accent*');
    // wild: orbiting planets
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + p.frame * 0.3;
      const c = add(hc, [Math.cos(a) * 0.22, 0.1 + Math.sin(a) * 0.05, Math.sin(a) * 0.16]);
      m.ball(c, 0.022 - i * 0.003, i === 0 ? 'accent*' : i === 1 ? 'brass' : '#c88aff*');
      if (i === 1) m.ell(c, [0.04, 0.006, 0.04], 'brass', [0.3, 0, 0.3]);
    }
  },
};

// Bramble — accent amber. A hunched druid crone in a Side-coloured leaf
// cloak, leaning on a crooked staff topped with amber. Wild: a crown of
// antlers dripping with moss, and mushrooms sprouting from her shoulders.
S.bramble = {
  palette: { accent: '#ffb030', iris: '#ffb030', hair: '#c8c4b8', skin: '#e0c4a4', moss: '#7aa040' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'side',
      skirt: { mat: 'side', len: 0.26, flare: 0.9 },
      shoulders: 0.1,
      waistY: 0.26,
      headR: 0.12,
      arms: (s) => (s > 0 ? [[0.05, -0.07, 0.06], [0.06, -0.08, 0.14]] : [[-0.06, -0.08, 0.04], [-0.06, -0.14, 0.08]]),
    });
    const { hc, r, waistY, lift } = f;
    // leaf fringe on the cloak
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      m.ell([Math.sin(a) * 0.13, 0.05, Math.cos(a) * 0.11], [0.035, 0.05, 0.012], i % 2 ? 'side2' : 'moss', [0.3, a, 0]);
    }
    eyes(m, hc, r, 'anime', 'iris', 0.4, -0.2);
    mouthAt(m, hc, r, -0.55);
    m.ball(add(hc, [0, -0.02, r * 0.95]), 0.022, 'skin'); // crooked nose
    // wild grey hair
    const hair = m.group();
    m.ell(add(hc, [0, 0.03, -0.04]), [r * 1.1, r * 0.95, r], 'hair', [0, 0, 0], hair);
    both((s) => m.tube([add(hc, [s * r * 0.85, -0.02, 0]), add(hc, [s * r * 1.1, -0.14, -0.01]), add(hc, [s * r * 1.0, -0.22, 0.0])], [0.035, 0.03, 0.012], 'hair', hair));
    // crooked staff with an amber stone
    const hand: V3 = [0.17, waistY + 0.1 + lift, 0.14];
    m.tube([[0.19, 0.02, 0.15], add(hand, [0.0, 0.12, 0]), add(hand, [-0.03, 0.24, 0.0]), add(hand, [0.02, 0.32, 0])], [0.016, 0.017, 0.016, 0.014], 'bark');
    m.ball(add(hand, [0.0, 0.35 + flick(p, 0, 0.004), 0]), 0.035, 'accent*');
    // wild: mossy antler crown
    both((s) => {
      const b0 = add(hc, [s * 0.05, 0.09, -0.02]);
      const b1 = add(hc, [s * 0.13, 0.18, -0.04]);
      const b2 = add(hc, [s * 0.2, 0.25, -0.03]);
      m.tube([b0, b1, b2], [0.018, 0.014, 0.007], 'bark');
      m.tube([b1, add(hc, [s * 0.09, 0.27, -0.05])], [0.011, 0.005], 'bark');
      m.tube([b1, add(b1, [s * 0.01, -0.07 - flick(p, s, 0.01), 0.01])], [0.008, 0.004], 'moss');
      m.tube([b2, add(b2, [0, -0.06, 0])], [0.007, 0.003], 'moss');
      // mushrooms on the shoulders
      const sh: V3 = [s * 0.1, waistY + 0.2 + lift, 0.0];
      m.tube([sh, add(sh, [0, 0.035, 0])], [0.008, 0.008], 'cloth');
      m.ell(add(sh, [0, 0.04, 0]), [0.03, 0.016, 0.03], 'accent');
    });
  },
};

// Cinder — accent orange; Fire. A haughty noble in a Side-coloured coat with
// a high collar and a long dark cape whose hem smoulders. Wild: a crown of
// embers burning on his head, and a flame cupped in his hand.
S.cinder = {
  palette: { accent: '#ff8a2a', iris: '#ff7a2a', hair: '#2a2028', skin: '#f2d2bc' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'side',
      legs: { mat: 'dark', boot: 'dark' },
      shoulders: 0.1,
      waistY: 0.24,
      headR: 0.12,
      arms: (s) => (s > 0 ? [[0.07, -0.05, 0.02], [0.03, -0.08, -0.02]] : [[-0.05, -0.06, 0.06], [-0.06, 0.0, 0.13]]),
    });
    const { hc, r, waistY, lift } = f;
    // coat tails, buttons, high collar
    m.poly([[-0.07, waistY + 0.02, 0.02], [0.07, waistY + 0.02, 0.02], [0.09, waistY - 0.15, -0.02], [-0.09, waistY - 0.15, -0.02]], 'side');
    for (let i = 0; i < 3; i++) m.ball([0.0, waistY + 0.04 + i * 0.045 + lift * 0.5, 0.065], 0.01, 'gold');
    m.ell([0, waistY + 0.19 + lift, -0.02], [0.08, 0.05, 0.06], 'side2', [-0.3, 0, 0]);
    // long cape with a smouldering hem
    const cape: V3[] = [[-0.11, waistY + 0.17 + lift, -0.05], [0.11, waistY + 0.17 + lift, -0.05], [0.17, 0.02, -0.14], [0, 0.0, -0.16], [-0.17, 0.02, -0.14]];
    m.poly(cape, 'dark');
    for (let i = 0; i < 5; i++) m.ball([-0.15 + i * 0.075, 0.02 + (i % 2) * 0.01, -0.145 - (i === 2 ? 0.01 : 0)], 0.014, 'lava*');
    eyes(m, hc, r, 'anime', 'iris', 0.4, -0.18);
    mouthAt(m, hc, r, -0.55);
    // slicked-back black hair
    const hair = m.group();
    m.ell(add(hc, [0, 0.035, -0.045]), [r * 1.05, r * 0.88, r * 0.95], 'hair', [0, 0, 0], hair);
    m.ell(add(hc, [0, 0.07, 0.04]), [r * 0.9, r * 0.25, r * 0.5], 'hair', [-0.3, 0, 0], hair);
    // wild: crown of embers
    for (let i = 0; i < 5; i++) {
      const a = -1 + i * 0.5;
      flame(m, add(hc, [Math.sin(a) * 0.09, 0.1, Math.cos(a) * 0.04 - 0.02]), 0.09 + (i % 2) * 0.03, 0.025, p, i);
    }
    m.ell(add(hc, [0, 0.095, -0.01]), [0.1, 0.018, 0.09], 'gold');
    // flame cupped in the raised hand
    flame(m, [-0.17, f.waistY + 0.16 + lift, 0.14], 0.09, 0.03, p, 9, 'accent*');
  },
};

// Zephyr — accent sky blue. A wind herald in a light Side-coloured tunic,
// a feathered cap and a long scarf, holding a golden horn. Wild: ribbons
// of wind circle him and his scarf streams sideways on the wind.
S.zephyr = {
  palette: { accent: '#9ae0ff', iris: '#4ab0e0', hair: '#e8c880', skin: '#f4d6bc' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'side',
      legs: { mat: 'sideL', boot: 'wood' },
      shoulders: 0.09,
      waistY: 0.24,
      headR: 0.12,
      arms: (s) => (s > 0 ? [[0.05, -0.02, 0.07], [0.0, 0.04, 0.14]] : [[-0.06, -0.08, 0.04], [-0.06, -0.14, 0.08]]),
    });
    const { hc, r, waistY, lift } = f;
    m.ell([0, waistY - 0.02, 0], [0.075, 0.06, 0.06], 'side'); // tunic skirt
    m.ell([0, waistY + 0.02, 0], [0.07, 0.016, 0.058], 'gold'); // belt
    eyes(m, hc, r, 'anime', 'iris', 0.4, -0.18);
    mouthAt(m, hc, r, -0.55);
    // swept golden hair and a feathered cap
    const hair = m.group();
    m.ell(add(hc, [0, 0.02, -0.04]), [r * 1.05, r * 0.88, r * 0.95], 'hair', [0, 0, 0], hair);
    m.tube([add(hc, [-0.04, 0.02, -0.1]), add(hc, [-0.14, 0.0, -0.12]), add(hc, [-0.2, 0.03, -0.1])], [0.04, 0.025, 0.008], 'hair', hair);
    const cap = m.group();
    m.ell(add(hc, [0, 0.08, -0.01]), [r * 0.95, r * 0.45, r * 0.9], 'side2', [-0.2, 0, 0.15], cap);
    m.tube([add(hc, [0.06, 0.12, -0.02]), add(hc, [0.0, 0.22, -0.1]), add(hc, [-0.1, 0.26, -0.16])], [0.018, 0.016, 0.006], 'white');
    // golden horn raised to the lips
    const hand: V3 = [0.12, waistY + 0.18 + lift, 0.14];
    m.tube([add(hand, [-0.04, 0.05, 0.02]), hand, add(hand, [0.06, -0.01, 0.03])], [0.008, 0.016, 0.03], 'gold');
    // long scarf streaming on the wind
    const w = flick(p, 0, 0.02);
    m.tube([[0, waistY + 0.18 + lift, 0.02], [-0.1, waistY + 0.16 + lift, -0.04], [-0.22, waistY + 0.18 + w, -0.06], [-0.34, waistY + 0.13 - w, -0.06]], [0.025, 0.022, 0.018, 0.008], 'sideL');
    // wild: wind ribbons
    for (let k = 0; k < 2; k++) {
      const pts: V3[] = [];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 1.4 + p.frame * 0.5 + k * Math.PI;
        pts.push([Math.cos(a) * 0.24, 0.12 + k * 0.25 + i * 0.012, Math.sin(a) * 0.18]);
      }
      m.tube(pts, pts.map((_, i) => 0.006 + 0.008 * Math.sin((i / 6) * Math.PI)), 'accent*');
    }
  },
};

// Sexton — accent ghost teal. A gaunt grave-keeper in a Side-coloured
// hooded coat, a spade on his back and a lantern burning with ghost-fire.
// Wild: a floating skull familiar with glowing eyes keeps him company.
S.sexton = {
  palette: { accent: '#6af0d8', iris: '#6af0d8', hair: '#5a5a66', skin: '#d8ccc0' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'side',
      skirt: { mat: 'side', len: 0.25, flare: 0.6 },
      shoulders: 0.095,
      waistY: 0.27,
      headR: 0.115,
      arms: (s) => (s > 0 ? [[0.05, -0.07, 0.06], [0.05, -0.12, 0.13]] : [[-0.05, -0.08, 0.04], [-0.05, -0.15, 0.07]]),
    });
    const { hc, r, waistY, lift } = f;
    // spade on the back
    m.tube([[-0.09, 0.15, -0.1], [0.07, waistY + 0.32 + lift, -0.09]], [0.012, 0.012], 'wood');
    m.ell([-0.1, 0.12, -0.1], [0.04, 0.055, 0.008], 'metal', [0, 0, 0.6]);
    eyes(m, hc, r, 'anime', 'iris', 0.4, -0.2);
    mouthAt(m, hc, r, -0.55);
    // deep hood
    const hood = m.group();
    m.ell(add(hc, [0, 0.03, -0.035]), [r * 1.25, r * 1.15, r * 1.1], 'side2', [0.15, 0, 0], hood);
    m.ell(add(hc, [0, 0.11, 0.06]), [r * 0.95, r * 0.35, r * 0.4], 'side2', [0.5, 0, 0], hood);
    // ghost-fire lantern
    const hand: V3 = [0.15, waistY + 0.05 + lift, 0.14];
    m.tube([hand, add(hand, [0, -0.05, 0])], [0.006, 0.006], 'metal');
    m.ell(add(hand, [0, -0.09, 0]), [0.03, 0.04, 0.03], 'accent*');
    m.ell(add(hand, [0, -0.045, 0]), [0.034, 0.01, 0.034], 'metal');
    m.ell(add(hand, [0, -0.135, 0]), [0.034, 0.01, 0.034], 'metal');
    // wild: floating skull familiar
    const sk: V3 = add(hc, [-0.22, -0.02 + flick(p, 2, 0.02), 0.06]);
    m.ball(sk, 0.045, 'bone');
    m.ell(add(sk, [0, -0.035, 0.012]), [0.03, 0.02, 0.028], 'bone');
    m.eye(add(sk, [0.017, 0.005, 0.042]), [0.3, 0, 1], 'glow', 'accent');
    m.eye(add(sk, [-0.017, 0.005, 0.042]), [-0.3, 0, 1], 'glow', 'accent');
    for (let i = 0; i < 3; i++) m.ball(add(sk, [0.03 + i * 0.03, -0.05 - i * 0.02, -0.02]), 0.012 - i * 0.003, 'accent*');
  },
};

// Nereid — accent aqua; Water. A sea priestess in a flowing Side-coloured
// gown with a shell bodice and coral tiara, holding a conch horn. Wild: a
// ring of floating water circles her.
S.nereid = {
  palette: { accent: '#5ff0e0', iris: '#30c0d0', hair: '#40b0c0', skin: '#f0dcd4', coral: '#ff7f8a', water: '#5ab8f0' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      skirt: { mat: 'side', len: 0.27, flare: 1.0, hem: 'pearl' },
      shoulders: 0.085,
      waistY: 0.28,
      headR: 0.115,
      arms: (s) => (s > 0 ? [[0.05, -0.05, 0.06], [0.03, 0.0, 0.14]] : [[-0.06, -0.08, 0.04], [-0.07, -0.13, 0.08]]),
    });
    const { hc, r, waistY, lift } = f;
    both((s) => m.ell([s * 0.035, waistY + 0.12 + lift * 0.5, 0.055], [0.035, 0.03, 0.02], 'pearl')); // shell bodice
    eyes(m, hc, r, 'anime', 'iris', 0.4, -0.18);
    mouthAt(m, hc, r, -0.55);
    // long wavy aqua hair
    const hair = m.group();
    m.ell(add(hc, [0, 0.03, -0.035]), [r * 1.06, r * 0.92, r], 'hair', [0, 0, 0], hair);
    m.ell(add(hc, [0, 0.055, 0.065]), [r * 0.9, r * 0.3, r * 0.42], 'hair', [0.45, 0, 0], hair);
    for (const x of [-0.06, 0, 0.06]) {
      const w = flick(p, x * 10, 0.012);
      m.tube([add(hc, [x, -0.02, -0.08]), add(hc, [x * 1.3 + w, -0.15, -0.1]), add(hc, [x - w, -0.3, -0.08])], [0.04, 0.032, 0.01], 'hair', hair);
    }
    // coral tiara
    for (let i = 0; i < 3; i++) m.spike(add(hc, [(i - 1) * 0.04, 0.1, 0.04]), add(hc, [(i - 1) * 0.055, 0.17 - Math.abs(i - 1) * 0.03, 0.03]), 0.015, 'coral');
    // conch horn
    const hand: V3 = [0.12, waistY + 0.14 + lift, 0.14];
    m.tube([add(hand, [-0.02, 0.0, 0]), add(hand, [0.04, 0.03, 0.01]), add(hand, [0.08, 0.02, 0.01])], [0.015, 0.03, 0.008], 'pearl');
    // wild: ring of floating water
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + p.frame * 0.35;
      m.ball([Math.cos(a) * 0.25, 0.18 + Math.sin(a * 2) * 0.03, Math.sin(a) * 0.19], i % 3 === 0 ? 0.026 : 0.018, i % 3 === 0 ? 'accent*' : 'water');
    }
  },
};

// Cairn — accent ochre. An old stone hermit with a huge white beard, a
// Side-coloured robe and a walking stick. Wild: boulders float above his
// shoulders like pauldrons, their runes glowing ochre.
S.cairn = {
  palette: { accent: '#e8a840', iris: '#8a6a3a', hair: '#f0ece4', skin: '#e4c4a4' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'side',
      skirt: { mat: 'side', len: 0.25, flare: 0.8, hem: 'rock' },
      shoulders: 0.1,
      waistY: 0.27,
      headR: 0.12,
      arms: (s) => (s > 0 ? [[0.05, -0.07, 0.06], [0.06, -0.1, 0.14]] : [[-0.05, -0.08, 0.05], [-0.05, -0.15, 0.08]]),
    });
    const { hc, r, waistY, lift } = f;
    m.ell([0, waistY + 0.03, 0], [0.07, 0.018, 0.058], 'wood'); // rope belt
    eyes(m, hc, r, 'anime', 'iris', 0.4, -0.12);
    // bald crown, white tufts and a huge beard
    both((s) => m.ell(add(hc, [s * r * 0.85, 0.0, -0.02]), [0.035, 0.045, 0.045], 'hair'));
    const beard = m.group();
    m.ell(add(hc, [0, -0.08, 0.06]), [0.09, 0.08, 0.06], 'hair', [0, 0, 0], beard);
    m.tube([add(hc, [0, -0.12, 0.08]), add(hc, [0.0, -0.22, 0.09]), add(hc, [0.01, -0.28, 0.08])], [0.06, 0.045, 0.015], 'hair', beard);
    m.ell(add(hc, [0, 0.04, 0.09]), [0.07, 0.015, 0.03], 'hair'); // bushy brows
    // walking stick
    const hand: V3 = [0.17, waistY + 0.03 + lift, 0.14];
    m.tube([[0.18, 0.02, 0.15], add(hand, [0, 0.16, 0]), add(hand, [0.02, 0.24, 0])], [0.015, 0.016, 0.02], 'wood');
    // wild: floating boulder pauldrons with glowing runes
    both((s) => {
      const c: V3 = [s * 0.16, waistY + 0.27 + lift + flick(p, s, 0.012), -0.01];
      m.ell(c, [0.075, 0.06, 0.07], 'rock', [0.3 * s, 0.4, 0.2]);
      m.ell(add(c, [s * 0.02, 0.01, 0.06]), [0.025, 0.012, 0.01], 'accent*', [0, 0, s * 0.5]);
      m.ball(add(c, [s * 0.05, -0.05, 0.03]), 0.016, 'rock');
    });
  },
};

// Tinker — accent copper. A goggled tinkerer in a Side-coloured apron with a
// tool belt and a big brass mechanical arm. Wild: clockwork wings of gears
// and rods tick on her back, and a gear orbits her head.
S.tinker = {
  palette: { accent: '#e8884a', iris: '#4ab060', hair: '#8a4a2a', skin: '#f2d2b8', brass: '#d8a848' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'cloth',
      sleeve: 'cloth',
      legs: { mat: 'dark', boot: 'wood' },
      shoulders: 0.095,
      waistY: 0.24,
      headR: 0.12,
      arms: (s) => (s > 0 ? null : [[-0.06, -0.07, 0.05], [-0.05, -0.13, 0.1]]),
    });
    const { hc, r, waistY, lift } = f;
    // Side-coloured apron and tool belt
    m.ell([0, waistY + 0.06 + lift * 0.5, 0.05], [0.075, 0.12, 0.03], 'side');
    m.poly([[-0.07, waistY, 0.07], [0.07, waistY, 0.07], [0.065, waistY - 0.16, 0.06], [-0.065, waistY - 0.16, 0.06]], 'side');
    m.ell([0, waistY + 0.02, 0], [0.075, 0.02, 0.062], 'wood');
    both((s) => m.ell([s * 0.06, waistY + 0.0, 0.06], [0.02, 0.025, 0.015], 'wood'));
    // brass mechanical right arm with a big gauntlet
    const sh: V3 = [0.11, waistY + 0.14 + lift, 0];
    m.ball(sh, 0.045, 'brass');
    m.tube([sh, [0.17, waistY + 0.06 + lift, 0.05], [0.16, waistY + 0.0 + lift, 0.12]], [0.03, 0.026, 0.026], 'brass');
    m.ell([0.16, waistY - 0.02 + lift, 0.14], [0.05, 0.045, 0.045], 'brass');
    m.ball([0.17, waistY + 0.06 + lift, 0.05], 0.03, 'accent');
    eyes(m, hc, r, 'anime', 'iris', 0.4, -0.18);
    mouthAt(m, hc, r, -0.55);
    // auburn hair in a bun, goggles on the forehead
    const hair = m.group();
    m.ell(add(hc, [0, 0.03, -0.035]), [r * 1.05, r * 0.92, r], 'hair', [0, 0, 0], hair);
    m.ball(add(hc, [0, 0.1, -0.1]), 0.05, 'hair', hair);
    m.ell(add(hc, [0, 0.07, 0.0]), [r * 1.08, 0.018, r * 1.02], 'dark', [-0.25, 0, 0]);
    both((s) => m.ball(add(hc, [s * 0.04, 0.08, 0.1]), 0.026, 'brass'));
    both((s) => m.ball(add(hc, [s * 0.04, 0.08, 0.122]), 0.016, 'crystal'));
    // wild: clockwork wings and an orbiting gear
    both((s) => {
      const root: V3 = [s * 0.04, waistY + 0.16 + lift, -0.07];
      const g = m.group();
      for (let i = 0; i < 3; i++) {
        const tip: V3 = add(root, [s * (0.12 + i * 0.05), 0.12 - i * 0.07, -0.04]);
        m.tube([root, tip], [0.008, 0.006], 'brass', g);
        m.ell(tip, [0.03, 0.03, 0.006], i === 1 ? 'accent' : 'brass', [0, s * 0.3, p.frame * 0.4 * s]);
      }
      membrane(m, root, [add(root, [s * 0.12, 0.12, -0.04]), add(root, [s * 0.17, 0.05, -0.04]), add(root, [s * 0.22, -0.02, -0.04])], 'sideL');
    });
    const a = p.frame * 0.5;
    const gc = add(hc, [Math.cos(a) * 0.2, 0.12, Math.sin(a) * 0.14]);
    m.ell(gc, [0.03, 0.03, 0.008], 'accent', [0, a, 0]);
    void arm;
  },
};
