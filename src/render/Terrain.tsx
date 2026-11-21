// Themed terrain: Plain / Rough tops with flat detail or raised clutter, Pits,
// Obstacles, and the water surface (Shallow and Deep read apart, foam at the
// shore).

import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { type Hex, type MapHex, type MatchState, type Obstacle, DIRS, hexKey, mapHexAt, neighbor, surfaceOf } from '../rules';
import { useGame } from '../store';
import { anchorSources } from './anchors';
import { type Deco, type Theme, hexSeed, rng, variantOf } from './themes';

const SQRT3 = Math.sqrt(3);
export const STEP = 0.5; // world units per Height level
export const BASE = -1.5;

export function hexToWorld(h: Hex): [number, number] {
  return [SQRT3 * (h.q + h.r / 2), 1.5 * h.r];
}

// ---------- shared geometry ----------

const columnCache = new Map<string, THREE.CylinderGeometry>();
/** A hex column from BASE up to `height`; open-topped for Pits. */
export function columnGeo(height: number, open = false): THREE.CylinderGeometry {
  const key = `${height}|${open}`;
  let g = columnCache.get(key);
  if (!g) {
    const h = height * STEP - BASE;
    g = new THREE.CylinderGeometry(0.97, 0.97, h, 6, 1, open);
    g.translate(0, h / 2 + BASE, 0);
    columnCache.set(key, g);
  }
  return g;
}

const SHAPES: Record<Deco['shape'], THREE.BufferGeometry> = {
  sphere: new THREE.SphereGeometry(1, 8, 6),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 6),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 7),
  rock: new THREE.DodecahedronGeometry(1, 0),
};
// Sizes: sphere / rock use radii; box uses full sizes; cone / cyl use [radius, height, radius].

export function DecoMesh({ d }: { d: Deco }) {
  return (
    <mesh geometry={SHAPES[d.shape]} position={d.p} scale={d.s} rotation={d.rot ?? [0, 0, 0]} raycast={() => null}>
      <meshLambertMaterial
        color={d.color}
        emissive={d.emissive ? d.color : '#000000'}
        emissiveIntensity={d.emissive ?? 0}
        flatShading
        transparent={d.opacity !== undefined}
        opacity={d.opacity ?? 1}
      />
    </mesh>
  );
}

// ---------- top textures ----------

const topCache = new Map<string, THREE.Texture>();
function topTexture(theme: Theme, terrain: 'plain' | 'rough', variant: 0 | 1, seed: number): THREE.Texture {
  // a few texture versions per look, so neighbouring hexes don't repeat exactly
  const ver = seed % 3;
  const key = `${theme.id}|${terrain}|${variant}|${ver}`;
  let t = topCache.get(key);
  if (t) return t;
  const look = theme[terrain][variant];
  const n = 32;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = look.top;
  ctx.fillRect(0, 0, n, n);
  const put = (x: number, y: number, c: string) => {
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    ctx.fillStyle = c;
    ctx.fillRect(x, y, 1, 1);
  };
  look.pattern?.(put, rng(1000 + ver * 77 + variant * 13), n);
  t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  topCache.set(key, t);
  return t;
}

/** Brightness by Height, and tint by water depth over the tile. */
function tint(height: number, depth: number): THREE.Color {
  const c = new THREE.Color(1, 1, 1).multiplyScalar(1 + (height - 3) * 0.06);
  if (depth === 1) c.lerp(new THREE.Color('#5fa8a0'), 0.35);
  else if (depth >= 2) c.lerp(new THREE.Color('#0c2236'), 0.72);
  return c;
}

// ---------- tiles ----------

export function ThemedTile({ mh, theme, depth }: { mh: MapHex; theme: Theme; depth: number }) {
  const terrain = mh.terrain === 'rough' ? 'rough' : 'plain';
  const variant = variantOf(mh.hex, mh.variant);
  const seed = hexSeed(mh.hex);
  const mats = useMemo(() => {
    const c = tint(mh.height, depth);
    const side = new THREE.MeshLambertMaterial({ color: new THREE.Color(theme.side).multiply(c), flatShading: true });
    const top = new THREE.MeshLambertMaterial({ map: topTexture(theme, terrain, variant, seed), color: c, flatShading: true });
    return [side, top, side];
  }, [theme, terrain, variant, seed, mh.height, depth]);
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  const decos = useMemo(() => {
    const look = theme[terrain][variant];
    return depth > 0 || !look.deco ? [] : look.deco(rng(seed));
  }, [theme, terrain, variant, seed, depth]);
  const y = mh.height * STEP;
  return (
    <>
      <mesh geometry={columnGeo(mh.height)} material={mats} />
      {decos.length > 0 && (
        <group position={[0, y, 0]}>
          {decos.map((d, i) => (
            <DecoMesh key={i} d={d} />
          ))}
        </group>
      )}
    </>
  );
}

