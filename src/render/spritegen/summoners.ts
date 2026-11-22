// The thirty Summoners, part 1: the ranged ones and the fighters (casters
// and demi-humans are in summoners2.ts). Each is humanoid or demi-human,
// has a Side-coloured outfit, its own accent colour ('accent'), and one
// signature item or trait that makes it memorable.

import { type V3, add } from './model';
import { both, eyes, figure, flame, flick, membrane, mouthAt } from './kit';
import type { Design } from './designs';
import { SUMMONER_DESIGNS_2 } from './summoners2';
import { face, hairCap, longHair } from './people';

const S: Record<string, Design> = {};

// ------------------------------------------------------------ ranged

// Corsair — accent ghost green. A sky-pirate in a Side-coloured long coat
// and a tricorne, with a brass mechanical arm that ends in a spell-pistol.
// Signature: a little ghost parrot perched on the shoulder.
S.corsair = {
  palette: { accent: '#7affc8', iris: '#4ab060', hair: '#8a4a2a', skin: '#f2d2b8', brass: '#d8a848' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'side',
      legs: { mat: 'dark', boot: 'dark' },
      shoulders: 0.1,
      waistY: 0.24,
      headR: 0.12,
      arms: (s) => (s > 0 ? null : [[-0.06, -0.07, 0.05], [-0.05, -0.13, 0.1]]),
    });
    const { hc, r, waistY, lift } = f;
    // coat tails and a sash
    m.poly([[-0.08, waistY + 0.02, -0.02], [0.08, waistY + 0.02, -0.02], [0.11, waistY - 0.17, -0.06], [-0.11, waistY - 0.17, -0.06]], 'side2');
    m.ell([0, waistY + 0.02, 0], [0.072, 0.02, 0.06], 'red');
    // brass arm aiming the spell-pistol forward
    const sh: V3 = [0.11, waistY + 0.14 + lift, 0];
    m.ball(sh, 0.043, 'brass');
    m.tube([sh, [0.16, waistY + 0.1 + lift, 0.07], [0.15, waistY + 0.12 + lift, 0.15]], [0.028, 0.025, 0.024], 'brass');
    const gun: V3 = [0.15, waistY + 0.12 + lift, 0.17];
    m.ell(gun, [0.026, 0.035, 0.03], 'wood', [0.6, 0, 0]);
    m.tube([add(gun, [0, 0.02, 0.01]), add(gun, [0, 0.03, 0.12])], [0.02, 0.016], 'brass');
    m.ball(add(gun, [0, 0.03, 0.14 + flick(p, 0, 0.004)]), 0.018, 'accent*');
    face(m, hc, r);
    m.ell(add(hc, [0.05, 0.0, r * 0.93]), [0.03, 0.026, 0.008], 'dark'); // eyepatch
    hairCap(m, hc, r);
    // tricorne
    const hat = m.group();
    m.ell(add(hc, [0, 0.085, -0.01]), [0.17, 0.03, 0.15], 'dark', [-0.15, 0, 0], hat);
    m.ell(add(hc, [0, 0.12, -0.02]), [0.1, 0.06, 0.09], 'dark', [0, 0, 0], hat);
    both((s) => m.ell(add(hc, [s * 0.12, 0.11, 0.02]), [0.06, 0.04, 0.03], 'dark', [0, s * 0.6, s * 0.4]));
    m.ell(add(hc, [0, 0.1, 0.12]), [0.03, 0.025, 0.01], 'gold');
    // signature: ghost parrot on the left shoulder
    const pc: V3 = [-0.12, waistY + 0.27 + lift + flick(p, 2, 0.008), 0.0];
    const bird = m.group();
    m.ell(pc, [0.035, 0.05, 0.035], 'accent*', [0.3, 0, 0], bird);
    m.ball(add(pc, [0, 0.055, 0.015]), 0.03, 'accent*', bird);
    m.spike(add(pc, [0, 0.05, 0.04]), add(pc, [0, 0.035, 0.07]), 0.012, 'gold');
    m.eye(add(pc, [0.012, 0.062, 0.04]), [0.3, 0, 1], 'dot', 'dark');
    m.tube([add(pc, [0, -0.03, -0.02]), add(pc, [0.01, -0.09, -0.05])], [0.02, 0.004], 'accent*');
    membrane(m, add(pc, [0, 0.01, -0.01]), [add(pc, [-0.07, 0.06 + flick(p, 4, 0.02), -0.03]), add(pc, [-0.06, -0.02, -0.03])], 'accent*');
  },
};

