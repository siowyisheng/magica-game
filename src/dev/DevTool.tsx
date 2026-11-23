// Dev tool: hand-edit every Master's and Familiar's stats, Move Types, Attack
// and Magic. Edits are kept in this browser and apply to new matches; they
// can be exported / imported as JSON, reset, or (on the dev server) written
// into the repo's balance file.

import { useMemo, useRef, useState } from 'react';
import {
  ELEMENTS,
  MASTERS,
  FAMILIARS,
  kindOf,
  kindWarnings,
  shippedKind,
  abilityOf,
  abilityUsers,
  isBuiltInAbility,
  shippedAbility,
  type Alignment,
  type Element,
  type MagicAbility,
  type MoveType,
  type Stats,
  type Trajectory,
  type UnitKind,
  budgetError,
  generateSpread,
  mulberry32,
} from '../rules';
import { useGame } from '../store';
import { ELEMENT_COLORS, unitIconUrl } from '../render/sprites';
import {
  CAN_WRITE_REPO,
  allAbilities,
  createAbility,
  exportBalanceJson,
  importBalanceJson,
  isAbilityEdited,
  isAbilityRepoEdited,
  isEdited,
  isRepoEdited,
  resetAbility,
  resetAll,
  resetKind,
  saveAbility,
  saveKind,
  writeRepoBalance,
} from './balance';

