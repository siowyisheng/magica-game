import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  type Hex,
  type MatchState,
  type Unit,
  activeUnit,
  affectedUnits,
  attackTargets,
  canStandOn,
  getUnit,
  hexDistance,
  hexEq,
  hexKey,
  hexesInRange,
  kindOf,
  magicAbility,
  magicTargetHexes,
  mapHexAt,
  neighbor,
  pathTo,
  reachable,
  surfaceHeight,
  surfaceOf,
  unitAt,
  DIRS,
  facingToward,
} from '../rules';
import { useGame } from '../store';
import { SIDE_COLORS, unitTexture } from './sprites';
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
const capGeo = new THREE.CircleGeometry(0.92, 6).rotateX(-Math.PI / 2).rotateY(Math.PI / 6 * 0);
const ringGeo = new THREE.RingGeometry(0.78, 0.95, 6).rotateX(-Math.PI / 2);

function terrainColor(terrain: string, height: number): string {
  const c = new THREE.Color(terrain === 'rough' ? '#5d6b34' : terrain === 'stone' ? '#77806a' : '#8f9a52');
  c.offsetHSL(0, 0, (height - 3) * 0.05);
  return `#${c.getHexString()}`;
}

function Tile({ h, height, terrain }: { h: Hex; height: number; terrain: string }) {
  const [x, z] = hexToWorld(h);
  const setHoverHex = useGame((s) => s.setHoverHex);
  const clickHex = useGame((s) => s.clickHex);
  const color = useMemo(() => terrainColor(terrain, height), [terrain, height]);
  const bushes = useMemo(() => {
    if (terrain !== 'rough') return [];
    const seed = (h.q * 73856093) ^ (h.r * 19349663);
    return [0, 1, 2].map((i) => {
      const a = ((seed >>> (i * 5)) & 31) / 31 * Math.PI * 2;
      const r = 0.25 + (((seed >>> (i * 3)) & 7) / 7) * 0.4;
      return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
    });
  }, [terrain, h.q, h.r]);
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
      <mesh geometry={columnGeo(height)}>
        <meshLambertMaterial color={color} flatShading />
      </mesh>
      {bushes.map(([bx, bz], i) => (
        <mesh key={i} position={[bx, height * STEP + 0.18, bz]}>
          <coneGeometry args={[0.16, 0.38, 5]} />
          <meshLambertMaterial color="#3d4a22" flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Water({ match }: { match: MatchState }) {
  const setHoverHex = useGame((s) => s.setHoverHex);
  const clickHex = useGame((s) => s.clickHex);
  const water = match.map.hexes.filter((mh) => surfaceOf(mh, match.waterLevel) !== 'land');
  return (
    <>
      {water.map((mh) => {
        const [x, z] = hexToWorld(mh.hex);
        const deep = surfaceOf(mh, match.waterLevel) === 'deep';
        return (
          <mesh
            key={hexKey(mh.hex)}
            geometry={capGeo}
            position={[x, match.waterLevel * STEP - 0.06, z]}
            scale={[1.06, 1, 1.06]}
            onPointerMove={(e) => {
              e.stopPropagation();
              setHoverHex(mh.hex);
            }}
            onClick={(e) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              clickHex(mh.hex);
            }}
          >
            <meshLambertMaterial color={deep ? '#1f4d8f' : '#3f86c4'} transparent opacity={deep ? 0.88 : 0.7} />
          </mesh>
        );
      })}
    </>
  );
}

function Stones({ match }: { match: MatchState }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    ref.current?.children.forEach((c) => (c.rotation.y += dt * 0.8));
  });
  return (
    <group ref={ref}>
      {match.stones.map((s) => {
        const [x, z] = hexToWorld(s.hex);
        const mh = mapHexAt(match.map, s.hex)!;
        const color = s.owner === null ? '#e8e8ff' : SIDE_COLORS[s.owner];
        return (
          <mesh key={hexKey(s.hex)} position={[x + 0.45, mh.height * STEP + 0.3, z - 0.25]}>
            <octahedronGeometry args={[0.22]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} flatShading />
          </mesh>
        );
      })}
    </group>
  );
}

// ---------- highlights ----------

interface Mark {
  h: Hex;
  color: string;
  opacity: number;
}

function useMarks(): Mark[] {
  const match = useGame((s) => s.match);
  const phase = useGame((s) => s.phase);
  const hoverHex = useGame((s) => s.hoverHex);
  return useMemo(() => {
    const u = activeUnit(match);
    const marks: Mark[] = [];
    if (!u) return marks;
    const kind = kindOf(u.kind);
    if (phase.kind === 'move') {
      const nodes = reachable(match, u);
      for (const n of nodes.values()) if (n.canEnd) marks.push({ h: n.hex, color: '#fff6c8', opacity: 0.38 });
      if (hoverHex) {
        const n = nodes.get(hexKey(hoverHex));
        if (n?.canEnd) for (const p of pathTo(nodes, hoverHex)) marks.push({ h: p, color: '#ffd23f', opacity: 0.5 });
      }
    } else if (phase.kind === 'target') {
      const view = { ...match, units: match.units.map((x) => (x.id === u.id ? { ...x, pos: phase.to } : x)) };
      const caster = getUnit(view, u.id);
      if (phase.command === 'attack') {
        const a = kind.attack;
        for (const h of hexesInRange(phase.to, a.maxRange))
          if (hexDistance(h, phase.to) >= a.minRange && mapHexAt(match.map, h)) marks.push({ h, color: '#ff6a4f', opacity: 0.22 });
        for (const t of attackTargets(view, caster, phase.to)) marks.push({ h: t.pos, color: '#ff3b1f', opacity: 0.55 });
      } else {
        const ab = magicAbility(kind, phase.command.magic);
        if (ab.kind !== 'water') {
          for (const h of hexesInRange(phase.to, ab.maxRange))
            if (hexDistance(h, phase.to) >= ab.minRange && mapHexAt(match.map, h)) marks.push({ h, color: '#b46cff', opacity: 0.2 });
          const valid = magicTargetHexes(match, u, ab, phase.to);
          for (const h of valid) marks.push({ h, color: '#c98bff', opacity: 0.45 });
          if (hoverHex && valid.some((v) => hexEq(v, hoverHex))) {
            for (const h of hexesInRange(hoverHex, ab.radius)) marks.push({ h, color: '#ffe066', opacity: 0.45 });
            void affectedUnits;
          }
        }
      }
    } else if (phase.kind === 'summonDir') {
      const sk = kindOf(phase.summonKind);
      for (const d of DIRS) {
        const h = neighbor(phase.to, d);
        const mh = mapHexAt(match.map, h);
        const occ = unitAt(match, h);
        if (mh && canStandOn(sk, mh, match.waterLevel) && (!occ || occ.id === u.id) && !hexEq(h, phase.to))
          marks.push({ h, color: '#ffd23f', opacity: 0.5 });
      }
    } else if (phase.kind === 'facing') {
      for (const d of DIRS) {
        const h = neighbor(phase.to, d);
        if (mapHexAt(match.map, h)) marks.push({ h, color: '#ffffff', opacity: 0.12 });
      }
    }
    if (hoverHex && mapHexAt(match.map, hoverHex)) marks.push({ h: hoverHex, color: '#ffe066', opacity: 0.25 });
    return marks;
  }, [match, phase, hoverHex]);
}

function Highlights() {
  const match = useGame((s) => s.match);
  const marks = useMarks();
  return (
    <>
      {marks.map((m, i) => {
        const [x, z] = hexToWorld(m.h);
        return (
          <mesh key={i} geometry={capGeo} position={[x, topY(match, m.h) + 0.02 + i * 0.0005, z]} raycast={() => null}>
            <meshBasicMaterial color={m.color} transparent opacity={m.opacity} depthWrite={false} />
          </mesh>
        );
      })}
    </>
  );
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

function UnitView({ unit, displayPos, facing, isActive }: { unit: Unit; displayPos: Hex; facing: number; isActive: boolean }) {
  const match = useGame((s) => s.match);
  const hoverUnitId = useGame((s) => s.hoverUnitId);
  const setHoverUnit = useGame((s) => s.setHoverUnit);
  const setHoverHex = useGame((s) => s.setHoverHex);
  const clickHex = useGame((s) => s.clickHex);
  const group = useRef<THREE.Group>(null);
  const [tx, tz] = hexToWorld(displayPos);
  const ty = topY(match, displayPos);
  const tex = useMemo(() => unitTexture(unit.kind, unit.side), [unit.kind, unit.side]);
  const k = kindOf(unit.kind);
  const scale = k.isSummoner ? 1.35 : k.role === 'dragon' || k.role === 'tank' ? 1.3 : 1.1;
  const hovered = hoverUnitId === unit.id;

  useEffect(() => {
    const v = new THREE.Vector3();
    const mk = (dy: number) => () => (group.current ? group.current.getWorldPosition(v).add(new THREE.Vector3(0, dy, 0)) : null);
    anchorSources.set(`unit:${unit.id}`, mk(scale + 0.3));
    anchorSources.set(`tag:${unit.id}`, mk(scale + 0.55));
    return () => {
      anchorSources.delete(`unit:${unit.id}`);
      anchorSources.delete(`tag:${unit.id}`);
    };
  }, [unit.id, scale]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const t = Math.min(1, dt * 10);
    g.position.x += (tx - g.position.x) * t;
    g.position.y += (ty - g.position.y) * t;
    g.position.z += (tz - g.position.z) * t;
  });

  return (
    <group ref={group} position={[tx, ty, tz]}>
      <mesh geometry={arrowGeo} rotation={[0, dirAngle(facing), 0]} position={[0, 0.03, 0]} raycast={() => null}>
        <meshBasicMaterial color={SIDE_COLORS[unit.side]} side={THREE.DoubleSide} />
      </mesh>
      {(hovered || isActive) && (
        <mesh geometry={ringGeo} position={[0, 0.04, 0]} raycast={() => null}>
          <meshBasicMaterial color={hovered ? '#ffe066' : '#ffffff'} transparent opacity={0.9} />
        </mesh>
      )}
      <sprite
        scale={[scale * (18 / 22), scale, 1]}
        position={[0, scale / 2 + 0.05, 0]}
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
        <spriteMaterial map={tex} transparent alphaTest={0.5} color={hovered ? '#ffffcc' : '#ffffff'} />
      </sprite>
    </group>
  );
}

function Units() {
  const match = useGame((s) => s.match);
  const phase = useGame((s) => s.phase);
  const hoverHex = useGame((s) => s.hoverHex);
  const active = activeUnit(match);
  return (
    <>
      {match.units.map((u) => {
        let pos = u.pos;
        let facing: number = u.facing;
        if (active && u.id === active.id && 'to' in phase) {
          pos = phase.to;
          if (phase.kind === 'facing' && hoverHex && !hexEq(hoverHex, phase.to)) facing = facingToward(phase.to, hoverHex);
        }
        return <UnitView key={u.id} unit={u} displayPos={pos} facing={facing} isActive={active?.id === u.id} />;
      })}
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
    camera.position.set(center[0] + 14, 22, center[1] + 22);
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
          <Tile key={hexKey(mh.hex)} h={mh.hex} height={mh.height} terrain={mh.terrain} />
        ))}
      </group>
      <Water match={match} />
      <Stones match={match} />
      <Highlights />
      <Units />
      <Projector />
    </>
  );
}

export function Board() {
  const pixelSize = useGame((s) => s.pixelSize);
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
