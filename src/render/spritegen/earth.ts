// Earth summons.
import { type V3, add } from './model';
import { arm, both, breathe, eyes, flick, mouthAt } from './kit';
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
// Wild: its head is a huge blooming rose, with glowing eyes in the heart.
EARTH.thorn = {
  palette: { glow: '#ffe46a', bark: '#5e4a2e' },
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
    both((s) => m.ell([s * 0.1, 0.43 + lift, 0], [0.07, 0.03, 0.05], 'side', [0, 0, s * -0.5]));
    for (let i = 0; i < 5; i++) {
      const a = -1.2 + i * 0.6;
      m.ell([Math.sin(a) * 0.08, 0.2, Math.cos(a) * 0.07], [0.035, 0.06, 0.015], 'side', [0.3, a, 0]);
    }
    // thorny arms
    both((s) => {
      const a: V3[] = [[s * 0.1, 0.42 + lift, 0], [s * 0.18, 0.32 + lift, 0.03], [s * 0.2, 0.2 + lift, 0.08]];
      m.tube(a, [0.03, 0.025, 0.022], 'bark');
      for (let i = 0; i < 3; i++) m.spike([s * (0.14 + i * 0.03), 0.37 - i * 0.06 + lift, 0.02 + i * 0.03], [s * (0.2 + i * 0.03), 0.4 - i * 0.06 + lift, 0.03 + i * 0.03], 0.012, 'cloth');
    });
    // wild: rose head
    const hc: V3 = [0, 0.58 + lift, 0.03];
    const rose = m.group();
    m.ball(hc, 0.1, 'side2', rose);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      m.ell(add(hc, [Math.cos(a) * 0.1, Math.sin(a) * 0.09, -0.01]), [0.07, 0.065, 0.035], 'side', [0, 0, a]);
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.5;
      m.ell(add(hc, [Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0.06]), [0.045, 0.045, 0.025], 'sideL', [0, 0, a]);
    }
    m.ball(add(hc, [0, 0, 0.07]), 0.035, 'side2');
    m.eye(add(hc, [0.025, 0.005, 0.11]), [0.2, 0, 1], 'glow', 'glow');
    m.eye(add(hc, [-0.025, 0.005, 0.11]), [-0.2, 0, 1], 'glow', 'glow');
    both((s) => m.ell(add(hc, [s * 0.12, -0.1, -0.04]), [0.06, 0.02, 0.03], 'leaf', [0, 0, s * -0.6]));
  },
};

// Sling: a hooded goblin slinger whirling a sling stone.
// Wild: a cluster of amethyst geode crystals grows from its back.
EARTH.sling = {
  palette: { skin: '#b0a060', iris: '#ffd23c', gem: '#b07aff' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    both((s) => {
      m.tube([[s * 0.05, 0.17, 0], [s * 0.07, 0.08, 0.02], [s * 0.07, 0.02, 0.03]], [0.035, 0.03, 0.03], 'skin');
      m.ell([s * 0.07, 0.02, 0.06], [0.04, 0.025, 0.05], 'wood');
    });
    const body = m.group();
    m.ell([0, 0.27, 0], [0.11 * swell, 0.12, 0.09 * swell], 'side2', [0, 0, 0], body);
    m.ell([0, 0.22, 0.0], [0.115, 0.02, 0.095], 'wood'); // belt
    m.ball([0.06, 0.2, 0.08], 0.03, 'wood'); // pouch
    // hood and cape
    const hood = m.group();
    m.tube([[0, 0.4 + lift, -0.04], [0, 0.25, -0.1], [0.0, 0.1, -0.11]], [0.12, 0.13, 0.12], 'side', hood);
    const hc: V3 = [0, 0.48 + lift, 0.03];
    m.ell(add(hc, [0, 0.03, -0.03]), [0.15, 0.14, 0.13], 'side', [0, 0, 0], hood);
    m.ball(hc, 0.12, 'skin');
    both((s) => m.spike(add(hc, [s * 0.1, -0.0, 0.0]), add(hc, [s * 0.26, 0.04, -0.03]), 0.035, 'skin'));
    m.ball(add(hc, [0, -0.02, 0.12]), 0.03, 'skin'); // nose
    eyes(m, hc, 0.12, 'beast', 'iris', 0.4, 0.02);
    mouthAt(m, hc, 0.12, -0.45, 'fang', 0.15);
    // sling arm raised and whirling
    const hand: V3 = [0.13, 0.62 + lift, 0.02];
    arm(m, [0.1, 0.36 + lift, 0], [0.16, 0.48 + lift, 0.0], hand, 0.03, 'side2', 'skin', 0.03);
    const a = p.frame * 1.3;
    const stone: V3 = add(hand, [Math.cos(a) * 0.12, 0.08, Math.sin(a) * 0.1]);
    m.tube([hand, add(hand, [Math.cos(a) * 0.06, 0.06, Math.sin(a) * 0.05]), stone], [0.008, 0.008, 0.008], 'wood');
    m.ball(stone, 0.03, 'stone');
    arm(m, [-0.1, 0.36 + lift, 0], [-0.15, 0.28 + lift, 0.04], [-0.12, 0.22 + lift, 0.08], 0.03, 'side2', 'skin', 0.03);
    // wild: geode crystals
    for (const [x, y, len, t] of [[0.04, 0.42, 0.18, 0.3], [-0.06, 0.38, 0.14, -0.5], [0.1, 0.32, 0.12, 0.9], [-0.1, 0.28, 0.1, -1.0]] as [number, number, number, number][]) {
      const base: V3 = [x, y + lift, -0.12];
      m.spike(base, add(base, [Math.sin(t) * len * 0.6, len * Math.cos(t * 0.5), -len * 0.5]), 0.035, 'gem');
    }
  },
};

