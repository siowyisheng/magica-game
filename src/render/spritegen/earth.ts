// Earth familiars.
import { type V3, add } from './model';
import { arm, both, breathe, eyes, figure, flick, mouthAt } from './kit';
import type { Design } from './designs';

export const EARTH: Record<string, Design> = {};

// Clod: a waddling lump of earth with stubby limbs.
// Wild: a big Side-coloured spotted mushroom grows from its head, with a sprout.
EARTH.clod = {
  palette: { elem: '#a0784a', iris: '#2c2836' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    both((s) => m.ell([s * 0.08, 0.05, 0.02], [0.06, 0.05, 0.07], 'rock'));
    const body = m.group();
    m.ell([0, 0.22, 0], [0.17 * swell, 0.17, 0.15 * swell], 'elem', [0, 0, 0], body);
    for (const [x, y, z] of [[0.1, 0.12, 0.11], [-0.12, 0.22, 0.09], [0.05, 0.3, 0.13]] as V3[]) m.ball([x, y, z], 0.025, 'rock');
    both((s) => arm(m, [s * 0.15, 0.24, 0], [s * 0.2, 0.18, 0.04], [s * 0.2, 0.13, 0.07], 0.035, 'elem', 'elem', 0.04));
    const fc: V3 = [0, 0.24, 0];
    eyes(m, fc, 0.17, 'dot', 'iris', 0.3, 0.1);
    mouthAt(m, fc, 0.17, -0.12);
    m.mouth(add(fc, [0.085, 0.0, 0.14]), [0.4, 0, 1], 'blush');
    m.mouth(add(fc, [-0.085, 0.0, 0.14]), [-0.4, 0, 1], 'blush');
    // wild: mushroom cap
    const top: V3 = [0, 0.38 + lift, -0.01];
    m.tube([[0, 0.34, 0], top], [0.05, 0.045], 'cloth');
    const cap = m.group();
    m.ell(add(top, [0, 0.06, 0]), [0.2, 0.09, 0.18], 'side', [0.05, 0, 0.08], cap);
    for (const [x, z] of [[0.08, 0.1], [-0.1, 0.06], [0.0, 0.14], [0.12, -0.02], [-0.05, -0.06]]) m.ell(add(top, [x, 0.12, z]), [0.025, 0.015, 0.025], 'white');
    m.tube([add(top, [0.02, 0.14, -0.04]), add(top, [0.04, 0.2, -0.05])], [0.01, 0.008], 'leaf');
    both((s) => m.ell(add(top, [0.04 + s * 0.03, 0.21, -0.05]), [0.03, 0.01, 0.015], 'leaf', [0, 0, s * 0.5]));
  },
};

