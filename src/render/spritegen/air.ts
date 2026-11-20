// Air summons.
import { type V3, add } from './model';
import { arm, both, breathe, eyes, flame, flick, membrane, mouthAt } from './kit';
import type { Design } from './designs';

export const AIR: Record<string, Design> = {};

// Sprite: a tiny fairy in a Side-coloured petal dress.
// Wild: a dandelion-clock puff for hair, and dragonfly wings.
AIR.sprite = {
  palette: { iris: '#3fc08a' },
  build(m, p) {
    const { swell, lift, b } = breathe(p);
    const y0 = 0.14 + 0.02 * Math.sin(p.frame * 0.8);
    // petal dress
    const dress = m.group();
    m.ell([0, y0 + 0.12, 0], [0.1, 0.07, 0.09], 'side', [0, 0, 0], dress);
    m.ell([0, y0 + 0.2, 0], [0.065 * swell, 0.07, 0.055 * swell], 'side', [0, 0, 0], dress);
    both((s) => m.ell([s * 0.06, y0 + 0.08, 0.02], [0.04, 0.06, 0.03], 'sideL', [0, 0, s * 0.5]));
    both((s) => m.tube([[s * 0.03, y0 + 0.08, 0], [s * 0.04, y0 - 0.02, 0.03], [s * 0.045, y0 - 0.08, 0.02]], [0.022, 0.02, 0.016], 'skin'));
    both((s) => arm(m, [s * 0.06, y0 + 0.24 + lift, 0], [s * 0.11, y0 + 0.2 + lift, 0.03], [s * 0.12, y0 + 0.26 + lift, 0.06], 0.02, 'skin', 'skin', 0.022));
    const hc: V3 = [0, y0 + 0.4 + lift, 0.02];
    m.ball(hc, 0.13, 'skin');
    eyes(m, hc, 0.13, 'anime', 'iris', 0.42, -0.15);
    mouthAt(m, hc, 0.13, -0.5);
    // wild: dandelion puff hair
    const puff = m.group();
    m.ell(add(hc, [0, 0.05, -0.02]), [0.14, 0.1, 0.13], 'cloud', [0, 0, 0], puff);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const e = 0.35 + 0.5 * ((i * 7) % 5) / 5;
      m.ball(add(hc, [Math.cos(a) * 0.15 * Math.cos(e), 0.06 + Math.sin(e) * 0.15, Math.sin(a) * 0.13 * Math.cos(e) - 0.02]), 0.04, 'cloud', puff);
    }
    for (let i = 0; i < 3; i++) {
      const a = 0.4 + i * 1.1 + p.frame * 0.4;
      m.ball(add(hc, [Math.cos(a) * 0.26, 0.2 + i * 0.05, -0.05]), 0.016, 'white');
    }
    // dragonfly wings
    both((s) => {
      const root: V3 = [s * 0.03, y0 + 0.26, -0.06];
      const f = 0.05 * b;
      m.ell(add(root, [s * 0.15, 0.1 + f, -0.04]), [0.15, 0.04, 0.01], 'crystal', [0, 0.3 * s, s * 0.45]);
      m.ell(add(root, [s * 0.13, -0.02 + f * 0.5, -0.04]), [0.12, 0.03, 0.01], 'crystal', [0, 0.3 * s, s * -0.15]);
    });
  },
};

