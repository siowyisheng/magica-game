import { describe, expect, it, beforeEach } from 'vitest';
import { hexKey, validateMap } from '../rules';
import { blankDraft, fromMapDef, toMapDef, useEditor } from './editorStore';
import { generateRandomMap as makeTestMap } from '../rules';

/** A fixed random map (the same every run): Scaffold Ford is gone. */
const TEST_MAP = makeTestMap(20261127);

describe('map editor', () => {
  beforeEach(() => useEditor.getState().load(blankDraft()));

  it('round-trips a map through a draft', () => {
    const d = fromMapDef(TEST_MAP, 'test-map', true);
    const m = toMapDef(d);
    const key = (h: { hex: { q: number; r: number }; height: number; terrain: string }) => `${hexKey(h.hex)}|${h.height}|${h.terrain}`;
    const solid = (hs: typeof TEST_MAP.hexes) => hs.filter((h) => h.terrain !== 'pit').map(key).sort(); // a Pit and a missing hex are the same
    expect(solid(m.hexes)).toEqual(solid(TEST_MAP.hexes));
    expect(m.spawns).toEqual(TEST_MAP.spawns);
    expect(validateMap(TEST_MAP)).toEqual([]);
  });

  it('starts from a valid blank map', () => {
    expect(validateMap(toMapDef(blankDraft()))).toEqual([]);
  });

  it('mirrors edits top to bottom, and undo / redo restore them', () => {
    const ed = useEditor.getState();
    ed.setMirror(true);
    ed.setTool('pit');
    ed.paint({ col: 3, row: 2 }, false);
    const d = useEditor.getState().draft;
    expect(d.cells[2 * d.width + 3].terrain).toBe('pit');
    expect(d.cells[(d.height - 1 - 2) * d.width + 3].terrain).toBe('pit');
    useEditor.getState().doUndo();
    expect(useEditor.getState().draft.cells[2 * d.width + 3].terrain).toBe('plain');
    useEditor.getState().doRedo();
    expect(useEditor.getState().draft.cells[2 * d.width + 3].terrain).toBe('pit');
  });

  it('places Obstacles only on Plain or Rough, and flags bad maps', () => {
    const ed = useEditor.getState();
    ed.setMirror(false);
    ed.setObstacleDef(6);
    ed.paint({ col: 1, row: 1 }, false);
    let d = useEditor.getState().draft;
    expect(d.cells[1 * d.width + 1].obstacle).toBe(6);
    // a spawn under an Obstacle is a problem
    ed.paint({ col: d.spawns[0].col, row: d.spawns[0].row }, false);
    expect(validateMap(toMapDef(useEditor.getState().draft)).some((p) => p.includes('under an Obstacle'))).toBe(true);
    // no Obstacles on Pits
    ed.setTool('pit');
    ed.paint({ col: 4, row: 4 }, false);
    ed.setObstacleDef(2);
    ed.paint({ col: 4, row: 4 }, false);
    d = useEditor.getState().draft;
    expect(d.cells[4 * d.width + 4].obstacle).toBeUndefined();
  });
});