// Thorn: a fighter of twisted bramble with thorny arms and leaves.
// Wild: its head is a huge rose-pink bloom, with glowing eyes in the heart.
EARTH.thorn = {
  palette: { glow: '#ffe46a', bark: '#4a7a34', leaf: '#94d060', rose: '#e8508a', rose2: '#a8285e', roseL: '#ff8ab8' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    both((s) => m.tube([[s * 0.05, 0.22, 0], [s * 0.08, 0.1, 0.03], [s * 0.07, 0.0, 0.05]], [0.035, 0.03, 0.03], 'bark'));
    const body = m.group();
    m.tube([[0, 0.2, 0], [0.02, 0.3, 0.01], [0, 0.42 + lift, 0]], [0.08, 0.09 * swell, 0.075], 'bark', body);
    // vine wraps
    for (let i = 0; i < 6; i++) {
      const a = i * 1.3;
      m.ball([Math.sin(a) * 0.085, 0.22 + i * 0.035, Math.cos(a) * 0.075], 0.022, 'leaf');
    }
    // Side-coloured leaf pauldrons and skirt
    both((s) => {
      m.ell([s * 0.11, 0.44 + lift, 0], [0.085, 0.035, 0.065], 'side', [0, 0, s * -0.45]);
      m.ell([s * 0.13, 0.41 + lift, 0.02], [0.06, 0.025, 0.045], 'side2', [0, 0, s * -0.7]);
    });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      m.ell([Math.sin(a) * 0.085, 0.19, Math.cos(a) * 0.075], [0.04, 0.075, 0.015], i % 2 ? 'side' : 'side2', [0.35, a, 0]);
    }
    m.ell([0, 0.33 + lift * 0.5, 0.07], [0.06, 0.07, 0.03], 'side'); // leaf breastplate
    // thorny arms
    both((s) => {
      const a: V3[] = [[s * 0.1, 0.42 + lift, 0], [s * 0.18, 0.32 + lift, 0.03], [s * 0.2, 0.2 + lift, 0.08]];
      m.tube(a, [0.03, 0.025, 0.022], 'bark');
      for (let i = 0; i < 3; i++) m.spike([s * (0.14 + i * 0.03), 0.37 - i * 0.06 + lift, 0.02 + i * 0.03], [s * (0.2 + i * 0.03), 0.4 - i * 0.06 + lift, 0.03 + i * 0.03], 0.012, 'cloth');
    });
    // wild: a huge rose-pink bloom for a head, with green sepals
    const hc: V3 = [0, 0.6 + lift, 0.03];
    const rose = m.group();
    both((s) => m.ell(add(hc, [s * 0.1, -0.09, -0.02]), [0.07, 0.025, 0.04], 'leaf', [0, 0, s * -0.5]));
    m.ball(hc, 0.11, 'rose2', rose);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      m.ell(add(hc, [Math.cos(a) * 0.105, Math.sin(a) * 0.095, -0.005]), [0.075, 0.07, 0.035], 'rose', [0.15, 0, a]);
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.5;
      m.ell(add(hc, [Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0.07]), [0.05, 0.045, 0.025], 'roseL', [0, 0, a]);
    }
    m.ball(add(hc, [0, 0, 0.085]), 0.04, 'rose2');
    m.eye(add(hc, [0.026, 0.008, 0.123]), [0.2, 0, 1], 'glow', 'glow');
    m.eye(add(hc, [-0.026, 0.008, 0.123]), [-0.2, 0, 1], 'glow', 'glow');
  },
};