// Hawk: a fierce bird of prey. Wild: its tail is a little storm cloud and its
// crest crackles with lightning.
AIR.hawk = {
  palette: { iris: '#ffd23c', beak: '#f0c040' },
  build(m, p) {
    const { swell, lift, b } = breathe(p);
    const y = 0.12;
    const body = m.group();
    m.ell([0, y + 0.25, 0], [0.12 * swell, 0.16, 0.12 * swell], 'side', [-0.35, 0, 0], body);
    m.ell([0, y + 0.22, 0.07], [0.08, 0.11, 0.06], 'white', [-0.35, 0, 0]); // breast
    const hc: V3 = [0, y + 0.45 + lift, 0.08];
    m.ball(hc, 0.09, 'white');
    m.ell(add(hc, [0, 0.03, -0.02]), [0.09, 0.05, 0.08], 'side2'); // cap
    const beak = m.group();
    m.tube([add(hc, [0, -0.0, 0.08]), add(hc, [0, -0.02, 0.13]), add(hc, [0, -0.06, 0.14])], [0.03, 0.02, 0.006], 'beak', beak);
    eyes(m, hc, 0.09, 'beast', 'iris', 0.6, 0.05);
    // talons
    both((s) => m.tube([[s * 0.04, y + 0.1, 0.02], [s * 0.05, y - 0.02, 0.05], [s * 0.05, y - 0.07, 0.08]], [0.02, 0.016, 0.01], 'beak'));
    // spread wings
    both((s) => {
      const up = 0.08 * b;
      const root: V3 = [s * 0.08, y + 0.32, -0.04];
      membrane(m, root, [[s * 0.26, y + 0.56 + up, -0.1], [s * 0.46, y + 0.62 + up, -0.14], [s * 0.5, y + 0.5 + up, -0.14], [s * 0.42, y + 0.36 + up, -0.12], [s * 0.3, y + 0.22, -0.1], [s * 0.12, y + 0.18, -0.06]], 'side');
      for (let i = 0; i < 4; i++) m.ell([s * (0.3 + i * 0.05), y + 0.46 - i * 0.05 + up, -0.13], [0.06, 0.015, 0.012], 'side2', [0, 0, s * (-0.9 - i * 0.2)]);
    });
    // wild: storm-cloud tail and lightning crest
    const cloud = m.group();
    for (let i = 0; i < 5; i++) m.ball([(i - 2) * 0.05, y + 0.08 + (i % 2) * 0.03, -0.17 - Math.abs(i - 2) * 0.015], 0.055, 'cloud', cloud);
    m.ell([0, y + 0.06, -0.16], [0.13, 0.04, 0.05], 'side2');
    const zig: V3[] = [add(hc, [0, 0.07, -0.02]), add(hc, [0.03, 0.13, -0.05]), add(hc, [-0.01, 0.15, -0.07]), add(hc, [0.03, 0.22 + flick(p, 1, 0.01), -0.1])];
    m.tube(zig, [0.016, 0.014, 0.012, 0.006], 'spark*');
    m.tube([[0.02, y + 0.06, -0.2], [-0.03, y + 0.0, -0.22], [0.02, y - 0.06, -0.24]], [0.012, 0.01, 0.006], 'spark*');
  },
};

// Monk: a bald monk in a Side-coloured robe with a gold sash and beads.
// Wild: a third eye of light and a ring of lightning beads orbiting him.
AIR.monk = {
  palette: { iris: '#5aa0e0', beads: '#6e3a28' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    const robe = m.group();
    m.ell([0, 0.08, 0], [0.16, 0.08, 0.13], 'side', [0, 0, 0], robe);
    m.tube([[0, 0.1, 0], [0, 0.3, 0], [0, 0.42 + lift, 0]], [0.15, 0.12 * swell, 0.11 * swell], 'side', robe);
    // sash across the chest
    m.ell([0, 0.33 + lift * 0.5, 0.005], [0.125 * swell, 0.03, 0.115 * swell], 'gold', [0, 0, 0.45]);
    m.ell([0, 0.2, 0.0], [0.142, 0.02, 0.12], 'elem');
    // arms: hands together in prayer
    both((s) => arm(m, [s * 0.12, 0.42 + lift, 0], [s * 0.13, 0.32 + lift, 0.08], [s * 0.02, 0.37 + lift, 0.13], 0.04, 'side', 'skin', 0.03));
    // prayer beads hanging from the hands
    for (let i = 0; i < 7; i++) {
      const a = (i / 6) * Math.PI;
      m.ball([Math.cos(a) * 0.05, 0.31 + lift - Math.sin(a) * 0.05, 0.14], 0.015, 'beads');
    }
    const hc: V3 = [0, 0.58 + lift, 0.02];
    m.ball(hc, 0.13, 'skin');
    both((s) => m.ell(add(hc, [s * 0.125, -0.01, 0]), [0.02, 0.035, 0.025], 'skin'));
    eyes(m, hc, 0.13, 'anime', 'iris', 0.38, -0.15);
    mouthAt(m, hc, 0.13, -0.5);
    // third eye
    const [tp] = [add(hc, [0, 0.06, 0.12])];
    m.ell(tp, [0.015, 0.025, 0.01], 'spark*');
    // wild: orbiting lightning beads
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + p.frame * 0.3;
      m.ball([Math.cos(a) * 0.26, 0.3 + Math.sin(a) * 0.05, Math.sin(a) * 0.2], 0.028, i % 3 === 0 ? 'spark*' : 'elem*');
    }
  },
};