const rimGeo = new THREE.RingGeometry(0.72, 0.97, 6, 1).rotateX(-Math.PI / 2).rotateY(Math.PI / 6);
const floorGeo = new THREE.CircleGeometry(0.72, 6).rotateX(-Math.PI / 2).rotateY(Math.PI / 6);
const shaftCache = new Map<number, THREE.CylinderGeometry>();
function shaftGeo(depth: number) {
  let g = shaftCache.get(depth);
  if (!g) {
    g = new THREE.CylinderGeometry(0.72, 0.72, depth, 6, 1, true);
    g.translate(0, -depth / 2, 0);
    shaftCache.set(depth, g);
  }
  return g;
}

/** A Pit: an open hole with a rim, a shaft, and the Theme's floor. */
export function PitTile({ mh, theme }: { mh: MapHex; theme: Theme }) {
  const y = mh.height * STEP;
  const pit = theme.pit;
  const decos = useMemo(() => pit.deco?.(rng(hexSeed(mh.hex))) ?? [], [pit, mh.hex]);
  const sideColor = useMemo(() => new THREE.Color(theme.side).multiply(tint(mh.height, 0)), [theme, mh.height]);
  const rimColor = useMemo(() => new THREE.Color(theme.plain[0].top).multiply(tint(mh.height, 0)).multiplyScalar(0.85), [theme, mh.height]);
  const floor = useRef<THREE.MeshLambertMaterial>(null);
  useFrame(({ clock }) => {
    if (floor.current && pit.glow) floor.current.emissiveIntensity = pit.glow * (0.85 + 0.15 * Math.sin(clock.elapsedTime * 2 + hexSeed(mh.hex)));
  });
  return (
    <>
      <mesh geometry={columnGeo(mh.height, true)}>
        <meshLambertMaterial color={sideColor} flatShading />
      </mesh>
      <mesh geometry={rimGeo} position={[0, y + 0.001, 0]}>
        <meshLambertMaterial color={rimColor} flatShading />
      </mesh>
      <mesh geometry={shaftGeo(pit.depth)} position={[0, y, 0]}>
        <meshLambertMaterial color={pit.wall} side={THREE.BackSide} flatShading />
      </mesh>
      <mesh geometry={floorGeo} position={[0, y - pit.depth, 0]}>
        <meshLambertMaterial ref={floor} color={pit.floor} emissive={pit.glow ? pit.floor : '#000000'} emissiveIntensity={pit.glow ?? 0} />
      </mesh>
      <group position={[0, y - pit.depth, 0]}>
        {decos.map((d, i) => (
          <DecoMesh key={i} d={d} />
        ))}
      </group>
    </>
  );
}

// ---------- obstacles ----------

/** Obstacle models are authored small; drawn at this scale so they fill their hex. */
const OBSTACLE_SCALE = 1.55;

function obstacleTop(theme: Theme, def: 5 | 10 | 15): number {
  let top = 0.4;
  for (const d of theme.obstacles[def](rng(1))) top = Math.max(top, d.p[1] + d.s[1] / (d.shape === 'sphere' || d.shape === 'rock' ? 1 : 2));
  return top * OBSTACLE_SCALE;
}