// Sling: a crouching goblin slinger with huge ears and nose, a Side-coloured
// hood pushed back and a short cape, whirling a stone above its head.
// Wild: a geode of amethyst crystals erupts from its back.
EARTH.sling = {
  palette: { skin: '#a8b060', iris: '#ffd23c', gem: '#b07aff' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      legs: { mat: 'skin', boot: 'wood' },
      shoulders: 0.09,
      waistY: 0.2,
      headR: 0.13,
      arms: (s) => (s > 0 ? [[0.05, 0.08, 0.0], [0.04, 0.2, 0.02]] : [[-0.05, -0.07, 0.05], [-0.04, -0.12, 0.11]]),
    });
    const { hc, r, waistY, lift } = f;
    // belt, pouch of stones
    m.ell([0, waistY + 0.02, 0], [0.065, 0.018, 0.052], 'wood');
    m.ball([0.06, waistY - 0.01, 0.05], 0.028, 'wood');
    // hood pushed back, cape behind
    const hood = m.group();
    m.ell(add(hc, [0, -0.02, -0.08]), [r * 1.05, r * 0.85, r * 0.7], 'side', [0.3, 0, 0], hood);
    m.poly([[-0.09, waistY + 0.16 + lift, -0.05], [0.09, waistY + 0.16 + lift, -0.05], [0.12, 0.06, -0.1], [-0.12, 0.06, -0.1]], 'side');
    // big goblin face
    both((s) => {
      const g = m.group();
      m.spike(add(hc, [s * r * 0.85, 0.0, -0.01]), add(hc, [s * 0.27, 0.06, -0.04]), 0.04, 'skin', g);
      m.spike(add(hc, [s * r * 0.9, 0.005, 0.0]), add(hc, [s * 0.22, 0.05, -0.025]), 0.018, 'pink', g);
    });
    m.ell(add(hc, [0, -0.03, r * 0.95]), [0.025, 0.03, 0.035], 'skin'); // nose
    eyes(m, hc, r, 'beast', 'iris', 0.42, 0.04);
    mouthAt(m, hc, r, -0.55, 'fang', 0.15);
    mouthAt(m, hc, r, -0.55, 'mouth', -0.05);
    // sling whirling above the raised hand
    const hand: V3 = [0.13, waistY + 0.34 + lift, 0.02];
    const a = p.frame * 1.3;
    const stone: V3 = add(hand, [Math.cos(a) * 0.13, 0.07, Math.sin(a) * 0.1]);
    m.tube([hand, add(hand, [Math.cos(a) * 0.07, 0.05, Math.sin(a) * 0.05]), stone], [0.008, 0.008, 0.008], 'wood');
    m.ball(stone, 0.03, 'stone');
    // wild: geode crystal cluster on the back
    const back: V3 = [0, waistY + 0.12 + lift, -0.1];
    m.ell(back, [0.08, 0.07, 0.04], 'rock');
    for (const [dx, dy, len, t, mat] of [[0.02, 0.03, 0.2, 0.15, 'gem'], [-0.05, 0.02, 0.15, -0.6, 'gem'], [0.07, 0.0, 0.13, 0.9, 'crystal'], [-0.08, -0.03, 0.11, -1.1, 'crystal'], [0.0, -0.02, 0.12, 0.0, 'gem']] as [number, number, number, number, string][]) {
      const b0: V3 = add(back, [dx, dy, -0.02]);
      m.spike(b0, add(b0, [Math.sin(t) * len * 0.7, len * Math.cos(t), -len * 0.45]), 0.032, mat);
    }
  },
};

// Dryad: a tree spirit woman with bark-brown skin, leaf hair and a
// Side-coloured gown of layered leaves, standing on spreading roots.
// Wild: a crown of branching antlers in blossom.
EARTH.dryad = {
  palette: { skin: '#d8b48a', iris: '#4ab05a', pink: '#ffb0d0' },
  build(m, p) {
    // spreading roots
    for (let i = 0; i < 6; i++) {
      const a = -1.6 + i * 0.64;
      m.tube([[Math.sin(a) * 0.05, 0.05, Math.cos(a) * 0.04], [Math.sin(a) * 0.13, 0.015, Math.cos(a) * 0.11], [Math.sin(a) * 0.17, 0.01, Math.cos(a) * 0.14]], [0.022, 0.014, 0.006], 'bark');
    }
    const f = figure(m, p, {
      top: 'side',
      skirt: { mat: 'side', len: 0.24, flare: 0.85 },
      shoulders: 0.09,
      waistY: 0.28,
      headR: 0.12,
      arms: (s) => (s > 0 ? [[0.05, -0.07, 0.04], [0.06, -0.01, 0.1]] : [[-0.05, -0.08, 0.03], [-0.07, -0.15, 0.05]]),
    });
    const { hc, r, waistY, lift } = f;
    // layered leaf skirt edges
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      m.ell([Math.sin(a) * 0.1, 0.07, Math.cos(a) * 0.09], [0.04, 0.065, 0.014], i % 2 ? 'side2' : 'leaf', [0.25, a, 0]);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.5;
      m.ell([Math.sin(a) * 0.07, waistY - 0.04, Math.cos(a) * 0.06], [0.03, 0.05, 0.012], 'side2', [0.2, a, 0]);
    }
    // a blossom held in the raised hand
    m.ball([0.15, waistY + 0.13 + lift, 0.1], 0.03, 'pink');
    eyes(m, hc, r, 'anime', 'iris', 0.4, -0.18);
    mouthAt(m, hc, r, -0.55);
    // leaf hair falling past the shoulders
    const hair = m.group();
    m.ell(add(hc, [0, 0.03, -0.035]), [r * 1.06, r * 0.92, r], 'side', [0, 0, 0], hair);
    m.ell(add(hc, [0, 0.06, 0.065]), [r * 0.88, r * 0.3, r * 0.4], 'side', [0.5, 0, 0], hair);
    for (let i = 0; i < 7; i++) {
      const a = -1.5 + i * 0.5;
      m.ell(add(hc, [Math.sin(a) * r * 0.95, -0.07 - (i % 2) * 0.04, Math.cos(a) * -0.05 - 0.02]), [0.03, 0.065, 0.016], i % 2 ? 'side' : 'leaf', [0, a, 0.15 * Math.sin(a)], hair);
    }
    // wild: blossoming antlers
    both((s) => {
      const b0 = add(hc, [s * 0.05, 0.09, -0.02]);
      const b1 = add(hc, [s * 0.12, 0.19, -0.05]);
      const b2 = add(hc, [s * 0.21, 0.28, -0.06]);
      const t1 = add(hc, [s * 0.07, 0.29, -0.06]);
      const t2 = add(hc, [s * 0.26, 0.2, -0.04]);
      m.tube([b0, b1, b2], [0.018, 0.014, 0.008], 'bark');
      m.tube([b1, t1], [0.012, 0.006], 'bark');
      m.tube([[(b1[0] + b2[0]) / 2, (b1[1] + b2[1]) / 2, (b1[2] + b2[2]) / 2], t2], [0.01, 0.005], 'bark');
      for (const q of [b2, t1, t2]) m.ball(q, 0.026, 'pink');
      m.ell(add(b1, [s * 0.02, 0.01, 0.01]), [0.03, 0.012, 0.015], 'leaf', [0, 0, s * 0.6]);
    });
  },
};

