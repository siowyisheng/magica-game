import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  type Hex,
  type MatchState,
  type SideId,
  type Unit,
  activeUnit,
  canStandOn,
  hexDistance,
  hexEq,
  hexKey,
  hexesInRange,
  kindOf,
  magicAbility,
  mapHexAt,
  neighbor,
  pathTo,
  reachable,
  surfaceHeight,
  surfaceOf,
  unitAt,
  DIRS,
  minAimDistance,
  validateTurn,
  type Command,
  unitReach,
  facingTowardTarget,
} from '../rules';
import { hoverQuick, quickPlans, summonDirToward, useGame } from '../store';
import { FENCE_HEIGHT, fenceGeometry, regionSegments, ribbonGeometry, type LineStyle } from './outlines';
import {
  SIDE_COLORS,
  facingForHeading,
  idleFrameAt,
  projectileTexture,
  setSpritePixelSize,
  spriteFeetOffset,
  spriteTopHeight,
  spriteWorldSize,
  unitFrameTexture,
  unitOutlineTexture,
  unitTexture,
} from './sprites';
import { MS_PER_HEX, SUMMON_PHASES, type AnimStep } from '../anim';
import { Overlay } from '../ui/Overlay';
import { anchorPositions, anchorSources } from './anchors';

const SQRT3 = Math.sqrt(3);
export const STEP = 0.5; // world units per Height level
const BASE = -1.5;

export function hexToWorld(h: Hex): [number, number] {
  return [SQRT3 * (h.q + h.r / 2), 1.5 * h.r];
}

function topY(match: MatchState, h: Hex): number {
  const mh = mapHexAt(match.map, h);
  if (!mh) return 0;
  return surfaceHeight(mh, match.waterLevel) * STEP;
}

// ---------- camera controls: wheel zoom, right-drag pan, right-click cancel ----------

function CameraControls() {
  const { camera, gl } = useThree();
  const rightClick = useGame((s) => s.rightClick);
  useEffect(() => {
    const el = gl.domElement;
    const cam = camera as THREE.OrthographicCamera;
    let down: { x: number; y: number } | null = null;
    let panning = false;
    let last = { x: 0, y: 0 };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cam.zoom = THREE.MathUtils.clamp(cam.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 12, 160);
      cam.updateProjectionMatrix();
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 2) return;
      down = { x: e.clientX, y: e.clientY };
      last = { ...down };
      panning = false;
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      if (!panning && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) panning = true;
      if (panning) {
        const dx = e.clientX - last.x;
        const dy = e.clientY - last.y;
        last = { x: e.clientX, y: e.clientY };
        const right = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1);
        cam.position.addScaledVector(right, -dx / cam.zoom).addScaledVector(up, dy / cam.zoom);
      }
    };
    const onUp = (e: PointerEvent) => {
      if (e.button !== 2 || !down) return;
      if (!panning) rightClick();
      down = null;
      panning = false;
    };
    const noMenu = (e: Event) => e.preventDefault();
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('contextmenu', noMenu);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('contextmenu', noMenu);
    };
  }, [camera, gl, rightClick]);
  return null;
}

// ---------- terrain ----------

const hexGeoCache = new Map<number, THREE.CylinderGeometry>();
function columnGeo(height: number): THREE.CylinderGeometry {
  let g = hexGeoCache.get(height);
  if (!g) {
    const h = height * STEP - BASE;
    g = new THREE.CylinderGeometry(0.97, 0.97, h, 6, 1);
    g.translate(0, h / 2 + BASE, 0);
    hexGeoCache.set(height, g);
  }
  return g;
}
// Flat hexagons aligned with the (pointy-top) tile columns.
const ringGeo = new THREE.RingGeometry(0.74, 0.92, 6).rotateX(-Math.PI / 2).rotateY(Math.PI / 6);

function terrainColor(terrain: string, height: number): string {
  const c = new THREE.Color(terrain === 'rough' ? '#5d6b34' : terrain === 'stone' ? '#77806a' : '#8f9a52');
  c.offsetHSL(0, 0, (height - 3) * 0.05);
  return `#${c.getHexString()}`;
}

const STONE_NEUTRAL = '#a8804a'; // light brown (glow brightens it)

