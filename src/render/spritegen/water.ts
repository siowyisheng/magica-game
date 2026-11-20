// Water summons.
import { type V3, add } from './model';
import { arm, both, breathe, eyes, flick, membrane, mouthAt } from './kit';
import type { Design } from './designs';

export const WATER: Record<string, Design> = {};

// Bubble: a glossy slime droplet with a cheerful face.
// Wild: a goldfish swims circles around it, trailing bubbles.
WATER.bubble = {
  palette: { iris: '#2c2836', fish: '#ff9a3c' },
  build(m, p) {
    const { swell, b } = breathe(p);
    const body = m.group();
    m.ell([0, 0.17 - 0.01 * b, 0], [0.18 * swell, 0.17 - 0.01 * b, 0.16 * swell], 'sideGloss', [0, 0, 0], body);
    m.tube([[0, 0.28, -0.01], [0.02, 0.38, -0.03], [0.07, 0.42, -0.05]], [0.09, 0.04, 0.012], 'sideGloss', body);
    const fc: V3 = [0, 0.18, 0];
    eyes(m, fc, 0.17, 'anime', 'iris', 0.32, 0.05);
    mouthAt(m, fc, 0.17, -0.15);
    m.mouth(add(fc, [0.09, 0.0, 0.14]), [0.45, 0, 1], 'blush');
    m.mouth(add(fc, [-0.09, 0.0, 0.14]), [-0.45, 0, 1], 'blush');
    // wild: orbiting goldfish
    const a = p.frame * 0.9;
    const fp: V3 = [Math.cos(a) * 0.27, 0.32 + Math.sin(a * 2) * 0.03, Math.sin(a) * 0.2];
    const dir = -Math.sin(a) > 0 ? 1 : -1;
    const fish = m.group();
    m.ell(fp, [0.05, 0.035, 0.03], 'fish', [0, 0, 0], fish);
    m.poly([add(fp, [-dir * 0.04, 0, 0]), add(fp, [-dir * 0.09, 0.035, 0]), add(fp, [-dir * 0.09, -0.035, 0])], 'fish');
    for (let i = 0; i < 3; i++) m.ball(add(fp, [-dir * (0.08 + i * 0.05), 0.04 + i * 0.03, 0]), 0.012 + i * 0.004, 'ice');
  },
};

// Crab: an armoured crab with a Side-coloured shell and eyes on stalks.
// Wild: one claw is enormous, and a coral reef garden grows on its back.
WATER.crab = {
  palette: { iris: '#2c2836', coral: '#ff7f9a', anemone: '#a0f0d0' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    // legs
    both((s) => {
      for (let i = 0; i < 3; i++) {
        const z = 0.06 - i * 0.07;
        m.tube([[s * 0.15, 0.13, z], [s * 0.26, 0.15, z - 0.01], [s * 0.3, 0.02, z - 0.02]], [0.025, 0.02, 0.012], 'side2');
      }
    });
    const shell = m.group();
    m.ell([0, 0.16, 0], [0.2 * swell, 0.1, 0.15 * swell], 'side', [0, 0, 0], shell);
    m.ell([0, 0.12, 0.04], [0.17, 0.05, 0.12], 'side2', [0, 0, 0], shell);
    // eyes on stalks
    both((s) => {
      m.tube([[s * 0.05, 0.22, 0.1], [s * 0.06, 0.3 + lift, 0.12]], [0.014, 0.014], 'side2');
      m.ball([s * 0.06, 0.31 + lift, 0.12], 0.028, 'white');
      m.eye([s * 0.065, 0.315 + lift, 0.148], [s * 0.2, 0.1, 1], 'dot', 'iris');
    });
    mouthAt(m, [0, 0.15, 0.1], 0.06, -0.1);
    // claws: small left, huge right
    arm(m, [-0.15, 0.17, 0.08], [-0.22, 0.2, 0.15], [-0.18, 0.22, 0.2], 0.025, 'side', 'side', 0.035);
    m.tube([[0.15, 0.17, 0.08], [0.25, 0.22, 0.14]], [0.035, 0.04], 'side');
    const claw: V3 = [0.27, 0.3 + lift, 0.18];
    const cg = m.group();
    m.ell(claw, [0.1, 0.09, 0.07], 'side', [0, 0, 0.4], cg);
    m.ell(add(claw, [-0.02, 0.1, 0.0]), [0.06, 0.04, 0.045], 'side', [0, 0, -0.5]);
    m.spike(add(claw, [0.03, 0.04, 0.03]), add(claw, [-0.08, 0.13 + flick(p, 0, 0.01), 0.03]), 0.03, 'side2');
    // wild: coral garden on the back
    const back: V3 = [0, 0.24, -0.05];
    m.tube([back, add(back, [0.02, 0.1, -0.02]), add(back, [0.07, 0.17, -0.03])], [0.025, 0.018, 0.01], 'coral');
    m.tube([add(back, [0.02, 0.1, -0.02]), add(back, [-0.05, 0.16, -0.02])], [0.015, 0.008], 'coral');
    m.tube([add(back, [-0.09, 0, 0]), add(back, [-0.11, 0.08, 0.0]), add(back, [-0.08, 0.13, 0.01])], [0.02, 0.014, 0.008], 'coral');
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      m.spike(add(back, [0.09, 0, 0.04]), add(back, [0.09 + Math.cos(a) * 0.04, 0.06 + flick(p, i, 0.01), 0.04 + Math.sin(a) * 0.03]), 0.012, 'anemone');
    }
    m.ball(add(back, [-0.02, 0.01, 0.06]), 0.03, 'white'); // pearl
  },
};

