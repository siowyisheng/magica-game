// Loadout builder: pick exactly LOADOUT_SIZE of the Familiars, name the Loadout
// and save it in this browser.

import { useRef, useState } from 'react';
import { ELEMENTS, LOADOUT_SIZE, FAMILIARS, kindOf } from '../rules';
import { ELEMENT_COLORS } from '../render/sprites';
import { useGame } from '../store';
import { deleteLoadout, exportLoadoutsJson, importLoadoutsJson, isPlayable, listLoadouts, nameProblems, saveLoadout, saveProblems, type StoredLoadout } from '../loadouts/library';
import { LoadoutStrip } from './LoadoutView';
import { FamiliarDetail } from './FamiliarCard';

interface Draft {
  id: string | null;
  name: string;
  familiars: string[];
}

const fromStored = (l: StoredLoadout): Draft => ({ id: l.id, name: l.name, familiars: [...l.familiars] });
const blank = (): Draft => ({ id: null, name: uniqueName('New Loadout'), familiars: [] });

export function LoadoutEditor() {
  const setScreen = useGame((s) => s.setScreen);
  const setSetupOpen = useGame((s) => s.setSetupOpen);
  const [list, setList] = useState(() => listLoadouts());
  const [draft, setDraft] = useState<Draft>(() => (list[0] ? fromStored(list[0]) : blank()));
  const [dirty, setDirty] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const flash = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage((cur) => (cur === m ? null : cur)), 3000);
  };
  const confirmDiscard = () => !dirty || window.confirm('Discard unsaved changes?');
  const change = (f: (d: Draft) => Draft) => {
    setDraft((d) => f({ ...d, familiars: [...d.familiars] }));
    setDirty(true);
  };
  const problems = saveProblems(draft.name, draft.familiars, draft.id);
  const canSave = problems.length === 0;

  const save = (asNew: boolean) => {
    const name = asNew ? uniqueName(`${draft.name} (copy)`) : draft.name;
    const p = saveProblems(name, draft.familiars, asNew ? null : draft.id);
    if (p.length) return flash(p[0]);
    const saved = saveLoadout(asNew ? null : draft.id, name, draft.familiars);
    setList(listLoadouts());
    setDraft(fromStored(saved));
    setDirty(false);
    flash(`Saved “${saved.name}”`);
  };

  const perElement = ELEMENTS.map((e) => [e, draft.familiars.filter((id) => kindOf(id).element === e).length] as const);

  return (
    <div className="devtool">
      <div className="editor-top window">
        <b>Loadouts</b>
        <span className="muted small">Pick exactly {LOADOUT_SIZE} of the {FAMILIARS.length} Familiars. Loadouts are kept in this browser.</span>
        <span className="spacer" />
        {message && <span className="flash">{message}</span>}
        <button onClick={() => setSetupOpen(true)}>New match…</button>
        <button onClick={() => setScreen('game')}>Back to game</button>
      </div>
      <div className="editor-body">
        <div className="window dev-list">
          <button
            onClick={() => {
              if (!confirmDiscard()) return;
              setDraft(blank());
              setDirty(true);
            }}
          >
            + New Loadout
          </button>
          <div className="title">Mine</div>
          {list.length === 0 && <div className="muted small">None yet. Start a new one.</div>}
          {list.map((l) => (
            <LoadoutItem key={l.id} l={l} on={l.id === draft.id} pick={() => confirmDiscard() && (setDraft(fromStored(l)), setDirty(false))} />
          ))}
        </div>

        <div className="window dev-form">
          <label className="dev-field">
            <span>Name</span>
            <input value={draft.name} maxLength={24} onChange={(e) => change((d) => ({ ...d, name: e.target.value }))} />
          </label>
          <div className="loadout-count">
            <b className={draft.familiars.length === LOADOUT_SIZE ? 'good' : 'bad'}>
              {draft.familiars.length} / {LOADOUT_SIZE}
            </b>
            {perElement.map(([e, n]) => (
              <span key={e} style={{ color: ELEMENT_COLORS[e] }}>
                {e} {n}
              </span>
            ))}
            <span className="spacer" />
            <button onClick={() => change((d) => ({ ...d, familiars: [] }))}>Clear</button>
            <button onClick={() => change((d) => ({ ...d, familiars: FAMILIARS.map((s) => s.id) }))}>All</button>
          </div>
          <LoadoutStrip
            familiars={draft.familiars}
            side={0}
            big
            onHover={setHover}
            onToggle={(id) =>
              change((d) => ({ ...d, familiars: d.familiars.includes(id) ? d.familiars.filter((x) => x !== id) : [...d.familiars, id] }))
            }
          />
          <div className="muted small">Click a Familiar to add or remove it. Darkened Familiars are left out.</div>
          <div className="loadout-card">{hover && <FamiliarDetail kindId={hover} side={0} />}</div>
        </div>

        <div className="window editor-side">
          <div className="title">Problems</div>
          {problems.length ? problems.map((p) => <div key={p} className="bad small">• {p}</div>) : <div className="good small">Ready.</div>}
          <div className="btn-row">
            <button disabled={!canSave} onClick={() => save(false)}>
              Save
            </button>
            <button disabled={loadoutProblemsOnly(draft.familiars)} onClick={() => save(true)}>
              Save as new
            </button>
          </div>
          <button
            disabled={!draft.id}
            onClick={() => {
              if (!draft.id || !window.confirm(`Delete “${draft.name}”?`)) return;
              deleteLoadout(draft.id);
              const l = listLoadouts();
              setList(l);
              setDraft(l[0] ? fromStored(l[0]) : blank());
              setDirty(false);
              flash('Deleted');
            }}
          >
            Delete
          </button>
          <div className="title">Share</div>
          <div className="btn-row">
            <button
              onClick={() => {
                const blob = new Blob([exportLoadoutsJson()], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'magica-loadouts.json';
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              Export mine
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
                if (!f) return;
                try {
                  const n = importLoadoutsJson(await f.text());
                  setList(listLoadouts());
                  flash(`Imported ${n} Loadout${n === 1 ? '' : 's'}`);
                } catch (err) {
                  flash(`Import failed: ${(err as Error).message}`);
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadoutItem({ l, on, pick }: { l: StoredLoadout; on: boolean; pick: () => void }) {
  return (
    <button className={`map-item ${on ? 'on' : ''}`} onClick={pick} title={isPlayable(l) ? undefined : `Has ${l.familiars.length} Familiars: add or remove to make ${LOADOUT_SIZE}`}>
      {l.name}
      {!isPlayable(l) && <span className="bad small"> · needs {LOADOUT_SIZE}</span>}
    </button>
  );
}

const loadoutProblemsOnly = (familiars: string[]) => new Set(familiars).size !== LOADOUT_SIZE;

function uniqueName(base: string): string {
  let name = base.slice(0, 24);
  for (let k = 2; nameProblems(name, null).length; k++) name = `${base.slice(0, 19)} ${k}`;
  return name;
}