const lightTex = (() => {
  const n = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  g.addColorStop(0, 'rgba(255,255,240,1)');
  g.addColorStop(0.35, 'rgba(255,240,170,0.75)');
  g.addColorStop(1, 'rgba(255,220,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, n, n);
  return new THREE.CanvasTexture(cv);
})();

/** A Magic Stone hex: the whole column takes its controller's colour and glows softly. */
/** A Magic Stone hex: the whole column takes its controller's colour and glows softly. */
/** A Magic Stone hex: the whole column takes its controller's colour and glows softly. */
function StoneColumn({ hex: h, height, owner }: { hex: Hex; height: number; owner: SideId | null }) {
  const mat = useRef<THREE.MeshLambertMaterial>(null);
  const light = useRef<THREE.Sprite>(null);
  const lightMat = useRef<THREE.SpriteMaterial>(null);
  useFrame(({ clock }) => {
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.2);
    let shown = owner;
    let glow = 0;
    const anim = useGame.getState().anim;
    if (anim) {
      const t = performance.now() - anim.start;
      for (const st of anim.steps) {
        if (st.kind !== 'capture' || !hexEq(st.hex, h) || t < st.t0) continue;
        const p = Math.min(1, (t - st.t0) / (st.t1 - st.t0));
        // ease in to the peak, ease out after it; colour flips at the brightest moment
        glow = p < 0.5 ? easeInOut(p / 0.5) : 1 - easeInOut((p - 0.5) / 0.5);
        if (p >= 0.5) shown = st.side;
      }
    }
    if (mat.current) {
      const c = shown === null ? STONE_NEUTRAL : SIDE_COLORS[shown];
      mat.current.color.set(c);
      mat.current.emissive.set(c);
      mat.current.emissiveIntensity = 0.24 + 0.18 * pulse + 1.2 * glow;
    }
    if (light.current && lightMat.current) {
      light.current.visible = glow > 0.001;
      const sc = 1 + 2.2 * glow;
      light.current.scale.set(sc, sc * 1.5, 1);
      lightMat.current.opacity = glow;
    }
  });
  const color = owner === null ? STONE_NEUTRAL : SIDE_COLORS[owner];
  return (
    <>
      <mesh geometry={columnGeo(height)}>
        <meshLambertMaterial ref={mat} color={color} emissive={color} emissiveIntensity={0.3} flatShading />
      </mesh>
      <sprite ref={light} visible={false} position={[0, height * STEP + 0.6, 0]} raycast={() => null} renderOrder={12}>
        <spriteMaterial ref={lightMat} map={lightTex} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
    </>
  );
}

function Tile({
  h,
  height,
  terrain,
  owner,
  depth,
}: {
  h: Hex;
  height: number;
  terrain: string;
  owner?: SideId | null;
  /** Water depth over this tile (0 = dry). */
  depth: number;
}) {
  const [x, z] = hexToWorld(h);
  const setHoverHex = useGame((s) => s.setHoverHex);
  const clickHex = useGame((s) => s.clickHex);
  const color = useMemo(() => {
    const c = new THREE.Color(terrainColor(terrain, height));
    // seen through the water: shallow floors a little darker, deep floors much darker
    if (depth === 1) c.lerp(new THREE.Color('#2f5a52'), 0.35);
    else if (depth >= 2) c.lerp(new THREE.Color('#0a1622'), 0.7);
    return `#${c.getHexString()}`;
  }, [terrain, height, depth]);
  const bushes = useMemo(() => {
    if (terrain !== 'rough' || depth > 0) return [];
    const seed = (h.q * 73856093) ^ (h.r * 19349663);
    return [0, 1, 2].map((i) => {
      const a = ((seed >>> (i * 5)) & 31) / 31 * Math.PI * 2;
      const r = 0.25 + (((seed >>> (i * 3)) & 7) / 7) * 0.4;
      return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
    });
  }, [terrain, h.q, h.r, depth]);
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHoverHex(h);
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    clickHex(h);
  };
  return (
    <group position={[x, 0, z]} onPointerMove={onMove} onClick={onClick}>
      {terrain === 'stone' ? (
        <StoneColumn hex={h} height={height} owner={owner ?? null} />
      ) : (
        <mesh geometry={columnGeo(height)}>
          <meshLambertMaterial color={color} flatShading />
        </mesh>
      )}
      {bushes.map(([bx, bz], i) => (
        <mesh key={i} position={[bx, height * STEP + 0.18, bz]}>
          <coneGeometry args={[0.16, 0.38, 5]} />
          <meshLambertMaterial color="#3d4a22" flatShading />
        </mesh>
      ))}
    </group>
  );
}

/** Pixel ripple texture for the water surface (tiles seamlessly). */
const rippleTex = (() => {
  const n = 32;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#d0d0d0';
  ctx.fillRect(0, 0, n, n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const w = Math.sin((x / n) * Math.PI * 4 + Math.sin((y / n) * Math.PI * 2) * 2) + Math.sin((y / n) * Math.PI * 6);
      if (w > 1.3) ctx.fillStyle = '#ffffff';
      else if (w < -1.4) ctx.fillStyle = '#a8a8a8';
      else continue;
      ctx.fillRect(x, y, 1, 1);
    }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

/** Axial hex containing world point (x, z). */
function worldToHex(x: number, z: number): Hex {
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

/** One continuous water surface over every water hex, in a single look. */
function Water({ match }: { match: MatchState }) {
  const setHoverHex = useGame((s) => s.setHoverHex);
  const clickHex = useGame((s) => s.clickHex);
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    for (const mh of match.map.hexes) {
      if (surfaceOf(mh, match.waterLevel) === 'land') continue;
      const [x, z] = hexToWorld(mh.hex);
      const g = new THREE.CircleGeometry(1, 6).rotateX(-Math.PI / 2).rotateY(Math.PI / 6).translate(x, 0, z);
      const pos = g.getAttribute('position');
      const uv = g.getAttribute('uv');
      for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 3, pos.getZ(i) / 3); // world-space UVs: seamless
      parts.push(g);
    }
    return parts.length ? mergeGeometries(parts) : null;
  }, [match.map, match.waterLevel]);
  useFrame((_, dt) => {
    rippleTex.offset.x += dt * 0.03;
    rippleTex.offset.y += dt * 0.012;
  });
  if (!geo) return null;
  const hexAt = (e: ThreeEvent<PointerEvent | MouseEvent>) => worldToHex(e.point.x, e.point.z);
  return (
    <mesh
      geometry={geo}
      position={[0, match.waterLevel * STEP - 0.06, 0]}
      onPointerMove={(e) => {
        e.stopPropagation();
        setHoverHex(hexAt(e));
      }}
      onClick={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        clickHex(hexAt(e));
      }}
    >
      <meshLambertMaterial color="#4a9aa2" map={rippleTex} transparent opacity={0.62} depthWrite={false} />
    </mesh>
  );
}

