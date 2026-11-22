// The thirty Summoners, part 2: casters, spirits and demi-humans.

import { type Model, type Pose, type V3, add } from './model';
import { both, eyes, figure, flick, membrane, mouthAt } from './kit';
import type { Design } from './designs';
import { face, hairCap, longHair } from './people';

const S: Record<string, Design> = {};

/** A serpent's tail from the waist, curling round on the ground. */
function serpentTail(m: Model, p: Pose, waistY: number, mat: string, belly: string, r0 = 0.08) {
  const pts: V3[] = [[0, waistY - 0.02, 0], [0, waistY - 0.12, 0.02], [0.02, 0.06, 0.06]];
  for (let i = 0; i < 7; i++) {
    const a = 1.2 + i * 0.75 + flick(p, 9, 0.05);
    pts.push([Math.cos(a) * (0.16 - i * 0.012), 0.045, Math.sin(a) * (0.13 - i * 0.01) - 0.02]);
  }
  const radii = pts.map((_, i) => Math.max(0.012, r0 * (1 - i / pts.length) + 0.01));
  const g = m.group();
  m.tube(pts, radii, mat, g);
  m.tube(pts.slice(0, 3).map((q) => add(q, [0, 0, 0.03])), [r0 * 0.7, r0 * 0.65, r0 * 0.5], belly, g);
  return pts;
}

/** A floating figure's tattered hem in place of legs. */
function wispHem(m: Model, p: Pose, y: number, mat: string, w = 0.12) {
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + p.frame * 0.2;
    m.spike([Math.sin(a) * w * 0.7, y, Math.cos(a) * w * 0.6], [Math.sin(a) * w * 1.1, y - 0.12 - (i % 2) * 0.04, Math.cos(a) * w * 0.9], 0.035, mat);
  }
}

// ------------------------------------------------------------ casters

// Magus — accent violet. A long-bearded archmage in a Side-coloured robe and
// a pointed hat, with a staff. Signature: an open grimoire floating before
// him, runes orbiting behind his head.
S.magus = {
  palette: { accent: '#b98cff', hair: '#e9e4f5', iris: '#8a5cff', paper: '#f4ead0' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'side',
      skirt: { mat: 'side', len: 0.27, flare: 1.0, hem: 'gold' },
      shoulders: 0.1,
      waistY: 0.28,
      headR: 0.125,
      arms: (s) => (s > 0 ? [[0.05, -0.08, 0.05], [0.07, -0.12, 0.12]] : [[-0.07, -0.05, 0.06], [-0.06, 0.0, 0.14]]),
    });
    const { hc, r, waistY, lift } = f;
    m.ell([0, waistY + 0.03, 0.0], [0.068, 0.018, 0.055], 'gold');
    m.poly([[-0.1, waistY + 0.17 + lift, -0.05], [0.1, waistY + 0.17 + lift, -0.05], [0.15, 0.03, -0.12], [0, 0.01, -0.14], [-0.15, 0.03, -0.12]], 'side2');
    eyes(m, hc, r, 'anime', 'iris', 0.4, -0.12);
    m.ell(add(hc, [0, 0.03, 0.1]), [0.08, 0.015, 0.03], 'hair'); // brows
    // long beard
    const beard = m.group();
    m.ell(add(hc, [0, -0.07, 0.07]), [0.085, 0.07, 0.06], 'hair', [0, 0, 0], beard);
    m.tube([add(hc, [0, -0.11, 0.08]), add(hc, [0.0, -0.24, 0.1]), add(hc, [0.02, -0.33, 0.09])], [0.055, 0.04, 0.01], 'hair', beard);
    // hat
    const hat = m.group();
    m.ell(add(hc, [0, 0.085, -0.03]), [0.21, 0.02, 0.18], 'side2', [-0.35, 0, 0], hat);
    m.tube([add(hc, [0, 0.09, -0.04]), add(hc, [0, 0.2, -0.07]), add(hc, [0.0, 0.3, -0.13]), add(hc, [0.05, 0.34, -0.21])], [0.105, 0.07, 0.037, 0.012], 'side2', hat);
    m.ell(add(hc, [0, 0.11, -0.04]), [0.108, 0.02, 0.1], 'gold', [-0.35, 0, 0]);
    // staff
    const hand: V3 = [0.17, waistY + 0.02 + lift, 0.12];
    m.tube([[0.18, 0.02, 0.13], add(hand, [0, 0.3, -0.01]), add(hand, [-0.01, 0.46, -0.02])], [0.015, 0.016, 0.019], 'wood');
    m.ball(add(hand, [-0.01, 0.5 + flick(p, 1, 0.006), -0.02]), 0.04, 'accent*');
    // signature: floating open grimoire
    const bc: V3 = [-0.12, waistY + 0.2 + lift + flick(p, 2, 0.012), 0.2];
    both((s) => {
      m.poly([add(bc, [0, -0.04, 0]), add(bc, [s * 0.1, -0.03, -0.02]), add(bc, [s * 0.1, 0.06, -0.02]), add(bc, [0, 0.05, 0])], 'paper');
      m.poly([add(bc, [0, -0.045, -0.006]), add(bc, [s * 0.105, -0.035, -0.026]), add(bc, [s * 0.105, 0.065, -0.026]), add(bc, [0, 0.055, -0.006])], 'side2');
    });
    for (let i = 0; i < 3; i++) m.ell(add(bc, [-0.05 + i * 0.05, 0.1 + i * 0.03 + flick(p, i + 3, 0.01), 0.0]), [0.012, 0.018, 0.004], 'accent*', [0, 0, i]);
    // runes orbiting behind the head
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + p.frame * 0.25;
      m.ell(add(hc, [Math.cos(a) * 0.2, Math.sin(a) * 0.2, -0.17]), [0.02, 0.032, 0.01], 'accent*', [0, 0, a]);
    }
  },
};

