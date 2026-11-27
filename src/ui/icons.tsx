// One small pixel-art icon set, drawn as SVG from character grids so it looks
// identical on every OS. Each icon shows its name on hover.

import type { ReactElement } from 'react';
import { abilityLabel, classOf, CLASS_NAME, type Element, type UnitKind } from '../rules';

type Palette = Record<string, string>;

interface IconDef {
  title: string;
  grid: string[];
  palette: Palette;
}

const O = '#10121a'; // outline

const ICONS = {
  atk: {
    title: 'Attack',
    // a sword: two-tone blade (bright edge, shaded flat), gold crossguard, leather grip, gold pommel
    palette: { o: O, w: '#f4f7ff', b: '#8f9bb8', g: '#f6cf5a', d: '#b8862a', h: '#7a4a2a', p: '#f6cf5a' },
    grid: [
      '......owo',
      '.....owbo',
      '..o.owbo.',
      '.ogowbo..',
      '..odbo...',
      '.ohodo...',
      'oho.ogo..',
      'po...o...',
      'o........',
    ],
  },
  def: {
    title: 'Defense',
    palette: { o: O, s: '#7f9cc8', l: '#c4d4f0' },
    grid: [
      '.ooooooo.',
      'oslllllso',
      'oslsssslo',
      'oslsssslo',
      'osssssso.',
      '.osssso..',
      '..ossso..',
      '...oso...',
      '....o....',
    ],
  },
  mp: {
    title: 'Magic Power',
    palette: { o: O, y: '#c58bff', w: '#f4e8ff' },
    grid: [
      '....o....',
      '...oyo...',
      '...oyo...',
      'ooooyoooo',
      'oyyywyyyo',
      '.oooyooo.',
      '..oyoyo..',
      '.oyo.oyo.',
      '.oo...oo.',
    ],
  },
  mdf: {
    title: 'Magic Defense',
    palette: { o: O, s: '#8a5cc8', l: '#e0c8ff' },
    grid: [
      '.ooooooo.',
      'ossssssso',
      'ossslssso',
      'osslllsso',
      'ossslssso',
      '.osssso..',
      '..ossso..',
      '...oso...',
      '....o....',
    ],
  },
  spd: {
    title: 'Speed',
    palette: { o: O, w: '#d8c8a0', s: '#f0d060' },
    grid: [
      'ooooooooo',
      '.owwwwwo.',
      '..ossso..',
      '...oso...',
      '....o....',
      '...owo...',
      '..owswo..',
      '.osssssso',
      'ooooooooo',
    ],
  },
  mov: {
    title: 'Move',
    palette: { o: O, b: '#9a6a3a', l: '#c89a5a' },
    grid: [
      '..oooo...',
      '..obbo...',
      '..obbo...',
      '..obbo...',
      '..obbboo.',
      '.oblbbbbo',
      '.obbbbbbo',
      '.oooooooo',
      '.........',
    ],
  },
  day: {
    title: 'Day',
    palette: { o: '#c8901a', y: '#ffd34d', w: '#fff2b0' },
    grid: [
      '....y....',
      '.y..y..y.',
      '..ooooo..',
      '..oywyo..',
      'yyoyyyoyy',
      '..oyyyo..',
      '..ooooo..',
      '.y..y..y.',
      '....y....',
    ],
  },
  night: {
    title: 'Night',
    palette: { o: '#4a5a9a', m: '#c8d4ff' },
    grid: [
      '...ooo...',
      '..ommo...',
      '.ommo....',
      '.omo.....',
      '.omo.....',
      '.ommo....',
      '..ommoo..',
      '...oooo..',
      '.........',
    ],
  },
  neutral: {
    title: 'Neutral',
    palette: { o: '#8a7a9a', y: '#ffd34d', m: '#5a6aaa' },
    grid: [
      '..ooooo..',
      '.oyyymmo.',
      'oyyyymmmo',
      'oyyyymmmo',
      'oyyyymmmo',
      'oyyyymmmo',
      '.oyyymmo.',
      '..ooooo..',
      '.........',
    ],
  },
  fire: {
    title: 'Fire',
    palette: { o: O, r: '#e8622c', y: '#ffd34d' },
    grid: [
      '....o....',
      '...oro...',
      '..orro.o.',
      '.orrrooro',
      '.orryrrro',
      'orryyyrro',
      'orryyyrro',
      '.orryrro.',
      '..ooooo..',
    ],
  },
  air: {
    title: 'Air',
    palette: { o: '#3a6a7a', a: '#a8e0ee' },
    grid: [
      '..oooo...',
      '.oaaaao..',
      '......ao.',
      'oooooao..',
      'aaaaaa...',
      '.........',
      'oooooo...',
      'aaaaaao..',
      '......o..',
    ],
  },
  earth: {
    title: 'Earth',
    palette: { o: O, b: '#b48a3a', l: '#d8b060', d: '#7a5a20' },
    grid: [
      '.........',
      '...ooo...',
      '..olbbo..',
      '.olbbbbo.',
      'olbbbbdbo',
      'obbbbdbbo',
      'obbdbbbdo',
      '.oooooooo',
      '.........',
    ],
  },
  water: {
    title: 'Water',
    palette: { o: O, w: '#3a78d8', l: '#a8c8ff' },
    grid: [
      '....o....',
      '...owo...',
      '...owo...',
      '..owwwo..',
      '.owlwwwo.',
      '.owlwwwo.',
      '.owwwwwo.',
      '..owwwo..',
      '...ooo...',
    ],
  },
  // Class icons (what a Familiar does when it Acts)
  classFighter: {
    title: 'Fighter',
    // a sword, like ATK's, in the Fighter's orange
    palette: { o: O, w: '#fff0dc', b: '#ff9a3c', g: '#ffd08a', h: '#8a4a1a' },
    grid: [
      '......owo',
      '.....owbo',
      '..o.owbo.',
      '.ogowbo..',
      '..ogbo...',
      '.ohogo...',
      'oho.ogo..',
      'ho...o...',
      'o........',
    ],
  },
  classCaster: {
    title: 'Caster',
    // a four-point star with sparkles
    palette: { o: O, y: '#b07cff', w: '#f4e8ff' },
    grid: [
      '....o....',
      '...oyo...',
      'o..oyo..o',
      '.ooywyoo.',
      'oyywwwyyo',
      '.ooywyoo.',
      'o..oyo..o',
      '...oyo...',
      '....o....',
    ],
  },
  classHealer: {
    title: 'Healer',
    palette: { o: O, r: '#ff7fb8', l: '#ffd0e6' },
    grid: [
      '.........',
      '.oo...oo.',
      'orro.orro',
      'orlrorrro',
      'orrrrrrro',
      '.orrrrro.',
      '..orrro..',
      '...oro...',
      '....o....',
    ],
  },
  classMaster: {
    title: 'Master',
    // a five-point star in gold
    palette: { o: O, y: '#ffd23f', w: '#fff6c2' },
    grid: [
      '....o....',
      '...owo...',
      'ooooyoooo',
      'oyywyyyyo',
      '.oyyyyyo.',
      '..oyyyo..',
      '.oyyoyyo.',
      '.oyo.oyo.',
      '.oo...oo.',
    ],
  },
  classBuff: {
    title: 'Support (buff)',
    // a double chevron, up
    palette: { o: O, g: '#4fd8e8', l: '#c8f6fc' },
    grid: [
      '....o....',
      '...ogo...',
      '..oglgo..',
      '.ogo.ogo.',
      'oo..o..oo',
      '...ogo...',
      '..oglgo..',
      '.ogo.ogo.',
      'oo.....oo',
    ],
  },
  classDebuff: {
    title: 'Support (debuff)',
    // a double chevron, down
    palette: { o: O, p: '#4fd8e8', l: '#c8f6fc' },
    grid: [
      'oo.....oo',
      '.opo.opo.',
      '..oplpo..',
      '...opo...',
      'oo..o..oo',
      '.opo.opo.',
      '..oplpo..',
      '...opo...',
      '....o....',
    ],
  },
  hex: {
    title: 'Hex (MDF lowered)',
    // a cracked violet eye
    palette: { o: O, v: '#b070ff', l: '#e0c8ff', k: '#2a1040' },
    grid: [
      '.........',
      '...ooo...',
      '.oovvvoo.',
      'ovvlklvvo',
      'ovlkkklvo',
      'ovvlklvvo',
      '.oovvvoo.',
      '...ooo...',
      '.........',
    ],
  },
  entangle: {
    title: 'Entangled (no movement)',
    // a looping vine
    palette: { o: O, g: '#5fc04a', l: '#b8f08a' },
    grid: [
      '..oo.....',
      '.oglo....',
      'oglgo.oo.',
      'ogogo.ogo',
      '.oggoogl.',
      '..ogglgo.',
      '...oggo..',
      '..oglo...',
      '..ooo....',
    ],
  },
  signature: {
    title: 'Signature Familiar',
    // a gold five-point star
    palette: { o: O, y: '#ffd040', w: '#fff4b0', d: '#c88a10' },
    grid: [
      '....o....',
      '...owo...',
      'oooowyooo',
      'oywwwyyyo',
      '.oyyyyyo.',
      '..oyyyo..',
      '.oyydyyo.',
      '.oyo.oyo.',
      '.oo...oo.',
    ],
  },
} satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 14, title }: { name: IconName; size?: number; title?: string }) {
  const def: IconDef = ICONS[name];
  const rects: ReactElement[] = [];
  def.grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      const fill = def.palette[c];
      if (fill) rects.push(<rect key={`${x},${y}`} x={x} y={y} width={1.02} height={1.02} fill={fill} />);
    }
  });
  return (
    <svg className="px-icon" width={size} height={size} viewBox="0 0 9 9" shapeRendering="crispEdges" role="img">
      <title>{title ?? def.title}</title>
      {rects}
    </svg>
  );
}