// Lancer — accent cyan. A plumed javelin knight in light plate over a
// Side-coloured surcoat. Signature: a quiver of glowing lances on the back,
// one raised ready to throw.
S.lancer = {
  palette: { accent: '#6ae8ff', iris: '#3a7ad8', hair: '#e8d0a0', skin: '#f2d2bc' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'metal',
      sleeve: 'metal',
      legs: { mat: 'metal', boot: 'metal' },
      shoulders: 0.105,
      waistY: 0.25,
      headR: 0.12,
      arms: (s) => (s > 0 ? [[0.06, 0.04, -0.02], [0.04, 0.12, 0.02]] : [[-0.05, -0.08, 0.05], [-0.04, -0.13, 0.1]]),
    });
    const { hc, r, waistY, lift } = f;
    m.poly([[-0.07, waistY + 0.05, 0.07], [0.07, waistY + 0.05, 0.07], [0.06, waistY - 0.15, 0.06], [-0.06, waistY - 0.15, 0.06]], 'side');
    // quiver of glowing lances
    m.tube([[-0.06, waistY + 0.02, -0.09], [0.04, waistY + 0.24 + lift, -0.1]], [0.035, 0.035], 'wood');
    for (let i = 0; i < 3; i++) {
      const b: V3 = [0.02 + i * 0.03, waistY + 0.2 + lift, -0.1 - i * 0.01];
      m.tube([b, add(b, [0.05, 0.2, 0])], [0.008, 0.008], 'wood');
      m.spike(add(b, [0.05, 0.2, 0]), add(b, [0.065, 0.27, 0]), 0.016, 'accent*');
    }
    // the raised lance
    const hand: V3 = [0.15, waistY + 0.27 + lift, 0.02];
    m.tube([add(hand, [-0.02, -0.02, -0.18]), add(hand, [0.02, 0.02, 0.16])], [0.009, 0.009], 'wood');
    m.spike(add(hand, [0.02, 0.02, 0.16]), add(hand, [0.03, 0.03, 0.26]), 0.022, 'accent*');
    face(m, hc, r);
    // open helm with a tall plume
    const helm = m.group();
    m.ell(add(hc, [0, 0.035, -0.02]), [r * 1.07, r * 0.85, r * 1.02], 'metal', [0, 0, 0], helm);
    m.ell(add(hc, [0, 0.05, 0.075]), [r * 0.9, r * 0.12, r * 0.4], 'metal', [-0.3, 0, 0], helm);
    const w = flick(p, 1, 0.01);
    m.tube([add(hc, [0, 0.13, -0.02]), add(hc, [0, 0.24, -0.06]), add(hc, [w, 0.27, -0.16]), add(hc, [w, 0.2, -0.25])], [0.03, 0.035, 0.03, 0.01], 'side');
  },
};

// Harpist — accent gold-white. An elf bard in a Side-coloured robe with long
// pointed ears. Signature: a harp whose strings are beams of light.
S.harpist = {
  palette: { accent: '#fff2a8', iris: '#5ad08a', hair: '#f0e0b0', skin: '#f6dcc4' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'side',
      skirt: { mat: 'side', len: 0.27, flare: 0.9, hem: 'gold' },
      shoulders: 0.09,
      waistY: 0.28,
      headR: 0.12,
      arms: (s) => (s > 0 ? [[0.05, -0.06, 0.06], [0.0, -0.02, 0.15]] : [[-0.05, -0.05, 0.07], [-0.02, 0.02, 0.15]]),
    });
    const { hc, r, waistY, lift } = f;
    face(m, hc, r, 'iris', -0.16);
    longHair(m, hc, r, p, 'hair', 0.3, 3);
    both((s) => m.spike(add(hc, [s * r * 0.9, 0.0, -0.01]), add(hc, [s * r * 1.9, 0.07, -0.04]), 0.028, 'skin')); // elf ears
    m.ell(add(hc, [0, 0.07, 0.02]), [r * 1.02, 0.012, r * 0.95], 'gold', [-0.2, 0, 0]); // circlet
    // harp held in front: a curved gold frame with light strings
    const base: V3 = [0.02, waistY + 0.04 + lift, 0.17];
    const frame: V3[] = [base, add(base, [0.03, 0.12, 0.01]), add(base, [0.0, 0.24, 0.0]), add(base, [-0.06, 0.27, 0.0])];
    m.tube(frame, [0.016, 0.014, 0.014, 0.02], 'gold');
    m.tube([base, add(base, [-0.1, 0.06, 0]), add(base, [-0.09, 0.22, 0.0]), add(base, [-0.06, 0.27, 0])], [0.016, 0.014, 0.013, 0.013], 'gold');
    for (let i = 0; i < 4; i++) {
      const x = -0.075 + i * 0.022;
      const shimmer = 0.004 + 0.002 * Math.max(0, flick(p, i, 1));
      m.tube([add(base, [x + 0.01, 0.04, 0]), add(base, [x - 0.005, 0.24 - Math.abs(i - 1.5) * 0.02, 0])], [shimmer, shimmer], 'accent*');
    }
    for (let i = 0; i < 3; i++) {
      const a = p.frame * 0.4 + i * 2.1;
      m.ball(add(base, [Math.cos(a) * 0.14, 0.18 + i * 0.05, Math.sin(a) * 0.06]), 0.01, 'accent*'); // drifting notes of light
    }
  },
};

