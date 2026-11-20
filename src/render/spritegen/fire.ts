// Fire summons.
import { type V3, add } from './model';
import { arm, both, breathe, eyes, flame, flick, legs, membrane, mouthAt } from './kit';
import type { Design } from './designs';

export const FIRE: Record<string, Design> = {};

// Archer: an elf archer with a longbow and quiver.
// Wild: phoenix hair of living flame and a bow whose tips burn.
FIRE.archer = {
  palette: { iris: '#ff9a3c', skin: '#f7d8c0' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    legs(m, 0.2, 0.055, 0.035, 'side2', 'wood');
    const torso = m.group();
    m.ell([0, 0.3, 0], [0.095 * swell, 0.1, 0.075 * swell], 'side', [0, 0, 0], torso);
    m.ell([0, 0.2, 0], [0.11, 0.06, 0.09], 'side', [0, 0, 0], torso); // tunic skirt
    m.ell([0, 0.235, 0.0], [0.1, 0.018, 0.083], 'gold'); // belt
    // quiver on the back with burning fletching
    m.tube([[-0.06, 0.2, -0.1], [0.06, 0.42 + lift, -0.1]], [0.03, 0.03], 'wood');
    for (let i = 0; i < 3; i++) m.ball([0.05 + i * 0.015, 0.45 + lift + i * 0.01, -0.1], 0.018, 'flame*');
    const hc: V3 = [0, 0.55 + lift, 0.01];
    m.ball(hc, 0.13, 'skin');
    both((s) => m.spike(add(hc, [s * 0.11, 0.0, -0.02]), add(hc, [s * 0.24, 0.07, -0.06]), 0.03, 'skin'));
    eyes(m, hc, 0.13, 'anime', 'iris', 0.4, -0.12);
    mouthAt(m, hc, 0.13, -0.5);
    // wild: phoenix hair, swept back and up in flames
    const hair = m.group();
    m.ell(add(hc, [0, 0.05, -0.02]), [0.14, 0.1, 0.13], 'phoenix', [0, 0, 0], hair);
    m.ell(add(hc, [0, 0.06, 0.07]), [0.12, 0.05, 0.06], 'phoenix', [0.4, 0, 0], hair);
    for (let i = 0; i < 4; i++) {
      const a = -0.6 + i * 0.4;
      flame(m, add(hc, [Math.sin(a) * 0.09, 0.12, -0.08]), 0.13 + 0.04 * (i % 2), 0.04, p, i);
    }
    m.tube([add(hc, [0, 0.02, -0.1]), add(hc, [0, -0.12, -0.16]), add(hc, [0.02, -0.25, -0.17])], [0.05, 0.04, 0.012], 'phoenix', hair);
    flame(m, add(hc, [0.02, -0.25, -0.17]), 0.06, 0.02, p, 8);
    // bow arm (left) out front, right hand drawing
    arm(m, [-0.09, 0.37 + lift, 0], [-0.17, 0.36 + lift, 0.08], [-0.19, 0.37 + lift, 0.16], 0.03, 'side', 'skin', 0.03);
    arm(m, [0.09, 0.37 + lift, 0], [0.11, 0.33 + lift, 0.07], [0.04, 0.37 + lift, 0.1], 0.03, 'side', 'skin', 0.03);
    m.tube([[-0.19, 0.12, 0.18], [-0.23, 0.26, 0.2], [-0.2, 0.37 + lift, 0.17], [-0.23, 0.5, 0.2], [-0.19, 0.64, 0.18]], [0.012, 0.016, 0.02, 0.016, 0.012], 'wood');
    m.tube([[-0.19, 0.12, 0.18], [0.03, 0.37 + lift, 0.11], [-0.19, 0.64, 0.18]], [0.007, 0.007, 0.007], 'spark*');
    flame(m, [-0.19, 0.64, 0.18], 0.07, 0.025, p, 11);
    flame(m, [-0.19, 0.1, 0.18], 0.06, 0.022, p, 13);
  },
};