// Siren: a sea singer with long seaweed hair, fin ears and a Side-coloured gown.
// Wild: a glowing jellyfish bell sits on her head like a hat, trailing tendrils.
WATER.siren = {
  palette: { hair: '#2a6a6a', iris: '#40e0d0', glow: '#7af0ff', skin: '#e8e0f0' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    const gown = m.group();
    m.tube([[0, 0.06, 0], [0, 0.22, 0], [0, 0.4 + lift, 0]], [0.12, 0.09 * swell, 0.08 * swell], 'side', gown);
    m.ell([0, 0.05, 0.02], [0.15, 0.05, 0.13], 'side2'); // fishtail hem
    both((s) => m.poly([[s * 0.06, 0.06, 0.1], [s * 0.2, 0.0, 0.12], [s * 0.15, 0.1, 0.1]], 'side2'));
    both((s) => arm(m, [s * 0.08, 0.4 + lift, 0], [s * 0.15, 0.36 + lift, 0.05], [s * 0.1, 0.44 + lift, 0.1], 0.024, 'skin', 'skin', 0.024));
    const hc: V3 = [0, 0.55 + lift, 0.02];
    m.ball(hc, 0.12, 'skin');
    eyes(m, hc, 0.12, 'anime', 'iris', 0.4, -0.15);
    mouthAt(m, hc, 0.12, -0.5);
    both((s) => membrane(m, add(hc, [s * 0.11, 0.0, -0.01]), [add(hc, [s * 0.2, 0.08, -0.05]), add(hc, [s * 0.22, 0.0, -0.06]), add(hc, [s * 0.18, -0.06, -0.04])], 'elem'));
    // seaweed hair
    const hair = m.group();
    m.ell(add(hc, [0, 0.02, -0.04]), [0.13, 0.11, 0.11], 'hair', [0, 0, 0], hair);
    for (let i = 0; i < 4; i++) {
      const x = -0.09 + i * 0.06;
      const w = flick(p, i, 0.015);
      m.tube([add(hc, [x, -0.02, -0.08]), add(hc, [x * 1.3 + w, -0.18, -0.1]), add(hc, [x * 1.1 - w, -0.34, -0.08]), add(hc, [x + w, -0.42, -0.06])], [0.04, 0.035, 0.025, 0.01], 'hair', hair);
    }
    // wild: jellyfish hat
    const jc = add(hc, [0, 0.15, -0.04]);
    m.ell(jc, [0.13, 0.07, 0.12], 'glow*', [-0.35, 0, 0]);
    m.ell(add(jc, [0, 0.03, -0.01]), [0.06, 0.04, 0.06], '#d8fbff*');
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + (i / 4) * Math.PI * 0.9 - 0.1;
      const t0 = add(jc, [Math.cos(a) * 0.12, -0.04, Math.sin(a) * 0.1]);
      m.tube([t0, add(t0, [flick(p, i, 0.01), -0.08, 0]), add(t0, [-flick(p, i, 0.01), -0.14, 0])], [0.01, 0.008, 0.005], 'glow*');
    }
  },
};

