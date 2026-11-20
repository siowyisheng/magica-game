// Sprite designs: one per unit kind. Each is familiar from its name and has
// one fantastically wild element. Colours: 'side' (the Side Colour) is the
// main colour, 'elem' a shade of the Element, plus natural materials.

import { Model, type Pose, type V3, add } from './model';
import { arm, both, breathe, eyes, flame, flick, legs, membrane, mouthAt } from './kit';
import { FIRE } from './fire';
import { AIR } from './air';
import { EARTH } from './earth';
import { WATER } from './water';

export interface Design {
  /** Material colours for this kind (merged over the defaults). */
  palette?: Record<string, string>;
  build: (m: Model, p: Pose) => void;
}

const D: Record<string, Design> = {};

// ---------------------------------------------------------------- Summoner
// A robed mage with a wide-brimmed hat and staff. Wild: a halo of floating
// rune shards orbiting behind the head.
D.summoner = {
  palette: { hair: '#e9e4f5', iris: '#8a5cff', glow: '#b98cff' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    // robe: stacked widening ellipsoids
    const robe = m.group();
    m.ell([0, 0.07, 0], [0.2, 0.08, 0.17], 'side', [0, 0, 0], robe);
    m.tube([[0, 0.1, 0], [0, 0.26, 0], [0, 0.42 + lift, 0]], [0.18, 0.14 * swell, 0.115 * swell], 'side', robe);
    // sash and collar
    m.ell([0, 0.31, 0.005], [0.158 * swell, 0.025, 0.133 * swell], 'gold');
    m.ell([0, 0.48 + lift, 0.0], [0.1, 0.035, 0.09], 'side2');
    // head
    const hc: V3 = [0, 0.6 + lift, 0.01];
    m.ball(hc, 0.13, 'skin');
    // long hair behind and beside
    const hair = m.group();
    m.ell(add(hc, [0, -0.03, -0.05]), [0.14, 0.15, 0.1], 'hair', [0, 0, 0], hair);
    both((s) => m.ell(add(hc, [s * 0.1, -0.08, 0.0]), [0.04, 0.1, 0.05], 'hair', [0, 0, s * 0.15], hair));
    m.ell(add(hc, [0, 0.07, 0.07]), [0.12, 0.05, 0.06], 'hair', [0.3, 0, 0], hair); // fringe
    eyes(m, hc, 0.13, 'anime', 'iris', 0.4, -0.15);
    mouthAt(m, hc, 0.13, -0.5);
    // hat: wide brim and a bent cone
    const hat = m.group();
    m.ell(add(hc, [0, 0.1, -0.03]), [0.22, 0.022, 0.19], 'side2', [-0.25, 0, 0], hat);
    m.tube([add(hc, [0, 0.1, -0.04]), add(hc, [0, 0.22, -0.07]), add(hc, [0.0, 0.32, -0.14]), add(hc, [0.05, 0.36, -0.22])], [0.115, 0.075, 0.04, 0.012], 'side2', hat);
    m.ell(add(hc, [0, 0.125, -0.04]), [0.118, 0.022, 0.108], 'gold', [-0.25, 0, 0]);
    // arms: one holds the staff
    both((s) => {
      const sh: V3 = [s * 0.14, 0.42 + lift, 0];
      if (s > 0) arm(m, sh, [0.21, 0.3 + lift, 0.06], [0.22, 0.25 + lift, 0.12], 0.045, 'side', 'skin', 0.04);
      else arm(m, sh, [-0.2, 0.3 + lift, 0.02], [-0.16, 0.22 + lift, 0.1], 0.045, 'side', 'skin', 0.04);
    });
    // staff with a glowing orb
    m.tube([[0.23, 0.02, 0.14], [0.22, 0.6, 0.11], [0.2, 0.78, 0.1]], [0.016, 0.016, 0.02], 'wood');
    m.tube([[0.2, 0.78, 0.1], [0.25, 0.86, 0.1], [0.27, 0.83, 0.1]], [0.02, 0.018, 0.01], 'wood');
    m.ball([0.2, 0.86 + flick(p, 1, 0.006), 0.1], 0.05, 'glow*');
    // wild: rune halo
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + p.frame * 0.25;
      m.ell(add(hc, [Math.cos(a) * 0.22, 0.02 + Math.sin(a) * 0.22, -0.16]), [0.022, 0.035, 0.01], 'glow*', [0, 0, a]);
    }
  },
};

