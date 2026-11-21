// Loadout builder: pick exactly 18 of the 28 Summons, name the Loadout and
// save it in this browser. Starter Loadouts can be copied but not changed.

import { useRef, useState } from 'react';
import { ELEMENTS, LOADOUT_SIZE, SUMMONS, kindOf, loadoutProblems } from '../rules';
import { ELEMENT_COLORS } from '../render/sprites';
import { useGame } from '../store';
import { deleteLoadout, exportLoadoutsJson, importLoadoutsJson, listLoadouts, saveLoadout, saveProblems, type StoredLoadout } from '../loadouts/library';
import { LoadoutStrip } from './LoadoutView';
import { SummonDetail } from './SummonCard';

interface Draft {
  id: string | null;
  starter: boolean;
  name: string;
  summons: string[];
}

const fromStored = (l: StoredLoadout): Draft => ({ id: l.id, starter: l.starter, name: l.name, summons: [...l.summons] });

export function LoadoutEditor() {
  const setScreen = useGame((s) => s.setScreen);
  const setSetupOpen = useGame((s) => s.setSetupOpen);
  const [list, setList] = useState(() => listLoadouts());
  const [draft, setDraft] = useState<Draft>(() => fromStored(list[0]));
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
    setDraft((d) => f({ ...d, summons: [...d.summons] }));
    setDirty(true);
  };
  // a starter's own name is taken by the starter itself: only its Summons matter until it's copied
  const problems = draft.starter ? loadoutProblems(draft.summons) : saveProblems(draft.name, draft.summons, draft.id);
  const canSave = !draft.starter && problems.length === 0;

  const save = (asNew: boolean) => {
    const name = asNew || draft.starter ? uniqueName(`${draft.name} (copy)`, draft.summons) : draft.name;
    const p = saveProblems(name, draft.summons, asNew || draft.starter ? null : draft.id);
    if (p.length) return flash(p[0]);
    const saved = saveLoadout(asNew || draft.starter ? null : draft.id, name, draft.summons);
    setList(listLoadouts());
    setDraft(fromStored(saved));
    setDirty(false);
    flash(`Saved “${saved.name}”`);
  };

  const perElement = ELEMENTS.map((e) => [e, draft.summons.filter((id) => kindOf(id).element === e).length] as const);

  return (
    <div className="devtool">
      <div className="editor-top window">
        <b>Loadouts</b>
        <span className="muted small">Pick exactly {LOADOUT_SIZE} of the 28 Summons. Loadouts are kept in this browser.</span>
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
              setDraft({ id: null, starter: false, name: uniqueName('New Loadout', []), summons: [] });
              setDirty(true);
            }}
          >
            + New Loadout
          </button>
          <div className="title">Starters</div>
          {list.filter((l) => l.starter).map((l) => (
            <LoadoutItem key={l.id} l={l} on={l.id === draft.id} pick={() => confirmDiscard() && (setDraft(fromStored(l)), setDirty(false))} />
          ))}
          <div className="title">Mine</div>
          {list.filter((l) => !l.starter).length === 0 && <div className="muted small">None yet. Edit a starter and Save as new, or start a new one.</div>}
          {list.filter((l) => !l.starter).map((l) => (
            <LoadoutItem key={l.id} l={l} on={l.id === draft.id} pick={() => confirmDiscard() && (setDraft(fromStored(l)), setDirty(false))} />
          ))}
        </div>

        <div className="window dev-form">
          <label className="dev-field">
            <span>Name</span>
            <input value={draft.name} maxLength={24} disabled={draft.starter} onChange={(e) => change((d) => ({ ...d, name: e.target.value }))} />
            {draft.starter && <span className="muted small">Starter Loadout: Save as new to make your own copy</span>}
          </label>
          <div className="loadout-count">
            <b className={draft.summons.length === LOADOUT_SIZE ? 'good' : 'bad'}>
              {draft.summons.length} / {LOADOUT_SIZE}
            </b>
            {perElement.map(([e, n]) => (
              <span key={e} style={{ color: ELEMENT_COLORS[e] }}>
                {e} {n}
              </span>
            ))}
            <span className="spacer" />
            <button onClick={() => change((d) => ({ ...d, summons: [] }))}>Clear</button>
            <button onClick={() => change((d) => ({ ...d, summons: SUMMONS.map((s) => s.id) }))}>All</button>
          </div>
          <LoadoutStrip
            summons={draft.summons}
            side={0}
            big
            onHover={setHover}
            onToggle={(id) =>
              change((d) => ({ ...d, summons: d.summons.includes(id) ? d.summons.filter((x) => x !== id) : [...d.summons, id] }))
            }
          />
          <div className="muted small">Click a Summon to add or remove it. Darkened Summons are left out.</div>
          <div className="loadout-card">{hover && <SummonDetail kindId={hover} side={0} />}</div>
        </div>

        <div className="window editor-side">
          <div className="title">Problems</div>
          {problems.length ? problems.map((p) => <div key={p} className="bad small">• {p}</div>) : <div className="good small">Ready.</div>}
          <div className="btn-row">
            <button disabled={!canSave} onClick={() => save(false)}>
              Save
            </button>
            <button disabled={loadoutProblemsOnly(draft.summons)} onClick={() => save(true)}>
              Save as new
            </button>
          </div>
          <button
            disabled={!draft.id || draft.starter}
            onClick={() => {
              if (!draft.id || !window.confirm(`Delete “${draft.name}”?`)) return;
              deleteLoadout(draft.id);
              const l = listLoadouts();
              setList(l);
              setDraft(fromStored(l[0]));
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
    <button className={`map-item ${on ? 'on' : ''}`} onClick={pick}>
      {l.name}
    </button>
  );
}

const loadoutProblemsOnly = (summons: string[]) => new Set(summons).size !== LOADOUT_SIZE;

function uniqueName(base: string, summons: string[]): string {
  let name = base.slice(0, 24);
  for (let k = 2; saveProblems(name, summons.length === LOADOUT_SIZE ? summons : SUMMONS.slice(0, LOADOUT_SIZE).map((s) => s.id), null).some((p) => p.includes('already exists')); k++) {
    name = `${base.slice(0, 19)} ${k}`;
  }
  return name;
}