// Turtle: a great tortoise with a Side-coloured domed shell.
// Wild: a tiny mountain with a shrine gate and a pine tree grows on its shell.
EARTH.turtle = {
  palette: { skin: '#9aa070', iris: '#2c2836' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    both((s) => {
      m.ell([s * 0.16, 0.06, 0.12], [0.06, 0.06, 0.07], 'skin');
      m.ell([s * 0.16, 0.06, -0.14], [0.06, 0.06, 0.07], 'skin');
    });
    const shell = m.group();
    m.ell([0, 0.2, -0.01], [0.26 * swell, 0.16, 0.25 * swell], 'side', [0, 0, 0], shell);
    m.ell([0, 0.1, -0.01], [0.27, 0.04, 0.26], 'side2', [0, 0, 0], shell);
    for (const [x, z] of [[0, 0.12], [0.13, 0.05], [-0.13, 0.05], [0.12, -0.12], [-0.12, -0.12]]) m.ell([x, 0.27, z], [0.06, 0.02, 0.06], 'side2', [0.35 * (z > 0 ? 1 : -1), 0, -x * 2]);
    // head out on a neck
    const hc: V3 = [0, 0.2 + lift, 0.3];
    m.tube([[0, 0.14, 0.18], hc], [0.06, 0.06], 'skin');
    m.ell(hc, [0.08, 0.07, 0.08], 'skin');
    eyes(m, hc, 0.075, 'dot', 'iris', 0.55, 0.1);
    mouthAt(m, hc, 0.08, -0.3);
    m.spike([0, 0.14, -0.24], [0.0, 0.12, -0.33], 0.025, 'skin');
    // wild: mountain shrine
    const top: V3 = [0.03, 0.33, -0.04];
    const mt = m.group();
    m.spike(top, add(top, [0, 0.24, 0]), 0.13, 'stone', mt);
    m.spike(add(top, [0, 0.13, 0]), add(top, [0, 0.245, 0]), 0.06, 'white', mt);
    m.spike(add(top, [-0.08, 0, 0.02]), add(top, [-0.07, 0.14, 0.02]), 0.07, 'rock');
    // shrine gate
    const g0 = add(top, [0.1, 0.0, 0.07]);
    m.tube([g0, add(g0, [0, 0.09, 0])], [0.008, 0.008], 'red');
    m.tube([add(g0, [0.06, 0, 0]), add(g0, [0.06, 0.09, 0])], [0.008, 0.008], 'red');
    m.tube([add(g0, [-0.015, 0.09, 0]), add(g0, [0.075, 0.095, 0])], [0.01, 0.01], 'red');
    // pine tree
    const t0 = add(top, [-0.14, -0.02, 0.06]);
    m.tube([t0, add(t0, [0, 0.05, 0])], [0.01, 0.01], 'wood');
    m.spike(add(t0, [0, 0.04, 0]), add(t0, [0, 0.16 + flick(p, 1, 0.004), 0]), 0.045, 'leaf');
  },
};