const STAT_KEYS: (keyof Stats)[] = ['atk', 'def', 'mp', 'mdf', 'spd', 'mov'];
const MOVE_TYPES: MoveType[] = ['walk', 'slow', 'fly', 'swim', 'wade'];
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export function DevTool() {
  const setScreen = useGame((s) => s.setScreen);
  const setSetupOpen = useGame((s) => s.setSetupOpen);
  const [selected, setSelected] = useState('regent');
  // bumped after every change so the roster (a live array) re-renders
  const [rev, setRev] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const bump = () => setRev((r) => r + 1);
  const flash = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage((cur) => (cur === m ? null : cur)), 3000);
  };

  const roster = useMemo(() => [...MASTERS, ...FAMILIARS], [rev]); // eslint-disable-line react-hooks/exhaustive-deps
  // the selection is a unit kind id, or 'ability:<id>' for a Magic Ability
  const abilitySel = selected.startsWith('ability:') ? selected.slice(8) : null;
  const kind = abilitySel ? null : kindOf(selected);
  const warnings = kind ? kindWarnings(kind, roster) : [];

  const edit = (f: (k: UnitKind) => void) => {
    const k = clone(kindOf(selected));
    f(k);
    saveKind(k);
    bump();
  };
  const editAbility = (f: (m: MagicAbility) => void) => {
    if (!abilitySel) return;
    const a = clone(abilityOf(abilitySel)!);
    f(a);
    saveAbility(a);
    bump();
  };

  const groups: { label: string; color?: string; kinds: UnitKind[] }[] = [
    { label: 'Masters', kinds: MASTERS },
    ...ELEMENTS.map((e) => ({ label: e[0].toUpperCase() + e.slice(1), color: ELEMENT_COLORS[e], kinds: FAMILIARS.filter((k) => k.element === e && true) })),
  ];

  return (
    <div className="devtool">
      <div className="editor-top window">
        <b>Dev tools — unit balance</b>
        <span className="muted small">Edits are saved in this browser and apply to new matches.</span>
        <span className="spacer" />
        {message && <span className="flash">{message}</span>}
        <button onClick={() => setSetupOpen(true)}>New match…</button>
        <button onClick={() => setScreen('game')}>Back to game</button>
      </div>
      <div className="editor-body">
        <div className="window dev-list">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="title" style={g.color ? { color: g.color } : undefined}>
                {g.label}
              </div>
              {g.kinds.map((k) => {
                const n = kindWarnings(k, roster).length;
                return (
                  <button key={k.id} className={`map-item dev-item ${k.id === selected ? 'on' : ''}`} onClick={() => setSelected(k.id)}>
                    <img src={unitIconUrl(k.id, 0)} alt="" />
                    <span className="dev-name">{k.name}</span>
                    {isEdited(k.id) && <span className="tag edited" title="Edited in this browser">edited</span>}
                    {isRepoEdited(k.id) && <span className="tag repo" title="Changed in the repo's balance file">repo</span>}
                    {n > 0 && <span className="tag warn" title={`${n} warning(s)`}>!{n}</span>}
                  </button>
                );
              })}
            </div>
          ))}
          <div className="title">Magic Abilities</div>
          <button
            onClick={() => {
              const id = createAbility();
              bump();
              setSelected(`ability:${id}`);
            }}
          >
            + New ability
          </button>
          {allAbilities().map((a) => (
            <button key={a.id} className={`map-item dev-item ${selected === `ability:${a.id}` ? 'on' : ''}`} onClick={() => setSelected(`ability:${a.id}`)}>
              <span className="dev-name">{a.name}</span>
              <span className="muted small">{abilityUsers(a.id).length}</span>
              {isAbilityEdited(a.id) && <span className="tag edited">edited</span>}
              {isAbilityRepoEdited(a.id) && <span className="tag repo">repo</span>}
            </button>
          ))}
        </div>

        <div className="window dev-form" key={selected}>
          {kind ? (
            <KindForm kind={kind} edit={edit} openAbility={(id) => setSelected(`ability:${id}`)} />
          ) : abilitySel && abilityOf(abilitySel) ? (
            <AbilityForm a={abilityOf(abilitySel)!} edit={editAbility} openKind={setSelected} />
          ) : (
            <div className="muted">This ability no longer exists.</div>
          )}
        </div>

        <div className="window editor-side">
          <div className="title">Warnings</div>
          {warnings.length ? warnings.map((w) => <div key={w} className="bad small">• {w}</div>) : <div className="good small">No warnings.</div>}
          <div className="title">{kind ? 'This unit' : 'This ability'}</div>
          <button
            disabled={kind ? !isEdited(selected) : !abilitySel || !isAbilityEdited(abilitySel)}
            onClick={() => {
              if (kind) {
                resetKind(selected);
                flash(`${kind.name} reset`);
              } else if (abilitySel) {
                const name = abilityOf(abilitySel)?.name;
                resetAbility(abilitySel);
                flash(`${name} reset`);
              }
              bump();
            }}
          >
            {abilitySel && !isBuiltInAbility(abilitySel) && !shippedAbility(abilitySel) ? 'Delete this new ability' : 'Reset to shipped values'}
          </button>
          <div className="title">All units</div>
          <div className="btn-row">
            <button
              onClick={() => {
                const blob = new Blob([exportBalanceJson()], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'magica-balance.json';
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
                if (!f) return;
                try {
                  importBalanceJson(await f.text());
                  bump();
                  flash('Balance imported');
                } catch (err) {
                  flash(`Import failed: ${(err as Error).message}`);
                }
              }}
            />
          </div>
          <button
            onClick={() => {
              if (!window.confirm('Reset every unit to its shipped values? Your local edits will be lost.')) return;
              resetAll();
              bump();
              flash('All local edits reset');
            }}
          >
            Reset all
          </button>
          {CAN_WRITE_REPO ? (
            <>
              <button
                className="play"
                onClick={async () => {
                  if (!window.confirm('Write the current balance into src/rules/data/overrides.json?')) return;
                  try {
                    await writeRepoBalance();
                    bump();
                    flash('Written to src/rules/data/overrides.json');
                  } catch (err) {
                    flash(`Write failed: ${(err as Error).message}`);
                  }
                }}
              >
                Write to repo
              </button>
              <div className="muted small">Saves the current balance (repo + your edits) as the game's shipped balance, in src/rules/data/overrides.json. Commit that file to keep it.</div>
            </>
          ) : (
            <div className="muted small">Run the dev server (npm run dev) to write balance into the repo, or Export and send the file.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Num({ label, value, onChange, min, max, step = 1, shipped }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; shipped?: number }) {
  const changed = shipped !== undefined && shipped !== value;
  return (
    <label className={`dev-field ${changed ? 'changed' : ''}`} title={changed ? `Shipped: ${shipped}` : undefined}>
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
      />
      {changed && <span className="muted small">({shipped})</span>}
    </label>
  );
}

function TrajectorySelect({ value, onChange }: { value?: Trajectory; onChange: (t: Trajectory) => void }) {
  return (
    <label className="dev-field">
      <span>Trajectory</span>
      <select value={value ?? 'high'} onChange={(e) => onChange(e.target.value as Trajectory)}>
        <option value="high">High</option>
        <option value="direct">Direct</option>
      </select>
    </label>
  );
}

function KindForm({ kind, edit, openAbility }: { kind: UnitKind; edit: (f: (k: UnitKind) => void) => void; openAbility: (id: string) => void }) {
  const shipped = shippedKind(kind.id);
  const summon = !kind.isMaster;
  return (
    <>
      <div className="dev-head">
        <img src={unitIconUrl(kind.id, 0)} alt="" />
        <img src={unitIconUrl(kind.id, 1)} alt="" />
        <div>
          <div className="title">{kind.name}</div>
          <div className="muted small">
            {kind.isMaster ? 'Master' : `${kind.element} Familiar · ${kind.role}`} · id {kind.id}
          </div>
        </div>
      </div>

      <div className="dev-section">
        <label className="dev-field">
          <span>Name</span>
          <input value={kind.name} maxLength={16} onChange={(e) => edit((k) => void (k.name = e.target.value))} />
        </label>
        {summon && <Num label="Cost" value={kind.cost} step={8} min={0} shipped={shipped.cost} onChange={(v) => edit((k) => void (k.cost = v))} />}
        <label className="dev-field">
          <span>Element</span>
          <select value={kind.element ?? 'none'} onChange={(e) => edit((k) => void (k.element = e.target.value === 'none' ? null : (e.target.value as Element)))}>
            <option value="none">None</option>
            {ELEMENTS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <label className="dev-field">
          <span>Alignment</span>
          <select value={kind.alignment} onChange={(e) => edit((k) => void (k.alignment = e.target.value as Alignment))}>
            <option value="none">None</option>
            <option value="day">Day</option>
            <option value="night">Night</option>
          </select>
        </label>
      </div>

      <div className="title">Stats</div>
      <div className="dev-section stats">
        {STAT_KEYS.map((s) => (
          <Num key={s} label={s.toUpperCase()} value={kind.stats[s]} min={0} max={40} shipped={shipped.stats[s]} onChange={(v) => edit((k) => void (k.stats[s] = v))} />
        ))}
      </div>
      {kind.isMaster && <BudgetRow kind={kind} edit={edit} />}

      <div className="title">Move Types</div>
      <div className="dev-section">
        {MOVE_TYPES.map((t) => (
          <label key={t} className="dev-check">
            <input
              type="checkbox"
              checked={kind.moveTypes.includes(t)}
              onChange={(e) =>
                edit((k) => {
                  const set = new Set(k.moveTypes);
                  if (e.target.checked) set.add(t);
                  else set.delete(t);
                  k.moveTypes = MOVE_TYPES.filter((x) => set.has(x));
                })
              }
            />{' '}
            {t}
          </label>
        ))}
      </div>

      <div className="title">Attack</div>
      <div className="dev-section">
        <Num
          label="Range"
          value={kind.attack.range}
          min={1}
          max={8}
          shipped={shipped.attack.range}
          onChange={(v) =>
            edit((k) => {
              k.attack.range = v;
              if (v > 1) k.attack.trajectory = k.attack.trajectory ?? 'high';
              else delete k.attack.trajectory;
            })
          }
        />
        {kind.attack.range > 1 && <TrajectorySelect value={kind.attack.trajectory} onChange={(t) => edit((k) => void (k.attack.trajectory = t))} />}
      </div>

      <div className="title">Magic</div>
      <div className="muted small">Magic Abilities are shared: edit one under Magic Abilities and every unit using it changes.</div>
      {(summon ? [0] : kind.magic.map((_, i) => i)).map((slot) => {
        const cur = kind.magic[slot];
        const options = allAbilities().filter((a) => kind.isMaster || a.kind !== 'water');
        return (
          <div key={slot} className="dev-section magic">
            <label className="dev-field">
              <span>{summon ? 'Ability' : `Slot ${slot + 1}`}</span>
              <select
                value={cur?.id ?? ''}
                onChange={(e) =>
                  edit((k) => {
                    const a = e.target.value ? abilityOf(e.target.value) : undefined;
                    if (summon) k.magic = a ? [a] : [];
                    else if (a) k.magic[slot] = a;
                  })
                }
              >
                {summon && <option value="">None</option>}
                {options.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.kind === 'water' ? `water ${a.delta > 0 ? 'rise' : 'ebb'}` : `${a.kind}, range ${a.range}`}, {a.manaCost}◆)
                  </option>
                ))}
              </select>
            </label>
            {cur && <span className="muted small">{magicSummary(cur)} · used by {abilityUsers(cur.id).length}</span>}
            {cur && <button onClick={() => openAbility(cur.id)}>Edit ability…</button>}
            {(shipped.magic[slot]?.id ?? '') !== (cur?.id ?? '') && <span className="muted small">(shipped: {shipped.magic[slot]?.name ?? 'none'})</span>}
          </div>
        );
      })}
    </>
  );
}