// Savage — accent toxic green. A tusked wild-folk huntress in bone armour
// with a feathered headdress. Signature: she hurls a spear of crackling
// green fire.
S.savage = {
  palette: { accent: '#8aff4a', iris: '#ffcc3a', hair: '#3a2a1a', skin: '#9ab872' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'skin',
      legs: { mat: 'skin', boot: 'wood' },
      shoulders: 0.11,
      waistY: 0.25,
      headR: 0.12,
      arms: (s) => (s > 0 ? [[0.07, 0.04, -0.03], [0.05, 0.13, 0.0]] : [[-0.06, -0.05, 0.06], [-0.04, -0.03, 0.14]]),
    });
    const { hc, r, waistY, lift } = f;
    // fur loincloth and bone armour
    m.ell([0, waistY - 0.03, 0], [0.08, 0.06, 0.065], 'wood');
    both((s) => {
      const c: V3 = [s * 0.11, waistY + 0.2 + lift, 0];
      m.ell(c, [0.05, 0.03, 0.05], 'bone', [0, 0, s * -0.4]);
      m.spike(add(c, [s * 0.02, 0.02, 0]), add(c, [s * 0.08, 0.08, -0.01]), 0.015, 'bone');
    });
    for (let i = 0; i < 3; i++) m.ell([0, waistY + 0.07 + i * 0.03 + lift * 0.5, 0.068], [0.06 - i * 0.008, 0.008, 0.01], 'bone');
    face(m, hc, r);
    both((s) => m.spike(add(hc, [s * 0.04, -0.07, 0.09]), add(hc, [s * 0.05, -0.01, 0.13]), 0.012, 'bone')); // tusks
    hairCap(m, hc, r, 'hair', false);
    m.tube([add(hc, [0, 0.0, -0.1]), add(hc, [0, -0.15, -0.13]), add(hc, [0, -0.26, -0.1])], [0.04, 0.03, 0.012], 'hair');
    // feather headdress
    for (let i = 0; i < 5; i++) {
      const a = -0.8 + i * 0.4;
      m.ell(add(hc, [Math.sin(a) * 0.1, 0.14 + Math.cos(a) * 0.05, -0.04]), [0.018, 0.06, 0.006], i % 2 ? 'red' : 'white', [0, 0, -a]);
    }
    m.ell(add(hc, [0, 0.07, 0]), [r * 1.04, 0.016, r], 'red');
    // signature: spear of green fire raised overhead
    const hand: V3 = [0.17, waistY + 0.27 + lift, -0.03];
    m.tube([add(hand, [-0.02, -0.04, -0.14]), add(hand, [0.02, 0.06, 0.16])], [0.01, 0.01], 'wood');
    const tip = add(hand, [0.025, 0.07, 0.19]);
    m.spike(tip, add(tip, [0.01, 0.02, 0.07]), 0.02, 'bone');
    flame(m, add(tip, [0, -0.02, 0.0]), 0.12, 0.035, p, 3, 'accent*');
  },
};

// Tracker — accent amber. A lynx-eared hunter in a fur-trimmed Side-coloured
// cloak. Signature: an enormous longbow made from a stag's antlers.
S.tracker = {
  palette: { accent: '#ffc24a', iris: '#d8a020', hair: '#b88a5a', skin: '#f0d0b0', antler: '#e8dcc0' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'side',
      legs: { mat: 'wood', boot: 'dark' },
      shoulders: 0.095,
      waistY: 0.25,
      headR: 0.12,
      arms: (s) => (s > 0 ? [[0.06, 0.0, 0.05], [0.05, 0.05, 0.12]] : [[-0.06, -0.02, 0.06], [-0.1, 0.04, 0.13]]),
    });
    const { hc, r, waistY, lift } = f;
    // fur mantle
    m.ell([0, waistY + 0.18 + lift, -0.01], [0.12, 0.045, 0.09], 'hair');
    m.poly([[-0.1, waistY + 0.17 + lift, -0.05], [0.1, waistY + 0.17 + lift, -0.05], [0.13, 0.05, -0.12], [-0.13, 0.05, -0.12]], 'side2');
    face(m, hc, r, 'iris', -0.18);
    hairCap(m, hc, r);
    // lynx ears with black tufts
    both((s) => {
      m.spike(add(hc, [s * 0.07, 0.09, -0.02]), add(hc, [s * 0.11, 0.2, -0.03]), 0.035, 'hair');
      m.spike(add(hc, [s * 0.11, 0.19, -0.03]), add(hc, [s * 0.115, 0.25, -0.03]), 0.008, 'dark');
    });
    // signature: antler longbow, taller than the hunter
    const grip: V3 = [-0.2, waistY + 0.2 + lift, 0.13];
    for (const s of [1, -1]) {
      const a = add(grip, [0, s * 0.02, 0]);
      const b = add(grip, [0.03, s * 0.22, 0.02]);
      const c = add(grip, [0.0, s * 0.42, 0.0]);
      m.tube([a, b, c], [0.017, 0.014, 0.008], 'antler');
      m.tube([b, add(b, [-0.05, s * 0.06, 0.0])], [0.009, 0.003], 'antler'); // tines
      m.tube([add(grip, [0.02, s * 0.32, 0.01]), add(grip, [-0.03, s * 0.38, 0.0])], [0.007, 0.003], 'antler');
    }
    m.tube([add(grip, [0, 0.42, 0]), add(grip, [0.12, 0.0, 0.0]), add(grip, [0, -0.42, 0])], [0.003, 0.003, 0.003], 'white');
    m.tube([add(grip, [0.12, 0.0, 0.0]), add(grip, [-0.1, 0.0, 0.02])], [0.005, 0.005], 'wood');
    m.spike(add(grip, [-0.1, 0, 0.02]), add(grip, [-0.14, 0, 0.02]), 0.012, 'accent*');
  },
};