// Wisp: a floating ball of flame. Wild: it wears a porcelain fox mask and is
// circled by orbiting embers; a Side-coloured rope with tassels binds it.
FIRE.wisp = {
  palette: { spark: '#ffe46a' },
  build(m, p) {
    const { swell } = breathe(p);
    const y = 0.42 + 0.02 * Math.sin(p.frame * 0.9);
    const c: V3 = [0, y, 0];
    m.ball(c, 0.17 * swell, 'flame*');
    for (let i = 0; i < 5; i++) {
      const a = -1 + i * 0.5;
      flame(m, add(c, [Math.sin(a) * 0.1, 0.06, Math.cos(a) * 0.02 - 0.03]), 0.22 - Math.abs(a) * 0.08, 0.07, p, i);
    }
    // fox mask
    const mask = m.group();
    m.ell(add(c, [0, 0.0, 0.13]), [0.12, 0.13, 0.06], 'white', [0, 0, 0], mask);
    m.ell(add(c, [0, -0.06, 0.18]), [0.05, 0.05, 0.05], 'white', [0, 0, 0], mask); // muzzle
    both((s) => m.spike(add(c, [s * 0.08, 0.1, 0.12]), add(c, [s * 0.13, 0.22, 0.1]), 0.04, 'white', mask));
    both((s) => m.ell(add(c, [s * 0.065, 0.065, 0.175]), [0.03, 0.012, 0.01], 'side', [0, 0, s * -0.5]));
    m.ell(add(c, [0, 0.1, 0.175]), [0.012, 0.025, 0.01], 'side');
    m.eye(add(c, [0.045, 0.02, 0.19]), [0.3, 0, 1], 'glow', 'spark');
    m.eye(add(c, [-0.045, 0.02, 0.19]), [-0.3, 0, 1], 'glow', 'spark');
    // rope with tassels
    const rope = m.group();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      m.ball(add(c, [Math.sin(a) * 0.165, -0.08, Math.cos(a) * 0.15]), 0.022, 'side', rope);
    }
    both((s) => {
      const t = add(c, [s * 0.1, -0.1, 0.11]);
      m.tube([t, add(t, [s * 0.01, -0.08, 0.01]), add(t, [s * 0.015, -0.14 + flick(p, s, 0.01), 0.02])], [0.012, 0.012, 0.022], 'side2');
    });
    // orbiting embers
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + p.frame * 0.35;
      m.ball(add(c, [Math.cos(a) * 0.27, 0.02 + Math.sin(a) * 0.06, Math.sin(a) * 0.2]), 0.022, 'lava*');
    }
  },
};

// Newt: an upright salamander warrior. Wild: its back is a ridge of little
// volcanoes that glow and smoke.
FIRE.newt = {
  palette: { iris: '#ffcf3a', elem: '#ff9a4a' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    const body = m.group();
    m.ell([0, 0.27, -0.02], [0.12 * swell, 0.15, 0.11 * swell], 'side', [0.15, 0, 0], body);
    m.ell([0, 0.26, 0.06], [0.08, 0.12, 0.06], 'elem', [0.15, 0, 0]); // belly
    // legs: bent, wide stance
    both((s) => {
      const g = m.group();
      m.tube([[s * 0.07, 0.17, 0], [s * 0.13, 0.1, 0.04], [s * 0.11, 0.03, 0.06]], [0.045, 0.04, 0.035], 'side', g);
      m.ell([s * 0.12, 0.02, 0.1], [0.045, 0.02, 0.06], 'side2');
    });
    // tail curling round
    const sw = flick(p, 2, 0.015);
    m.tube([[0, 0.16, -0.1], [0.05, 0.07, -0.22], [0.17 + sw, 0.05, -0.2], [0.24 + sw, 0.09, -0.08]], [0.06, 0.045, 0.03, 0.012], 'side', body);
    // head: wide and flat, eyes on top
    const hc: V3 = [0, 0.49 + lift, 0.06];
    m.ell(hc, [0.13, 0.09, 0.12], 'side');
    m.ell(add(hc, [0, -0.04, 0.06]), [0.1, 0.035, 0.07], 'elem'); // jaw
    both((s) => {
      const ec = add(hc, [s * 0.075, 0.06, 0.04]);
      m.ball(ec, 0.045, 'side');
      m.eye(add(ec, [s * 0.01, 0.005, 0.04]), [s * 0.3, 0.2, 1], 'slit', 'iris');
    });
    mouthAt(m, add(hc, [0, -0.02, 0.05]), 0.09, -0.3, 'mouth', 0.2);
    // short arms
    both((s) => arm(m, [s * 0.11, 0.33 + lift, 0.02], [s * 0.16, 0.27 + lift, 0.07], [s * 0.13, 0.24 + lift, 0.12], 0.03, 'side', 'side2', 0.03));
    // wild: volcano ridge
    for (let i = 0; i < 3; i++) {
      const b: V3 = [0, 0.4 - i * 0.1 + lift, -0.1 - i * 0.03];
      const g = m.group();
      m.tube([b, add(b, [0, 0.05, -0.04])], [0.055, 0.03], 'rock', g);
      m.ball(add(b, [0, 0.07, -0.05]), 0.026, 'lava*');
      if ((i + p.frame) % 2 === 0) m.ball(add(b, [0.01, 0.13 + 0.01 * i, -0.06]), 0.02, 'cloud');
    }
  },
};