// Undine: a water spirit woman with a Side-coloured sash and gold circlet.
// Wild: below the waist she is a whirlpool, ringed with foam and droplets.
WATER.undine = {
  palette: { iris: '#e8fbff', hair: '#8fe0ff', skin: '#bfe8ff', water: '#58b8f0' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    // whirlpool: a spiral of water rings narrowing downward
    const pool = m.group();
    for (let i = 0; i < 26; i++) {
      const t = i / 25;
      const a = t * Math.PI * 6 + p.frame * 0.6;
      const r = 0.04 + t * 0.15;
      m.ball([Math.cos(a) * r, 0.02 + t * 0.3, Math.sin(a) * r * 0.85], 0.05 + t * 0.03, 'water', pool);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - p.frame * 0.5;
      m.ball([Math.cos(a) * 0.2, 0.3, Math.sin(a) * 0.17], 0.025, 'white');
    }
    const body = m.group();
    m.ell([0, 0.42 + lift * 0.5, 0], [0.08 * swell, 0.1, 0.065 * swell], 'skin', [0, 0, 0], body);
    // Side-coloured bodice, sash and shawl
    m.ell([0, 0.4 + lift * 0.5, 0.005], [0.085 * swell, 0.065, 0.07 * swell], 'side');
    m.ell([0, 0.33, 0], [0.12, 0.035, 0.1], 'side2', [0, 0, 0.15]);
    m.tube([[0.1, 0.34, 0.03], [0.17, 0.25, 0.05], [0.21, 0.17 + flick(p, 0, 0.01), 0.04]], [0.028, 0.024, 0.012], 'side');
    m.tube([[-0.09, 0.5 + lift, -0.04], [-0.2, 0.44 + lift, -0.06], [-0.28, 0.5 + lift + flick(p, 2, 0.015), -0.06], [-0.34, 0.44 + lift, -0.05]], [0.025, 0.025, 0.02, 0.01], 'side');
    m.tube([[0.09, 0.5 + lift, -0.04], [0.16, 0.56 + lift, -0.06]], [0.025, 0.02], 'side');
    both((s) => arm(m, [s * 0.07, 0.48 + lift, 0], [s * 0.15, 0.44 + lift, 0.04], [s * 0.19, 0.5 + lift, 0.08], 0.022, 'skin', 'skin', 0.022));
    const hc: V3 = [0, 0.61 + lift, 0.02];
    m.ball(hc, 0.11, 'skin');
    eyes(m, hc, 0.11, 'anime', 'iris', 0.4, -0.15);
    mouthAt(m, hc, 0.11, -0.5);
    const hair = m.group();
    m.ell(add(hc, [0, 0.03, -0.03]), [0.12, 0.1, 0.11], 'hair', [0, 0, 0], hair);
    m.tube([add(hc, [0, 0.04, -0.09]), add(hc, [0.06, -0.08, -0.16]), add(hc, [0.0, -0.2, -0.18]), add(hc, [-0.06, -0.3, -0.14])], [0.06, 0.05, 0.035, 0.012], 'hair', hair);
    m.ell(add(hc, [0, 0.08, 0.01]), [0.115, 0.018, 0.105], 'gold', [-0.2, 0, 0]);
    m.ball(add(hc, [0, 0.085, 0.11]), 0.018, 'crystal');
    // floating droplets
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + p.frame * 0.3;
      m.ball([Math.cos(a) * 0.26, 0.55 + Math.sin(a) * 0.08, Math.sin(a) * 0.15], 0.022, 'water');
    }
  },
};