// Wyrm: a long earth serpent on stubby legs, its body coiled in an S so its
// length shows from every side, head reared up, in Side-coloured scales.
// Wild: amethyst crystal spines along its back and a spiral drill horn.
EARTH.wyrm = {
  palette: { iris: '#ffcf3a', gem: '#b07aff', elem: '#e0c080' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    const sw = flick(p, 1, 0.02);
    const spine: V3[] = [
      [-0.3 + sw, 0.04, -0.2],
      [-0.12, 0.07, -0.3],
      [0.14, 0.1, -0.27],
      [0.27, 0.13, -0.08],
      [0.12, 0.15, 0.06],
      [-0.08, 0.18, 0.08],
      [-0.1, 0.3 + lift * 0.5, 0.14],
      [-0.02, 0.43 + lift, 0.18],
    ];
    const radii = [0.025, 0.05, 0.075, 0.09 * swell, 0.095 * swell, 0.09, 0.08, 0.075];
    const body = m.group();
    m.tube(spine, radii, 'side', body);
    // pale belly scutes on the underside
    for (let i = 1; i < 7; i++) m.ell(add(spine[i], [0, -radii[i] * 0.55, 0]), [radii[i] * 0.8, radii[i] * 0.4, radii[i] * 0.8], 'elem');
    // stubby clawed legs
    for (const [i, s] of [[3, 1], [3, -1], [5, 1], [5, -1]] as [number, number][]) {
      const q = spine[i];
      const g = m.group();
      m.tube([add(q, [s * 0.06, -0.02, 0.03]), [q[0] + s * 0.1, 0.025, q[2] + 0.05]], [0.035, 0.028], 'side2', g);
      m.ell([q[0] + s * 0.1, 0.015, q[2] + 0.07], [0.03, 0.015, 0.035], 'bone');
    }
    // head: broad, with a jaw and a frill
    const hc: V3 = add(spine[7], [0.01, 0.05, 0.08]);
    m.ell(hc, [0.085, 0.07, 0.1], 'side');
    m.ell(add(hc, [0, -0.045, 0.05]), [0.065, 0.03, 0.07], 'elem');
    both((s) => m.poly([add(hc, [s * 0.06, 0.02, -0.05]), add(hc, [s * 0.17, 0.06, -0.12]), add(hc, [s * 0.13, -0.04, -0.1])], 'side2'));
    eyes(m, hc, 0.085, 'slit', 'iris', 0.55, 0.2);
    mouthAt(m, add(hc, [0, -0.03, 0.06]), 0.06, -0.4, 'fang', 0.3);
    // wild: drill horn
    const horn = m.group();
    const h0 = add(hc, [0, 0.06, 0.05]);
    m.spike(h0, add(h0, [0, 0.09, 0.1]), 0.034, 'gold', horn);
    for (let i = 0; i < 3; i++) m.ball(add(h0, [0, 0.02 + i * 0.024, 0.024 + i * 0.03]), 0.024 - i * 0.006, 'metal', horn);
    // crystal spines along the back
    for (let i = 2; i < 7; i++) {
      const q = spine[i];
      m.spike(add(q, [0, radii[i] * 0.7, 0]), add(q, [0, radii[i] + 0.09 - i * 0.004, -0.02]), 0.032, i % 2 ? 'gem' : 'crystal');
    }
  },
};