// Golem: a hulking stone brute with Side-coloured carved pauldrons.
// Wild: a molten heart blazing through its chest, and rocks orbiting its head.
FIRE.golem = {
  palette: { glow: '#ffb040' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    // legs
    both((s) => {
      const g = m.group();
      m.tube([[s * 0.1, 0.22, 0], [s * 0.12, 0.08, 0.02]], [0.075, 0.07], 'rock', g);
      m.ell([s * 0.12, 0.04, 0.04], [0.08, 0.045, 0.1], 'stone');
    });
    const body = m.group();
    m.ell([0, 0.4 + lift * 0.5, 0], [0.22 * swell, 0.18, 0.15 * swell], 'stone', [0, 0, 0], body);
    m.ell([0, 0.26, 0], [0.15, 0.08, 0.11], 'rock', [0, 0, 0], body);
    // molten heart and cracks
    const hp = 0.03 * p.breath;
    m.ball([0, 0.42 + lift * 0.5, 0.12 * swell], 0.07 + hp * 0.3, 'lava*');
    for (const [x, y] of [[0.08, 0.5], [-0.09, 0.47], [0.05, 0.33], [-0.06, 0.34]]) m.spike([0, 0.42, 0.12], [x, y + lift * 0.5, 0.13], 0.018, 'lava*');
    // pauldrons
    both((s) => m.ell([s * 0.2, 0.52 + lift, 0], [0.1, 0.07, 0.1], 'side', [0, 0, s * -0.3]));
    both((s) => m.ell([s * 0.2, 0.57 + lift, 0], [0.05, 0.02, 0.05], 'gold', [0, 0, s * -0.3]));
    // arms and huge fists
    both((s) => {
      const g = m.group();
      m.tube([[s * 0.24, 0.48 + lift, 0], [s * 0.3, 0.32 + lift, 0.04], [s * 0.29, 0.2 + lift, 0.08]], [0.065, 0.06, 0.055], 'rock', g);
      m.ell([s * 0.29, 0.14 + lift, 0.1], [0.09, 0.08, 0.08], 'stone');
    });
    // small head sunk between the shoulders
    const hc: V3 = [0, 0.6 + lift, 0.05];
    m.ell(hc, [0.085, 0.075, 0.08], 'stone');
    m.eye(add(hc, [0.035, 0.0, 0.075]), [0.3, 0, 1], 'glow', 'glow');
    m.eye(add(hc, [-0.035, 0.0, 0.075]), [-0.3, 0, 1], 'glow', 'glow');
    // wild: orbiting rocks
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + p.frame * 0.3;
      m.ell(add(hc, [Math.cos(a) * 0.2, 0.14 + Math.sin(a * 2) * 0.02, Math.sin(a) * 0.12]), [0.035, 0.03, 0.03], 'rock', [a, a, 0]);
    }
  },
};

