// The menu at the bottom right: the match and screen buttons, a Code entry (DEV
// unlocks the Map Editor and Dev Tools), and the gear that opens the settings.

import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { type HpBarsMode, useGame } from '../store';
import { useOnline } from '../online/session';
import { useAudio } from '../audio';
import { listMaps } from '../maps/library';
import { fromMapDef, useEditor } from '../editor/editorStore';

const DEV_KEY = 'magica.dev';

/** Codes unlocked in this browser (only DEV so far: the Map Editor and Dev Tools). */
export const useCodes = create<{ dev: boolean }>(() => {
  try {
    return { dev: localStorage.getItem(DEV_KEY) === '1' };
  } catch {
    return { dev: false };
  }
});

/** Enter a Code; true when it is a known one. DEV turns the dev items on, or off again. */
export function enterCode(raw: string): boolean {
  const code = raw.trim().toUpperCase();
  if (code !== 'DEV') return false;
  const dev = !useCodes.getState().dev;
  useCodes.setState({ dev });
  try {
    localStorage.setItem(DEV_KEY, dev ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
  return true;
}

/** Open the editor on the map the current match is played on. */
function openEditor() {
  const g = useGame.getState();
  const m = listMaps().find((x) => x.id === g.mapId);
  const ed = useEditor.getState();
  if (!ed.dirty) ed.load(m ? fromMapDef(m.map, m.id, m.builtin) : fromMapDef(g.match.map, null, false));
  g.setScreen('editor');
}

/** Close a popover on Esc or a click outside it (and outside its button). */
function useDismiss(open: boolean, close: () => void, ...refs: React.RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (refs.some((r) => r.current?.contains(e.target as Node))) return;
      close();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', key);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function BottomMenu() {
  const online = useOnline((s) => s.stage !== null);
  const dev = useCodes((s) => s.dev);
  const g = useGame.getState;
  const [open, setOpen] = useState<'settings' | 'code' | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const gearRef = useRef<HTMLButtonElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);
  const codeBtnRef = useRef<HTMLButtonElement>(null);
  useDismiss(open === 'settings', () => setOpen(null), settingsRef, gearRef);
  useDismiss(open === 'code', () => setOpen(null), codeRef, codeBtnRef);
  return (
    <div className="bottom-menu">
      {open === 'settings' && (
        <div className="menu-pop window" ref={settingsRef}>
          <Settings />
        </div>
      )}
      {open === 'code' && (
        <div className="menu-pop window" ref={codeRef}>
          <CodeEntry onDone={() => setOpen(null)} />
        </div>
      )}
      <div className="menu-buttons">
        {!online && (
          <>
            <button className="menu-btn" onClick={() => g().newRandom()} title="You against a Normal AI on a Random Map, the AI's Master and Loadout random">
              New Random
            </button>
            <button className="menu-btn" onClick={() => g().setSetupOpen(true)}>
              New Match
            </button>
            <button className="menu-btn" onClick={() => g().newMatch()} title="The same map, Masters and Loadouts again">
              Rematch
            </button>
          </>
        )}
        <button className="menu-btn" onClick={() => g().setScreen('online')} title="Play someone on another computer">
          Play Online
        </button>
        <button className="menu-btn" onClick={() => g().setScreen('loadouts')}>
          Loadouts
        </button>
        <button className="menu-btn" onClick={() => g().setScreen('replays')}>
          Watch Replay
        </button>
        <button className={`menu-btn ${open === 'code' ? 'on' : ''}`} ref={codeBtnRef} onClick={() => setOpen(open === 'code' ? null : 'code')}>
          Code
        </button>
        {dev && (
          <>
            <button className="menu-btn" onClick={openEditor}>
              Map Editor
            </button>
            <button className="menu-btn" onClick={() => g().setScreen('dev')}>
              Dev Tools
            </button>
          </>
        )}
        <button className={`menu-btn gear ${open === 'settings' ? 'on' : ''}`} ref={gearRef} onClick={() => setOpen(open === 'settings' ? null : 'settings')} title="Settings" aria-label="Settings">
          ⚙
        </button>
      </div>
    </div>
  );
}

function CodeEntry({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const [wrong, setWrong] = useState(0);
  return (
    <form
      className="code-entry"
      onSubmit={(e) => {
        e.preventDefault();
        if (enterCode(code)) onDone();
        else setWrong(Date.now());
      }}
    >
      <div className="title">Code</div>
      <input
        key={wrong}
        className={wrong ? 'wrong' : ''}
        autoFocus
        value={code}
        maxLength={5}
        spellCheck={false}
        onChange={(e) => setCode(e.target.value.replace(/[^a-z]/gi, '').toUpperCase())}
      />
      {wrong > 0 && <div className="bad small">Unknown code</div>}
    </form>
  );
}

function Settings() {
  const match = useGame((s) => s.match);
  const hpBars = useGame((s) => s.hpBars);
  const showPlans = useGame((s) => s.showPlans);
  const setShowPlans = useGame((s) => s.setShowPlans);
  const setHpBars = useGame((s) => s.setHpBars);
  const setAi = useGame((s) => s.setAi);
  const watching = useGame((s) => s.replay !== null);
  const online = useOnline((s) => s.stage !== null);
  return (
    <div className="settings">
      <div className="title">Settings</div>
      <label title="Show what each AI Side is trying to do: its Posture, Front, summon Needs and Reserve">
        <input type="checkbox" checked={showPlans} onChange={(e) => setShowPlans(e.target.checked)} /> Show AI plans
      </label>
      <label>
        Floating HP bars{' '}
        <select value={hpBars} onChange={(e) => setHpBars(e.target.value as HpBarsMode)}>
          <option value="damaged">When damaged</option>
          <option value="always">Always</option>
          <option value="off">Off (no AV bars either)</option>
        </select>
      </label>
      {!watching && !online && (
        <>
          <label>
            <input type="checkbox" checked={match.sides[1].ai} onChange={(e) => setAi(1, e.target.checked)} /> Red is AI (off = hotseat)
          </label>
          <label>
            <input type="checkbox" checked={match.sides[0].ai} onChange={(e) => setAi(0, e.target.checked)} /> Green is AI
          </label>
        </>
      )}
      <SoundOptions />
      <div className="muted small">Wheel: zoom · Right-drag: pan · Right-click: back / cancel move</div>
    </div>
  );
}

function SoundOptions() {
  const { music, sfx, muted, track, setMusic, setSfx, toggleMute, skipTrack } = useAudio();
  return (
    <div className="sound-options">
      <label className="slider">
        <span>Music</span>
        <input type="range" min={0} max={1} step={0.05} value={music} onChange={(e) => setMusic(Number(e.target.value))} />
      </label>
      <label className="slider">
        <span>Sound</span>
        <input type="range" min={0} max={1} step={0.05} value={sfx} onChange={(e) => setSfx(Number(e.target.value))} />
      </label>
      <div className="now-playing">
        <label>
          <input type="checkbox" checked={muted} onChange={toggleMute} /> Mute
        </label>
        <span className="muted small track-name" title="Now playing">
          {track && !muted && music > 0 ? `♪ ${track}` : ''}
        </span>
        <button className="small-btn" onClick={skipTrack} disabled={!track || muted || music === 0} title="Next track">
          ⏭
        </button>
      </div>
    </div>
  );
}