// ---------- highlights ----------

// ---------- range outlines & target markers ----------

export const LINE_COLORS = {
  move: '#ffffff',
  attack: '#ff4a3a',
  magic: '#4aa8ff',
  source: '#ffe066',
  summon: '#ffd23f',
} as const;

const PALE_SIDE = { 0: '#b8f0bf', 1: '#f5b8b8' } as const;

interface OutlineLayer {
  key: string;
  region: Map<string, Hex>;
  style: LineStyle;
}

const dashed = (color: string, phase: number): LineStyle => ({ color, width: 0.07, dash: { period: 0.3, phase } });

function toMap(hexes: Hex[]): Map<string, Hex> {
  return new Map(hexes.map((h) => [hexKey(h), h] as const));
}

/** What to outline this frame. */
function useOutlines(): OutlineLayer[] {
  const match = useGame((s) => s.match);
  const phase = useGame((s) => s.phase);
  const hoverHex = useGame((s) => s.hoverHex);
  const hoverUnitId = useGame((s) => s.hoverUnitId);
  const inspected = useGame((s) => s.inspected);
  return useMemo(() => {
    const u = activeUnit(match);
    const layers: OutlineLayer[] = [];
    if (!u || phase.kind === 'idle') return layers;
    const kind = kindOf(u.kind);

    // Toggled units: move (pale Side colour), Attack Reach (red dashed), Magic Reach (blue dashed).
    for (const id of inspected) {
      const o = match.units.find((x) => x.id === id);
      if (!o) continue;
      const r = unitReach(match, o);
      layers.push({ key: `i${id}m`, region: r.move, style: { color: PALE_SIDE[o.side], width: 0.05, opacity: 0.9 } });
      if (r.attack.size) layers.push({ key: `i${id}a`, region: r.attack, style: dashed(LINE_COLORS.attack, 0) });
      if (r.magic.size) layers.push({ key: `i${id}g`, region: r.magic, style: dashed(LINE_COLORS.magic, 0.5) });
    }

    if (phase.kind === 'move' && phase.selected) {
      layers.push({ key: 'move', region: unitReach(match, u).move, style: { color: LINE_COLORS.move, width: 0.08 } });
      const q = hoverQuick({ match, phase, hoverHex, hoverUnitId });
      if (q) {
        const src = [...(q.plans.attack?.sources ?? []), ...(q.plans.magic?.sources ?? [])];
        layers.push({ key: 'src', region: toMap(src), style: { color: LINE_COLORS.source, width: 0.06 } });
      }
    } else if (phase.kind === 'target') {
      const isAttack = phase.command === 'attack';
      const ab = isAttack ? null : magicAbility(kind, (phase.command as { magic: string }).magic);
      if (isAttack || (ab && ab.kind !== 'water')) {
        const range = isAttack ? kind.attack.range : (ab as { range: number }).range;
        const min = isAttack ? 1 : minAimDistance(ab as Parameters<typeof minAimDistance>[0]);
        const hexes = hexesInRange(phase.to, range).filter((h) => hexDistance(h, phase.to) >= min && mapHexAt(match.map, h));
        layers.push({ key: 'tgt', region: toMap(hexes), style: dashed(isAttack ? LINE_COLORS.attack : LINE_COLORS.magic, 0) });
      }
    } else if (phase.kind === 'summonDir') {
      const sk = kindOf(phase.summonKind);
      const hexes: Hex[] = [];
      for (const d of DIRS) {
        const h = neighbor(phase.to, d);
        const mh = mapHexAt(match.map, h);
        const occ = unitAt(match, h);
        if (mh && canStandOn(sk, mh, match.waterLevel) && (!occ || occ.id === u.id)) hexes.push(h);
      }
      layers.push({ key: 'sum', region: toMap(hexes), style: { color: LINE_COLORS.summon, width: 0.08 } });
    } else if (phase.kind === 'quickChoice') {
      layers.push({ key: 'src', region: toMap([phase.attack.dest, phase.magic.dest]), style: { color: LINE_COLORS.source, width: 0.06 } });
    }
    return layers;
  }, [match, phase, hoverHex, hoverUnitId, inspected]);
}

/** A translucent fence along the region boundary with a bright band on top. */
function OutlineMesh({ layer }: { layer: OutlineLayer }) {
  const match = useGame((s) => s.match);
  const { body, top, cap } = useMemo(() => {
    const segs = regionSegments(match, layer.region);
    const band = Math.min(0.09, layer.style.width * 1.3);
    // Edges running up/down the screen face the camera edge-on, so a vertical band vanishes there;
    // a flat band lying on the fence top is visible at every edge angle.
    const lifted = segs.map((sg) => ({ ...sg, a: sg.a.clone().setY(sg.a.y + FENCE_HEIGHT), b: sg.b.clone().setY(sg.b.y + FENCE_HEIGHT) }));
    return {
      body: fenceGeometry(segs, layer.style, 0, FENCE_HEIGHT - band),
      top: fenceGeometry(segs, layer.style, FENCE_HEIGHT - band, FENCE_HEIGHT),
      cap: ribbonGeometry(lifted, { ...layer.style, width: Math.max(0.06, layer.style.width) }),
    };
  }, [match, layer]);
  useEffect(
    () => () => {
      body.dispose();
      top.dispose();
      cap.dispose();
    },
    [body, top, cap],
  );
  const o = layer.style.opacity ?? 1;
  return (
    <>
      <mesh geometry={body} raycast={() => null} renderOrder={5}>
        <meshBasicMaterial color={layer.style.color} transparent opacity={0.22 * o} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh geometry={top} raycast={() => null} renderOrder={6}>
        <meshBasicMaterial color={layer.style.color} transparent opacity={o} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh geometry={cap} raycast={() => null} renderOrder={6}>
        <meshBasicMaterial color={layer.style.color} transparent opacity={o} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </>
  );
}