// ------------------------------------------------------------ fighters

// Templar — accent sun gold; Day. A holy knight in plate with a
// Side-coloured tabard. Signature: a sun crest on the helm and a
// cross-shaped greatsword held point-down.
S.templar = {
  palette: { accent: '#ffd24a', iris: '#4a7ad8', hair: '#c88a4a', skin: '#f0cba8' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'metal',
      sleeve: 'metal',
      legs: { mat: 'metal', boot: 'metal' },
      shoulders: 0.11,
      waistY: 0.25,
      headR: 0.12,
      arms: (s) => (s > 0 ? [[0.03, -0.07, 0.07], [-0.06, -0.08, 0.14]] : [[-0.03, -0.07, 0.07], [0.06, -0.08, 0.14]]),
    });
    const { hc, r, waistY, lift } = f;
    m.ell([0, waistY + 0.08 + lift * 0.5, 0.045], [0.07, 0.11, 0.035], 'side');
    m.poly([[-0.06, waistY, 0.07], [0.06, waistY, 0.07], [0.055, waistY - 0.14, 0.06], [-0.055, waistY - 0.14, 0.06]], 'side');
    m.ell([0, waistY + 0.1 + lift * 0.5, 0.082], [0.022, 0.022, 0.008], 'gold');
    both((s) => m.ell([s * 0.11, waistY + 0.16 + lift, 0], [0.06, 0.035, 0.06], 'side2', [0, 0, s * -0.4]));
    const helm = m.group();
    m.ell(add(hc, [0, 0.03, -0.02]), [r * 1.07, r * 0.85, r * 1.02], 'metal', [0, 0, 0], helm);
    m.ell(add(hc, [0, 0.07, 0.06]), [r * 0.95, r * 0.22, r * 0.5], 'metal', [-0.5, 0, 0], helm);
    eyes(m, hc, r, 'anime', 'iris', 0.38, -0.2);
    mouthAt(m, hc, r, -0.55);
    // sun crest
    const sc = add(hc, [0, 0.17, -0.03]);
    m.ell(sc, [0.045, 0.045, 0.012], 'accent*');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + p.frame * 0.1;
      m.spike(add(sc, [Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0]), add(sc, [Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0]), 0.01, 'gold');
    }
    // cross-shaped greatsword planted in front, both hands on the hilt
    const hilt: V3 = [0, waistY + 0.05 + lift, 0.2];
    m.tube([add(hilt, [0, -0.04, 0]), add(hilt, [0, -0.29, 0.01])], [0.03, 0.012], 'metal');
    m.tube([add(hilt, [-0.09, -0.04, 0]), add(hilt, [0.09, -0.04, 0])], [0.014, 0.014], 'gold');
    m.tube([add(hilt, [0, -0.04, 0]), add(hilt, [0, 0.06, 0])], [0.012, 0.012], 'wood');
    m.ball(add(hilt, [0, 0.075, 0]), 0.02, 'accent*');
  },
};