// Titan: an earth colossus of stone in Side-coloured armour plates.
// Wild: its shoulders are snow-capped mountain peaks with pines, and runes
// glow across its face and chest.
EARTH.titan = {
  palette: { glow: '#ffd070' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    both((s) => {
      m.tube([[s * 0.1, 0.24, 0], [s * 0.12, 0.08, 0.02]], [0.08, 0.075], 'rock');
      m.ell([s * 0.12, 0.04, 0.04], [0.09, 0.045, 0.11], 'stone');
      m.ell([s * 0.12, 0.18, 0.06], [0.06, 0.05, 0.03], 'side');
    });
    const body = m.group();
    m.ell([0, 0.44 + lift * 0.5, 0], [0.21 * swell, 0.2, 0.15 * swell], 'stone', [0, 0, 0], body);
    m.ell([0, 0.27, 0], [0.16, 0.07, 0.12], 'rock', [0, 0, 0], body);
    m.ell([0, 0.46 + lift * 0.5, 0.11], [0.14, 0.12, 0.06], 'side'); // chest plate
    for (const [x0, y0, x1, y1] of [[-0.05, 0.42, 0.0, 0.5], [0.0, 0.5, 0.05, 0.42], [0, 0.5, 0, 0.36]]) {
      m.tube([[x0, y0 + lift * 0.5, 0.17], [x1, y1 + lift * 0.5, 0.17]], [0.01, 0.01], 'glow*');
    }
    // mountain shoulders with snow and pines
    both((s) => {
      const sh: V3 = [s * 0.21, 0.56 + lift, 0];
      const g = m.group();
      m.spike(add(sh, [0, -0.04, 0]), add(sh, [s * 0.04, 0.2, 0]), 0.11, 'rock', g);
      m.spike(add(sh, [s * 0.02, 0.08, 0]), add(sh, [s * 0.04, 0.205, 0]), 0.05, 'white');
      m.spike(add(sh, [s * 0.09, 0.0, 0.04]), add(sh, [s * 0.1, 0.1, 0.04]), 0.03, 'leaf');
      m.spike(add(sh, [s * -0.06, 0.02, 0.06]), add(sh, [s * -0.06, 0.1, 0.06]), 0.025, 'leaf');
      arm(m, add(sh, [s * 0.04, -0.06, 0]), [s * 0.3, 0.32 + lift, 0.05], [s * 0.29, 0.18 + lift, 0.09], 0.07, 'rock', 'stone', 0.085);
    });
    const hc: V3 = [0, 0.66 + lift, 0.04];
    m.ell(hc, [0.09, 0.09, 0.09], 'stone');
    m.ell(add(hc, [0, 0.05, 0.01]), [0.095, 0.03, 0.09], 'side');
    m.eye(add(hc, [0.035, 0.0, 0.085]), [0.35, 0, 1], 'glow', 'glow');
    m.eye(add(hc, [-0.035, 0.0, 0.085]), [-0.35, 0, 1], 'glow', 'glow');
    m.tube([add(hc, [0, -0.02, 0.09]), add(hc, [0, -0.06, 0.08])], [0.008, 0.008], 'glow*');
    void flick;
  },
};