function magicSummary(m: MagicAbility): string {
  if (m.kind === 'water') return `${m.delta > 0 ? 'raises' : 'lowers'} the Water Level`;
  if (m.kind === 'damage' && m.burst) return `Burst, radius ${m.radius} around the caster (hits allies)`;
  return `${m.kind}, range ${m.range}${m.radius ? `, area ${m.radius}` : ''}${m.range > 1 ? `, ${m.trajectory === 'direct' ? 'Direct' : 'High'}` : ''}`;
}

/** A shared Magic Ability, with the units that use it. */
function AbilityForm({ a, edit, openKind }: { a: MagicAbility; edit: (f: (m: MagicAbility) => void) => void; openKind: (id: string) => void }) {
  const users = abilityUsers(a.id);
  return (
    <>
      <div className="title">{a.name}</div>
      <div className="muted small">
        Magic Ability · id {a.id}
        {isBuiltInAbility(a.id) ? '' : ' · new'}
      </div>
      <MagicForm m={a} shipped={shippedAbility(a.id)} onChange={edit} />
      <div className="title">Used by ({users.length})</div>
      <div className="btn-row">
        {users.length === 0 && <span className="muted small">No unit uses this ability yet: pick it from a unit's Magic section.</span>}
        {users.map((k) => (
          <button key={k.id} className="map-item dev-item" onClick={() => openKind(k.id)}>
            <img src={unitIconUrl(k.id, 0)} alt="" />
            <span className="dev-name">{k.name}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function MagicForm({ m, shipped, onChange }: { m: MagicAbility; shipped?: MagicAbility; onChange: (f: (m: MagicAbility) => void) => void }) {
  const sh = shipped && shipped.kind === m.kind ? shipped : undefined;
  return (
    <div className="dev-section magic">
      <label className="dev-field">
        <span>Name</span>
        <input value={m.name} maxLength={20} onChange={(e) => onChange((x) => void (x.name = e.target.value))} />
      </label>
      {m.kind === 'water' ? (
        <span className="muted small">{m.delta > 0 ? 'Rise' : 'Ebb'} the Water Level by 1</span>
      ) : (
        <>
          <label className="dev-field">
            <span>Effect</span>
            <select value={m.kind} onChange={(e) => onChange((x) => void (x.kind === 'water' || (x.kind = e.target.value as 'damage' | 'heal')))}>
              <option value="damage">Damage</option>
              <option value="heal">Heal</option>
            </select>
          </label>
          <Num
            label="Range"
            value={m.range}
            min={0}
            max={8}
            shipped={sh && sh.kind !== 'water' ? sh.range : undefined}
            onChange={(v) =>
              onChange((x) => {
                if (x.kind === 'water') return;
                x.range = v;
                if (v > 1) x.trajectory = x.trajectory ?? 'high';
                else delete x.trajectory;
              })
            }
          />
          <label className="dev-field">
            <span>Area</span>
            <select value={m.radius} onChange={(e) => onChange((x) => void (x.kind !== 'water' && (x.radius = Number(e.target.value) as 0 | 1 | 2)))}>
              <option value={0}>Single hex</option>
              <option value={1}>Hex + neighbours</option>
              <option value={2}>Two rings (Burst)</option>
            </select>
          </label>
          {m.kind === 'damage' && (
            <label className="dev-check" title="Centred on the caster (range 0); hits every Unit around it, allies included, but not the caster">
              <input
                type="checkbox"
                checked={!!m.burst}
                onChange={(e) =>
                  onChange((x) => {
                    if (x.kind !== 'damage') return;
                    if (e.target.checked) {
                      x.burst = true;
                      x.range = 0;
                      delete x.trajectory;
                      if (x.radius === 0) x.radius = 1;
                    } else {
                      delete x.burst;
                      if (x.radius === 2) x.radius = 1;
                    }
                  })
                }
              />{' '}
              Burst
            </label>
          )}
          {m.range > 1 && <TrajectorySelect value={m.trajectory} onChange={(t) => onChange((x) => void (x.kind !== 'water' && (x.trajectory = t)))} />}
        </>
      )}
      <Num label="Mana" value={m.manaCost} min={0} max={120} shipped={sh?.manaCost} onChange={(v) => onChange((x) => void (x.manaCost = v))} />
    </div>
  );
}

/** A Master's distance from the Stat Budget, and a button to roll a new balanced spread. */
function BudgetRow({ kind, edit }: { kind: UnitKind; edit: (f: (k: UnitKind) => void) => void }) {
  const err = budgetError(kind.stats, kind.attack.range);
  return (
    <div className="dev-section">
      <span className={Math.abs(err) <= 0.5 ? 'muted small' : 'bad small'} title="MP-equivalent of the stats minus the Stat Budget's total; within ±0.5 counts as balanced">
        Stat Budget: {err >= 0 ? '+' : ''}
        {err.toFixed(2)} MP {Math.abs(err) <= 0.5 ? '(balanced)' : err > 0 ? '(too strong)' : '(too weak)'}
      </span>
      <button
        title="Replace the stats with a random spread on the Stat Budget, for this Master's Attack range"
        onClick={() => {
          const s = generateSpread(mulberry32((Date.now() ^ (Math.random() * 1e9)) >>> 0), kind.attack.range);
          if (s) edit((k) => void (k.stats = s));
        }}
      >
        Roll a balanced spread
      </button>
    </div>
  );
}