function Highlights() {
  const match = useGame((s) => s.match);
  const rawHover = useGame((s) => s.hoverHex);
  const phase = useGame((s) => s.phase);
  const layers = useOutlines();
  // While choosing a summon hex, ring the hex the cursor direction selects.
  const active = activeUnit(match);
  let hoverHex = rawHover;
  if (phase.kind === 'summonDir' && active) {
    const d = summonDirToward(match, active.id, phase.to, phase.summonKind, rawHover);
    hoverHex = d === null ? null : neighbor(phase.to, d);
  }
  return (
    <>
      {layers.map((l) => (
        <OutlineMesh key={l.key} layer={l} />
      ))}
      {hoverHex && mapHexAt(match.map, hoverHex) && (
        <mesh
          geometry={ringGeo}
          position={[hexToWorld(hoverHex)[0], topY(match, hoverHex) + 0.03, hexToWorld(hoverHex)[1]]}
          raycast={() => null}
        >
          <meshBasicMaterial color="#ffe066" transparent opacity={0.6} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}

export type TargetMark = 'attack' | 'magic' | 'both' | 'heal';

/** Units the acting unit can act on right now, and how. */
function useTargetMarks(): Map<number, TargetMark> {
  const match = useGame((s) => s.match);
  const phase = useGame((s) => s.phase);
  return useMemo(() => {
    const out = new Map<number, TargetMark>();
    const u = activeUnit(match);
    if (!u) return out;
    if (phase.kind === 'move' && phase.selected) {
      for (const t of match.units) {
        if (t.id === u.id) continue;
        const q = quickPlans(match, u, t);
        const a = !!q.attack;
        const m = !!q.magic && q.magic.affordable;
        if (a && m) out.set(t.id, 'both');
        else if (a) out.set(t.id, 'attack');
        else if (m) out.set(t.id, q.magic!.ability.kind === 'heal' ? 'heal' : 'magic');
      }
    } else if (phase.kind === 'target') {
      for (const t of match.units) {
        const command: Command =
          phase.command === 'attack' ? { type: 'attack', target: t.pos } : { type: 'magic', ability: phase.command.magic, target: t.pos };
        if (validateTurn(match, { unitId: u.id, to: phase.to, facing: phase.facing, command })) continue;
        if (phase.command === 'attack') out.set(t.id, 'attack');
        else out.set(t.id, magicAbility(kindOf(u.kind), phase.command.magic).kind === 'heal' ? 'heal' : 'magic');
      }
    }
    return out;
  }, [match, phase]);
}

// ---------- units ----------

function dirAngle(d: number): number {
  // world angle (radians, around Y) of a hex direction vector
  const v = [
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
  ][d];
  const [x, z] = hexToWorld({ q: v[0], r: v[1] });
  return Math.atan2(x, z);
}

const arrowGeo = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0.95);
  s.lineTo(-0.28, 0.6);
  s.lineTo(0.28, 0.6);
  s.closePath();
  return new THREE.ShapeGeometry(s).rotateX(Math.PI / 2);
})();

/** World position of a hex's standing surface. */
function worldAt(match: MatchState, h: Hex): THREE.Vector3 {
  const [x, z] = hexToWorld(h);
  return new THREE.Vector3(x, topY(match, h), z);
}

/** Sample a hex path at progress p ∈ [0,1]; also returns the segment's heading. */
function samplePath(match: MatchState, path: Hex[], p: number): { pos: THREE.Vector3; heading: number | null } {
  if (path.length < 2) return { pos: worldAt(match, path[0]), heading: null };
  const f = Math.min(Math.max(p, 0), 1) * (path.length - 1);
  const i = Math.min(Math.floor(f), path.length - 2);
  const a = worldAt(match, path[i]);
  const b = worldAt(match, path[i + 1]);
  const k = f - i;
  const pos = a.clone().lerp(b, k);
  // small hop per step so slides read as footsteps
  pos.y += Math.sin(k * Math.PI) * 0.12 + Math.max(0, b.y - a.y) * Math.sin(k * Math.PI) * 0.5;
  return { pos, heading: Math.atan2(b.x - a.x, b.z - a.z) };
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Sprite raycast that ignores transparent texels, so empty sprite corners don't steal clicks. */
function alphaRaycast(this: THREE.Sprite, raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
  const hits: THREE.Intersection[] = [];
  THREE.Sprite.prototype.raycast.call(this, raycaster, hits);
  const map = (this.material as THREE.SpriteMaterial).map;
  const img = map?.image as HTMLCanvasElement | undefined;
  for (const h of hits) {
    if (!img || !h.uv) {
      intersects.push(h);
      continue;
    }
    const x = Math.floor(h.uv.x * img.width);
    const y = Math.floor((1 - h.uv.y) * img.height);
    let data = alphaData.get(img);
    if (!data) alphaData.set(img, (data = img.getContext('2d')!.getImageData(0, 0, img.width, img.height).data));
    // a 1-texel margin makes thin parts easier to hit
    let solid = false;
    for (let dy = -1; dy <= 1 && !solid; dy++)
      for (let dx = -1; dx <= 1 && !solid; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < img.width && yy < img.height && data[(yy * img.width + xx) * 4 + 3] > 0) solid = true;
      }
    if (solid) intersects.push(h);
  }
}
const alphaData = new WeakMap<HTMLCanvasElement, Uint8ClampedArray>();

