// Spell and status effects drawn in the 3D scene: the Empower animation and
// the reusable status aura a buffed Unit wears.

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { EMPOWER_PEAK, animElapsed, type AnimStep } from '../anim';
import { useGame } from '../store';

/** A soft round glow, white at the centre: tint it with the material colour. */
export const glowTex = (() => {
  const n = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, n, n);
  return new THREE.CanvasTexture(cv);
})();

/** Colour of Empower (warm gold), its spell and its aura. */
export const EMPOWER_COLOR = '#ffb02e';

const easeOut = (p: number) => 1 - (1 - p) * (1 - p);
const bell = (p: number) => Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, p))));

const MOTES = 10;
const SPARKS = 8;

/**
 * The Empower animation: golden motes spiral from the caster to the target
 * (or up round the caster when it empowers itself), then a column of light
 * rises round the target with sparks climbing it and a ring flashing on the
 * ground at the peak, when the bonus lands.
 */
export function EmpowerFx({ step, from, to }: { step: Extract<AnimStep, { kind: 'empower' }>; from: THREE.Vector3; to: THREE.Vector3 }) {
  const motes = useRef<(THREE.Sprite | null)[]>([]);
  const sparks = useRef<(THREE.Sprite | null)[]>([]);
  const column = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const self = from.distanceTo(to) < 0.01;
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const anim = useGame.getState().anim;
    if (!anim) return;
    const p = (animElapsed(anim) - step.t0) / (step.t1 - step.t0);
    const on = p >= 0 && p <= 1;
    // motes: the first 45%, travelling in a helix
    motes.current.forEach((m, i) => {
      if (!m) return;
      const q = (p - i * 0.012) / 0.45;
      m.visible = on && q >= 0 && q <= 1;
      if (!m.visible) return;
      const a = q * Math.PI * 3 + (i / MOTES) * Math.PI * 2;
      const r = 0.22 * (1 - q * 0.6);
      tmp.copy(from).lerp(to, self ? 0 : easeOut(q));
      m.position.set(tmp.x + Math.cos(a) * r, tmp.y + 0.25 + (self ? q * 0.6 : 0.45 + Math.sin(q * Math.PI) * 0.35), tmp.z + Math.sin(a) * r);
      const s = 0.2 + 0.08 * Math.sin(i + q * 9);
      m.scale.set(s, s, 1);
      (m.material as THREE.SpriteMaterial).opacity = Math.min(1, 4 * (1 - q));
    });
    // column of light round the target
    const c = (p - 0.35) / 0.65; // 0..1 over the last 65%
    const peak = (EMPOWER_PEAK - 0.35) / 0.65;
    if (column.current) {
      column.current.visible = on && c >= 0;
      if (column.current.visible) {
        const h = 0.2 + 1.1 * easeOut(Math.min(1, c / peak));
        column.current.scale.set(1, h, 1);
        column.current.position.y = h / 2;
        (column.current.material as THREE.MeshBasicMaterial).opacity = 0.55 * (c < peak ? c / peak : 1 - (c - peak) / (1 - peak));
      }
    }
    sparks.current.forEach((s, i) => {
      if (!s) return;
      const q = (c - (i / SPARKS) * 0.4) / 0.6;
      s.visible = on && q >= 0 && q <= 1;
      if (!s.visible) return;
      const a = (i / SPARKS) * Math.PI * 2 + q * 2;
      s.position.set(Math.cos(a) * 0.3, 0.1 + q * 1.2, Math.sin(a) * 0.3);
      const k = 0.1 + 0.05 * bell(q);
      s.scale.set(k * 0.6, k * 1.6, 1);
      (s.material as THREE.SpriteMaterial).opacity = bell(q);
    });
    if (ring.current) {
      const r = (c - peak) / 0.35;
      ring.current.visible = on && r >= 0 && r <= 1;
      if (ring.current.visible) {
        const sc = 0.4 + 0.9 * easeOut(r);
        ring.current.scale.set(sc, sc, sc);
        (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - r);
      }
    }
  });
  return (
    <>
      {Array.from({ length: MOTES }, (_, i) => (
        <sprite key={`m${i}`} ref={(el) => (motes.current[i] = el)} visible={false} raycast={() => null} renderOrder={21}>
          <spriteMaterial map={glowTex} color={i % 3 ? EMPOWER_COLOR : '#fff3c0'} transparent blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
        </sprite>
      ))}
      <group position={[to.x, to.y, to.z]}>
        <mesh ref={column} visible={false} raycast={() => null} renderOrder={19}>
          <cylinderGeometry args={[0.34, 0.42, 1, 24, 1, true]} />
          <meshBasicMaterial color={EMPOWER_COLOR} transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        {Array.from({ length: SPARKS }, (_, i) => (
          <sprite key={`s${i}`} ref={(el) => (sparks.current[i] = el)} visible={false} raycast={() => null} renderOrder={21}>
            <spriteMaterial map={glowTex} color="#fff0b0" transparent blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
          </sprite>
        ))}
        <mesh ref={ring} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false} raycast={() => null} renderOrder={20}>
          <ringGeometry args={[0.6, 0.72, 40]} />
          <meshBasicMaterial color={EMPOWER_COLOR} transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}