// Ronin — accent electric blue. A wandering samurai in a Side-coloured
// kimono under a wide straw hat. Signature: a katana of blue lightning.
S.ronin = {
  palette: { accent: '#5ac8ff', iris: '#3a5ad8', hair: '#1a1a28', skin: '#f0d0b4', straw: '#d8b870' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'side',
      skirt: { mat: 'side2', len: 0.2, flare: 0.6 },
      legs: { mat: 'side2', boot: 'wood' },
      shoulders: 0.1,
      waistY: 0.25,
      headR: 0.12,
      arms: (s) => (s > 0 ? [[0.06, -0.06, 0.07], [0.02, -0.02, 0.16]] : [[-0.05, -0.08, 0.05], [-0.05, -0.14, 0.08]]),
    });
    const { hc, r, waistY, lift } = f;
    m.ell([0, waistY + 0.02, 0], [0.072, 0.02, 0.06], 'white'); // obi
    both((s) => m.poly([[s * 0.0, waistY + 0.2 + lift, 0.06], [s * 0.07, waistY + 0.05, 0.065], [s * 0.02, waistY + 0.03, 0.068]], 'white')); // collar
    face(m, hc, r, 'iris', -0.2);
    hairCap(m, hc, r);
    m.ball(add(hc, [0, 0.11, -0.08]), 0.03, 'hair'); // topknot
    // straw hat
    const hat = m.group();
    m.ell(add(hc, [0, 0.08, 0]), [0.22, 0.022, 0.2], 'straw', [-0.15, 0, 0], hat);
    m.ell(add(hc, [0, 0.11, -0.005]), [0.13, 0.04, 0.12], 'straw', [-0.15, 0, 0], hat);
    m.ell(add(hc, [0, 0.14, -0.01]), [0.05, 0.025, 0.05], 'straw', [-0.15, 0, 0], hat);
    // signature: katana of lightning held low and forward
    const hand: V3 = [0.15, waistY + 0.12 + lift, 0.16];
    m.tube([add(hand, [0, -0.03, -0.03]), add(hand, [0, 0.02, 0.02])], [0.012, 0.012], 'dark');
    m.ell(add(hand, [0, 0.025, 0.025]), [0.025, 0.006, 0.025], 'gold');
    const blade: V3[] = [];
    for (let i = 0; i <= 6; i++) blade.push(add(hand, [(i % 2 ? 0.012 : -0.006) + flick(p, i, 0.004), 0.03 + i * 0.045, 0.03 + i * 0.03 - i * i * 0.002]));
    m.tube(blade, blade.map((_, i) => 0.012 - i * 0.0012), 'accent*');
    m.tube([add(hand, [0.02, 0.1, 0.05]), add(hand, [0.05, 0.13, 0.07]), add(hand, [0.03, 0.16, 0.1])], [0.004, 0.004, 0.002], 'white*');
  },
};

// Oni — accent crimson. A horned blue ogre-demon, broad as a door, in a
// tiger-skin wrap. Signature: a spiked iron kanabo club over the shoulder.
S.oni = {
  palette: { accent: '#ff4a3a', iris: '#ffd23a', hair: '#f0f0f0', skin: '#6a8ae0', tiger: '#f0b030' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'skin',
      sleeve: 'skin',
      legs: { mat: 'skin', boot: 'skin' },
      shoulders: 0.135,
      waistY: 0.25,
      headR: 0.13,
      arms: (s) => (s > 0 ? [[0.05, 0.02, 0.0], [0.0, 0.09, -0.02]] : [[-0.06, -0.08, 0.04], [-0.06, -0.15, 0.08]]),
    });
    const { hc, r, waistY, lift } = f;
    // tiger-skin wrap
    m.ell([0, waistY - 0.02, 0], [0.1, 0.07, 0.08], 'tiger');
    for (let i = 0; i < 4; i++) m.ell([-0.06 + i * 0.04, waistY - 0.02, 0.075], [0.008, 0.05, 0.006], 'dark', [0, 0, 0.3]);
    m.ell([0, waistY + 0.03, 0], [0.1, 0.018, 0.082], 'side'); // Side-coloured sash
    m.ell([0, waistY + 0.03, 0.08], [0.03, 0.03, 0.02], 'side2');
    eyes(m, hc, r, 'anime', 'iris', 0.4, -0.12);
    mouthAt(m, hc, r, -0.5, 'fang', 0.05);
    mouthAt(m, hc, r, -0.5, 'fang', -0.05);
    // wild white mane and horns
    const mane = m.group();
    m.ell(add(hc, [0, 0.02, -0.05]), [r * 1.15, r * 1.0, r * 1.0], 'hair', [0, 0, 0], mane);
    for (let i = 0; i < 5; i++) m.spike(add(hc, [(i - 2) * 0.05, 0.06, -0.08]), add(hc, [(i - 2) * 0.09, -0.02 - Math.abs(i - 2) * 0.03, -0.2]), 0.03, 'hair', mane);
    both((s) => m.tube([add(hc, [s * 0.06, 0.1, 0.0]), add(hc, [s * 0.1, 0.18, -0.01]), add(hc, [s * 0.09, 0.25, -0.04])], [0.028, 0.02, 0.004], 'bone'));
    // signature: kanabo over the right shoulder
    const hand: V3 = [0.13, waistY + 0.23 + lift, -0.02];
    m.tube([add(hand, [0, -0.02, 0.06]), add(hand, [-0.06, 0.12, -0.15]), add(hand, [-0.11, 0.2, -0.27])], [0.014, 0.045, 0.06], 'metal');
    for (let i = 0; i < 9; i++) {
      const t = 0.35 + (i / 8) * 0.6;
      const c = add(hand, [-0.11 * t, 0.2 * t, -0.27 * t]);
      const a = i * 2.4;
      m.spike(c, add(c, [Math.cos(a) * 0.06, Math.sin(a) * 0.05, 0.02]), 0.012, 'accent');
    }
  },
};

