// Water summons.
import { type V3, add } from './model';
import { arm, beast, both, breathe, eyes, figure, flick, membrane, mouthAt } from './kit';
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

// Siren: a sea singer with long seaweed hair, fin ears and a Side-coloured
// gown ending in a fishtail train; one hand raised to her lips as she sings.
// Wild: a glowing jellyfish bell sits on her head like a hat, trailing tendrils.
WATER.siren = {
  palette: { hair: '#2a6a6a', iris: '#40e0d0', glow: '#7af0ff', skin: '#ece2f2' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      skirt: { mat: 'side', len: 0.25, flare: 0.8 },
      shoulders: 0.09,
      waistY: 0.28,
      headR: 0.12,
      arms: (s) => (s > 0 ? [[0.04, -0.07, 0.06], [-0.02, 0.02, 0.12]] : [[-0.07, -0.06, 0.03], [-0.13, -0.08, 0.08]]),
    });
    const { hc, r, waistY, lift } = f;
    // fishtail train fanning on the ground behind
    both((s) => m.poly([[s * 0.02, 0.03, -0.06], [s * 0.2, 0.01, -0.16], [s * 0.15, 0.07, -0.08]], 'side2'));
    m.ell([0, waistY + 0.03, 0], [0.065, 0.016, 0.052], 'pearl');
    // shell necklace
    m.ball([0, waistY + 0.17 + lift, 0.06], 0.018, 'pearl');
    eyes(m, hc, r, 'anime', 'iris', 0.4, -0.18);
    mouthAt(m, hc, r, -0.55);
    // fin ears
    both((s) => membrane(m, add(hc, [s * r * 0.92, 0.0, -0.01]), [add(hc, [s * 0.2, 0.07, -0.05]), add(hc, [s * 0.21, 0.0, -0.06]), add(hc, [s * 0.17, -0.06, -0.04])], 'elem'));
    // long seaweed hair framing the face and falling to the hips
    const hair = m.group();
    m.ell(add(hc, [0, 0.03, -0.035]), [r * 1.05, r * 0.92, r], 'hair', [0, 0, 0], hair);
    m.ell(add(hc, [0, 0.055, 0.065]), [r * 0.9, r * 0.32, r * 0.42], 'hair', [0.45, 0, 0], hair);
    for (let i = 0; i < 4; i++) {
      const x = -0.09 + i * 0.06;
      const w = flick(p, i, 0.015);
      m.tube([add(hc, [x, -0.02, -0.08]), add(hc, [x * 1.4 + w, -0.16, -0.1]), add(hc, [x * 1.2 - w, -0.3, -0.08]), add(hc, [x + w, -0.38, -0.06])], [0.038, 0.034, 0.024, 0.01], 'hair', hair);
    }
    both((s) => m.tube([add(hc, [s * r * 0.8, -0.04, 0.04]), add(hc, [s * r * 0.95, -0.14, 0.03]), add(hc, [s * r * 0.9, -0.2, 0.03])], [0.025, 0.02, 0.01], 'hair', hair));
    // wild: jellyfish hat
    const jc = add(hc, [0, 0.13, -0.03]);
    m.ell(jc, [0.13, 0.07, 0.12], 'glow*', [-0.35, 0, 0]);
    m.ell(add(jc, [0, 0.03, -0.01]), [0.06, 0.04, 0.06], '#d8fbff*');
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + (i / 4) * Math.PI * 0.9 - 0.1;
      const t0 = add(jc, [Math.cos(a) * 0.12, -0.04, Math.sin(a) * 0.1]);
      m.tube([t0, add(t0, [flick(p, i, 0.01), -0.08, 0]), add(t0, [-flick(p, i, 0.01), -0.14, 0])], [0.01, 0.008, 0.005], 'glow*');
    }
  },
};