// Muse: a winged muse with a golden lyre and a flowing Side-coloured gown.
// Wild: her hair streams out as ribbons of wind.
AIR.muse = {
  palette: { iris: '#7a6cff', elem: '#bfe8f5' },
  build(m, p) {
    const { swell, lift, b } = breathe(p);
    const y0 = 0.08 + 0.015 * Math.sin(p.frame * 0.8);
    // gown trailing to a point (floating)
    const gown = m.group();
    m.tube([[0.02, y0, -0.04], [0, y0 + 0.14, 0], [0, y0 + 0.3, 0], [0, y0 + 0.42 + lift, 0]], [0.04, 0.13, 0.1 * swell, 0.09 * swell], 'side', gown);
    m.ell([0, y0 + 0.36, 0.0], [0.1 * swell, 0.02, 0.09], 'gold');
    // wings
    both((s) => {
      const root: V3 = [s * 0.04, y0 + 0.4, -0.07];
      const up = 0.05 * b;
      const rim: V3[] = [[s * 0.14, y0 + 0.62 + up, -0.12], [s * 0.26, y0 + 0.68 + up, -0.13], [s * 0.34, y0 + 0.6 + up, -0.14], [s * 0.33, y0 + 0.5 + up, -0.14], [s * 0.24, y0 + 0.44, -0.13], [s * 0.3, y0 + 0.36, -0.13], [s * 0.26, y0 + 0.26, -0.12], [s * 0.14, y0 + 0.3, -0.1]];
      membrane(m, root, rim, 'cloud');
      m.tube(rim, rim.map(() => 0.011), 'sideL');
    });
    // lyre held at the side
    const lyre: V3 = [0.15, y0 + 0.32 + lift, 0.08];
    m.tube([add(lyre, [-0.04, -0.05, 0]), add(lyre, [-0.05, 0.04, 0]), add(lyre, [-0.03, 0.09, 0])], [0.012, 0.012, 0.008], 'gold');
    m.tube([add(lyre, [0.04, -0.05, 0]), add(lyre, [0.05, 0.04, 0]), add(lyre, [0.03, 0.09, 0])], [0.012, 0.012, 0.008], 'gold');
    m.tube([add(lyre, [-0.04, -0.05, 0]), add(lyre, [0.04, -0.05, 0])], [0.014, 0.014], 'gold');
    arm(m, [0.09, y0 + 0.44 + lift, 0], [0.13, y0 + 0.36 + lift, 0.05], [0.12, y0 + 0.33 + lift, 0.1], 0.025, 'skin', 'skin', 0.022);
    arm(m, [-0.09, y0 + 0.44 + lift, 0], [-0.13, y0 + 0.36 + lift, 0.04], [-0.12, y0 + 0.3 + lift, 0.06], 0.025, 'skin', 'skin', 0.022);
    const hc: V3 = [0, y0 + 0.58 + lift, 0.02];
    m.ball(hc, 0.12, 'skin');
    eyes(m, hc, 0.12, 'anime', 'iris', 0.4, -0.15);
    mouthAt(m, hc, 0.12, -0.5);
    // wild: hair of wind ribbons
    const hair = m.group();
    m.ell(add(hc, [0, 0.04, -0.02]), [0.13, 0.1, 0.12], 'elem', [0, 0, 0], hair);
    m.ell(add(hc, [0, 0.06, 0.06]), [0.11, 0.05, 0.06], 'elem', [0.4, 0, 0], hair);
    for (let i = 0; i < 3; i++) {
      const w = flick(p, i, 0.03);
      m.tube([add(hc, [0.0, 0.06 - i * 0.05, -0.08]), add(hc, [-0.12, 0.04 - i * 0.06 + w, -0.12]), add(hc, [-0.24, 0.08 - i * 0.07 - w, -0.12]), add(hc, [-0.34, 0.02 - i * 0.08 + w, -0.1])], [0.035, 0.03, 0.022, 0.008], 'elem', hair);
    }
  },
};