// Oracle — accent pale cyan. A blindfolded seer in a star-dotted
// Side-coloured robe. Signature: a third eye blazing on her brow, and a
// crystal ball floating between her hands.
S.oracle = {
  palette: { accent: '#b8f4ff', iris: '#8ad8ff', hair: '#f0f0ff', skin: '#f4dccc', brass: '#d8a848' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'side',
      skirt: { mat: 'side', len: 0.27, flare: 1.0, hem: 'brass' },
      shoulders: 0.09,
      waistY: 0.28,
      headR: 0.12,
      arms: (s) => [[s * 0.04, -0.05, 0.07], [s * 0.01, -0.02, 0.15]],
    });
    const { hc, r, waistY, lift } = f;
    for (const [x, y, z] of [[0.05, 0.1, 0.13], [-0.07, 0.16, 0.12], [0.1, 0.05, 0.1], [-0.02, 0.06, 0.15]] as V3[]) m.ball([x, y, z], 0.01, 'accent*');
    mouthAt(m, hc, r, -0.55);
    longHair(m, hc, r, p, 'hair', 0.3, 3);
    // blindfold over the eyes
    m.ell(add(hc, [0, -0.005, 0.0]), [r * 1.03, 0.026, r * 1.03], 'side2', [-0.12, 0, 0]);
    m.tube([add(hc, [0.03, 0.0, -0.12]), add(hc, [0.07, -0.1, -0.15])], [0.014, 0.008], 'side2');
    // signature: third eye
    m.eye(add(hc, [0, 0.06, r * 0.95]), [0, 0.35, 1], 'glow', 'accent');
    // crystal ball between the hands
    const bc: V3 = [0, waistY + 0.13 + lift + flick(p, 1, 0.008), 0.19];
    m.ball(bc, 0.05, 'crystal');
    m.ball(add(bc, [0.01, 0.005, 0.01]), 0.022, 'accent*');
    m.ell(add(bc, [0, -0.06, 0]), [0.04, 0.012, 0.04], 'brass');
  },
};

// Lich — accent soul green. A skeletal sorcerer-king in a tattered
// Side-coloured robe and a jagged crown. Signature: a green soul-gem
// phylactery floating inside his open ribcage.
S.lich = {
  palette: { accent: '#7aff6a', iris: '#7aff6a', skin: '#e8e0cc' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side2',
      sleeve: 'side',
      skirt: { mat: 'side', len: 0.26, flare: 0.8 },
      shoulders: 0.095,
      waistY: 0.28,
      headR: 0.115,
      arms: (s) => (s > 0 ? [[0.06, -0.06, 0.06], [0.08, -0.02, 0.13]] : [[-0.06, -0.04, 0.06], [-0.09, 0.03, 0.12]]),
    });
    const { hc, r, waistY, lift } = f;
    // open robe showing ribs, with the phylactery inside
    for (let i = 0; i < 4; i++) m.ell([0, waistY + 0.05 + i * 0.03 + lift * 0.5, 0.05], [0.055 - i * 0.004, 0.008, 0.03], 'bone');
    m.tube([[0, waistY, 0.04], [0, waistY + 0.17 + lift, 0.04]], [0.01, 0.01], 'bone');
    const gem: V3 = [0, waistY + 0.1 + lift + flick(p, 1, 0.006), 0.09];
    m.ell(gem, [0.025, 0.035, 0.02], 'accent*', [0, p.frame * 0.4, 0]);
    // tattered hem
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      m.spike([Math.sin(a) * 0.12, 0.04, Math.cos(a) * 0.1], [Math.sin(a) * 0.15, -0.0, Math.cos(a) * 0.12], 0.02, 'side');
    }
    // skull: glowing sockets, no nose, a toothy grin
    eyes(m, hc, r, 'glow', 'iris', 0.38, -0.12);
    mouthAt(m, hc, r, -0.55, 'fang', 0.04);
    mouthAt(m, hc, r, -0.55, 'fang', -0.04);
    // jagged crown
    m.ell(add(hc, [0, 0.07, -0.005]), [r * 1.0, 0.02, r * 0.95], 'gold');
    for (let i = 0; i < 5; i++) {
      const a = -1.0 + i * 0.5;
      m.spike(add(hc, [Math.sin(a) * r * 0.95, 0.08, Math.cos(a) * r * 0.9]), add(hc, [Math.sin(a) * r * 1.05, 0.16 + (i % 2) * 0.03, Math.cos(a) * r]), 0.016, 'gold');
    }
    m.ball(add(hc, [0, 0.1, r * 0.98]), 0.014, 'accent*');
    // soul wisps rising from the hands
    both((s) => {
      const h: V3 = s > 0 ? [0.18, waistY + 0.12 + lift, 0.13] : [-0.19, waistY + 0.17 + lift, 0.12];
      for (let i = 0; i < 3; i++) m.ball(add(h, [flick(p, i + s, 0.012), 0.03 + i * 0.035, 0]), 0.016 - i * 0.004, 'accent*');
    });
  },
};

