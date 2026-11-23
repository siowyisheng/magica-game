// Map editor screen: paint terrain, Height, Obstacles, variants and spawns
// on a live 3D preview in the map's Theme; name, Theme, size, water and clock
// settings; undo / redo; live validation; save, export / import and play.

import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { axialToOffset, createMatch, hexKey, offsetToAxial, validateMap, type MapHex, type MatchState, type ObstacleDefense } from '../rules';
import { CameraControls, StoneColumn } from '../render/Board';
import { ObstacleView, PitTile, STEP, ThemedTile, Water, hexToWorld } from '../render/Terrain';
import { THEMES, themeOf, type Theme } from '../render/themes';
import { SIDE_COLORS, spriteFeetOffset, spriteWorldSize, unitFrameTexture } from '../render/sprites';
import { deleteMap, exportMapJson, listMaps, parseMapJson, saveMap } from '../maps/library';
import { useGame } from '../store';
import { MAX_HEIGHT, MAX_SIZE, MIN_HEIGHT, MIN_SIZE, blankDraft, fromMapDef, toMapDef, useEditor, type Spot, type Tool } from './editorStore';

const TOOLS: { tool: Tool; label: string; key: string; hint: string }[] = [
  { tool: 'plain', label: 'Plain', key: '1', hint: 'Paint Plain. Right-click: Plain.' },
  { tool: 'rough', label: 'Rough', key: '2', hint: 'Paint Rough. Right-click: Plain.' },
  { tool: 'pit', label: 'Pit', key: '3', hint: 'Paint Pits. Right-click: Plain.' },
  { tool: 'stone', label: 'Magic Stone', key: '4', hint: 'Place Magic Stones. Right-click: Plain.' },
  { tool: 'height', label: 'Height', key: '5', hint: 'Click: raise 1. Right-click: lower 1.' },
  { tool: 'obstacle', label: 'Obstacle', key: '6', hint: 'Place an Obstacle on Plain or Rough. Right-click: remove.' },
  { tool: 'variant', label: 'Look', key: '7', hint: 'Cycle the Theme look: auto → A → B. Right-click: auto.' },
  { tool: 'spawn0', label: 'Green spawn', key: '8', hint: 'Place the Green Master. Click it again to turn it.' },
  { tool: 'spawn1', label: 'Red spawn', key: '9', hint: 'Place the Red Master. Click it again to turn it.' },
];