export function ObstacleView({ o, theme, match, interactive = true }: { o: Obstacle; theme: Theme; match: MatchState; interactive?: boolean }) {
  const setHoverUnit = useGame((s) => s.setHoverUnit);
  const setHoverHex = useGame((s) => s.setHoverHex);
  const clickHex = useGame((s) => s.clickHex);
  const hovered = useGame((s) => s.hoverUnitId === o.id);
  const group = useRef<THREE.Group>(null);
  const mh = mapHexAt(match.map, o.pos);
  const [x, z] = hexToWorld(o.pos);
  const y = mh ? Math.max(mh.height, match.waterLevel) * STEP : 0;
  const decos = useMemo(() => theme.obstacles[o.def](rng(hexSeed(o.pos))), [theme, o.def, o.pos]);
  const top = useMemo(() => obstacleTop(theme, o.def), [theme, o.def]);
  useEffect(() => {
    const v = new THREE.Vector3();
    anchorSources.set(`unit:${o.id}`, () => (group.current ? group.current.getWorldPosition(v).add(new THREE.Vector3(0, top + 0.25, 0)) : null));
    anchorSources.set(`tag:${o.id}`, () => (group.current ? group.current.getWorldPosition(v).add(new THREE.Vector3(0, top + 0.5, 0)) : null));
    return () => {
      anchorSources.delete(`unit:${o.id}`);
      anchorSources.delete(`tag:${o.id}`);
    };
  }, [o.id, top]);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.position.set(x, y, z);
    const anim = useGame.getState().anim;
    if (!anim) return;
    const t = performance.now() - anim.start;
    for (const st of anim.steps) {
      if (st.kind === 'hit' && st.unitIds.includes(o.id) && t >= st.t0 && t <= st.t1) {
        const p = (t - st.t0) / (st.t1 - st.t0);
        g.position.x += Math.sin(p * Math.PI * 8) * 0.06 * (1 - p);
      }
    }
  });
  return (
    <group
      ref={group}
      position={[x, y, z]}
      raycast={interactive ? undefined : () => null}
      onPointerOver={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        setHoverUnit(o.id);
      }}
      onPointerOut={() => setHoverUnit(null)}
      onPointerMove={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        setHoverHex(o.pos);
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!interactive || e.button !== 0) return;
        e.stopPropagation();
        clickHex(o.pos);
      }}
    >
      <group scale={OBSTACLE_SCALE}>
        {decos.map((d, i) => (
          <DecoMesh key={i} d={d} />
        ))}
      </group>
      {/* invisible pick volume so the whole obstacle is easy to point at */}
      <mesh position={[0, top / 2, 0]} raycast={interactive ? undefined : () => null}>
        <cylinderGeometry args={[0.6, 0.6, top, 6]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {hovered && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 6]} raycast={() => null}>
          <ringGeometry args={[0.74, 0.92, 6]} />
          <meshBasicMaterial color="#ffe066" transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  );
}

// ---------- water ----------

/** Pixel ripple texture for the water surface (tiles seamlessly). */
function makeRipple(light: string, dark: string, base: string) {
  const n = 32;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, n, n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const w = Math.sin((x / n) * Math.PI * 4 + Math.sin((y / n) * Math.PI * 2) * 2) + Math.sin((y / n) * Math.PI * 6);
      if (w > 1.35) ctx.fillStyle = light;
      else if (w < -1.45) ctx.fillStyle = dark;
      else continue;
      ctx.fillRect(x, y, 1, 1);
    }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const shallowTex = makeRipple('#ffffff', '#b8d8d8', '#e0f0f0');
const deepTex = makeRipple('#c8e0ff', '#7898c0', '#a0b8d8');

/** Axial hex containing world point (x, z). */
export function worldToHex(x: number, z: number): Hex {
  const qf = (SQRT3 / 3) * x - z / 3;
  const rf = (2 / 3) * z;
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  const sRound = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(sRound - sf);
  if (dq > dr && dq > ds) q = -r - sRound;
  else if (dr > ds) r = -q - sRound;
  return { q, r };
}

function hexSurface(mhs: MapHex[]): THREE.BufferGeometry | null {
  const parts = mhs.map((mh) => {
    const [x, z] = hexToWorld(mh.hex);
    const g = new THREE.CircleGeometry(1, 6).rotateX(-Math.PI / 2).rotateY(Math.PI / 6).translate(x, 0, z);
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 3, pos.getZ(i) / 3); // world-space UVs: seamless
    return g;
  });
  return parts.length ? mergeGeometries(parts) : null;
}

