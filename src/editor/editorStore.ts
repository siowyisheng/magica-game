// Map editor state: a rectangular (odd-r offset) draft of a map, paint
// tools, top↔bottom mirroring, and undo / redo.

import { create } from 'zustand';
import {
  axialToOffset,
  offsetToAxial,
  type Dir,
  type HexTerrain,
  type MapDef,
  type MapHex,
  type ObstacleDefense,
} from '../rules';

export interface Cell {
  terrain: HexTerrain;
  height: number;
  variant?: 0 | 1;
  obstacle?: ObstacleDefense;
}

export interface Spot {
  col: number;
  row: number;
}

export interface Draft {
  /** Library id when saved; null for a new, unsaved map. */
  id: string | null;
  builtin: boolean;
  name: string;
  theme: string;
  width: number;
  height: number;
  /** Row-major cells. */
  cells: Cell[];
  waterLevel: number;
  startClock: number;
  spawns: [Spot, Spot];
  spawnFacing: [Dir, Dir];
}

export type Tool = 'plain' | 'rough' | 'pit' | 'stone' | 'height' | 'obstacle' | 'variant' | 'spawn0' | 'spawn1';

export const MIN_SIZE = 7;
export const MAX_SIZE = 21;
export const MIN_HEIGHT = -3;
export const MAX_HEIGHT = 8;

const DEFAULT_CELL: Cell = { terrain: 'plain', height: 3 };

export function blankDraft(width = 15, height = 13): Draft {
  const cells = Array.from({ length: width * height }, () => ({ ...DEFAULT_CELL }));
  const mid = Math.floor(width / 2);
  cells[Math.floor(height / 2) * width + mid] = { terrain: 'stone', height: 3 };
  return {
    id: null,
    builtin: false,
    name: 'New map',
    theme: 'meadow',
    width,
    height,
    cells,
    waterLevel: 0,
    startClock: 6 * 60,
    spawns: [
      { col: mid, row: height - 1 },
      { col: mid, row: 0 },
    ],
    spawnFacing: [1, 4],
  };
}

export function toMapDef(d: Draft): MapDef {
  const hexes: MapHex[] = [];
  const obstacles: MapDef['obstacles'] = [];
  for (let row = 0; row < d.height; row++)
    for (let col = 0; col < d.width; col++) {
      const c = d.cells[row * d.width + col];
      const hex = offsetToAxial(col, row);
      hexes.push({ hex, height: c.height, terrain: c.terrain, ...(c.variant !== undefined ? { variant: c.variant } : {}) });
      if (c.obstacle) obstacles.push({ hex, def: c.obstacle });
    }
  return {
    name: d.name.trim(),
    theme: d.theme,
    hexes,
    obstacles,
    waterLevel: d.waterLevel,
    startClock: d.startClock,
    spawns: [offsetToAxial(d.spawns[0].col, d.spawns[0].row), offsetToAxial(d.spawns[1].col, d.spawns[1].row)],
    spawnFacing: [...d.spawnFacing] as [Dir, Dir],
  };
}

/** A map as an editable draft. Hexes outside the map's rectangle become Pits. */
export function fromMapDef(map: MapDef, id: string | null, builtin: boolean): Draft {
  const offs = map.hexes.map((h) => ({ ...axialToOffset(h.hex), h }));
  const minCol = Math.min(...offs.map((o) => o.col));
  // keep row parity (odd-r) by shifting rows only by an even amount
  const minRowRaw = Math.min(...offs.map((o) => o.row));
  const minRow = minRowRaw - (((minRowRaw % 2) + 2) % 2);
  const width = Math.max(...offs.map((o) => o.col)) - minCol + 1;
  const height = Math.max(...offs.map((o) => o.row)) - minRow + 1;
  const cells: Cell[] = Array.from({ length: width * height }, () => ({ terrain: 'pit', height: 3 }) as Cell);
  for (const o of offs) cells[(o.row - minRow) * width + (o.col - minCol)] = { terrain: o.h.terrain, height: o.h.height, variant: o.h.variant };
  for (const ob of map.obstacles ?? []) {
    const { col, row } = axialToOffset(ob.hex);
    const c = cells[(row - minRow) * width + (col - minCol)];
    if (c) c.obstacle = ob.def;
  }
  const spot = (h: { q: number; r: number }): Spot => {
    const { col, row } = axialToOffset(h);
    return { col: col - minCol, row: row - minRow };
  };
  return {
    id,
    builtin,
    name: map.name,
    theme: map.theme ?? 'meadow',
    width,
    height,
    cells,
    waterLevel: map.waterLevel,
    startClock: map.startClock,
    spawns: [spot(map.spawns[0]), spot(map.spawns[1])],
    spawnFacing: [...map.spawnFacing] as [Dir, Dir],
  };
}

/** Top↔bottom mirror of a cell, and of a Facing. */
export const mirrorSpot = (d: Draft, s: Spot): Spot => ({ col: s.col, row: d.height - 1 - s.row });
export const mirrorFacing = (f: Dir): Dir => ((6 - f) % 6) as Dir;

const clone = (d: Draft): Draft => JSON.parse(JSON.stringify(d));

interface EditorStore {
  draft: Draft;
  tool: Tool;
  obstacleDef: ObstacleDefense;
  mirror: boolean;
  hover: Spot | null;
  undo: Draft[];
  redo: Draft[];
  /** Cells already changed in the current stroke (each changes once per drag). */
  stroke: Set<number> | null;
  /** The draft differs from what was last loaded or saved. */
  dirty: boolean;