export const STAT_ICONS = [
  ['atk', 'atk'],
  ['def', 'def'],
  ['mp', 'mp'],
  ['mdf', 'mdf'],
  ['spd', 'spd'],
  ['mov', 'mov'],
] as const;

export function ElementIcon({ element, size }: { element: Element; size?: number }) {
  return <Icon name={element} size={size} />;
}

export function AlignmentIcon({ alignment, size }: { alignment: 'day' | 'night'; size?: number }) {
  return <Icon name={alignment} size={size} title={alignment === 'day' ? 'Day-aligned' : 'Night-aligned'} />;
}

/** Each Class's own colour (a Master's star is gold); the Side shows only as an outline. */
export const CLASS_COLORS = { fighter: '#ff9a3c', caster: '#b07cff', healer: '#ff7fb8', support: '#4fd8e8', master: '#ffd23f' } as const;

export function classColor(k: UnitKind): string {
  return k.isMaster ? CLASS_COLORS.master : CLASS_COLORS[classOf(k)];
}

/** The icon for a Unit's Class (a Support's shows whether it buffs or debuffs; a Master's is a gold star). */
export function classIconName(k: UnitKind): IconName {
  if (k.isMaster) return 'classMaster';
  const c = classOf(k);
  if (c === 'support') return abilityLabel(k.ability) === 'debuff' ? 'classDebuff' : 'classBuff';
  return c === 'fighter' ? 'classFighter' : c === 'caster' ? 'classCaster' : 'classHealer';
}

/** The Class icon for a kind; hover shows the Class. */
export function ClassIcon({ kind, size }: { kind: UnitKind; size?: number }) {
  return <Icon name={classIconName(kind)} size={size} title={kind.isMaster ? 'Master' : CLASS_NAME[classOf(kind)]} />;
}

/** An icon's pixel grid and colours (for drawing it on the board). */
export function iconPixels(name: IconName): { grid: string[]; palette: Record<string, string> } {
  const d: IconDef = ICONS[name];
  return { grid: d.grid, palette: d.palette };
}