/** Corner k of a pointy-top hex (corner 0 points to +z). */
const CORNER: [number, number][] = [0, 1, 2, 3, 4, 5].map((k) => [Math.sin((Math.PI / 3) * k), Math.cos((Math.PI / 3) * k)]);
/** For each direction, the corner pair on the edge facing it. */
const EDGE: [number, number][] = DIRS.map((d) => {
  const [vx, vz] = hexToWorld(neighbor({ q: 0, r: 0 }, d));
  const target = Math.atan2(vx, vz);
  let best: [number, number] = [0, 1];
  let bestDiff = Infinity;
  for (let k = 0; k < 6; k++) {
    const a = CORNER[k];
    const b = CORNER[(k + 1) % 6];
    let diff = Math.abs(Math.atan2(a[0] + b[0], a[1] + b[1]) - target);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff < bestDiff) {
      bestDiff = diff;
      best = [k, (k + 1) % 6];
    }
  }
  return best;
});

/** Thin ribbons along hex edges where `edgeOf(mh, n)` is true, inset into the hex. */
function edgeRibbons(match: MatchState, hexes: MapHex[], edgeOf: (mh: MapHex, n: MapHex | undefined) => boolean, width: number): THREE.BufferGeometry | null {
  const pos: number[] = [];
  for (const mh of hexes) {
    const [cx, cz] = hexToWorld(mh.hex);
    for (const d of DIRS) {
      const n = mapHexAt(match.map, neighbor(mh.hex, d));
      if (!edgeOf(mh, n)) continue;
      const [i, j] = EDGE[d];
      const a = [cx + CORNER[i][0] * 0.98, cz + CORNER[i][1] * 0.98];
      const b = [cx + CORNER[j][0] * 0.98, cz + CORNER[j][1] * 0.98];
      const a2 = [cx + CORNER[i][0] * (0.98 - width), cz + CORNER[i][1] * (0.98 - width)];
      const b2 = [cx + CORNER[j][0] * (0.98 - width), cz + CORNER[j][1] * (0.98 - width)];
      pos.push(a[0], 0, a[1], b[0], 0, b[1], b2[0], 0, b2[1], a[0], 0, a[1], b2[0], 0, b2[1], a2[0], 0, a2[1]);
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/**
 * Water: Shallow is a light, clear teal (the floor shows through), Deep a
 * darker blue, and a faint line where Shallow meets Deep. (No white shore
 * foam: white lines are kept for Move Range outlines.)
 */
export function Water({ match, interactive = true }: { match: MatchState; interactive?: boolean }) {
  const setHoverHex = useGame((s) => s.setHoverHex);
  const clickHex = useGame((s) => s.clickHex);
  const { shallow, deep, shelf } = useMemo(() => {
    const wet = match.map.hexes.filter((mh) => surfaceOf(mh, match.waterLevel) !== 'land');
    const sh = wet.filter((mh) => surfaceOf(mh, match.waterLevel) === 'shallow');
    const dp = wet.filter((mh) => surfaceOf(mh, match.waterLevel) === 'deep');
    return {
      shallow: hexSurface(sh),
      deep: hexSurface(dp),
      shelf: edgeRibbons(match, dp, (_, n) => !!n && surfaceOf(n, match.waterLevel) === 'shallow', 0.05),
    };
  }, [match.map, match.waterLevel]);
  useFrame((_, dt) => {
    shallowTex.offset.x += dt * 0.03;
    shallowTex.offset.y += dt * 0.012;
    deepTex.offset.x -= dt * 0.018;
    deepTex.offset.y += dt * 0.008;
  });
  const hexAt = (e: ThreeEvent<PointerEvent | MouseEvent>) => worldToHex(e.point.x, e.point.z);
  const handlers = !interactive ? { raycast: () => null } : {
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHoverHex(hexAt(e));
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      clickHex(hexAt(e));
    },
  };
  const y = match.waterLevel * STEP - 0.06;
  // drawn after the units (renderOrder) so the water covers the legs of units wading in it
  return (
    <group position={[0, y, 0]}>
      {shallow && (
        <mesh geometry={shallow} {...handlers} renderOrder={13}>
          <meshLambertMaterial color="#5cc2c8" map={shallowTex} transparent opacity={0.48} depthWrite={false} />
        </mesh>
      )}
      {deep && (
        <mesh geometry={deep} {...handlers} renderOrder={13}>
          <meshLambertMaterial color="#2f6fb0" map={deepTex} transparent opacity={0.74} depthWrite={false} />
        </mesh>
      )}
      {shelf && (
        <mesh geometry={shelf} position={[0, 0.004, 0]} raycast={() => null} renderOrder={13}>
          <meshBasicMaterial color="#4fb8d8" transparent opacity={0.45} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

export { hexKey };