// Shark: a powerful shark in Side-coloured skin with a white belly.
// Wild: a glowing anglerfish lure dangles from its brow, and glowing spots run
// along its flanks.
WATER.shark = {
  palette: { iris: '#2c2836', glow: '#9ff6ff' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    const sw = flick(p, 2, 0.03);
    const spine: V3[] = [
      [sw, 0.18, -0.36],
      [0, 0.22, -0.18],
      [0, 0.24, 0.0],
      [0, 0.24 + lift * 0.5, 0.16],
      [0, 0.22 + lift * 0.5, 0.28],
    ];
    const body = m.group();
    m.tube(spine, [0.03, 0.09, 0.13 * swell, 0.12, 0.07], 'side', body);
    m.ell([0, 0.17, 0.08], [0.1, 0.06, 0.18], 'white'); // belly
    // tail fin
    m.poly([[sw, 0.18, -0.34], [sw, 0.36, -0.46], [sw, 0.26, -0.36], [sw, 0.06, -0.44]], 'side2');
    // dorsal and pectoral fins
    m.poly([[0, 0.34, -0.06], [0, 0.5, -0.14], [0, 0.34, 0.08]], 'side2');
    both((s) => m.poly([[s * 0.1, 0.18, 0.08], [s * 0.26, 0.06, -0.02], [s * 0.1, 0.16, -0.02]], 'side2'));
    // face: eyes, toothy grin
    const hc: V3 = [0, 0.24, 0.24];
    eyes(m, hc, 0.11, 'dot', 'iris', 0.8, 0.15);
    for (let i = 0; i < 4; i++) {
      const a = -0.5 + i * 0.33;
      m.mouth(add(hc, [Math.sin(a) * 0.09, -0.055, Math.cos(a) * 0.075]), [Math.sin(a), -0.2, Math.cos(a)], 'fang');
    }
    // wild: lure and glowing spots
    const l0: V3 = [0, 0.34, 0.2];
    m.tube([l0, [0, 0.45, 0.28], [0, 0.44, 0.38]], [0.01, 0.008, 0.006], 'side2');
    m.ball([0, 0.41 + flick(p, 0, 0.01), 0.39], 0.035, 'glow*');
    for (let i = 0; i < 4; i++) both((s) => m.ball([s * 0.11, 0.24 - i * 0.01, 0.05 - i * 0.08], 0.016, 'glow*'));
  },
};

// Wolf: a proud wolf in Side-coloured fur with a white chest.
// Wild: a mane of icicles and frost crystals along its spine.
WATER.wolf = {
  palette: { iris: '#9ff0ff' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    const body = m.group();
    m.ell([0, 0.33, -0.04], [0.12 * swell, 0.12 * swell, 0.24], 'side', [0, 0, 0], body);
    m.ell([0, 0.36, 0.13], [0.13 * swell, 0.14 * swell, 0.12], 'side', [0, 0, 0], body);
    m.ell([0, 0.32, 0.2], [0.08, 0.1, 0.06], 'white'); // chest
    for (const [z, s] of [[0.13, 1], [0.13, -1], [-0.18, 1], [-0.18, -1]] as [number, number][]) {
      const g = m.group();
      m.tube([[s * 0.07, 0.3, z], [s * 0.075, 0.14, z + 0.01], [s * 0.075, 0.03, z + 0.02]], [0.045, 0.035, 0.032], 'side', g);
      m.ell([s * 0.075, 0.02, z + 0.04], [0.035, 0.022, 0.05], 'white');
    }
    const hc: V3 = [0, 0.56 + lift, 0.25];
    m.tube([[0, 0.42, 0.16], [0, 0.52 + lift, 0.22]], [0.09, 0.075], 'side', body);
    m.ball(hc, 0.1, 'side');
    m.ell(add(hc, [0, -0.035, 0.1]), [0.05, 0.045, 0.09], 'white');
    m.ball(add(hc, [0, -0.015, 0.19]), 0.02, 'dark');
    both((s) => m.spike(add(hc, [s * 0.06, 0.06, -0.03]), add(hc, [s * 0.09, 0.18, -0.05]), 0.04, 'side'));
    eyes(m, hc, 0.1, 'beast', 'iris', 0.55, 0.08);
    // tail
    m.tube([[0, 0.38, -0.26], [0.04, 0.32, -0.38], [0.06, 0.22, -0.42]], [0.05, 0.05, 0.02], 'side', body);
    // wild: icicle mane
    for (let i = 0; i < 7; i++) {
      const a = -1.2 + i * 0.4;
      const b0: V3 = add(hc, [Math.sin(a) * 0.09, -0.04 + Math.cos(a) * 0.02, -0.08]);
      m.spike(b0, add(b0, [Math.sin(a) * 0.1, 0.08 - Math.abs(a) * 0.05, -0.1]), 0.025, 'ice');
    }
    for (let i = 0; i < 3; i++) m.spike([0, 0.44 - i * 0.01, 0.02 - i * 0.1], [0, 0.55 - i * 0.03, -0.02 - i * 0.1], 0.03, 'ice');
  },
};