// Witch — accent potion green. A witch in a Side-coloured dress and a tall
// crooked hat, sitting side-saddle on a floating broom. Signature: a tiny
// cauldron charm on her belt that bubbles over.
S.witch = {
  palette: { accent: '#9aff5a', iris: '#a05ae8', hair: '#2a1a3a', skin: '#f2dcd0', straw: '#d8b870' },
  build(m, p) {
    const hover = 0.1 + flick(p, 0, 0.012);
    // broom under her
    const by = hover + 0.12;
    m.tube([[0.0, by, 0.26], [0.0, by, -0.12]], [0.012, 0.012], 'wood');
    m.tube([[0, by, -0.12], [0, by, -0.2], [0, by + 0.01, -0.3]], [0.02, 0.05, 0.06], 'straw');
    m.ell([0, by, -0.12], [0.026, 0.026, 0.012], 'red');
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'side',
      skirt: { mat: 'side', len: 0.13, flare: 0.7, hem: 'dark' },
      shoulders: 0.09,
      waistY: 0.27,
      headR: 0.12,
      hover,
      arms: (s) => (s > 0 ? [[0.04, -0.07, 0.07], [0.0, -0.1, 0.14]] : [[-0.06, -0.05, 0.05], [-0.1, 0.02, 0.1]]),
    });
    const { hc, r, waistY, lift } = f;
    // legs dangling to one side
    both((s) => m.tube([[s * 0.04, by, 0.03], [0.07 + s * 0.02, by - 0.08, 0.08], [0.08 + s * 0.02, by - 0.14, 0.1]], [0.026, 0.022, 0.02], 'dark'));
    face(m, hc, r);
    longHair(m, hc, r, p, 'hair', 0.24, 2, 0);
    // tall crooked hat
    const hat = m.group();
    m.ell(add(hc, [0, 0.085, -0.03]), [0.2, 0.018, 0.17], 'dark', [-0.3, 0, 0], hat);
    m.tube([add(hc, [0, 0.09, -0.04]), add(hc, [0.01, 0.2, -0.07]), add(hc, [-0.04, 0.3, -0.1]), add(hc, [-0.12, 0.33, -0.12])], [0.1, 0.065, 0.035, 0.012], 'dark', hat);
    m.ell(add(hc, [0, 0.11, -0.04]), [0.104, 0.02, 0.095], 'accent', [-0.3, 0, 0]);
    // signature: cauldron charm bubbling on the belt
    const cc: V3 = [-0.1, waistY - 0.02, 0.07];
    m.ell(cc, [0.035, 0.03, 0.035], 'dark');
    m.ell(add(cc, [0, 0.025, 0]), [0.03, 0.008, 0.03], 'accent*');
    for (let i = 0; i < 3; i++) m.ball(add(cc, [flick(p, i, 0.01), 0.05 + i * 0.03 + ((p.frame + i) % 3) * 0.01, 0]), 0.012 - i * 0.002, 'accent*');
    // wand
    m.tube([[-0.21, waistY + 0.16 + lift, 0.1], [-0.25, waistY + 0.26 + lift, 0.12]], [0.008, 0.005], 'wood');
    m.ball([-0.255, waistY + 0.275 + lift, 0.12], 0.012, 'accent*');
    void hairCap;
  },
};

// Warlock — accent hellfire magenta. A hooded pact-mage in a Side-coloured
// robe. Signature: a cape of shadow tentacles and a staff topped by a
// demon's open eye.
S.warlock = {
  palette: { accent: '#ff4ad8', iris: '#ff4ad8', hair: '#2a2030', skin: '#e8d0c8' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'side',
      skirt: { mat: 'side', len: 0.26, flare: 0.8 },
      shoulders: 0.095,
      waistY: 0.27,
      headR: 0.12,
      arms: (s) => (s > 0 ? [[0.05, -0.07, 0.06], [0.06, -0.1, 0.13]] : [[-0.06, -0.03, 0.06], [-0.1, 0.03, 0.12]]),
    });
    const { hc, r, waistY, lift } = f;
    // shadow tentacles from the back
    for (let i = 0; i < 5; i++) {
      const s = i - 2;
      const pts: V3[] = [];
      for (let k = 0; k < 5; k++) pts.push([s * 0.04 + s * k * 0.035 + flick(p, i * 5 + k, 0.015), waistY + 0.15 + lift - k * 0.06 + Math.abs(s) * k * 0.01, -0.08 - k * 0.04]);
      m.tube(pts, [0.03, 0.027, 0.022, 0.015, 0.006], 'dark');
    }
    eyes(m, hc, r, 'glow', 'iris', 0.4, -0.15);
    mouthAt(m, hc, r, -0.55);
    // deep hood
    const hood = m.group();
    m.ell(add(hc, [0, 0.03, -0.035]), [r * 1.25, r * 1.15, r * 1.1], 'side2', [0.15, 0, 0], hood);
    m.spike(add(hc, [0, 0.12, -0.05]), add(hc, [0, 0.2, -0.14]), 0.05, 'side2', hood);
    // demon-eye staff
    const hand: V3 = [0.17, waistY + 0.04 + lift, 0.13];
    m.tube([[0.18, 0.02, 0.14], add(hand, [0, 0.3, 0])], [0.014, 0.016], 'dark');
    const ec = add(hand, [0, 0.36, 0]);
    both((s) => m.tube([add(ec, [s * 0.02, -0.04, 0]), add(ec, [s * 0.06, 0.02, 0]), add(ec, [s * 0.03, 0.07, 0])], [0.01, 0.009, 0.003], 'dark'));
    m.ball(ec, 0.035, 'white');
    m.eye(add(ec, [0, 0, 0.032]), [0, 0, 1], 'slit', 'accent');
  },
};

// Seraph — accent sunlight; Day. A six-winged angel in a white and
// Side-coloured robe. Signature: a halo of small suns.
S.seraph = {
  palette: { accent: '#ffe86a', iris: '#e8a020', hair: '#fff0c0', skin: '#f8e4d4' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'white',
      sleeve: 'white',
      skirt: { mat: 'side', len: 0.25, flare: 0.8, hem: 'gold' },
      shoulders: 0.09,
      waistY: 0.3,
      headR: 0.12,
      hover: 0.03,
      arms: (s) => (s > 0 ? [[0.05, -0.04, 0.07], [0.04, 0.03, 0.13]] : [[-0.05, -0.04, 0.07], [-0.04, 0.03, 0.13]]),
    });
    const { hc, r, waistY, lift } = f;
    // six wings: three pairs, upper, middle, lower
    both((s) => {
      for (let k = 0; k < 3; k++) {
        const root: V3 = [s * 0.04, waistY + 0.17 + lift - k * 0.04, -0.07];
        const up = 0.02 * p.breath * (k === 1 ? -1 : 1);
        const dy = [0.22, 0.04, -0.16][k];
        membrane(m, root, [add(root, [s * 0.1, dy + 0.06 + up, -0.03]), add(root, [s * 0.24, dy + up, -0.05]), add(root, [s * 0.2, dy - 0.07 + up, -0.04]), add(root, [s * 0.08, dy * 0.4 - 0.04, -0.02])], k === 1 ? 'white' : 'cloud');
      }
    });
    face(m, hc, r);
    longHair(m, hc, r, p, 'hair', 0.24, 3);
    // signature: halo of small suns
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + p.frame * 0.3;
      m.ball(add(hc, [Math.cos(a) * 0.13, 0.17 + Math.sin(a) * 0.03, Math.sin(a) * 0.1 - 0.02]), 0.018, 'accent*');
    }
    // light gathered between the hands
    m.ball([0, waistY + 0.14 + lift + flick(p, 1, 0.006), 0.18], 0.03, 'accent*');
  },
};

