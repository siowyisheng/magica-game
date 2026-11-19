// Bridges 3D positions to the DOM overlay without React re-renders.
import type * as THREE from 'three';

export interface ScreenPos {
  x: number;
  y: number;
}

/** Sources: functions returning a world position for an anchor id. */
export const anchorSources = new Map<string, () => THREE.Vector3 | null>();
/** Latest projected screen positions (CSS px relative to the board). */
export const anchorPositions = new Map<string, ScreenPos>();