function UnitView({
  unit,
  displayPos,
  facing,
  isActive,
  previewPath,
  inspected = false,
  ghost = false,
  mark,
  clickThrough = false,
}: {
  unit: Unit;
  displayPos: Hex;
  facing: number;
  isActive: boolean;
  previewPath?: Hex[];
  /** Its ranges are toggled on. */
  inspected?: boolean;
  /** A translucent stand-in (e.g. a quick-action destination); not interactive. */
  ghost?: boolean;
  /** Valid quick-action / command target: draws a coloured sprite outline. */
  mark?: TargetMark;
  /** Let clicks pass through to the tiles (e.g. while choosing a summon hex). */
  clickThrough?: boolean;
}) {
  const outline = useRef<THREE.Sprite>(null);
  const outlineMat = useRef<THREE.SpriteMaterial>(null);
  const match = useGame((s) => s.match);
  const hoverUnitId = useGame((s) => s.hoverUnitId);
  const setHoverUnit = useGame((s) => s.setHoverUnit);
  const setHoverHex = useGame((s) => s.setHoverHex);
  const clickHex = useGame((s) => s.clickHex);
  const group = useRef<THREE.Group>(null);
  const arrow = useRef<THREE.Mesh>(null);
  const body = useRef<THREE.Sprite>(null);
  const bodyMat = useRef<THREE.SpriteMaterial>(null);
  const [tx, tz] = hexToWorld(displayPos);
  const ty = topY(match, displayPos);
  const tex = useMemo(() => unitTexture(unit.kind, unit.side), [unit.kind, unit.side]);
  const size = spriteWorldSize(unit.kind);
  const lift = size / 2 - spriteFeetOffset(unit.kind) + 0.05;
  const scale = spriteTopHeight(unit.kind) - 0.2; // top of the figure, for anchors above it
  const hovered = hoverUnitId === unit.id;
  const baseColor = hovered ? '#ffffcc' : '#ffffff';

  // Local slide for the player's (uncommitted) move preview.
  const previewKey = previewPath ? previewPath.map(hexKey).join('>') : '';
  const preview = useRef<{ key: string; start: number }>({ key: '', start: 0 });
  if (preview.current.key !== previewKey) preview.current = { key: previewKey, start: performance.now() };

  useEffect(() => {
    if (ghost) return;
    const v = new THREE.Vector3();
    const mk = (dy: number) => () => (group.current ? group.current.getWorldPosition(v).add(new THREE.Vector3(0, dy, 0)) : null);
    anchorSources.set(`unit:${unit.id}`, mk(scale + 0.3));
    anchorSources.set(`tag:${unit.id}`, mk(scale + 0.55));
    return () => {
      anchorSources.delete(`unit:${unit.id}`);
      anchorSources.delete(`tag:${unit.id}`);
    };
  }, [unit.id, scale, ghost]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const now = performance.now();
    const anim = useGame.getState().anim;
    let pos: THREE.Vector3 | null = null;
    let heading: number | null = null;
    const offset = new THREE.Vector3();
    let flash = 0;
    let glow = 0;

    if (anim) {
      const t = now - anim.start;
      for (const st of anim.steps) {
        if (st.kind === 'move' && st.unitId === unit.id) {
          const p = (t - st.t0) / (st.t1 - st.t0);
          if (p <= 1) ({ pos, heading } = samplePath(match, st.path, p));
        } else if (st.kind === 'melee' && st.unitId === unit.id && t >= st.t0 && t <= st.t1) {
          const a = worldAt(match, st.from);
          const b = worldAt(match, st.target);
          const dir = b.sub(a).setY(0).normalize();
          const p = (t - st.t0) / (st.t1 - st.t0);
          // wind up (pull back), bonk (lunge), recover
          let d: number;
          if (p < 0.45) d = -0.38 * easeInOut(p / 0.45);
          else if (p < 0.6) d = -0.38 + 1.03 * ((p - 0.45) / 0.15);
          else d = 0.65 * (1 - easeInOut((p - 0.6) / 0.4));
          offset.addScaledVector(dir, d);
          offset.y += p < 0.45 ? 0.12 * (p / 0.45) : p < 0.6 ? 0.12 : 0.12 * (1 - (p - 0.6) / 0.4);
        } else if (st.kind === 'summon' && st.unitId === unit.id && t >= st.t0 && t <= st.t1) {
          const p = (t - st.t0) / (st.t1 - st.t0);
          const { approachEnd, backStart } = SUMMON_PHASES;
          const a = worldAt(match, st.from);
          const dir = worldAt(match, st.target).sub(a).setY(0).normalize();
          const reach = 0.38;
          const d =
            p < approachEnd ? reach * easeInOut(p / approachEnd) : p < backStart ? reach : reach * (1 - easeInOut((p - backStart) / (1 - backStart)));
          offset.addScaledVector(dir, d);
          glow = p < approachEnd ? p / approachEnd : p < backStart ? 1 : 1 - (p - backStart) / (1 - backStart);
        } else if (st.kind === 'hit' && st.unitIds.includes(unit.id) && t >= st.t0 && t <= st.t1) {
          const p = (t - st.t0) / (st.t1 - st.t0);
          offset.x += Math.sin(p * Math.PI * 8) * 0.07 * (1 - p);
          flash = 1 - p;
        }
      }
    } else if (previewPath && previewPath.length > 1) {
      const p = (now - preview.current.start) / (MS_PER_HEX * (previewPath.length - 1));
      if (p <= 1) ({ pos, heading } = samplePath(match, previewPath, p));
    }

    if (pos) {
      g.position.copy(pos);
    } else {
      const s = Math.min(1, dt * 12);
      g.position.x += (tx - g.position.x) * s;
      g.position.y += (ty - g.position.y) * s;
      g.position.z += (tz - g.position.z) * s;
    }
    if (body.current) body.current.position.set(offset.x, lift + offset.y, offset.z);
    if (arrow.current) arrow.current.rotation.y = heading ?? dirAngle(facing);
    if (bodyMat.current) {
      bodyMat.current.color.set(baseColor).lerp(new THREE.Color('#ff4040'), flash * 0.8);
      if (glow > 0) bodyMat.current.color.lerp(new THREE.Color('#fff3b0'), 0.5 * glow).multiplyScalar(1 + 0.9 * glow);
      const frame = idleFrameAt(now, (unit.id * 1.37) % 4);
      let shown = facing;
      if (heading !== null) shown = facingForHeading(heading);
      else if (anim && anim.actorId === unit.id) shown = anim.facing;
      const tex = unitFrameTexture(unit.kind, unit.side, frame, shown);
      if (bodyMat.current.map !== tex) bodyMat.current.map = tex;
      if (outlineMat.current && mark) {
        const ot = unitOutlineTexture(unit.kind, unit.side, frame, shown);
        if (outlineMat.current.map !== ot) {
          outlineMat.current.map = ot;
          outlineMat.current.needsUpdate = true;
        }
        const both = mark === 'both' && Math.floor(now / 400) % 2 === 1;
        outlineMat.current.color.set(mark === 'heal' ? '#5fe07a' : mark === 'magic' || both ? LINE_COLORS.magic : LINE_COLORS.attack);
        outlineMat.current.opacity = 0.75 + 0.25 * Math.sin(now / 160);
      }
    }
    if (outline.current && body.current) outline.current.position.copy(body.current.position);
  });

  return (
    <group ref={group} position={[tx, ty, tz]}>
      <mesh ref={arrow} geometry={arrowGeo} rotation={[0, dirAngle(facing), 0]} position={[0, 0.03, 0]} raycast={() => null}>
        <meshBasicMaterial color={SIDE_COLORS[unit.side]} side={THREE.DoubleSide} />
      </mesh>
      {!ghost && (hovered || isActive || inspected) && (
        <mesh geometry={ringGeo} position={[0, 0.04, 0]} raycast={() => null}>
          <meshBasicMaterial color={hovered ? '#ffe066' : inspected ? '#9fd0ff' : '#ffffff'} transparent opacity={0.9} />
        </mesh>
      )}
      {mark && !ghost && (
        <sprite ref={outline} scale={[size, size, 1]} position={[0, lift, 0]} raycast={() => null} renderOrder={9}>
          <spriteMaterial ref={outlineMat} transparent alphaTest={0.3} depthTest={false} />
        </sprite>
      )}
      <sprite
        ref={body}
        renderOrder={10}
        scale={[size, size, 1]}
        position={[0, lift, 0]}
        raycast={ghost || clickThrough ? () => null : alphaRaycast}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoverUnit(unit.id);
        }}
        onPointerOut={() => setHoverUnit(null)}
        onPointerMove={(e) => {
          e.stopPropagation();
          setHoverHex(displayPos);
        }}
        onClick={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          clickHex(displayPos);
        }}
      >
        <spriteMaterial ref={bodyMat} map={tex} transparent alphaTest={ghost ? 0.2 : 0.5} color={baseColor} opacity={ghost ? 0.45 : 1} depthWrite={!ghost} />
      </sprite>
    </group>
  );
}