// Banshee — accent soulfire blue; Night. A ghostly woman floating in a
// tattered Side-coloured gown, mouth open in a wail. Signature: streaming
// white hair and a lantern of blue soulfire.
S.banshee = {
  palette: { accent: '#5ab4ff', iris: '#5ab4ff', hair: '#f4f6ff', skin: '#c8d8f0' },
  build(m, p) {
    const hover = 0.08 + flick(p, 0, 0.012);
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'side',
      skirt: { mat: 'side', len: 0.18, flare: 0.7 },
      shoulders: 0.09,
      waistY: 0.27,
      headR: 0.12,
      hover,
      arms: (s) => (s > 0 ? [[0.05, -0.07, 0.06], [0.05, -0.12, 0.13]] : [[-0.08, 0.0, 0.03], [-0.13, 0.06, 0.06]]),
    });
    const { hc, r, waistY, lift } = f;
    wispHem(m, p, hover + 0.1, 'side2', 0.13);
    eyes(m, hc, r, 'glow', 'iris', 0.4, -0.15);
    m.mouth(add(hc, [0, -0.06, r * 0.9]), [0, -0.3, 1], 'fang');
    // signature: hair streaming up and back as if in a gale
    const hair = hairCap(m, hc, r, 'hair', false);
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.05;
      const w = flick(p, i, 0.02);
      m.tube([add(hc, [x, 0.02, -0.09]), add(hc, [x * 1.5 + w, 0.08, -0.2]), add(hc, [x * 1.8 - w, 0.14, -0.31])], [0.028, 0.02, 0.005], 'hair', hair);
    }
    // soulfire lantern
    const hand: V3 = [0.15, f.waistY + 0.04 + lift, 0.14];
    m.tube([hand, add(hand, [0, -0.05, 0])], [0.006, 0.006], 'metal');
    m.ell(add(hand, [0, -0.09, 0]), [0.03, 0.04, 0.03], 'accent*');
    m.ell(add(hand, [0, -0.045, 0]), [0.034, 0.01, 0.034], 'metal');
    m.ell(add(hand, [0, -0.135, 0]), [0.034, 0.01, 0.034], 'metal');
    void waistY;
  },
};

// Vampire — accent blood red; Night. A pale noble in a Side-coloured coat
// with a long cape. Signature: a high collar of bat wings, and a goblet of
// glowing blood.
S.vampire = {
  palette: { accent: '#ff2a4a', iris: '#ff2a4a', hair: '#1a1420', skin: '#ece4ec' },
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
    m.poly([[-0.07, waistY + 0.02, 0.02], [0.07, waistY + 0.02, 0.02], [0.09, waistY - 0.15, -0.02], [-0.09, waistY - 0.15, -0.02]], 'side');
    for (let i = 0; i < 3; i++) m.ball([0.0, waistY + 0.04 + i * 0.045 + lift * 0.5, 0.065], 0.01, 'gold');
    // cape: dark outside, red lining at the hem
    m.poly([[-0.11, waistY + 0.17 + lift, -0.05], [0.11, waistY + 0.17 + lift, -0.05], [0.18, 0.02, -0.14], [0, 0.0, -0.16], [-0.18, 0.02, -0.14]], 'dark');
    m.poly([[-0.17, 0.03, -0.13], [0.17, 0.03, -0.13], [0.15, 0.06, -0.1], [-0.15, 0.06, -0.1]], 'red');
    // signature: bat-wing collar
    both((s) => membrane(m, [s * 0.03, waistY + 0.18 + lift, -0.04], [[s * 0.13, waistY + 0.38 + lift, -0.06], [s * 0.17, waistY + 0.3 + lift, -0.06], [s * 0.2, waistY + 0.24 + lift, -0.05], [s * 0.1, waistY + 0.18 + lift, -0.04]], 'side2'));
    eyes(m, hc, r, 'slit', 'iris', 0.4, -0.18);
    mouthAt(m, hc, r, -0.55, 'fang', 0.03);
    // slicked hair with a widow's peak
    const hair = m.group();
    m.ell(add(hc, [0, 0.035, -0.045]), [r * 1.05, r * 0.88, r * 0.95], 'hair', [0, 0, 0], hair);
    m.ell(add(hc, [0, 0.07, 0.04]), [r * 0.9, r * 0.25, r * 0.5], 'hair', [-0.3, 0, 0], hair);
    m.spike(add(hc, [0, 0.07, r * 0.8]), add(hc, [0, 0.02, r * 1.02]), 0.03, 'hair');
    // goblet of glowing blood
    const gc: V3 = [-0.17, waistY + 0.16 + lift, 0.14];
    m.tube([add(gc, [0, -0.06, 0]), add(gc, [0, -0.02, 0])], [0.018, 0.006], 'gold');
    m.ell(add(gc, [0, 0.01, 0]), [0.03, 0.03, 0.03], 'gold');
    m.ell(add(gc, [0, 0.035, 0]), [0.025, 0.007, 0.025], 'accent*');
    m.ball(add(gc, [0.01, 0.06 + ((p.frame % 3) * 0.008), 0]), 0.007, 'accent*');
  },
};