// Beetle: a broad scarab with a domed, glossy Side-coloured shell, a horn and
// six jointed legs. Wild: a carved sun disc of amber glows on its back.
EARTH.beetle = {
  palette: { iris: '#ffd23c', amber: '#ffb030' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    both((s) => {
      for (let i = 0; i < 3; i++) {
        const z = 0.1 - i * 0.1;
        const g = m.group();
        m.tube([[s * 0.12, 0.13, z], [s * 0.24, 0.17, z + 0.01], [s * 0.28, 0.02, z + 0.03]], [0.024, 0.02, 0.012], 'dark', g);
      }
    });
    const shell = m.group();
    m.ell([0, 0.21, -0.02], [0.22 * swell, 0.15, 0.24 * swell], 'side', [0, 0, 0], shell);
    m.ell([-0.06, 0.31, 0.02], [0.06, 0.03, 0.08], 'sideL', [0, 0, 0], shell); // shine
    m.tube([[0, 0.34, 0.14], [0, 0.37, -0.02], [0, 0.33, -0.22]], [0.008, 0.008, 0.008], 'side2'); // shell seam
    // head and horn
    const hc: V3 = [0, 0.18 + lift, 0.23];
    m.ell(hc, [0.13, 0.095, 0.1], 'side2');
    m.tube([add(hc, [0, 0.04, 0.06]), add(hc, [0, 0.15, 0.12]), add(hc, [0, 0.25, 0.07])], [0.035, 0.024, 0.008], 'side2');
    eyes(m, hc, 0.11, 'beast', 'iris', 0.6, 0.15);
    both((s) => m.tube([add(hc, [s * 0.04, -0.03, 0.06]), add(hc, [s * 0.07, -0.05, 0.11]), add(hc, [s * 0.04, -0.06, 0.14])], [0.012, 0.01, 0.006], 'dark')); // mandibles
    // wild: an amber sun disc with rays, glowing on the shell
    const c: V3 = [0, 0.365, -0.02];
    m.ell(c, [0.065, 0.015, 0.065], 'amber*');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      m.spike(add(c, [Math.cos(a) * 0.06, -0.004, Math.sin(a) * 0.06]), add(c, [Math.cos(a) * (0.1 + 0.01 * p.breath), -0.02, Math.sin(a) * (0.1 + 0.01 * p.breath)]), 0.012, 'amber*');
    }
  },
};

// Treant: an old walking tree, a face in its bark, branch arms, roots for feet
// and a Side-coloured canopy. Wild: glowing mushrooms grow up its trunk.
EARTH.treant = {
  palette: { iris: '#ffe46a', cap: '#7ff0c0' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    // roots spreading as feet
    for (let i = 0; i < 5; i++) {
      const a = -1.2 + i * 0.6;
      m.tube([[Math.sin(a) * 0.06, 0.1, Math.cos(a) * 0.05], [Math.sin(a) * 0.16, 0.03, Math.cos(a) * 0.13], [Math.sin(a) * 0.22, 0.01, Math.cos(a) * 0.17]], [0.045, 0.03, 0.014], 'bark');
    }
    // trunk, thicker at the base
    const trunk = m.group();
    m.tube([[0, 0.05, 0], [0, 0.25, 0], [0, 0.45 + lift, -0.01]], [0.13, 0.12 * swell, 0.12 * swell], 'bark', trunk);
    // carved face
    const fc: V3 = [0, 0.38 + lift, 0.1];
    m.ell(add(fc, [0, 0.03, 0]), [0.09, 0.018, 0.02], 'wood'); // heavy brow
    eyes(m, fc, 0.04, 'dot', 'iris', 1.2, -0.1);
    m.ell(add(fc, [0, -0.07, 0.005]), [0.04, 0.02, 0.02], 'dark'); // mouth knot
    // branch arms, forking at the hands
    both((s) => {
      const sh: V3 = [s * 0.1, 0.42 + lift, 0];
      const el: V3 = [s * 0.22, 0.34 + lift, 0.05];
      const hd: V3 = [s * 0.25, 0.2 + lift, 0.1];
      m.tube([sh, el, hd], [0.04, 0.032, 0.025], 'bark');
      for (const [dx, dy] of [[0.04, -0.06], [-0.02, -0.07], [0.0, -0.04]] as [number, number][]) m.tube([hd, add(hd, [s * dx, dy, 0.03])], [0.014, 0.006], 'bark');
    });
    // canopy of Side-coloured leaves
    const canopy = m.group();
    for (const [x, y, z, r] of [[0, 0.62, -0.02, 0.17], [0.15, 0.56, -0.04, 0.12], [-0.15, 0.57, -0.03, 0.12], [0.07, 0.7, 0.04, 0.1], [-0.08, 0.7, -0.08, 0.1], [0, 0.55, 0.1, 0.1]] as [number, number, number, number][])
      m.ball([x, y + lift, z], r, 'side', canopy);
    for (const [x, y, z] of [[0.1, 0.66, 0.08], [-0.12, 0.62, 0.06], [0.02, 0.76, 0.0]] as [number, number, number][]) m.ball([x, y + lift, z], 0.05, 'sideL', canopy);
    // wild: glowing mushrooms up the trunk
    for (const [x, y, z, s] of [[0.11, 0.14, 0.06, 1], [-0.12, 0.22, 0.05, 0.8], [0.12, 0.3, -0.02, 0.7]] as [number, number, number, number][]) {
      m.tube([[x, y, z], [x * 1.15, y + 0.03 * s, z]], [0.01 * s, 0.01 * s], 'white');
      m.ell([x * 1.2, y + 0.04 * s, z], [0.035 * s, 0.018 * s, 0.03 * s], 'cap*');
    }
  },
};