// Kraken: a giant octopus with a Side-coloured mantle and curling tentacles.
// Wild: one huge cyclops eye, a barnacled gold crown, and glowing suckers.
WATER.kraken = {
  palette: { iris: '#ffcf3a', glow: '#9ff6ff', elem: '#e88aa0' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    // tentacles
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const w = flick(p, i, 0.025);
      const pts: V3[] = [
        [ca * 0.1, 0.12, sa * 0.08],
        [ca * 0.26, 0.04, sa * 0.2],
        [ca * 0.42 + w, 0.06, sa * 0.3],
        [ca * 0.5, 0.16 + w, sa * 0.34],
        [ca * 0.44 - w, 0.24, sa * 0.3],
      ];
      const g = m.group();
      m.tube(pts, [0.07, 0.06, 0.04, 0.025, 0.01], 'side', g);
      for (let k = 1; k < 4; k++) m.ball(add(pts[k], [0, -0.02, 0]), 0.014, 'glow*');
    }
    // mantle
    const mantle = m.group();
    m.ell([0, 0.32 + lift * 0.5, -0.02], [0.24 * swell, 0.22, 0.22 * swell], 'side', [0, 0, 0], mantle);
    m.ell([0, 0.52 + lift, -0.08], [0.2 * swell, 0.2, 0.2], 'side', [-0.3, 0, 0], mantle);
    for (const [x, y] of [[0.14, 0.4], [-0.16, 0.36], [0.08, 0.58], [-0.1, 0.6]]) m.ball([x, y + lift * 0.5, 0.16], 0.025, 'side2');
    // wild: cyclops eye
    const ec: V3 = [0, 0.34 + lift * 0.5, 0.17];
    m.ball(ec, 0.09, 'white');
    m.ball(add(ec, [0, 0, 0.055]), 0.05, 'iris');
    m.ell(add(ec, [0, 0, 0.09]), [0.012, 0.035, 0.01], 'dark');
    m.ball(add(ec, [0.025, 0.03, 0.09]), 0.012, 'white');
    m.ell(add(ec, [0, p.blink ? 0.0 : 0.07, 0.03]), [0.1, p.blink ? 0.09 : 0.04, 0.08], 'side2'); // lid
    // barnacled crown
    const cc: V3 = [0, 0.7 + lift, -0.1];
    const crown = m.group();
    m.ell(cc, [0.12, 0.035, 0.11], 'gold', [-0.3, 0, 0], crown);
    for (let i = 0; i < 5; i++) {
      const a = -1.1 + i * 0.55;
      m.spike(add(cc, [Math.sin(a) * 0.1, 0.02, Math.cos(a) * 0.05]), add(cc, [Math.sin(a) * 0.12, 0.11, Math.cos(a) * 0.05 - 0.02]), 0.025, 'gold', crown);
    }
    m.ball(add(cc, [0.06, 0.03, 0.07]), 0.02, 'white');
    m.ball(add(cc, [-0.05, 0.02, 0.08]), 0.016, 'stone');
  },
};