// Regent — accent starlight. A young king in a Side-coloured tunic and an
// ermine cape, under an oversized crown. Signature: a sceptre topped by a
// star kept in a golden cage.
S.regent = {
  palette: { accent: '#fff6c8', iris: '#5a8ae8', hair: '#f0c860', skin: '#f6dac6', ermine: '#f8f6f0' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'side',
      legs: { mat: 'side2', boot: 'dark' },
      shoulders: 0.095,
      waistY: 0.24,
      headR: 0.125,
      arms: (s) => (s > 0 ? [[0.06, -0.05, 0.06], [0.06, -0.04, 0.14]] : [[-0.05, -0.08, 0.05], [-0.05, -0.15, 0.08]]),
    });
    const { hc, r, waistY, lift } = f;
    m.ell([0, waistY - 0.02, 0], [0.075, 0.06, 0.06], 'side');
    m.ell([0, waistY + 0.02, 0], [0.07, 0.016, 0.058], 'gold');
    // ermine cape
    m.poly([[-0.11, waistY + 0.17 + lift, -0.05], [0.11, waistY + 0.17 + lift, -0.05], [0.16, 0.02, -0.13], [-0.16, 0.02, -0.13]], 'red');
    m.ell([0, waistY + 0.19 + lift, -0.01], [0.12, 0.035, 0.08], 'ermine');
    for (let i = 0; i < 4; i++) m.ell([-0.08 + i * 0.055, waistY + 0.2 + lift, 0.06 - Math.abs(i - 1.5) * 0.02], [0.007, 0.012, 0.005], 'dark');
    face(m, hc, r);
    hairCap(m, hc, r);
    // oversized crown slipping over one ear
    const crown = m.group();
    m.ell(add(hc, [0, 0.1, 0]), [0.14, 0.04, 0.135], 'gold', [-0.1, 0, 0.18], crown);
    m.ell(add(hc, [0.0, 0.12, -0.01]), [0.11, 0.04, 0.1], 'red', [-0.1, 0, 0.18], crown);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const b = add(hc, [Math.sin(a) * 0.13 + 0.02, 0.13 + Math.sin(a) * 0.02, Math.cos(a) * 0.125]);
      m.spike(b, add(b, [0.01, 0.07, 0]), 0.022, 'gold');
      m.ball(add(b, [0.012, 0.075, 0]), 0.012, 'gold');
    }
    m.ball(add(hc, [0.02, 0.1, 0.14]), 0.02, 'accent*');
    // signature: caged-star sceptre
    const hand: V3 = [0.16, waistY + 0.11 + lift, 0.15];
    m.tube([add(hand, [0, -0.08, 0]), add(hand, [0, 0.22, 0])], [0.011, 0.013], 'gold');
    const sc = add(hand, [0, 0.29, 0]);
    m.ball(sc, 0.03 + 0.004 * Math.max(0, flick(p, 1, 1)), 'accent*');
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      m.tube([add(sc, [0, -0.05, 0]), add(sc, [Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05]), add(sc, [0, 0.055, 0])], [0.005, 0.005, 0.005], 'gold');
    }
    m.ball(add(sc, [0, 0.06, 0]), 0.01, 'gold');
  },
};

// Herald — accent sky blue. A messenger in a light Side-coloured tunic and a
// feathered cap with a streaming scarf. Signature: winged boots, and a long
// golden trumpet hung with a banner.
S.herald = {
  palette: { accent: '#9ae0ff', iris: '#4ab0e0', hair: '#e8c880', skin: '#f4d6bc' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'side',
      legs: { mat: 'sideL', boot: 'gold' },
      shoulders: 0.09,
      waistY: 0.24,
      headR: 0.12,
      arms: (s) => (s > 0 ? [[0.05, -0.02, 0.07], [0.0, 0.04, 0.14]] : [[-0.06, -0.08, 0.04], [-0.06, -0.14, 0.08]]),
    });
    const { hc, r, waistY, lift } = f;
    m.ell([0, waistY - 0.02, 0], [0.075, 0.06, 0.06], 'side');
    m.ell([0, waistY + 0.02, 0], [0.07, 0.016, 0.058], 'gold');
    face(m, hc, r);
    const hair = hairCap(m, hc, r);
    m.tube([add(hc, [-0.04, 0.02, -0.1]), add(hc, [-0.14, 0.0, -0.12]), add(hc, [-0.2, 0.03, -0.1])], [0.04, 0.025, 0.008], 'hair', hair);
    m.ell(add(hc, [0, 0.08, -0.01]), [r * 0.95, r * 0.45, r * 0.9], 'side2', [-0.2, 0, 0.15]);
    m.tube([add(hc, [0.06, 0.12, -0.02]), add(hc, [0.0, 0.22, -0.1]), add(hc, [-0.1, 0.26, -0.16])], [0.018, 0.016, 0.006], 'white');
    // golden trumpet with a hanging banner
    const hand: V3 = [0.12, waistY + 0.18 + lift, 0.14];
    const bell = add(hand, [0.1, 0.06, 0.1]);
    m.tube([add(hand, [-0.05, 0.02, -0.03]), hand, bell], [0.008, 0.012, 0.014], 'gold');
    m.tube([bell, add(bell, [0.03, 0.015, 0.03])], [0.016, 0.04], 'gold');
    const w = flick(p, 0, 0.01);
    m.poly([add(hand, [0.02, -0.005, 0.02]), add(hand, [0.08, 0.03, 0.08]), add(hand, [0.09 + w, -0.07, 0.08]), add(hand, [0.05, -0.05, 0.05]), add(hand, [0.03 - w, -0.08, 0.03])], 'side');
    m.ell(add(hand, [0.055, -0.02, 0.055]), [0.014, 0.014, 0.004], 'gold');
    // streaming scarf
    m.tube([[0, waistY + 0.18 + lift, 0.02], [-0.1, waistY + 0.16 + lift, -0.04], [-0.22, waistY + 0.18 + w, -0.06], [-0.32, waistY + 0.13 - w, -0.06]], [0.025, 0.022, 0.018, 0.008], 'accent');
    // signature: winged boots
    both((s) => {
      const heel: V3 = [s * 0.05, 0.04, -0.02];
      const up = 0.02 * p.breath;
      membrane(m, heel, [add(heel, [s * 0.07, 0.07 + up, -0.04]), add(heel, [s * 0.1, 0.03 + up, -0.06]), add(heel, [s * 0.06, 0.0, -0.05])], 'white');
    });
  },
};

