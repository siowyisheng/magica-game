// Sprite designs: one per unit kind. Each is familiar from its name and has
// one fantastically wild element. Colours: 'side' (the Side Colour) is the
// main colour, 'elem' a shade of the Element, plus natural materials.

import { Model, type Pose, type V3, add } from './model';
import { arm, beast, both, breathe, eyes, flame, flick, legs, membrane, mouthAt } from './kit';
import { FIRE } from './fire';
import { AIR } from './air';
import { EARTH } from './earth';
import { WATER } from './water';
import { SUMMONER_DESIGNS } from './summoners';

export interface Design {
  /** Material colours for this kind (merged over the defaults). */
  palette?: Record<string, string>;
  build: (m: Model, p: Pose) => void;
}

const D: Record<string, Design> = {};

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

// Hound: a lean hunting dog with a deep chest and jointed legs.
// Wild: a mane and tail of living fire, and molten, glowing paws.
D.hound = {
  palette: { iris: '#ffe066', fur2: '#f0c8a0' },
  build(m, p) {
    const { hc, neck0, tail } = beast(m, p, { fur: 'side', light: 'side2', pawMat: 'lava*' });
    // fangs bared
    m.mouth(add(hc, [0.02, -0.07, 0.15]), [0.3, -0.3, 1], 'fang');
    m.mouth(add(hc, [-0.02, -0.07, 0.15]), [-0.3, -0.3, 1], 'fang');
    // wild: fire mane from the crown down the neck, and a fire tail
    flame(m, add(hc, [0, 0.06, -0.06]), 0.15, 0.05, p, 0);
    for (let i = 0; i < 3; i++) flame(m, [0, neck0[1] + 0.1 - i * 0.04, neck0[2] - 0.02 - i * 0.07], 0.15 - i * 0.025, 0.055, p, i + 1);
    m.tube(tail.slice(0, 2), [0.035, 0.025], 'side');
    flame(m, tail[1], 0.17, 0.05, p, 7);
  },
};

export const DESIGNS: Record<string, Design> = { ...D, ...SUMMONER_DESIGNS, ...FIRE, ...AIR, ...EARTH, ...WATER };