// Harpy: a bird-woman with wings for arms and talons.
// Wild: a crown of crescent-moon feathers and glowing violet eyes.
AIR.harpy = {
  palette: { hair: '#4a3a6a', glow: '#c07aff', talon: '#e9bf45' },
  build(m, p) {
    const { swell, lift, b } = breathe(p);
    const y0 = 0.1;
    const body = m.group();
    m.ell([0, y0 + 0.24, 0], [0.09 * swell, 0.12, 0.075 * swell], 'side', [0, 0, 0], body);
    m.ell([0, y0 + 0.36 + lift, 0.0], [0.07, 0.05, 0.06], 'skin', [0, 0, 0]); // shoulders
    // feathered legs and talons
    both((s) => {
      const g = m.group();
      m.tube([[s * 0.05, y0 + 0.15, 0], [s * 0.07, y0 + 0.05, -0.02], [s * 0.05, y0 - 0.05, 0.03]], [0.045, 0.03, 0.018], 'side2', g);
      m.tube([[s * 0.05, y0 - 0.05, 0.03], [s * 0.06, y0 - 0.09, 0.08]], [0.015, 0.006], 'talon');
    });
    // wing-arms, swept out
    both((s) => {
      const up = 0.08 * b;
      const root: V3 = [s * 0.07, y0 + 0.37 + lift, -0.02];
      const g = m.group();
      membrane(m, root, [[s * 0.22, y0 + 0.56 + up, -0.06], [s * 0.4, y0 + 0.6 + up, -0.1], [s * 0.44, y0 + 0.46 + up, -0.1], [s * 0.36, y0 + 0.3 + up * 0.5, -0.08], [s * 0.22, y0 + 0.18, -0.05]], 'side', g);
      for (let i = 0; i < 4; i++) m.ell([s * (0.24 + i * 0.05), y0 + 0.4 - i * 0.06 + up, -0.09], [0.06, 0.016, 0.012], 'side2', [0, 0, s * (-1 - i * 0.2)]);
    });
    const hc: V3 = [0, y0 + 0.52 + lift, 0.02];
    m.ball(hc, 0.12, 'skin');
    const hair = m.group();
    m.ell(add(hc, [0, 0.03, -0.03]), [0.13, 0.12, 0.12], 'hair', [0, 0, 0], hair);
    m.tube([add(hc, [0, -0.02, -0.1]), add(hc, [0.02, -0.14, -0.14]), add(hc, [0, -0.24, -0.12])], [0.07, 0.05, 0.015], 'hair', hair);
    m.ell(add(hc, [0, 0.06, 0.06]), [0.1, 0.045, 0.06], 'hair', [0.4, 0, 0], hair);
    eyes(m, hc, 0.12, 'anime', 'glow', 0.4, -0.15);
    mouthAt(m, hc, 0.12, -0.5);
    // wild: crescent crown
    for (let i = 0; i < 5; i++) {
      const a = -0.9 + i * 0.45;
      m.spike(add(hc, [Math.sin(a) * 0.1, 0.09, -0.03]), add(hc, [Math.sin(a) * 0.17, 0.22 - Math.abs(a) * 0.05, -0.06]), 0.022, i === 2 ? 'spark*' : 'side2');
    }
    m.ell(add(hc, [0, 0.13, 0.02]), [0.035, 0.035, 0.01], 'spark*');
  },
};

// Giant: a towering, broad-shouldered warrior in a Side-coloured tunic.
// Wild: his head is wrapped in a thundercloud, with a beard of cloud and
// lightning crackling in it.
AIR.giant = {
  palette: { skin: '#e8c4a4', iris: '#5ac0ff' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    both((s) => {
      const g = m.group();
      m.tube([[s * 0.08, 0.3, 0], [s * 0.1, 0.15, 0.02], [s * 0.1, 0.05, 0.03]], [0.06, 0.05, 0.05], 'skin', g);
      m.ell([s * 0.1, 0.03, 0.05], [0.06, 0.035, 0.08], 'wood');
    });
    const body = m.group();
    m.ell([0, 0.3, 0], [0.16, 0.08, 0.12], 'side', [0, 0, 0], body); // kilt
    m.ell([0, 0.46 + lift * 0.5, 0], [0.18 * swell, 0.15, 0.13 * swell], 'side', [0, 0, 0], body);
    m.ell([0, 0.33, 0], [0.165, 0.025, 0.125], 'wood'); // belt
    m.ell([0, 0.33, 0.12], [0.03, 0.03, 0.01], 'gold');
    // arms
    both((s) => arm(m, [s * 0.19, 0.55 + lift, 0], [s * 0.26, 0.4 + lift, 0.03], [s * 0.25, 0.27 + lift, 0.06], 0.055, 'skin', 'skin', 0.055));
    const hc: V3 = [0, 0.68 + lift, 0.03];
    m.ball(hc, 0.11, 'skin');
    eyes(m, hc, 0.11, 'beast', 'iris', 0.4, 0.0);
    // wild: thundercloud hair and cloud beard
    const cloud = m.group();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      m.ball(add(hc, [Math.cos(a) * 0.12, 0.08 + Math.sin(a * 2) * 0.02, Math.sin(a) * 0.09 - 0.03]), 0.065, 'cloud', cloud);
    }
    m.ball(add(hc, [0, 0.15, -0.02]), 0.08, 'cloud', cloud);
    const beard = m.group();
    m.ell(add(hc, [0, -0.08, 0.06]), [0.1, 0.08, 0.06], 'cloud', [0, 0, 0], beard);
    m.ball(add(hc, [0, -0.15, 0.06]), 0.05, 'cloud', beard);
    const f = p.frame % 2;
    m.tube([add(hc, [0.1, 0.18, 0.0]), add(hc, [0.14, 0.12, 0.02]), add(hc, [0.11, 0.08, 0.04]), add(hc, [0.17, 0.0 + f * 0.02, 0.05])], [0.014, 0.012, 0.01, 0.006], 'spark*');
    m.tube([add(hc, [-0.1, 0.2, -0.02]), add(hc, [-0.15, 0.15, 0.0]), add(hc, [-0.12, 0.1, 0.02])], [0.012, 0.01, 0.006], 'spark*');
  },
};

