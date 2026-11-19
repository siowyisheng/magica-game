import { offsetToAxial } from '../hex';
import type { HexTerrain, MapDef, MapHex } from '../types';

// A fixed 15×13 (odd-r offset) map, mirrored top↔bottom.
// Water Level 2: height 1 = Shallow, height 0 = Deep.
// Legend per char: '.' plain h3, ',' rough h3, '^' plain h4, '#' plain h5,
// 'r' rough h4, 'l' low plain h2, '~' shallow h1, '=' deep h0,
// 'S' stone h3, 'L' stone on low ground h2, 'T' stone on plateau h4.
const ROWS_TOP = [
  '..,,...^...,,..', // 0 (red summoner spawn at col 7)
  '.,,..^^#^^..,,.', // 1
  '...T..^^^..T...', // 2
  ',,.....S....,..', // 3
  '.r,,..l...l.,r.', // 4
  '~ll~~~ll~~~ll~~', // 5
];
const ROW_MID = '=~l~==~L~==~l~='; // 6 (fords at cols 2 and 12, stone island at col 7)

const WIDTH = 15;

function cell(ch: string): { height: number; terrain: HexTerrain } {
  switch (ch) {
    case '.': return { height: 3, terrain: 'plain' };
    case ',': return { height: 3, terrain: 'rough' };
    case '^': return { height: 4, terrain: 'plain' };
    case '#': return { height: 5, terrain: 'plain' };
    case 'r': return { height: 4, terrain: 'rough' };
    case 'l': return { height: 2, terrain: 'plain' };
    case '~': return { height: 1, terrain: 'plain' };
    case '=': return { height: 0, terrain: 'plain' };
    case 'S': return { height: 3, terrain: 'stone' };
    case 'L': return { height: 2, terrain: 'stone' };
    case 'T': return { height: 4, terrain: 'stone' };
    default: throw new Error(`bad map char ${ch}`);
  }
}

function buildRows(): string[] {
  return [...ROWS_TOP, ROW_MID, ...[...ROWS_TOP].reverse()];
}

function build(): MapDef {
  const rows = buildRows();
  const hexes: MapHex[] = [];
  rows.forEach((line, row) => {
    if (line.length !== WIDTH) throw new Error(`row ${row} has width ${line.length}`);
    for (let col = 0; col < WIDTH; col++) {
      hexes.push({ hex: offsetToAxial(col, row), ...cell(line[col]) });
    }
  });
  return {
    name: 'Scaffold Ford',
    hexes,
    waterLevel: 2,
    startClock: 6 * 60,
    spawns: [offsetToAxial(7, 12), offsetToAxial(7, 0)],
    // Green (bottom) faces NE (toward the enemy), Red (top) faces SW.
    spawnFacing: [1, 4],
  };
}

export const SCAFFOLD_MAP: MapDef = build();