function Units() {
  const match = useGame((s) => s.match);
  const phase = useGame((s) => s.phase);
  const hoverHex = useGame((s) => s.hoverHex);
  const hoverUnitId = useGame((s) => s.hoverUnitId);
  const inspected = useGame((s) => s.inspected);
  const anim = useGame((s) => s.anim);
  const active = activeUnit(match);
  const marks = useTargetMarks();
  const summonDir =
    active && phase.kind === 'summonDir' ? summonDirToward(match, active.id, phase.to, phase.summonKind, hoverHex) : null;
  const quick = useMemo(() => hoverQuick({ match, phase, hoverHex, hoverUnitId }), [match, phase, hoverHex, hoverUnitId]);
  // Quick-action destinations: shown as instant ghosts; the acting unit stays put.
  const ghosts = useMemo(() => {
    if (!active || !quick) return [];
    const out: { key: string; at: Hex; label: 'A' | 'M' }[] = [];
    if (quick.plans.attack) out.push({ key: 'A', at: quick.plans.attack.dest, label: 'A' });
    if (quick.plans.magic) out.push({ key: 'M', at: quick.plans.magic.dest, label: 'M' });
    return out;
  }, [active, quick]);
  useEffect(() => {
    for (const k of ['ghost:A', 'ghost:M']) anchorSources.delete(k);
    for (const g of ghosts) {
      const v = worldAt(match, g.at).add(new THREE.Vector3(0, 0.25, 0));
      anchorSources.set(`ghost:${g.label}`, () => v);
    }
    return () => {
      for (const k of ['ghost:A', 'ghost:M']) anchorSources.delete(k);
    };
  }, [ghosts, match]);
  const shownAt = active && 'to' in phase ? { to: phase.to, facing: phase.facing } : null;
  const previewPath = useMemo(() => {
    if (!active || !shownAt || hexEq(active.pos, shownAt.to)) return undefined;
    return pathTo(reachable(match, active), shownAt.to);
  }, [match, active, shownAt?.to.q, shownAt?.to.r]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {match.units.map((u) => {
        let pos = u.pos;
        let facing: number = u.facing;
        let path: Hex[] | undefined;
        if (anim && u.id === anim.actorId) {
          pos = anim.to;
          facing = anim.facing;
        } else if (active && u.id === active.id && shownAt) {
          pos = shownAt.to;
          facing = shownAt.facing;
          path = previewPath;
          if (phase.kind === 'summonDir' && summonDir !== null) facing = summonDir;
        }
        return (
          <UnitView
            key={u.id}
            unit={u}
            displayPos={pos}
            facing={facing}
            isActive={active?.id === u.id}
            previewPath={path}
            inspected={inspected.includes(u.id)}
            mark={marks.get(u.id)}
            clickThrough={phase.kind === 'summonDir'}
          />
        );
      })}
      {active && phase.kind === 'summonDir' && summonDir !== null && (
        <UnitView
          key={`summonGhost${summonDir}`}
          unit={{ id: -1, kind: phase.summonKind, side: active.side, pos: neighbor(phase.to, summonDir), facing: summonDir, hp: 10, av: 0, stranded: false }}
          displayPos={neighbor(phase.to, summonDir)}
          facing={summonDir}
          isActive={false}
          ghost
        />
      )}
      {active &&
        quick &&
        ghosts.map((g) => (
          <UnitView
            key={`ghost${g.key}${hexKey(g.at)}`}
            unit={active}
            displayPos={g.at}
            facing={facingTowardTarget(g.at, quick.target.pos, active.facing)}
            isActive={false}
            ghost
          />
        ))}
    </>
  );
}

