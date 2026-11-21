// Renders a unit kind's sprite frames (pure; returns RGBA pixels).

import { Model, type Pose } from './model';
import { rasterize } from './render';
import { shade } from './shade';
import { paletteFor, type ElementKey, type SideId } from './palette';
import { DESIGNS } from './designs';

/** Model yaw of the three drawn views: front three-quarter (SE), profile (E), back three-quarter (NE). */
export const VIEW_YAWS = [Math.PI / 6, Math.PI / 2, (5 * Math.PI) / 6] as const;
export type ViewIndex = 0 | 1 | 2;

/**
 * Camera elevation for sprites. Lower than the board camera (≈43°) so faces
 * read clearly, as in hand-drawn tactics sprites.
 */
export const ELEVATION = (20 * Math.PI) / 180;

/** The square view window in model units: x ∈ [−X, X], y ∈ [Y0, Y1]. */
export const WINDOW = { x: 0.66, y0: -0.28, y1: 1.04 } as const;
export const WINDOW_SIZE = WINDOW.y1 - WINDOW.y0;
/** Fraction of the sprite height below the feet. */
export const FEET_FRACTION = -WINDOW.y0 / WINDOW_SIZE;

/** Idle poses: four breathing frames and a blink. */
export const FRAME_POSES: Omit<Pose, 'frame'>[] = [
  { breath: 0, blink: false },
  { breath: 0.35, blink: false },
  { breath: 0.72, blink: false },
  { breath: 1, blink: false },
  { breath: 0, blink: true },
];
export type FrameIndex = 0 | 1 | 2 | 3 | 4;

export interface SpritePixels {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

export function hasDesign(kindId: string): boolean {
  return kindId in DESIGNS;
}

export function buildModel(kindId: string, frame: FrameIndex): Model {
  const m = new Model();
  const design = DESIGNS[kindId] ?? DESIGNS.sigil;
  design.build(m, { ...FRAME_POSES[frame], frame });
  return m;
}

export function renderSprite(kindId: string, side: SideId, element: ElementKey, view: ViewIndex, frame: FrameIndex, size: number): SpritePixels {
  const px = size / WINDOW_SIZE;
  const model = buildModel(kindId, frame);
  const gb = rasterize(model, {
    yaw: VIEW_YAWS[view],
    elevation: ELEVATION,
    w: size,
    h: size,
    px,
    ox: size / 2,
    oy: WINDOW.y1 * px,
  });
  const design = DESIGNS[kindId] ?? DESIGNS.sigil;
  const data = shade(gb, paletteFor(kindId, side, element, design.palette), { blink: FRAME_POSES[frame].blink, px });
  return { w: size, h: size, data };
}