// Undine: a water spirit woman in a Side-coloured bodice, sash and shawl,
// with a gold circlet and flowing water hair.
// Wild: below the waist she is a whirlpool, a smooth spiral of water with a
// crest of foam, with droplets floating around her.
WATER.undine = {
  palette: { iris: '#e8fbff', hair: '#8fe0ff', skin: '#c4e8ff', water: '#4aa8e8', foam: '#e8f8ff' },
  build(m, p) {
    const spin = p.frame * 0.6;
    // whirlpool: two interleaved spirals narrowing to the ground
    for (const [phase, mat, rr] of [[0, 'water', 1], [Math.PI, 'water', 0.85]] as [number, string, number][]) {
      const pts: V3[] = [];
      const radii: number[] = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const a = t * Math.PI * 4 + spin + phase;
        const r = (0.02 + t * 0.15) * rr;
        pts.push([Math.cos(a) * r, 0.02 + t * 0.28, Math.sin(a) * r * 0.9]);
        radii.push(0.025 + t * 0.035);
      }
      m.tube(pts, radii, mat);
    }
    m.tube([[0, 0.02, 0], [0, 0.3, 0]], [0.03, 0.1], 'water');
    // foam crest around the top
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - spin;
      m.ball([Math.cos(a) * 0.16, 0.29 + (i % 2) * 0.015, Math.sin(a) * 0.14], 0.03, 'foam');
    }
    const f = figure(m, p, {
      top: 'side',
      skin: 'skin',
      shoulders: 0.085,
      waistY: 0.3,
      headR: 0.115,
      arms: (s) => (s > 0 ? [[0.07, -0.03, 0.04], [0.12, 0.04, 0.08]] : [[-0.07, -0.05, 0.04], [-0.12, -0.02, 0.1]]),
    });
    const { hc, r, waistY, lift } = f;
    m.ell([0, waistY + 0.01, 0], [0.09, 0.03, 0.075], 'side2', [0, 0, 0.12]); // sash
    m.tube([[-0.08, waistY + 0.17 + lift, -0.04], [-0.18, waistY + 0.1 + lift, -0.06], [-0.26, waistY + 0.16 + lift + flick(p, 2, 0.015), -0.06], [-0.32, waistY + 0.1 + lift, -0.05]], [0.025, 0.025, 0.02, 0.01], 'side');
    m.tube([[0.08, waistY + 0.17 + lift, -0.04], [0.15, waistY + 0.23 + lift, -0.06]], [0.025, 0.02], 'side');
    eyes(m, hc, r, 'anime', 'iris', 0.4, -0.18);
    mouthAt(m, hc, r, -0.55);
    const hair = m.group();
    m.ell(add(hc, [0, 0.03, -0.035]), [r * 1.06, r * 0.92, r], 'hair', [0, 0, 0], hair);
    m.ell(add(hc, [0, 0.055, 0.065]), [r * 0.9, r * 0.32, r * 0.42], 'hair', [0.45, 0, 0], hair);
    m.tube([add(hc, [0, 0.04, -0.09]), add(hc, [0.06, -0.08, -0.16]), add(hc, [0.0, -0.2, -0.18]), add(hc, [-0.06, -0.3, -0.14])], [0.06, 0.05, 0.035, 0.012], 'hair', hair);
    m.ell(add(hc, [0, 0.075, 0.01]), [0.11, 0.017, 0.1], 'gold', [-0.2, 0, 0]);
    m.ball(add(hc, [0, 0.08, r * 0.9]), 0.017, 'crystal');
    // droplets floating around her
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + p.frame * 0.3;
      m.ball([Math.cos(a) * 0.25, 0.5 + Math.sin(a) * 0.08, Math.sin(a) * 0.15], 0.02, 'water');
    }
  },
};