// ---------------------------------------------------------------- Fire
// Imp: a grinning little devil with bat wings and a pointed tail.
// Wild: its horns are living flames.
D.imp = {
  palette: { iris: '#ffd23c' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    const body = m.group();
    m.ell([0, 0.3, 0], [0.13 * swell, 0.13, 0.11 * swell], 'side', [0, 0, 0], body);
    m.ell([0, 0.27, 0.06], [0.09, 0.09, 0.06], 'side2', [0, 0, 0], body);
    legs(m, 0.2, 0.065, 0.04, 'side', 'side2', 0.02);
    const hc: V3 = [0, 0.56 + lift, 0.02];
    m.ball(hc, 0.17, 'side');
    // big pointed ears
    both((s) => m.spike(add(hc, [s * 0.14, 0.0, -0.01]), add(hc, [s * 0.27, 0.06, -0.04]), 0.04, 'side'));
    eyes(m, hc, 0.17, 'anime', 'iris', 0.4, -0.05);
    mouthAt(m, hc, 0.17, -0.42, 'mouth', 0.12);
    mouthAt(m, hc, 0.17, -0.38, 'mouth', -0.08);
    mouthAt(m, hc, 0.175, -0.5, 'fang', 0.05);
    // wild: flame horns
    both((s) => flame(m, add(hc, [s * 0.08, 0.12, 0.02]), 0.18, 0.05, p, s > 0 ? 0 : 3));
    // arms with claws
    both((s) => arm(m, [s * 0.1, 0.36 + lift, 0], [s * 0.18, 0.28 + lift, 0.04], [s * 0.16, 0.2 + lift, 0.09], 0.035, 'side', 'side2', 0.035));
    // bat wings
    both((s) => {
      const root: V3 = [s * 0.06, 0.4 + lift, -0.08];
      const up = 0.05 * p.breath;
      membrane(m, root, [[s * 0.2, 0.58 + up, -0.12], [s * 0.3, 0.48 + up, -0.14], [s * 0.27, 0.36 + up, -0.12], [s * 0.18, 0.32, -0.1]], 'side2');
    });
    // tail with a flame tip
    const sw = flick(p, 5, 0.02);
    m.tube([[0, 0.2, -0.1], [0.08 + sw, 0.12, -0.2], [0.18 + sw, 0.18, -0.22], [0.22 + sw, 0.28, -0.2]], [0.025, 0.02, 0.015, 0.012], 'side');
    flame(m, [0.22 + sw, 0.29, -0.2], 0.07, 0.03, p, 9);
  },
};

// Hound: a lean hunting dog. Wild: a mane and tail of living fire and
// molten, glowing paws.
D.hound = {
  palette: { iris: '#ffe066' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    const body = m.group();
    m.ell([0, 0.34, -0.02], [0.12 * swell, 0.12 * swell, 0.24], 'side', [0, 0, 0], body);
    m.ell([0, 0.36, 0.14], [0.13 * swell, 0.13 * swell, 0.12], 'side', [0, 0, 0], body); // chest
    // legs
    for (const [z, s] of [[0.14, 1], [0.14, -1], [-0.16, 1], [-0.16, -1]] as [number, number][]) {
      const g = m.group();
      m.tube([[s * 0.07, 0.3, z], [s * 0.075, 0.14, z + 0.01], [s * 0.075, 0.04, z + 0.02]], [0.045, 0.035, 0.03], 'side', g);
      m.ell([s * 0.075, 0.025, z + 0.04], [0.035, 0.025, 0.05], 'elem*');
    }
    // neck and head
    const hc: V3 = [0, 0.56 + lift, 0.24];
    m.tube([[0, 0.4, 0.16], [0, 0.5 + lift, 0.22]], [0.08, 0.07], 'side', body);
    m.ball(hc, 0.1, 'side');
    m.ell(add(hc, [0, -0.03, 0.1]), [0.055, 0.05, 0.08], 'side2'); // snout
    m.ball(add(hc, [0, -0.01, 0.18]), 0.022, 'dark'); // nose
    both((s) => m.spike(add(hc, [s * 0.06, 0.06, -0.02]), add(hc, [s * 0.1, 0.17, -0.05]), 0.035, 'side2'));
    eyes(m, hc, 0.1, 'beast', 'iris', 0.55, 0.05);
    mouthAt(m, add(hc, [0, -0.03, 0.1]), 0.06, -0.6, 'fang', 0.3);
    // wild: fire mane along the neck and a fire tail
    for (let i = 0; i < 4; i++) flame(m, [0, 0.47 + i * 0.03 + lift, 0.18 - i * 0.07], 0.14 - i * 0.015, 0.05, p, i);
    flame(m, [0, 0.4, -0.25], 0.16, 0.055, p, 7);
    m.tube([[0, 0.38, -0.22], [0, 0.42, -0.27]], [0.035, 0.03], 'side');
  },
};

export const DESIGNS: Record<string, Design> = { ...D, ...FIRE, ...AIR, ...EARTH, ...WATER };