// Valkyr — accent silver-white. A shield maiden in a winged helm with a
// Side-coloured round shield and a spear. Signature: great feathered wings.
S.valkyr = {
  palette: { accent: '#e8f4ff', iris: '#5aa0e8', hair: '#f0d070', skin: '#f6dcc8' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'metal',
      sleeve: 'side',
      skirt: { mat: 'side', len: 0.17, flare: 0.6, hem: 'gold' },
      legs: { mat: 'side2', boot: 'metal' },
      shoulders: 0.1,
      waistY: 0.25,
      headR: 0.12,
      arms: (s) => (s > 0 ? [[0.06, -0.04, 0.05], [0.04, 0.02, 0.12]] : [[-0.05, -0.06, 0.07], [-0.06, -0.06, 0.14]]),
    });
    const { hc, r, waistY, lift } = f;
    // wings: layered feathers fanning from the back
    both((s) => {
      const root: V3 = [s * 0.05, waistY + 0.17 + lift, -0.07];
      const up = 0.03 * p.breath;
      for (let i = 0; i < 4; i++) {
        const tip: V3 = add(root, [s * (0.18 + i * 0.05), 0.24 - i * 0.12 + up, -0.06 - i * 0.01]);
        m.ell([(root[0] + tip[0]) / 2, (root[1] + tip[1]) / 2, (root[2] + tip[2]) / 2], [0.12 - i * 0.012, 0.032, 0.008], i % 2 ? 'white' : 'accent', [0, 0, Math.atan2(tip[1] - root[1], tip[0] - root[0])]);
      }
    });
    face(m, hc, r);
    longHair(m, hc, r, p, 'hair', 0.26, 2);
    // winged helm
    const helm = m.group();
    m.ell(add(hc, [0, 0.06, -0.01]), [r * 1.05, r * 0.6, r * 1.0], 'metal', [0, 0, 0], helm);
    both((s) => membrane(m, add(hc, [s * 0.1, 0.08, 0.0]), [add(hc, [s * 0.18, 0.2, -0.04]), add(hc, [s * 0.2, 0.12, -0.06]), add(hc, [s * 0.15, 0.06, -0.03])], 'white'));
    // spear
    const hand: V3 = [0.16, waistY + 0.16 + lift, 0.12];
    m.tube([[0.17, 0.02, 0.13], add(hand, [0, 0.32, 0])], [0.01, 0.01], 'wood');
    m.spike(add(hand, [0, 0.32, 0]), add(hand, [0, 0.42, 0]), 0.022, 'metal');
    // round shield
    const sc: V3 = [-0.17, waistY + 0.08 + lift, 0.14];
    m.ell(sc, [0.1, 0.1, 0.02], 'side', [0, 0.4, 0]);
    m.ell(sc, [0.104, 0.104, 0.014], 'gold', [0, 0.4, 0]);
    m.ball(add(sc, [0.01, 0, 0.015]), 0.025, 'metal');
  },
};

// Duelist — accent rose. A fencer in a Side-coloured doublet and short cape
// with a big feathered hat. Signature: a rapier whose thrusts leave a trail
// of rose petals.
S.duelist = {
  palette: { accent: '#ff6a9a', iris: '#c03a6a', hair: '#3a2030', skin: '#f6d8c6' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'white',
      legs: { mat: 'side2', boot: 'dark' },
      shoulders: 0.09,
      waistY: 0.25,
      headR: 0.12,
      arms: (s) => (s > 0 ? [[0.06, -0.02, 0.07], [0.06, 0.0, 0.16]] : [[-0.06, 0.02, -0.02], [-0.04, 0.08, -0.06]]),
    });
    const { hc, r, waistY, lift } = f;
    m.ell([0, waistY + 0.02, 0], [0.068, 0.016, 0.056], 'gold');
    m.poly([[-0.1, waistY + 0.18 + lift, -0.04], [0.02, waistY + 0.18 + lift, -0.06], [-0.02, waistY - 0.02, -0.1], [-0.15, waistY + 0.02, -0.08]], 'side2'); // short cape
    m.ell([0, waistY + 0.19 + lift, 0.02], [0.06, 0.02, 0.05], 'white'); // ruff
    face(m, hc, r);
    hairCap(m, hc, r);
    // wide hat with a sweeping plume
    const hat = m.group();
    m.ell(add(hc, [0, 0.09, -0.02]), [0.19, 0.02, 0.16], 'side2', [-0.25, 0, 0.12], hat);
    m.ell(add(hc, [0, 0.12, -0.03]), [0.09, 0.05, 0.08], 'side2', [0, 0, 0], hat);
    m.tube([add(hc, [0.05, 0.14, -0.02]), add(hc, [-0.04, 0.24, -0.08]), add(hc, [-0.16, 0.22, -0.16])], [0.025, 0.03, 0.01], 'accent');
    // rapier thrust forward
    const hand: V3 = [0.15, waistY + 0.14 + lift, 0.16];
    m.ell(hand, [0.03, 0.03, 0.018], 'gold');
    m.tube([hand, add(hand, [0.01, 0.03, 0.3])], [0.006, 0.003], 'metal');
    // signature: rose petals trailing the blade
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      m.ell(add(hand, [0.03 + flick(p, i, 0.02), 0.05 + t * 0.05, 0.08 + t * 0.2]), [0.016, 0.01, 0.006], i % 2 ? 'accent' : 'red', [i, i * 0.7, 0]);
    }
  },
};