// Shark: a powerful shark in Side-coloured skin with a white belly, banking in
// a curve with its jaws open and rows of teeth showing.
// Wild: a glowing anglerfish lure dangles from its brow, and glowing spots run
// along its flanks.
WATER.shark = {
  palette: { iris: '#2c2836', glow: '#9ff6ff', gum: '#c0405a' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    const sw = flick(p, 2, 0.03);
    // a curved spine: the body banks, so its length shows from the front too
    const spine: V3[] = [
      [0.2 + sw, 0.26, -0.34],
      [0.12, 0.22, -0.2],
      [0.03, 0.22, -0.04],
      [-0.01, 0.24 + lift * 0.5, 0.1],
      [0.0, 0.25 + lift * 0.5, 0.22],
    ];
    const body = m.group();
    m.tube(spine, [0.03, 0.085, 0.125 * swell, 0.12, 0.09], 'side', body);
    m.ell([0.01, 0.17, 0.05], [0.09, 0.055, 0.2], 'white', [0, -0.15, 0]); // belly
    // tail fin (crescent) and fins
    const t = spine[0];
    m.poly([add(t, [0, 0, 0.02]), add(t, [0.04, 0.2, -0.1]), add(t, [0.01, 0.06, -0.03]), add(t, [0.03, -0.14, -0.08])], 'side2');
    m.poly([[0.03, 0.34, -0.08], [0.06, 0.52, -0.18], [0.0, 0.34, 0.06]], 'side2');
    both((s) => m.poly([[s * 0.09 + 0.02, 0.18, 0.08], [s * 0.27 + 0.02, 0.06, -0.04], [s * 0.1 + 0.02, 0.17, -0.03]], 'side2'));
    // head with open jaws
    const hc: V3 = [0, 0.27 + lift * 0.5, 0.27];
    m.ell(add(hc, [0, 0.03, 0.03]), [0.085, 0.06, 0.1], 'side'); // snout
    m.ell(add(hc, [0, -0.04, 0.02]), [0.075, 0.035, 0.08], 'gum'); // open mouth
    m.ell(add(hc, [0, -0.085, 0.0]), [0.075, 0.03, 0.085], 'white', [0.3, 0, 0]); // lower jaw
    for (let i = 0; i < 5; i++) {
      const a = -0.9 + i * 0.45;
      const up: V3 = add(hc, [Math.sin(a) * 0.065, -0.015, Math.cos(a) * 0.07 + 0.02]);
      m.spike(up, add(up, [0, -0.03, 0.005]), 0.012, 'white');
      const lo: V3 = add(hc, [Math.sin(a) * 0.06, -0.065, Math.cos(a) * 0.065 + 0.01]);
      m.spike(lo, add(lo, [0, 0.028, 0.005]), 0.011, 'white');
    }
    both((s) => m.eye(add(hc, [s * 0.07, 0.05, 0.03]), [s * 0.8, 0.2, 0.6], 'dot', 'iris'));
    // wild: lure and glowing spots
    const l0: V3 = add(hc, [0, 0.08, 0.0]);
    m.tube([l0, add(l0, [0, 0.12, 0.06]), add(l0, [0, 0.11, 0.15])], [0.01, 0.008, 0.006], 'side2');
    m.ball(add(l0, [0, 0.07 + flick(p, 0, 0.01), 0.16]), 0.035, 'glow*');
    for (let i = 0; i < 4; i++) both((s) => m.ball([s * 0.11 + 0.04 * (i / 3), 0.25 - i * 0.01, 0.05 - i * 0.08], 0.016, 'glow*'));
  },
};

// Wolf: a proud wolf in Side-coloured fur with a white ruff and muzzle.
// Wild: a mane of icicles and frost crystals along its neck and spine, and a
// frost-tipped tail.
WATER.wolf = {
  palette: { iris: '#9ff0ff' },
  build(m, p) {
    const { hc, neck0, tail } = beast(m, p, { fur: 'side', light: 'white', size: 1.05 });
    // thick neck ruff
    m.ell(add(neck0, [0, 0.04, 0.03]), [0.11, 0.09, 0.08], 'side', [0.4, 0, 0]);
    m.ell(add(neck0, [0, -0.02, 0.06]), [0.08, 0.07, 0.05], 'white', [0.4, 0, 0]);
    // bushy tail with an icy tip
    m.tube([tail[0], tail[1], tail[2]], [0.045, 0.06, 0.04], 'side');
    m.spike(tail[2], add(tail[2], [0.01, 0.08, -0.02]), 0.035, 'ice');
    // wild: icicle mane fanning back from the head and down the spine
    for (let i = 0; i < 6; i++) {
      const a = -1 + i * 0.4;
      const b0: V3 = add(hc, [Math.sin(a) * 0.07, 0.02, -0.07]);
      m.spike(b0, add(b0, [Math.sin(a) * 0.09, 0.1 - Math.abs(a) * 0.04, -0.1]), 0.022, 'ice');
    }
    for (let i = 0; i < 4; i++) {
      const q: V3 = [0, 0.48 - i * 0.03, 0.12 - i * 0.09];
      m.spike(q, add(q, [0, 0.1 - i * 0.015, -0.05]), 0.028 - i * 0.003, 'ice');
    }
  },
};