// Drake: a winged fire dragon. Wild: obsidian crystal horns and wings whose
// membranes are sheets of flame.
FIRE.drake = {
  palette: { iris: '#ffd23c', obsidian: '#3b2f52', elem: '#f0b060' },
  build(m, p) {
    const { swell, lift, b } = breathe(p);
    const hover = 0.08;
    const body = m.group();
    m.ell([0, 0.3 + hover, -0.04], [0.13 * swell, 0.13 * swell, 0.2], 'side', [-0.2, 0, 0], body);
    m.ell([0, 0.27 + hover, 0.06], [0.09, 0.1, 0.1], 'elem', [-0.2, 0, 0]); // belly
    // legs tucked
    both((s) => {
      const g = m.group();
      m.tube([[s * 0.08, 0.25 + hover, -0.06], [s * 0.1, 0.12 + hover, 0.0], [s * 0.09, 0.06 + hover, 0.05]], [0.05, 0.035, 0.03], 'side', g);
      m.ell([s * 0.09, 0.05 + hover, 0.07], [0.03, 0.02, 0.04], 'obsidian');
    });
    // neck and head
    const hc: V3 = [0, 0.64 + lift + hover, 0.14];
    m.tube([[0, 0.38 + hover, 0.08], [0, 0.5 + hover + lift, 0.16], [0, 0.6 + lift + hover, 0.13]], [0.075, 0.06, 0.06], 'side', body);
    m.ell(hc, [0.085, 0.075, 0.1], 'side');
    m.ell(add(hc, [0, -0.025, 0.1]), [0.06, 0.04, 0.07], 'side'); // snout
    m.ell(add(hc, [0, -0.05, 0.09]), [0.05, 0.02, 0.06], 'elem'); // jaw
    eyes(m, hc, 0.085, 'slit', 'iris', 0.6, 0.15);
    mouthAt(m, add(hc, [0, -0.04, 0.1]), 0.055, -0.4, 'fang', 0.4);
    both((s) => m.tube([add(hc, [s * 0.05, 0.05, -0.04]), add(hc, [s * 0.09, 0.13, -0.12]), add(hc, [s * 0.08, 0.17, -0.2])], [0.03, 0.02, 0.006], 'obsidian'));
    both((s) => m.spike(add(hc, [s * 0.03, 0.07, 0.0]), add(hc, [s * 0.05, 0.13, -0.03]), 0.018, 'crystal'));
    // tail with flame tip
    const sw = flick(p, 4, 0.02);
    m.tube([[0, 0.25 + hover, -0.2], [0.05, 0.18 + hover, -0.34], [0.16 + sw, 0.14 + hover, -0.4], [0.26 + sw, 0.2 + hover, -0.38]], [0.07, 0.05, 0.03, 0.012], 'side', body);
    flame(m, [0.26 + sw, 0.21 + hover, -0.38], 0.09, 0.035, p, 6);
    // wings: bone arms and flame membranes
    both((s) => {
      const up = 0.06 * b;
      const root: V3 = [s * 0.08, 0.42 + hover, -0.08];
      const elbow: V3 = [s * 0.28, 0.56 + up + hover, -0.12];
      const tip: V3 = [s * 0.5, 0.7 + up + hover, -0.16];
      const g = m.group();
      m.tube([root, elbow, tip], [0.03, 0.022, 0.01], 'side2', g);
      const rim: V3[] = [tip, [s * 0.55, 0.58 + up + hover, -0.22], [s * 0.47, 0.42 + up + hover, -0.2], [s * 0.34, 0.34 + hover, -0.16], [s * 0.16, 0.3 + hover, -0.1]];
      membrane(m, root, rim, 'flame*');
      // ribs from the elbow through the membrane
      for (const q of rim.slice(1, 4)) m.tube([elbow, q], [0.012, 0.006], 'side2', g);
    });
  },
};
