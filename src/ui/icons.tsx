// One small pixel-art icon set, drawn as SVG from character grids so it looks
// identical on every OS. Each icon shows its name on hover.

import type { ReactElement } from 'react';
import type { Element } from '../rules';

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
    palette: { o: O, s: '#e8ecf5', h: '#b08a3a' },
    grid: [
      '......oo.',
      '.....oso.',
      '....oso..',
      '...oso...',
      'o.oso....',
      '.ooo.....',
      '.oho.....',
      'oo.oo....',
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