// ---------- projectiles ----------

function Projectile({ step }: { step: Extract<AnimStep, { kind: 'projectile' }> }) {
  const match = useGame((s) => s.match);
  const ref = useRef<THREE.Sprite>(null);
  const mat = useRef<THREE.SpriteMaterial>(null);
  const tex = useMemo(() => projectileTexture(step.style, step.element, step.heal), [step.style, step.element, step.heal]);
  const a = useMemo(() => worldAt(match, step.from).add(new THREE.Vector3(0, 0.7, 0)), [match, step.from]);
  const b = useMemo(() => worldAt(match, step.to).add(new THREE.Vector3(0, 0.7, 0)), [match, step.to]);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const anim = useGame.getState().anim;
    const sp = ref.current;
    if (!sp || !anim) return;
    const t = performance.now() - anim.start;
    const p = (t - step.t0) / (step.t1 - step.t0);
    sp.visible = p >= 0 && p <= 1;
    if (!sp.visible) return;
    // High: a tall lob that grows with distance. Direct: a straight line.
    const arc = step.high ? 1.2 + 0.35 * a.distanceTo(b) : 0;
    const at = (q: number) => tmp.copy(a).lerp(b, q).setY(a.y + (b.y - a.y) * q + 4 * q * (1 - q) * arc);
    const cur = at(p).clone();
    sp.position.copy(cur);
    if (mat.current) {
      if (step.style === 'arrow') {
        // point along the on-screen velocity
        const next = at(Math.min(1, p + 0.02)).clone();
        const s0 = cur.clone().project(camera);
        const s1 = next.project(camera);
        mat.current.rotation = Math.atan2(s1.y - s0.y, s1.x - s0.x);
      } else {
        mat.current.rotation += 0.2;
        const pulse = 1 + Math.sin(t * 0.03) * 0.15;
        sp.scale.set(0.6 * pulse, 0.6 * pulse, 1);
      }
    }
  });
  return (
    <sprite ref={ref} visible={false} scale={step.style === "arrow" ? [0.8, 0.4, 1] : [0.6, 0.6, 1]} raycast={() => null}>
      <spriteMaterial ref={mat} map={tex} transparent depthTest={false} />
    </sprite>
  );
}