// Djinn: a genie whose body tapers into a swirl of smoke, with gold bands and
// a Side-coloured vest and sash. Wild: four arms and a lamp-crown with a flame.
AIR.djinn = {
  palette: { skin: '#8fd0e0', glow: '#ffe46a', hair: '#2c2836' },
  build(m, p) {
    const { swell, lift } = breathe(p);
    // smoke tail spiralling down to the lamp-point
    const smoke = m.group();
    const pts: V3[] = [];
    const radii: number[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const a = t * 5 + p.frame * 0.4;
      pts.push([Math.sin(a) * 0.08 * t, 0.36 - t * 0.33, Math.cos(a) * 0.05 * t]);
      radii.push(0.12 * (1 - t) + 0.02);
    }
    m.tube(pts, radii, 'cloud', smoke);
    m.ell([0, 0.36, 0], [0.13, 0.06, 0.1], 'side', [0, 0, 0]); // sash
    // torso
    const body = m.group();
    m.ell([0, 0.5 + lift * 0.5, 0], [0.15 * swell, 0.13, 0.1 * swell], 'skin', [0, 0, 0], body);
    both((s) => m.ell([s * 0.09, 0.53 + lift * 0.5, 0.02], [0.07, 0.11, 0.09], 'side', [0, 0, s * 0.2])); // open vest
    // four arms with gold bands
    both((s) => {
      arm(m, [s * 0.15, 0.58 + lift, 0], [s * 0.27, 0.62 + lift, 0.02], [s * 0.3, 0.74 + lift, 0.04], 0.035, 'skin', 'skin', 0.035);
      m.ball([s * 0.27, 0.62 + lift, 0.02], 0.04, 'gold');
      arm(m, [s * 0.14, 0.47 + lift, 0], [s * 0.24, 0.4 + lift, 0.05], [s * 0.2, 0.33 + lift, 0.11], 0.032, 'skin', 'skin', 0.032);
      m.ball([s * 0.24, 0.4 + lift, 0.05], 0.036, 'gold');
    });
    const hc: V3 = [0, 0.71 + lift, 0.02];
    m.ball(hc, 0.11, 'skin');
    m.eye(add(hc, [0.042, 0.0, 0.1]), [0.35, 0, 1], 'glow', 'glow');
    m.eye(add(hc, [-0.042, 0.0, 0.1]), [-0.35, 0, 1], 'glow', 'glow');
    mouthAt(m, hc, 0.11, -0.5);
    m.ell(add(hc, [0, -0.08, 0.05]), [0.04, 0.05, 0.04], 'hair'); // goatee
    // topknot and lamp-crown
    m.tube([add(hc, [0, 0.08, -0.04]), add(hc, [0, 0.14, -0.1]), add(hc, [0.0, 0.1, -0.2]), add(hc, [0.02, 0.0, -0.22])], [0.04, 0.035, 0.025, 0.008], 'hair');
    const crown = m.group();
    m.ell(add(hc, [0, 0.1, 0]), [0.1, 0.03, 0.09], 'gold', [0, 0, 0], crown);
    m.tube([add(hc, [0, 0.12, 0.06]), add(hc, [0, 0.14, 0.12]), add(hc, [0, 0.13, 0.16])], [0.03, 0.02, 0.01], 'gold', crown);
    flame(m, add(hc, [0, 0.14, 0.15]), 0.08, 0.025, p, 3);
  },
};