// Satyr — accent spring green. A goat-legged piper with curling horns and a
// Side-coloured sash. Signature: panpipes that puff glowing musical notes.
S.satyr = {
  palette: { accent: '#b8ff6a', iris: '#d89a2a', hair: '#8a5a3a', skin: '#f0cca8', fur: '#7a5a3a' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'skin',
      shoulders: 0.09,
      waistY: 0.26,
      headR: 0.12,
      arms: (s) => [[s * 0.05, -0.03, 0.07], [s * 0.02, 0.05, 0.14]],
    });
    const { hc, r, waistY, lift } = f;
    // goat legs: furry thighs, backward knees, hooves
    both((s) => {
      const g = m.group();
      m.tube([[s * 0.04, waistY - 0.02, 0], [s * 0.05, 0.16, 0.05], [s * 0.05, 0.09, -0.03], [s * 0.05, 0.03, 0.0]], [0.05, 0.04, 0.025, 0.02], 'fur', g);
      m.ell([s * 0.05, 0.02, 0.015], [0.025, 0.02, 0.03], 'dark');
    });
    m.ell([0, waistY - 0.01, 0], [0.08, 0.04, 0.065], 'fur');
    m.tube([[-0.07, waistY + 0.18 + lift, 0.06], [0.07, waistY + 0.03, 0.065]], [0.014, 0.014], 'side'); // sash
    face(m, hc, r, 'iris', -0.16);
    hairCap(m, hc, r);
    both((s) => {
      m.tube([add(hc, [s * 0.06, 0.08, -0.02]), add(hc, [s * 0.13, 0.13, -0.07]), add(hc, [s * 0.15, 0.06, -0.08]), add(hc, [s * 0.12, 0.03, -0.04])], [0.022, 0.018, 0.012, 0.006], 'bone');
      m.spike(add(hc, [s * r * 0.9, 0.0, -0.02]), add(hc, [s * r * 1.6, 0.03, -0.05]), 0.022, 'skin');
    });
    // signature: panpipes at the lips, and puffs of glowing notes
    const pc = add(hc, [0, -0.1, 0.15]);
    for (let i = 0; i < 5; i++) m.tube([add(pc, [-0.04 + i * 0.02, 0.0, 0]), add(pc, [-0.04 + i * 0.02, -0.06 + i * 0.008, 0])], [0.009, 0.009], 'wood');
    for (let i = 0; i < 3; i++) {
      const n = add(hc, [0.12 + i * 0.06, 0.02 + i * 0.07 + flick(p, i, 0.015), 0.1]);
      m.ell(n, [0.016, 0.012, 0.006], 'accent*', [0, 0, 0.4]);
      m.tube([add(n, [0.012, 0, 0]), add(n, [0.012, 0.045, 0])], [0.004, 0.004], 'accent*');
    }
  },
};

// Sylph — accent wind white; Air. A wind maiden floating barefoot in a
// light Side-coloured shift. Signature: dragonfly wings, and ribbons that
// float upward as if gravity forgot her.
S.sylph = {
  palette: { accent: '#d8fff8', iris: '#5ad8c8', hair: '#a8f0e0', skin: '#f6e4dc', wing: '#c8f4ff' },
  build(m, p) {
    const hover = 0.07 + flick(p, 0, 0.012);
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'skin',
      skirt: { mat: 'sideL', len: 0.17, flare: 0.6 },
      shoulders: 0.085,
      waistY: 0.27,
      headR: 0.12,
      hover,
      arms: (s) => [[s * 0.07, 0.0, 0.03], [s * 0.12, 0.06, 0.05]],
    });
    const { hc, r, waistY, lift } = f;
    both((s) => m.tube([[s * 0.03, hover + 0.12, 0], [s * 0.04, hover + 0.04, 0.02], [s * 0.04, hover - 0.02, -0.02]], [0.024, 0.02, 0.016], 'skin'));
    // signature: four dragonfly wings
    both((s) => {
      for (const [dy, len] of [[0.05, 0.27], [-0.04, 0.22]] as const) {
        const root: V3 = [s * 0.03, waistY + 0.15 + lift + dy * 0.3, -0.07];
        const tip: V3 = add(root, [s * len, dy * 2 + 0.03 * p.breath, -0.03]);
        m.ell([(root[0] + tip[0]) / 2, (root[1] + tip[1]) / 2, (root[2] + tip[2]) / 2], [len * 0.52, 0.035, 0.005], 'wing*', [0, 0, Math.atan2(tip[1] - root[1], tip[0] - root[0])]);
      }
    });
    face(m, hc, r);
    longHair(m, hc, r, p, 'hair', 0.18, 2, 0.06);
    // ribbons floating up
    for (let k = 0; k < 3; k++) {
      const x = (k - 1) * 0.08;
      const pts: V3[] = [];
      for (let i = 0; i < 5; i++) pts.push([x + Math.sin(i + p.frame * 0.6 + k) * 0.03, waistY + i * 0.07 - 0.02, 0.03 - i * 0.03]);
      m.tube(pts, [0.012, 0.012, 0.011, 0.009, 0.004], k === 1 ? 'accent' : 'side');
    }
  },
};

// Naga — accent cobra gold. A serpent prince: a man to the waist and a
// great scaled tail below. Signature: a cobra's hood flaring behind his
// head, and a trident.
S.naga = {
  palette: { accent: '#ffd84a', iris: '#e8c020', hair: '#1a2a20', skin: '#d8c09a', scale: '#4a8a5a', belly: '#e8d8a0' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'skin',
      sleeve: 'skin',
      shoulders: 0.1,
      waistY: 0.3,
      headR: 0.12,
      arms: (s) => (s > 0 ? [[0.06, -0.06, 0.05], [0.06, -0.06, 0.13]] : [[-0.05, -0.08, 0.05], [-0.05, -0.12, 0.1]]),
    });
    const { hc, r, waistY, lift } = f;
    serpentTail(m, p, waistY, 'scale', 'belly', 0.085);
    m.ell([0, waistY + 0.01, 0], [0.075, 0.025, 0.065], 'side');
    m.ell([0, waistY + 0.19 + lift, 0.01], [0.08, 0.03, 0.065], 'gold'); // gold collar
    // signature: cobra hood
    const hood = m.group();
    m.ell(add(hc, [0, 0.0, -0.08]), [0.2, 0.22, 0.03], 'side', [0.1, 0, 0], hood);
    m.ell(add(hc, [0, 0.0, -0.065]), [0.15, 0.17, 0.02], 'belly', [0.1, 0, 0], hood);
    both((s) => m.ell(add(hc, [s * 0.09, 0.05, -0.05]), [0.025, 0.02, 0.005], 'accent'));
    eyes(m, hc, r, 'slit', 'iris', 0.4, -0.18);
    mouthAt(m, hc, r, -0.55);
    hairCap(m, hc, r);
    // trident
    const hand: V3 = [0.17, waistY + 0.04 + lift, 0.14];
    m.tube([[0.18, 0.04, 0.15], add(hand, [0, 0.36, 0])], [0.01, 0.011], 'gold');
    const top = add(hand, [0, 0.36, 0]);
    m.tube([add(top, [-0.05, 0.0, 0]), add(top, [0.05, 0.0, 0])], [0.01, 0.01], 'gold');
    for (const x of [-0.05, 0, 0.05]) m.spike(add(top, [x, 0, 0]), add(top, [x, x === 0 ? 0.1 : 0.07, 0]), 0.012, 'gold');
  },
};