// Kraken: a giant octopus with a smooth, tall Side-coloured mantle swept
// back, tentacles spreading over the ground and two curling up in front.
// Wild: one huge cyclops eye, a barnacled gold crown, and glowing suckers.
WATER.kraken = {
  palette: { iris: '#ffcf3a', glow: '#9ff6ff', elem: '#f0a0b8' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    // ground tentacles: out, then curling up at the tips
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * 0.62 + (i / 5) * Math.PI * 1.76; // around the back and sides
      const ca = Math.sin(a);
      const sa = Math.cos(a);
      const w = flick(p, i, 0.025);
      const pts: V3[] = [
        [ca * 0.1, 0.1, sa * 0.08],
        [ca * 0.25, 0.04, sa * 0.2],
        [ca * 0.4 + w, 0.05, sa * 0.3],
        [ca * 0.46, 0.13 + w, sa * 0.33],
        [ca * 0.4 - w, 0.18, sa * 0.28],
      ];
      const g = m.group();
      m.tube(pts, [0.065, 0.055, 0.038, 0.024, 0.01], 'side', g);
      for (let k = 1; k < 4; k++) m.ball(add(pts[k], [0, -0.022, 0.01]), 0.013, 'glow*');
    }
    // two front tentacles rising beside the eye
    for (const s of [-1, 1]) {
      const w = flick(p, s + 5, 0.02);
      const pts: V3[] = [
        [s * 0.1, 0.12, 0.1],
        [s * 0.2, 0.1, 0.22],
        [s * 0.25, 0.22 + w, 0.26],
        [s * 0.22, 0.36, 0.22],
        [s * 0.16 - w, 0.42, 0.18],
      ];
      const g = m.group();
      m.tube(pts, [0.06, 0.05, 0.04, 0.026, 0.012], 'side', g);
      for (let k = 1; k < 4; k++) m.ball(add(pts[k], [-s * 0.02, 0, 0.02]), 0.013, 'elem');
    }
    // mantle: a lower body and a tall dome swept back
    const mantle = m.group();
    m.ell([0, 0.25 + lift * 0.3, 0], [0.2 * swell, 0.16, 0.18 * swell], 'side', [0, 0, 0], mantle);
    m.ell([0, 0.46 + lift, -0.1], [0.23 * swell, 0.2, 0.22 * swell], 'side', [-0.55, 0, 0], mantle);
    m.ell([0, 0.58 + lift, -0.22], [0.15, 0.13, 0.14], 'side', [-0.7, 0, 0], mantle);
    for (const [x, y, z] of [[0.15, 0.48, 0.04], [-0.16, 0.44, 0.03], [0.08, 0.6, -0.04], [-0.09, 0.58, -0.02], [0.0, 0.52, 0.08]] as V3[]) m.ball([x, y + lift, z], 0.024, 'side2');
    // wild: cyclops eye
    const ec: V3 = [0, 0.31 + lift * 0.3, 0.15];
    m.ball(ec, 0.1, 'white');
    m.ball(add(ec, [0, 0, 0.055]), 0.06, 'iris');
    m.ell(add(ec, [0, 0, 0.1]), [0.014, 0.04, 0.01], 'dark');
    m.ball(add(ec, [0.028, 0.034, 0.098]), 0.014, 'white');
    m.ell(add(ec, [0, p.blink ? 0.0 : 0.08, 0.03]), [0.11, p.blink ? 0.104 : 0.04, 0.09], 'side2'); // lid
    // barnacled crown on the dome
    const cc: V3 = [0, 0.7 + lift, -0.27];
    const crown = m.group();
    m.ell(cc, [0.1, 0.03, 0.09], 'gold', [-0.45, 0, 0], crown);
    for (let i = 0; i < 5; i++) {
      const a = -1.1 + i * 0.55;
      m.spike(add(cc, [Math.sin(a) * 0.09, 0.02, Math.cos(a) * 0.04]), add(cc, [Math.sin(a) * 0.1, 0.11, Math.cos(a) * 0.04 - 0.03]), 0.022, 'gold', crown);
    }
    m.ball(add(cc, [0.05, 0.03, 0.06]), 0.018, 'white');
    m.ball(add(cc, [-0.04, 0.02, 0.07]), 0.015, 'stone');
  },
};