// Efreet — accent flame orange; Fire. A red-skinned fire genie with gold
// bracers and a scimitar. Signature: below the waist it is a swirling
// column of flame.
S.efreet = {
  palette: { accent: '#ffb02a', iris: '#ffe46a', hair: '#ff6a1a', skin: '#d8503a' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'skin',
      sleeve: 'skin',
      shoulders: 0.12,
      waistY: 0.3,
      headR: 0.12,
      arms: (s) => (s > 0 ? [[0.07, 0.0, 0.03], [0.06, 0.07, 0.08]] : [[-0.07, -0.05, 0.03], [-0.06, -0.02, 0.1]]),
    });
    const { hc, r, waistY, lift } = f;
    // swirling flame tail instead of legs
    for (let i = 0; i < 5; i++) {
      const a = p.frame * 0.6 + i * 1.3;
      flame(m, [Math.cos(a) * 0.04, 0.02 + i * 0.04, Math.sin(a) * 0.04], 0.16, 0.07 - i * 0.008, p, i, i % 2 ? 'flame*' : 'accent*');
    }
    m.ell([0, waistY - 0.01, 0], [0.085, 0.03, 0.07], 'side'); // Side-coloured sash
    m.ell([0, waistY - 0.01, 0.07], [0.025, 0.025, 0.015], 'gold');
    both((s) => m.ell([s * 0.1, waistY + 0.04 + lift, 0.08], [0.026, 0.03, 0.026], 'gold')); // bracers
    eyes(m, hc, r, 'anime', 'iris', 0.4, -0.12);
    mouthAt(m, hc, r, -0.5);
    // bald head, gold earrings, flame topknot
    both((s) => m.ball(add(hc, [s * r * 0.95, -0.04, 0.01]), 0.015, 'gold'));
    flame(m, add(hc, [0, 0.1, -0.03]), 0.18, 0.04, p, 7, 'hair*');
    // scimitar raised in the right hand
    const hand: V3 = [0.17, waistY + 0.21 + lift, 0.11];
    m.tube([add(hand, [0, -0.03, 0]), add(hand, [0, 0.02, 0])], [0.012, 0.012], 'gold');
    m.tube([add(hand, [0, 0.02, 0]), add(hand, [0.02, 0.12, 0.02]), add(hand, [0.07, 0.2, 0.02]), add(hand, [0.13, 0.23, 0.01])], [0.022, 0.026, 0.02, 0.004], 'metal');
    m.ball([-0.17, waistY + 0.12 + lift + flick(p, 3, 0.01), 0.14], 0.03, 'accent*'); // ember in the palm
  },
};