  load: (d: Draft) => void;
  setTool: (t: Tool) => void;
  setObstacleDef: (d: ObstacleDefense) => void;
  setMirror: (m: boolean) => void;
  setHover: (s: Spot | null) => void;
  /** Change map settings (name, theme, water, clock…) as one undo step. */
  update: (f: (d: Draft) => void) => void;
  resize: (w: number, h: number) => void;
  beginStroke: () => void;
  endStroke: () => void;
  /** Apply the tool at a cell; `alt` (right-click) does the opposite. */
  paint: (s: Spot, alt: boolean) => void;
  doUndo: () => void;
  doRedo: () => void;
  markSaved: (id: string) => void;
}

export const useEditor = create<EditorStore>((set, get) => {
  const snapshot = () => {
    const { draft, undo } = get();
    set({ undo: [...undo, clone(draft)].slice(-100), redo: [] });
  };

  const applyOne = (d: Draft, s: Spot, alt: boolean, tool: Tool, def: ObstacleDefense) => {
    if (s.col < 0 || s.row < 0 || s.col >= d.width || s.row >= d.height) return;
    const c = d.cells[s.row * d.width + s.col];
    switch (tool) {
      case 'plain':
      case 'rough':
      case 'pit':
      case 'stone': {
        const t: HexTerrain = alt ? 'plain' : tool;
        c.terrain = t;
        if (t === 'pit' || t === 'stone') delete c.obstacle;
        if (t === 'stone' || t === 'pit') delete c.variant;
        return;
      }
      case 'height':
        c.height = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, c.height + (alt ? -1 : 1)));
        return;
      case 'obstacle':
        if (alt) delete c.obstacle;
        else if (c.terrain === 'plain' || c.terrain === 'rough') c.obstacle = def;
        return;
      case 'variant':
        if (alt || c.variant === 1) delete c.variant;
        else c.variant = c.variant === 0 ? 1 : 0;
        return;
    }
  };

  return {
    draft: blankDraft(),
    tool: 'plain',
    obstacleDef: 4,
    mirror: true,
    hover: null,
    undo: [],
    redo: [],
    stroke: null,
    dirty: false,

    load: (d) => set({ draft: clone(d), undo: [], redo: [], dirty: false }),
    setTool: (tool) => set({ tool }),
    setObstacleDef: (obstacleDef) => set({ obstacleDef, tool: 'obstacle' }),
    setMirror: (mirror) => set({ mirror }),
    setHover: (hover) => {
      const h = get().hover;
      if (h && hover && h.col === hover.col && h.row === hover.row) return;
      set({ hover });
    },
    update: (f) => {
      snapshot();
      const d = clone(get().draft);
      f(d);
      set({ draft: d, dirty: true });
    },
    resize: (w, h) => {
      w = Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(w)));
      h = Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(h)));
      const old = get().draft;
      if (w === old.width && h === old.height) return;
      snapshot();
      const d = clone(old);
      const cells: Cell[] = [];
      for (let row = 0; row < h; row++)
        for (let col = 0; col < w; col++) cells.push(col < old.width && row < old.height ? old.cells[row * old.width + col] : { ...DEFAULT_CELL });
      d.cells = cells;
      d.width = w;
      d.height = h;
      d.spawns = d.spawns.map((s) => ({ col: Math.min(s.col, w - 1), row: Math.min(s.row, h - 1) })) as [Spot, Spot];
      set({ draft: d, dirty: true });
    },
    beginStroke: () => {
      snapshot();
      set({ stroke: new Set() });
    },
    endStroke: () => set({ stroke: null }),
    paint: (s, alt) => {
      const { tool, obstacleDef, mirror, stroke } = get();
      const d = clone(get().draft);
      const key = s.row * d.width + s.col;
      if (stroke) {
        if (stroke.has(key)) return;
        stroke.add(key);
      } else snapshot();
      if (tool === 'spawn0' || tool === 'spawn1') {
        const i = tool === 'spawn0' ? 0 : 1;
        const cur = d.spawns[i];
        if (cur.col === s.col && cur.row === s.row) d.spawnFacing[i] = (((d.spawnFacing[i] + (alt ? 5 : 1)) % 6) as Dir);
        else d.spawns[i] = { ...s };
        if (mirror) {
          d.spawns[1 - i] = mirrorSpot(d, d.spawns[i]);
          d.spawnFacing[1 - i] = mirrorFacing(d.spawnFacing[i]);
        }
      } else {
        applyOne(d, s, alt, tool, obstacleDef);
        const m = mirrorSpot(d, s);
        if (mirror && (m.row !== s.row || m.col !== s.col)) applyOne(d, m, alt, tool, obstacleDef);
      }
      set({ draft: d, dirty: true });
    },
    doUndo: () => {
      const { undo, redo, draft } = get();
      if (!undo.length) return;
      set({ draft: undo[undo.length - 1], undo: undo.slice(0, -1), redo: [...redo, clone(draft)], dirty: true });
    },
    doRedo: () => {
      const { undo, redo, draft } = get();
      if (!redo.length) return;
      set({ draft: redo[redo.length - 1], redo: redo.slice(0, -1), undo: [...undo, clone(draft)], dirty: true });
    },
    markSaved: (id) => set((s) => ({ draft: { ...s.draft, id, builtin: false }, dirty: false })),
  };
});