/** The bright light on the summoned hex and the summon fading in inside it. */
function SummonFx({ step }: { step: Extract<AnimStep, { kind: 'summon' }> }) {
  const match = useGame((s) => s.match);
  const light = useRef<THREE.Sprite>(null);
  const lightMat = useRef<THREE.SpriteMaterial>(null);
  const body = useRef<THREE.SpriteMaterial>(null);
  const bodySprite = useRef<THREE.Sprite>(null);
  const base = useMemo(() => worldAt(match, step.target), [match, step.target]);
  const size = spriteWorldSize(step.summonKind);
  const lift = size / 2 - spriteFeetOffset(step.summonKind) + 0.05;
  useFrame(() => {
    const anim = useGame.getState().anim;
    if (!anim) return;
    const t = performance.now() - anim.start;
    const p = (t - step.t0) / (step.t1 - step.t0);
    const { lightStart, fadeStart, fadeEnd } = SUMMON_PHASES;
    // light: bloom in, hold, fade out as the summon solidifies
    const lp = p < lightStart ? 0 : p < fadeStart ? (p - lightStart) / (fadeStart - lightStart) : p < fadeEnd ? 1 : Math.max(0, 1 - (p - fadeEnd) / 0.2);
    if (light.current && lightMat.current) {
      const s = 0.4 + 2.4 * lp;
      light.current.scale.set(s, s * 1.3, 1);
      lightMat.current.opacity = lp;
    }
    const fp = p < fadeStart ? 0 : p < fadeEnd ? (p - fadeStart) / (fadeEnd - fadeStart) : 1;
    if (body.current && bodySprite.current) {
      body.current.opacity = fp;
      body.current.color.setScalar(1 + (1 - fp) * 1.5); // starts bright inside the light
      bodySprite.current.visible = fp > 0;
      const tex = unitFrameTexture(step.summonKind, step.side, idleFrameAt(performance.now(), 0), step.facing);
      if (body.current.map !== tex) body.current.map = tex;
    }
  });
  return (
    <group position={base}>
      <sprite ref={bodySprite} scale={[size, size, 1]} position={[0, lift, 0]} raycast={() => null} renderOrder={11}>
        <spriteMaterial ref={body} map={unitTexture(step.summonKind, step.side)} transparent opacity={0} alphaTest={0.05} depthWrite={false} />
      </sprite>
      <sprite ref={light} position={[0, 0.9, 0]} raycast={() => null} renderOrder={12}>
        <spriteMaterial ref={lightMat} map={lightTex} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
    </group>
  );
}

function Projectiles() {
  const anim = useGame((s) => s.anim);
  if (!anim) return null;
  return (
    <>
      {anim.steps.map((st, i) =>
        st.kind === 'projectile' ? (
          <Projectile key={`${anim.start}:${i}`} step={st} />
        ) : st.kind === 'summon' ? (
          <SummonFx key={`${anim.start}:${i}`} step={st} />
        ) : null,
      )}
    </>
  );
}

// ---------- projection of overlay anchors ----------

function Projector() {
  const match = useGame((s) => s.match);
  const phase = useGame((s) => s.phase);
  useEffect(() => {
    if (!('to' in phase)) return;
    const [x, z] = hexToWorld(phase.to);
    const y = topY(match, phase.to) + 0.8;
    anchorSources.set('menu', () => new THREE.Vector3(x, y, z));
    return () => {
      anchorSources.delete('menu');
    };
  }, [match, phase]);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const [id, src] of anchorSources) {
      const w = src();
      if (!w) continue;
      v.copy(w).project(camera);
      anchorPositions.set(id, { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height });
    }
  });
  return null;
}

// ---------- scene ----------

function Scene() {
  const match = useGame((s) => s.match);
  const setHoverHex = useGame((s) => s.setHoverHex);
  const center = useMemo(() => {
    const xs = match.map.hexes.map((h) => hexToWorld(h.hex));
    const cx = xs.reduce((a, p) => a + p[0], 0) / xs.length;
    const cz = xs.reduce((a, p) => a + p[1], 0) / xs.length;
    return [cx, cz] as const;
  }, [match.map]);
  const { camera } = useThree();
  useEffect(() => {
    // straight-on: rows run across the screen, flat hex sides vertical
    camera.position.set(center[0], 24, center[1] + 26);
    camera.lookAt(center[0], 0, center[1]);
    camera.updateProjectionMatrix();
  }, [camera, center]);

  return (
    <>
      <color attach="background" args={['#1b2233']} />
      <hemisphereLight args={['#dfe8ff', '#3a3320', 0.9]} />
      <directionalLight position={[10, 20, 8]} intensity={1.6} />
      <CameraControls />
      <group onPointerLeave={() => setHoverHex(null)}>
        {match.map.hexes.map((mh) => (
          <Tile
            key={hexKey(mh.hex)}
            h={mh.hex}
            height={mh.height}
            terrain={mh.terrain}
            owner={mh.terrain === 'stone' ? (match.stones.find((s) => hexEq(s.hex, mh.hex))?.owner ?? null) : undefined}
            depth={Math.max(0, match.waterLevel - mh.height)}
          />
        ))}
      </group>
      <Water match={match} />
      <Highlights />
      <Units />
      <Projectiles />
      <Projector />
    </>
  );
}

export function Board() {
  const pixelSize = useGame((s) => s.pixelSize);
  setSpritePixelSize(pixelSize);
  return (
    <>
    <Canvas
      orthographic
      camera={{ zoom: 38, near: -200, far: 400 }}
      dpr={1 / pixelSize}
      gl={{ antialias: false }}
      style={{ imageRendering: pixelSize > 1 ? 'pixelated' : 'auto' }}
    >
      <Scene />
    </Canvas>
    <Overlay />
    </>
  );
}