// Dwarf — accent crystal green; Earth. A stout dwarf in a Side-coloured
// tunic with a horned helm and a braided beard bound with gold rings.
// Signature: a crystal-studded drill-hammer bigger than he is.
S.dwarf = {
  palette: { accent: '#6affb0', iris: '#6a4a2a', hair: '#c86a2a', skin: '#e8c0a0' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'side',
      legs: { mat: 'side2', boot: 'dark' },
      shoulders: 0.12,
      waistY: 0.2,
      headR: 0.13,
      arms: (s) => (s > 0 ? [[0.05, -0.03, 0.07], [0.02, 0.02, 0.15]] : [[-0.05, -0.03, 0.07], [-0.02, 0.0, 0.15]]),
    });
    const { hc, r, waistY, lift } = f;
    m.ell([0, waistY + 0.02, 0], [0.085, 0.02, 0.07], 'wood');
    m.ell([0, waistY + 0.02, 0.07], [0.03, 0.025, 0.01], 'gold');
    eyes(m, hc, r, 'anime', 'iris', 0.4, -0.08);
    m.ell(add(hc, [0, 0.04, 0.1]), [0.08, 0.016, 0.03], 'hair'); // brows
    m.ball(add(hc, [0, -0.02, r * 0.97]), 0.026, 'skin'); // nose
    // braided beard
    const beard = m.group();
    m.ell(add(hc, [0, -0.07, 0.06]), [0.1, 0.07, 0.06], 'hair', [0, 0, 0], beard);
    both((s) => {
      m.tube([add(hc, [s * 0.04, -0.1, 0.09]), add(hc, [s * 0.05, -0.18, 0.1]), add(hc, [s * 0.04, -0.25, 0.09])], [0.03, 0.025, 0.012], 'hair', beard);
      m.ell(add(hc, [s * 0.05, -0.18, 0.1]), [0.026, 0.012, 0.026], 'gold');
    });
    // horned helm
    m.ell(add(hc, [0, 0.05, -0.01]), [r * 1.05, r * 0.65, r * 1.0], 'metal');
    both((s) => m.tube([add(hc, [s * 0.1, 0.07, 0]), add(hc, [s * 0.18, 0.12, 0.0]), add(hc, [s * 0.2, 0.2, -0.02])], [0.025, 0.016, 0.004], 'bone'));
    // signature: the drill-hammer, held across the body
    const hand: V3 = [0.0, waistY + 0.13 + lift, 0.17];
    m.tube([add(hand, [-0.14, -0.1, 0]), add(hand, [0.12, 0.2, -0.02])], [0.015, 0.015], 'wood');
    const head = add(hand, [0.15, 0.24, -0.02]);
    m.ell(head, [0.07, 0.05, 0.05], 'metal', [0, 0, -0.85]);
    m.tube([add(head, [0.04, -0.03, 0]), add(head, [0.13, -0.11, 0])], [0.045, 0.004], 'accent', m.group());
    for (let i = 0; i < 3; i++) m.ball(add(head, [0.06 + i * 0.025, -0.05 - i * 0.025, 0.03]), 0.012, 'accent*');
    m.ell(add(head, [-0.06, 0.05, 0]), [0.04, 0.035, 0.05], 'metal', [0, 0, -0.85]);
    m.ball(add(head, [0, 0.0, 0.05]), 0.018, 'accent*');
  },
};

// Gorgon — accent jade. A serpent-haired queen in a Side-coloured gown.
// Signature: a crown of living, hissing snakes, and a mirror shield.
S.gorgon = {
  palette: { accent: '#4ae8a0', iris: '#e8f04a', hair: '#4a9a5a', skin: '#c8e0b8' },
  build(m, p) {
    const f = figure(m, p, {
      top: 'side',
      sleeve: 'side',
      skirt: { mat: 'side', len: 0.27, flare: 0.8, hem: 'gold' },
      shoulders: 0.095,
      waistY: 0.28,
      headR: 0.12,
      arms: (s) => (s > 0 ? [[0.05, -0.08, 0.05], [0.06, -0.13, 0.11]] : [[-0.06, -0.05, 0.07], [-0.05, -0.02, 0.14]]),
    });
    const { hc, r, waistY, lift } = f;
    eyes(m, hc, r, 'slit', 'iris', 0.4, -0.18);
    mouthAt(m, hc, r, -0.55);
    hairCap(m, hc, r, 'hair', false);
    m.ell(add(hc, [0, 0.07, 0.04]), [r * 1.0, 0.014, r * 0.9], 'gold', [-0.2, 0, 0]);
    // signature: snakes for hair, each with a head and glowing eyes
    for (let i = 0; i < 7; i++) {
      const a = -1.5 + (i / 6) * 3;
      const w = flick(p, i, 0.015);
      const b = add(hc, [Math.sin(a) * 0.08, 0.06, Math.cos(a) * 0.04 - 0.06]);
      const tip = add(hc, [Math.sin(a) * 0.2 + w, 0.13 + Math.cos(a * 2) * 0.05, Math.cos(a) * 0.06 - 0.1]);
      const mid: V3 = [(b[0] + tip[0]) / 2, b[1] + 0.1, (b[2] + tip[2]) / 2];
      const g = m.group();
      m.tube([b, mid, tip], [0.018, 0.014, 0.013], i % 2 ? 'hair' : 'accent', g);
      m.ell(tip, [0.02, 0.016, 0.026], i % 2 ? 'hair' : 'accent', [0, 0, 0], g);
      m.ball(add(tip, [0, 0.008, 0.015]), 0.005, 'iris*');
    }
    // mirror shield
    const sc: V3 = [-0.17, waistY + 0.16 + lift, 0.14];
    m.ell(sc, [0.085, 0.1, 0.015], 'gold', [0, 0.4, 0]);
    m.ell(add(sc, [0.004, 0, 0.012]), [0.07, 0.085, 0.008], 'crystal', [0, 0.4, 0]);
  },
};

export const SUMMONER_DESIGNS: Record<string, Design> = { ...S, ...SUMMONER_DESIGNS_2 };