// Lamia — accent amethyst. A sorceress with a jewel-scaled serpent tail
// coiled beneath her and long dark hair. Signature: a golden staff shaped
// like a rearing snake with gem eyes.
S.lamia = {
  palette: { accent: '#c87aff', iris: '#c87aff', hair: '#2a1a3a', skin: '#f4d8c8', scale: '#7a4ab8', belly: '#e8c8f0' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'skin',
      shoulders: 0.088,
      waistY: 0.29,
      headR: 0.12,
      arms: (s) => (s > 0 ? [[0.05, -0.07, 0.05], [0.06, -0.07, 0.13]] : [[-0.06, -0.04, 0.06], [-0.08, 0.02, 0.12]]),
    });
    const { hc, r, waistY, lift } = f;
    const tail = serpentTail(m, p, waistY, 'scale', 'belly', 0.075);
    for (let i = 3; i < tail.length; i += 2) m.ball(add(tail[i], [0, 0.035, 0]), 0.01, 'accent*'); // jewels on the scales
    m.ell([0, waistY + 0.01, 0], [0.07, 0.02, 0.06], 'gold');
    face(m, hc, r, 'iris', -0.18);
    longHair(m, hc, r, p, 'hair', 0.32, 3);
    m.ball(add(hc, [0, 0.08, r * 0.9]), 0.014, 'accent*'); // circlet gem
    m.ell(add(hc, [0, 0.07, 0.0]), [r * 1.02, 0.012, r * 0.96], 'gold', [-0.2, 0, 0]);
    // signature: snake staff
    const hand: V3 = [0.16, waistY + 0.04 + lift, 0.13];
    const pts: V3[] = [[0.17, 0.06, 0.14]];
    for (let i = 1; i <= 6; i++) pts.push(add(hand, [Math.sin(i * 1.4) * 0.025, -0.06 + i * 0.06, 0]));
    m.tube(pts, pts.map((_, i) => 0.012 + i * 0.0015), 'gold');
    const head = add(hand, [0.03, 0.33, 0.03]);
    m.ell(head, [0.026, 0.022, 0.04], 'gold', [0.3, 0, 0]);
    m.ball(add(head, [0.012, 0.012, 0.025]), 0.007, 'accent*');
    m.ball(add(head, [-0.012, 0.012, 0.025]), 0.007, 'accent*');
    m.tube([add(head, [0, -0.01, 0.04]), add(head, [0, -0.02, 0.07])], [0.003, 0.002], 'red');
  },
};

// Selkie — accent sea-foam; Water. A seal-folk girl in a Side-coloured
// shift, holding a great pearl. Signature: her seal-skin worn as a hooded
// cloak, the seal's face peering from the top of the hood.
S.selkie = {
  palette: { accent: '#9affea', iris: '#3a8ac8', hair: '#4a5a6a', skin: '#f0dcd4', seal: '#8a96a4', sealL: '#c8d0d8' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      skirt: { mat: 'side', len: 0.26, flare: 0.9, hem: 'pearl' },
      shoulders: 0.085,
      waistY: 0.28,
      headR: 0.115,
      arms: (s) => [[s * 0.04, -0.05, 0.07], [s * 0.01, -0.02, 0.15]],
    });
    const { hc, r, waistY, lift } = f;
    // seal-skin cloak down the back, with flippers at the hem
    m.poly([[-0.1, waistY + 0.17 + lift, -0.06], [0.1, waistY + 0.17 + lift, -0.06], [0.15, 0.03, -0.13], [-0.15, 0.03, -0.13]], 'seal');
    both((s) => m.ell([s * 0.12, 0.04, -0.12], [0.045, 0.02, 0.06], 'seal', [0, s * 0.6, 0]));
    face(m, hc, r);
    longHair(m, hc, r, p, 'hair', 0.22, 2);
    // signature: seal-head hood
    const hood = m.group();
    m.ell(add(hc, [0, 0.04, -0.03]), [r * 1.2, r * 1.0, r * 1.1], 'seal', [0.1, 0, 0], hood);
    const sh = add(hc, [0, 0.13, 0.05]);
    m.ell(sh, [0.06, 0.045, 0.06], 'seal', [0, 0, 0], hood);
    m.ell(add(sh, [0, -0.015, 0.05]), [0.03, 0.022, 0.025], 'sealL');
    m.ball(add(sh, [0, -0.005, 0.072]), 0.009, 'dark');
    both((s) => m.eye(add(sh, [s * 0.026, 0.015, 0.045]), [s * 0.4, 0.2, 1], 'dot', 'dark'));
    both((s) => m.tube([add(sh, [s * 0.015, -0.02, 0.065]), add(sh, [s * 0.06, -0.025, 0.07])], [0.002, 0.002], 'white'));
    // great pearl held in both hands
    const pc: V3 = [0, waistY + 0.13 + lift + flick(p, 1, 0.006), 0.19];
    m.ball(pc, 0.045, 'pearl');
    m.ball(add(pc, [0.015, 0.015, 0.03]), 0.012, 'accent*');
    // a ring of droplets
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + p.frame * 0.35;
      m.ball([Math.cos(a) * 0.24, 0.2 + Math.sin(a * 2) * 0.03, Math.sin(a) * 0.18], 0.016, i % 2 ? 'accent*' : 'water');
    }
  },
};