export function MapEditor() {
  const draft = useEditor((s) => s.draft);
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const obstacleDef = useEditor((s) => s.obstacleDef);
  const setObstacleDef = useEditor((s) => s.setObstacleDef);
  const mirror = useEditor((s) => s.mirror);
  const setMirror = useEditor((s) => s.setMirror);
  const update = useEditor((s) => s.update);
  const resize = useEditor((s) => s.resize);
  const load = useEditor((s) => s.load);
  const doUndo = useEditor((s) => s.doUndo);
  const doRedo = useEditor((s) => s.doRedo);
  const markSaved = useEditor((s) => s.markSaved);
  const undoCount = useEditor((s) => s.undo.length);
  const redoCount = useEditor((s) => s.redo.length);
  const dirty = useEditor((s) => s.dirty);
  const hover = useEditor((s) => s.hover);
  const setScreen = useGame((s) => s.setScreen);
  const startMatch = useGame((s) => s.startMatch);
  const [library, setLibrary] = useState(() => listMaps());
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const map = useMemo(() => toMapDef(draft), [draft]);
  const problems = useMemo(() => validateMap(map), [map]);
  const valid = problems.length === 0;

  const flash = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage((cur) => (cur === m ? null : cur)), 2500);
  };
  const confirmDiscard = () => !dirty || window.confirm('Discard unsaved changes?');

  const save = (asNew: boolean) => {
    if (!valid) return;
    const entry = saveMap(asNew || draft.builtin ? null : draft.id, map);
    markSaved(entry.id);
    setLibrary(listMaps());
    useGame.getState().setMapId(entry.id);
    flash(`Saved “${map.name}”`);
  };

  // keyboard: tools 1–9, undo / redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, select, textarea')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        doRedo();
        return;
      }
      const t = TOOLS.find((x) => x.key === e.key);
      if (t) setTool(t.tool);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doUndo, doRedo, setTool]);

  const hoverCell = hover ? draft.cells[hover.row * draft.width + hover.col] : null;
  const toolHint = TOOLS.find((t) => t.tool === tool)?.hint;

  return (
    <div className="editor">
      <div className="editor-top window">
        <label>
          Name <input value={draft.name} maxLength={40} onChange={(e) => update((d) => void (d.name = e.target.value))} />
        </label>
        <label>
          Theme{' '}
          <select value={draft.theme} onChange={(e) => update((d) => void (d.theme = e.target.value))}>
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Size{' '}
          <input type="number" min={MIN_SIZE} max={MAX_SIZE} value={draft.width} onChange={(e) => resize(Number(e.target.value), draft.height)} />
          ×
          <input type="number" min={MIN_SIZE} max={MAX_SIZE} value={draft.height} onChange={(e) => resize(draft.width, Number(e.target.value))} />
        </label>
        <label title="Starting Water Level (Rise and Ebb, if a unit has them, move it by 1).">
          Water{' '}
          <input type="number" min={MIN_HEIGHT} max={MAX_HEIGHT} value={draft.waterLevel} onChange={(e) => update((d) => void (d.waterLevel = Math.round(Number(e.target.value))))} />
        </label>
        <label>
          Start{' '}
          <select value={Math.floor(draft.startClock / 60)} onChange={(e) => update((d) => void (d.startClock = Number(e.target.value) * 60))}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </label>
        <label title="Mirror every edit top ↔ bottom, so both sides get the same map">
          <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /> Mirror
        </label>
        <span className="spacer" />
        <button onClick={doUndo} disabled={!undoCount} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button onClick={doRedo} disabled={!redoCount} title="Redo (Ctrl+Y)">
          Redo
        </button>
        <button onClick={() => setScreen('game')}>Back to game</button>
      </div>

      <div className="editor-body">
        <div className="editor-tools window">
          <div className="title">Tools</div>
          {TOOLS.map((t) => (
            <button key={t.tool} className={`tool ${tool === t.tool ? 'on' : ''}`} onClick={() => setTool(t.tool)} title={t.hint}>
              <span className="key">{t.key}</span> {t.label}
            </button>
          ))}
          <div className="muted small">Obstacle Defense</div>
          <div className="def-row">
            {([2, 4, 6] as ObstacleDefense[]).map((d) => (
              <button key={d} className={`tool small-btn ${tool === 'obstacle' && obstacleDef === d ? 'on' : ''}`} onClick={() => setObstacleDef(d)}>
                {d}
              </button>
            ))}
          </div>
          <div className="muted small tool-hint">{toolHint}</div>
          <div className="muted small">Drag to paint · Right-drag: pan · Wheel: zoom</div>
        </div>

        <div className="editor-view">
          <Canvas orthographic camera={{ zoom: 34, near: -200, far: 400 }} dpr={1} gl={{ antialias: false }}>
            <EditorScene />
          </Canvas>
          <div className="editor-status">
            {hover && hoverCell
              ? `col ${hover.col}, row ${hover.row} · ${hoverCell.terrain === 'stone' ? 'Magic Stone' : hoverCell.terrain[0].toUpperCase() + hoverCell.terrain.slice(1)} · Height ${hoverCell.height}${
                  hoverCell.obstacle ? ` · Obstacle DEF ${hoverCell.obstacle}` : ''
                }${hoverCell.variant !== undefined ? ` · look ${'AB'[hoverCell.variant]}` : ''}`
              : ' '}
            {message && <span className="flash"> {message}</span>}
          </div>
        </div>

        <div className="editor-side window">
          <div className="title">Map</div>
          <div className="muted small">
            {draft.builtin ? 'Built-in map (Save makes your own copy)' : draft.id ? (dirty ? 'Unsaved changes' : 'Saved') : 'Not saved yet'}
          </div>
          <div className="btn-row">
            <button onClick={() => save(false)} disabled={!valid} title={valid ? 'Save' : 'Fix the problems below first'}>
              Save
            </button>
            <button onClick={() => save(true)} disabled={!valid}>
              Save as new
            </button>
          </div>
          <div className="btn-row">
            <button
              onClick={() => {
                if (!confirmDiscard()) return;
                load(blankDraft());
              }}
            >
              New
            </button>
            <button
              disabled={!draft.id || draft.builtin}
              onClick={() => {
                if (!draft.id || !window.confirm(`Delete “${draft.name}”? This cannot be undone.`)) return;
                deleteMap(draft.id);
                setLibrary(listMaps());
                load(blankDraft());
                flash('Deleted');
              }}
            >
              Delete
            </button>
          </div>
          <div className="btn-row">
            <button
              onClick={() => {
                const blob = new Blob([exportMapJson(map)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `${(map.name || 'map').replace(/[^\w-]+/g, '_')}.magica.json`;
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              Export
            </button>
            <button onClick={() => fileInput.current?.click()}>Import</button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f || !confirmDiscard()) return;
                try {
                  const m = parseMapJson(await f.text());
                  const d = fromMapDef(m, null, false);
                  load(d);
                  useEditor.setState({ dirty: true });
                  flash(`Imported “${m.name}” (not saved yet)`);
                } catch (err) {
                  flash(`Import failed: ${(err as Error).message}`);
                }
              }}
            />
          </div>
          <button
            className="play"
            disabled={!valid}
            onClick={() => {
              startMatch(map, draft.id && !dirty ? draft.id : undefined);
              setScreen('game');
            }}
          >
            Play this map
          </button>

          <div className="title">Problems</div>
          {valid ? <div className="good small">Ready to play.</div> : problems.map((p) => <div key={p} className="bad small">• {p}</div>)}

          <div className="title">Open</div>
          <div className="map-list">
            {library.map((m) => (
              <button
                key={m.id}
                className={`map-item ${m.id === draft.id ? 'on' : ''}`}
                onClick={() => {
                  if (!confirmDiscard()) return;
                  load(fromMapDef(m.map, m.id, m.builtin));
                }}
              >
                {m.map.name}
                <span className="muted small"> {m.builtin ? 'built-in' : themeOf(m.map.theme).name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- 3D preview ----------

function usePreview(): MatchState | null {
  const draft = useEditor((s) => s.draft);
  return useMemo(() => {
    try {
      const m = createMatch(toMapDef(draft), { ai: [true, true] });
      // show the masters at their spawns as placed, whatever the rules did on the first turn
      m.units.forEach((u, i) => {
        u.pos = offsetToAxial(draft.spawns[i].col, draft.spawns[i].row);
        u.facing = draft.spawnFacing[i];
      });
      return m;
    } catch {
      return null;
    }
  }, [draft]);
}

function EditorScene() {
  const match = usePreview();
  const draft = useEditor((s) => s.draft);
  const theme = themeOf(draft.theme);
  const hover = useEditor((s) => s.hover);
  const setHover = useEditor((s) => s.setHover);
  const paint = useEditor((s) => s.paint);
  const endStroke = useEditor((s) => s.endStroke);
  const { camera } = useThree();
  const size = `${draft.width}x${draft.height}`;
  useEffect(() => {
    const [cx, cz] = hexToWorld(offsetToAxial(Math.floor(draft.width / 2), Math.floor(draft.height / 2)));
    camera.position.set(cx, 24, cz + 26);
    camera.lookAt(cx, 0, cz);
    camera.updateProjectionMatrix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, size]);
  useEffect(() => {
    const up = () => endStroke();
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, [endStroke]);
  if (!match) return null;
  const hoverHex = hover ? offsetToAxial(hover.col, hover.row) : null;
  const hoverMh = hoverHex ? match.map.hexes.find((h) => h.hex.q === hoverHex.q && h.hex.r === hoverHex.r) : undefined;
  return (
    <>
      <color attach="background" args={[theme.background]} />
      <hemisphereLight args={['#dfe8ff', '#3a3320', 0.9]} />
      <directionalLight position={[10, 20, 8]} intensity={1.6} />
      <CameraControls
        onRightClick={() => {
          const h = useEditor.getState().hover;
          if (h) paint(h, true);
        }}
      />
      <group onPointerLeave={() => setHover(null)}>
        {match.map.hexes.map((mh) => (
          <EditorTile key={hexKey(mh.hex)} mh={mh} theme={theme} waterLevel={match.waterLevel} />
        ))}
      </group>
      {match.obstacles.map((o) => (
        <ObstacleView key={o.id} o={o} theme={theme} match={match} interactive={false} />
      ))}
      <Water match={match} interactive={false} />
      {match.units.map((u) => (
        <SpawnMarker key={u.id} match={match} side={u.side} hex={u.pos} facing={u.facing} />
      ))}
      {hoverMh && (
        <mesh
          position={[hexToWorld(hoverMh.hex)[0], Math.max(hoverMh.height, hoverMh.terrain === 'pit' ? hoverMh.height : match.waterLevel) * STEP + 0.04, hexToWorld(hoverMh.hex)[1]]}
          rotation={[-Math.PI / 2, 0, Math.PI / 6]}
          raycast={() => null}
        >
          <ringGeometry args={[0.78, 0.96, 6]} />
          <meshBasicMaterial color="#ffe066" transparent opacity={0.95} depthTest={false} />
        </mesh>
      )}
    </>
  );
}

function EditorTile({ mh, theme, waterLevel }: { mh: MapHex; theme: Theme; waterLevel: number }) {
  const setHover = useEditor((s) => s.setHover);
  const paint = useEditor((s) => s.paint);
  const beginStroke = useEditor((s) => s.beginStroke);
  const [x, z] = hexToWorld(mh.hex);
  const spot: Spot = axialToOffset(mh.hex);
  const depth = mh.terrain === 'pit' ? 0 : Math.max(0, waterLevel - mh.height);
  return (
    <group
      position={[x, 0, z]}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHover(spot);
        if (e.buttons & 1 && useEditor.getState().stroke) paint(spot, false);
      }}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        beginStroke();
        paint(spot, false);
      }}
    >
      {mh.terrain === 'stone' ? (
        <StoneColumn hex={mh.hex} height={mh.height} owner={null} />
      ) : mh.terrain === 'pit' ? (
        <PitTile mh={mh} theme={theme} />
      ) : (
        <ThemedTile mh={mh} theme={theme} depth={depth} />
      )}
    </group>
  );
}

const arrowGeo = (() => {
  const s = new THREE.Shape();
  s.moveTo(0.95, 0);
  s.lineTo(0.62, 0.2);
  s.lineTo(0.62, -0.2);
  s.closePath();
  return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2);
})();

function SpawnMarker({ match, side, hex, facing }: { match: MatchState; side: 0 | 1; hex: { q: number; r: number }; facing: number }) {
  const mh = match.map.hexes.find((h) => h.hex.q === hex.q && h.hex.r === hex.r);
  const [x, z] = hexToWorld(hex);
  const y = mh ? Math.max(mh.height, match.waterLevel) * STEP : 0;
  const size = spriteWorldSize('regent');
  const lift = size / 2 - spriteFeetOffset('regent') + 0.05;
  const [vx, vz] = hexToWorld([{ q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }][facing]);
  const angle = Math.atan2(-vz, vx);
  return (
    <group position={[x, y, z]}>
      <mesh geometry={arrowGeo} rotation={[0, angle, 0]} position={[0, 0.04, 0]} raycast={() => null}>
        <meshBasicMaterial color={SIDE_COLORS[side]} side={THREE.DoubleSide} />
      </mesh>
      <sprite scale={[size, size, 1]} position={[0, lift, 0]} raycast={() => null}>
        <spriteMaterial map={unitFrameTexture('regent', side, 0, facing)} transparent alphaTest={0.5} />
      </sprite>
    </group>
  );
}