// Dryad: a tree spirit woman with bark skin and a Side-coloured leaf gown.
// Wild: a crown of branching antlers in blossom.
EARTH.dryad = {
  palette: { skin: '#d8b48a', iris: '#4ab05a', pink: '#ffb0d0' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    // root feet and gown
    for (let i = 0; i < 5; i++) {
      const a = -1.3 + i * 0.65;
      m.tube([[Math.sin(a) * 0.06, 0.06, Math.cos(a) * 0.05], [Math.sin(a) * 0.15, 0.01, Math.cos(a) * 0.12]], [0.025, 0.01], 'bark');
    }
    const gown = m.group();
    m.tube([[0, 0.07, 0], [0, 0.24, 0], [0, 0.4 + lift, 0]], [0.13, 0.1 * swell, 0.085 * swell], 'side', gown);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      m.ell([Math.sin(a) * 0.12, 0.1, Math.cos(a) * 0.11], [0.045, 0.07, 0.015], 'side2', [0, a, 0]);
    }
    both((s) => arm(m, [s * 0.09, 0.4 + lift, 0], [s * 0.15, 0.3 + lift, 0.04], [s * 0.12, 0.24 + lift, 0.1], 0.025, 'skin', 'skin', 0.025));
    const hc: V3 = [0, 0.55 + lift, 0.02];
    m.ball(hc, 0.12, 'skin');
    eyes(m, hc, 0.12, 'anime', 'iris', 0.4, -0.15);
    mouthAt(m, hc, 0.12, -0.5);
    // leaf hair
    const hair = m.group();
    m.ell(add(hc, [0, 0.04, -0.03]), [0.13, 0.11, 0.12], 'side', [0, 0, 0], hair);
    for (let i = 0; i < 8; i++) {
      const a = -1.4 + i * 0.4;
      m.ell(add(hc, [Math.sin(a) * 0.12, -0.05 - (i % 2) * 0.05, -0.06]), [0.035, 0.07, 0.02], 'side', [0, a, 0.2 * Math.sin(a)], hair);
    }
    m.ell(add(hc, [0, 0.07, 0.06]), [0.1, 0.04, 0.05], 'side', [0.5, 0, 0], hair);
    // wild: blossoming antlers
    both((s) => {
      const b0 = add(hc, [s * 0.06, 0.09, -0.02]);
      const b1 = add(hc, [s * 0.13, 0.2, -0.05]);
      const b2 = add(hc, [s * 0.22, 0.3, -0.06]);
      m.tube([b0, b1, b2], [0.018, 0.014, 0.008], 'bark');
      m.tube([b1, add(hc, [s * 0.08, 0.3, -0.06])], [0.012, 0.006], 'bark');
      m.tube([lerpMid(b1, b2), add(hc, [s * 0.27, 0.22, -0.04])], [0.01, 0.005], 'bark');
      for (const q of [b2, add(hc, [s * 0.08, 0.3, -0.06]), add(hc, [s * 0.27, 0.22, -0.04])]) m.ball(q, 0.025, 'pink');
    });
  },
};
function lerpMid(a: V3, b: V3): V3 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

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

// Wyrm: a long, low earth serpent on stubby legs, in Side-coloured scales.
// Wild: amethyst crystal spines along its back and a spiral drill horn.
EARTH.wyrm = {
  palette: { iris: '#ffcf3a', gem: '#b07aff', elem: '#d0a860' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    const sw = flick(p, 1, 0.02);
    const spine: V3[] = [
      [0.12 + sw, 0.06, -0.36],
      [0.2, 0.1, -0.2],
      [0.12, 0.17, -0.06],
      [-0.04, 0.2, 0.04],
      [-0.08, 0.26, 0.14],
      [0.0, 0.42 + lift, 0.2],
    ];
    const body = m.group();
    m.tube(spine, [0.03, 0.07, 0.1 * swell, 0.1 * swell, 0.09, 0.085], 'side', body);
    // belly plates
    for (let i = 1; i < 5; i++) m.ell(add(spine[i], [0, -0.03, 0.05]), [0.06, 0.03, 0.05], 'elem');
    // stubby legs
    for (const [i, s] of [[2, 1], [2, -1], [4, 1], [4, -1]] as [number, number][]) {
      const q = spine[i];
      m.tube([add(q, [s * 0.07, 0, 0]), [q[0] + s * 0.11, 0.03, q[2] + 0.02]], [0.035, 0.03], 'side2');
    }
    // head
    const hc: V3 = add(spine[5], [0, 0.04, 0.08]);
    m.ell(hc, [0.08, 0.07, 0.1], 'side');
    m.ell(add(hc, [0, -0.04, 0.05]), [0.06, 0.03, 0.07], 'elem');
    eyes(m, hc, 0.08, 'slit', 'iris', 0.6, 0.2);
    mouthAt(m, add(hc, [0, -0.03, 0.06]), 0.06, -0.4, 'fang', 0.3);
    // wild: drill horn
    const horn = m.group();
    const h0 = add(hc, [0, 0.06, 0.06]);
    m.spike(h0, add(h0, [0, 0.08, 0.1]), 0.035, 'gold', horn);
    for (let i = 0; i < 3; i++) m.ball(add(h0, [0, 0.02 + i * 0.022, 0.025 + i * 0.028]), 0.024 - i * 0.006, 'metal', horn);
    // crystal spines
    for (let i = 1; i < 5; i++) {
      const q = spine[i];
      m.spike(add(q, [0, 0.07, 0]), add(q, [0, 0.17 - i * 0.01, -0.03]), 0.035, 'gem');
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