const EMBERS = 6;

/**
 * A status aura, worn while a status lasts (Empower uses it; any later buff
 * can pass its own colour): a glow pulsing at the feet, a faint ring on the
 * ground, and embers rising round the Unit. Placed inside the Unit's group,
 * so it follows the Unit; `height` is the top of its figure.
 */
export function StatusAura({ color, height, seed = 0 }: { color: string; height: number; seed?: number }) {
  const glow = useRef<THREE.Sprite>(null);
  const ring = useRef<THREE.Mesh>(null);
  const embers = useRef<(THREE.Sprite | null)[]>([]);
  useFrame(() => {
    const t = performance.now() / 1000 + seed * 0.37;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    if (glow.current) {
      const s = 0.95 + 0.12 * pulse;
      glow.current.scale.set(s, s * 0.55, 1);
      (glow.current.material as THREE.SpriteMaterial).opacity = 0.5 + 0.3 * pulse;
    }
    if (ring.current) (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.3 * pulse;
    embers.current.forEach((e, i) => {
      if (!e) return;
      const q = (t * 0.55 + i / EMBERS) % 1;
      const a = (i / EMBERS) * Math.PI * 2 + t * 1.3;
      e.position.set(Math.cos(a) * 0.3, 0.12 + q * height, Math.sin(a) * 0.26);
      const k = 0.11 * (1 - q * 0.5);
      e.scale.set(k, k * 1.5, 1);
      (e.material as THREE.SpriteMaterial).opacity = bell(q) * 0.9;
    });
  });
  return (
    <group>
      <sprite ref={glow} position={[0, 0.1, 0]} raycast={() => null} renderOrder={8}>
        <spriteMaterial map={glowTex} color={color} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <mesh ref={ring} position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} renderOrder={5}>
        <ringGeometry args={[0.5, 0.58, 36]} />
        <meshBasicMaterial color={color} transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {Array.from({ length: EMBERS }, (_, i) => (
        <sprite key={i} ref={(el) => (embers.current[i] = el)} raycast={() => null} renderOrder={11}>
          <spriteMaterial map={glowTex} color={i % 2 ? color : '#fff3c0'} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}

/** Colour of healing light. */
export const HEAL_COLOR = '#22ff66';

const HEAL_MOTES = 6;

/**
 * Stone Heal: a soft green glow swells on the Stone under the unit and a few
 * motes of light rise through it; the HP goes up at the glow's brightest.
 */
export function StoneHealFx({ step, at }: { step: Extract<AnimStep, { kind: 'stoneHeal' }>; at: THREE.Vector3 }) {
  const glow = useRef<THREE.Sprite>(null);
  const ring = useRef<THREE.Mesh>(null);
  const motes = useRef<(THREE.Sprite | null)[]>([]);
  useFrame(() => {
    const anim = useGame.getState().anim;
    if (!anim) return;
    const p = (animElapsed(anim) - step.t0) / (step.t1 - step.t0);
    const on = p >= 0 && p <= 1;
    const b = bell(p);
    if (glow.current) {
      glow.current.visible = on;
      const s = 0.7 + 0.5 * b;
      glow.current.scale.set(s, s * 1.2, 1);
      (glow.current.material as THREE.SpriteMaterial).opacity = 0.85 * b;
    }
    if (ring.current) {
      ring.current.visible = on;
      const s = 0.5 + 0.5 * easeOut(Math.min(1, Math.max(0, p)));
      ring.current.scale.set(s, s, s);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.8 * b;
    }
    motes.current.forEach((m, i) => {
      if (!m) return;
      const q = (p - (i / HEAL_MOTES) * 0.35) / 0.65;
      m.visible = on && q >= 0 && q <= 1;
      if (!m.visible) return;
      const a = (i / HEAL_MOTES) * Math.PI * 2;
      m.position.set(Math.cos(a) * 0.22, 0.1 + q * 0.9, Math.sin(a) * 0.2);
      const k = 0.09 + 0.04 * bell(q);
      m.scale.set(k, k, 1);
      (m.material as THREE.SpriteMaterial).opacity = bell(q);
    });
  });
  return (
    <group position={[at.x, at.y, at.z]}>
      <sprite ref={glow} position={[0, 0.35, 0]} visible={false} raycast={() => null} renderOrder={19}>
        <spriteMaterial map={glowTex} color={HEAL_COLOR} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <mesh ref={ring} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false} raycast={() => null} renderOrder={20}>
        <ringGeometry args={[0.55, 0.66, 36]} />
        <meshBasicMaterial color={HEAL_COLOR} transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {Array.from({ length: HEAL_MOTES }, (_, i) => (
        <sprite key={i} ref={(el) => (motes.current[i] = el)} visible={false} raycast={() => null} renderOrder={21}>
          <spriteMaterial map={glowTex} color={i % 2 ? HEAL_COLOR : '#eaffef'} transparent blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
        </sprite>
      ))}
    </group>
  );
}