// Mammoth: a shaggy war mammoth with a raised trunk, sweeping tusks and a
// fringe of long hair. Wild: its tusks are glowing crystal.
EARTH.mammoth = {
  palette: { iris: '#2c2836', tusk: '#9fe6ff' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    // pillar legs
    both((s) => {
      for (const z of [0.12, -0.12]) {
        const g = m.group();
        m.tube([[s * 0.11, 0.26, z], [s * 0.115, 0.08, z]], [0.07, 0.065], 'side2', g);
        m.ell([s * 0.115, 0.03, z + 0.01], [0.07, 0.035, 0.07], 'bone');
      }
    });
    // huge shaggy body with a shoulder hump
    const body = m.group();
    m.ell([0, 0.36, -0.02], [0.2 * swell, 0.16, 0.24 * swell], 'side', [0, 0, 0], body);
    m.ell([0, 0.48 + lift * 0.5, 0.08], [0.16, 0.1, 0.13], 'side', [0.3, 0, 0], body);
    // hair fringe hanging from the belly and flanks
    for (let i = 0; i < 7; i++) {
      const z = 0.18 - i * 0.06;
      both((s) => m.tube([[s * 0.17, 0.3, z], [s * 0.19, 0.2 + (i % 2) * 0.02, z]], [0.03, 0.012], 'side2'));
    }
    m.tube([[0, 0.38, -0.25], [0.02, 0.3, -0.3], [0.03, 0.24, -0.29]], [0.02, 0.015, 0.02], 'side2'); // tail
    // head with big ears and a raised trunk
    const hc: V3 = [0, 0.45 + lift, 0.24];
    m.ball(hc, 0.11, 'side');
    both((s) => m.ell(add(hc, [s * 0.1, 0.0, -0.04]), [0.025, 0.08, 0.06], 'side2', [0, 0.2 * s, 0]));
    eyes(m, hc, 0.11, 'dot', 'iris', 0.6, 0.15);
    m.tube([add(hc, [0, -0.04, 0.08]), add(hc, [0, -0.15, 0.13]), add(hc, [0, -0.17, 0.2]), add(hc, [0, -0.1 + 0.02 * p.breath, 0.25])], [0.045, 0.035, 0.028, 0.022], 'side');
    // wild: crystal tusks sweeping out and up
    both((s) => m.tube([add(hc, [s * 0.05, -0.07, 0.06]), add(hc, [s * 0.09, -0.16, 0.14]), add(hc, [s * 0.12, -0.1, 0.24]), add(hc, [s * 0.09, 0.0, 0.27])], [0.025, 0.022, 0.016, 0.006], 'tusk*'));
  },
};