// Hermit — accent lantern amber. A hunched old hermit in a patched
// Side-coloured cloak with a long beard. Signature: a huge spotted mushroom
// cap for a hat, and a lantern swinging from a crooked staff.
S.hermit = {
  palette: { accent: '#ffc04a', iris: '#8a6a3a', hair: '#e8e4dc', skin: '#e0c4a4', cap: '#d8443a' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'side',
      skirt: { mat: 'side', len: 0.24, flare: 0.8 },
      shoulders: 0.1,
      waistY: 0.25,
      headR: 0.12,
      arms: (s) => (s > 0 ? [[0.05, -0.04, 0.07], [0.06, 0.02, 0.13]] : [[-0.06, -0.08, 0.04], [-0.06, -0.14, 0.08]]),
    });
    const { hc, r, waistY, lift } = f;
    m.ell([-0.04, waistY + 0.08, 0.07], [0.03, 0.03, 0.01], 'side2'); // patch
    m.ell([0, waistY + 0.03, 0], [0.07, 0.018, 0.058], 'wood');
    eyes(m, hc, r, 'anime', 'iris', 0.4, -0.12);
    m.ball(add(hc, [0, -0.02, r * 0.95]), 0.022, 'skin');
    const beard = m.group();
    m.ell(add(hc, [0, -0.07, 0.06]), [0.085, 0.07, 0.06], 'hair', [0, 0, 0], beard);
    m.tube([add(hc, [0, -0.11, 0.08]), add(hc, [0.02, -0.2, 0.09]), add(hc, [0.0, -0.26, 0.08])], [0.05, 0.035, 0.01], 'hair', beard);
    // signature: mushroom cap
    const cap = m.group();
    m.ell(add(hc, [0, 0.09, -0.01]), [0.22, 0.1, 0.2], 'cap', [-0.1, 0, 0], cap);
    m.ell(add(hc, [0, 0.05, -0.0]), [0.18, 0.03, 0.17], 'cloth', [-0.1, 0, 0], cap);
    for (const [x, y, z] of [[0.08, 0.15, 0.08], [-0.1, 0.13, 0.06], [0.0, 0.18, -0.02], [0.13, 0.1, -0.05], [-0.05, 0.16, 0.12]] as V3[]) m.ell(add(hc, [x, y, z]), [0.025, 0.012, 0.025], 'cloth');
    // crooked staff with a hanging lantern
    const hand: V3 = [0.17, waistY + 0.16 + lift, 0.14];
    m.tube([[0.2, 0.02, 0.15], add(hand, [0.01, 0.06, 0]), add(hand, [-0.02, 0.18, 0]), add(hand, [0.05, 0.24, 0.0]), add(hand, [0.1, 0.22, 0])], [0.015, 0.016, 0.015, 0.013, 0.01], 'bark');
    const sw = flick(p, 2, 0.015);
    const lc = add(hand, [0.1 + sw, 0.12, 0]);
    m.tube([add(hand, [0.1, 0.22, 0]), add(lc, [0, 0.05, 0])], [0.003, 0.003], 'dark');
    m.ell(lc, [0.028, 0.038, 0.028], 'accent*');
    m.ell(add(lc, [0, 0.042, 0]), [0.03, 0.01, 0.03], 'metal');
    m.ell(add(lc, [0, -0.042, 0]), [0.03, 0.01, 0.03], 'metal');
    // little mushrooms on the shoulders
    both((s) => {
      const sh: V3 = [s * 0.1, waistY + 0.2 + lift, 0.0];
      m.tube([sh, add(sh, [0, 0.03, 0])], [0.007, 0.007], 'cloth');
      m.ell(add(sh, [0, 0.035, 0]), [0.025, 0.013, 0.025], 'cap');
    });
  },
};

// Shadow — accent violet glow. A masked ninja whose body is living shadow
// in a Side-coloured scarf. Signature: a crescent kunai, and wisps of
// darkness peeling off as it moves.
S.shadow = {
  palette: { accent: '#c88aff', iris: '#e8c8ff', skin: '#3a3048' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'dark',
      sleeve: 'dark',
      legs: { mat: 'dark', boot: 'dark' },
      shoulders: 0.09,
      waistY: 0.24,
      headR: 0.115,
      arms: (s) => (s > 0 ? [[0.07, -0.02, 0.05], [0.1, 0.03, 0.12]] : [[-0.06, -0.08, 0.05], [-0.04, -0.12, 0.11]]),
    });
    const { hc, r, waistY, lift } = f;
    m.ell([0, waistY + 0.02, 0], [0.065, 0.016, 0.054], 'side');
    // Side-coloured scarf with long tails
    m.ell([0, waistY + 0.2 + lift, 0.0], [0.07, 0.03, 0.065], 'side');
    const w = flick(p, 0, 0.02);
    m.tube([[0, waistY + 0.2 + lift, -0.05], [-0.08, waistY + 0.18 + lift, -0.12], [-0.2, waistY + 0.2 + w, -0.16], [-0.3, waistY + 0.16 - w, -0.16]], [0.022, 0.02, 0.016, 0.006], 'side');
    // mask covering the lower face; glowing eyes
    m.ell(add(hc, [0, 0.02, -0.01]), [r * 1.05, r * 1.0, r * 1.0], 'dark');
    m.ell(add(hc, [0, -0.04, 0.03]), [r * 1.0, r * 0.55, r * 0.95], 'side2');
    m.eye(add(hc, [0.04, 0.02, r * 0.95]), [0.35, 0, 1], 'glow', 'iris');
    m.eye(add(hc, [-0.04, 0.02, r * 0.95]), [-0.35, 0, 1], 'glow', 'iris');
    m.tube([add(hc, [0, 0.04, -0.1]), add(hc, [0.05, 0.02, -0.2])], [0.014, 0.004], 'side');
    // signature: crescent kunai
    const hand: V3 = [0.18, waistY + 0.17 + lift, 0.12];
    const blade: V3[] = [];
    for (let i = 0; i <= 6; i++) {
      const a = -0.6 + i * 0.35;
      blade.push(add(hand, [Math.cos(a) * 0.09 - 0.05, Math.sin(a) * 0.09 + 0.03, 0.02]));
    }
    m.tube(blade, blade.map((_, i) => 0.004 + 0.012 * Math.sin((i / 6) * Math.PI)), 'accent*');
    // shadow wisps
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + p.frame * 0.4;
      m.ball([Math.cos(a) * 0.14, 0.05 + i * 0.07 + flick(p, i, 0.02), Math.sin(a) * 0.1 - 0.06], 0.03 - i * 0.003, 'dark');
    }
    void eyes;
  },
};

export const SUMMONER_DESIGNS_2 = S;
