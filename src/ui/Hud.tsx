// The top HUD, laid out like a fighting game's: each Side's Master HP and Mana run
// out from the centre to the screen edges (and deplete back toward it), with Income
// and Upkeep as thin bars below. The Game Clock sits between them; each Master's
// portrait and Army Value sit at the outer corners.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  alignmentBonus,
  ELEMENTS,
  FAMILIARS,
  formatClock,
  inRoster,
  isSignature,
  onMap,
  SIGNATURE_LIMIT,
  summonLimit,
  INCOME_MULTIPLIER,
  kindOf,
  MANA_MAX,
  MAX_HP,
  manaIncome,
  nextIncomeAt,
  STONE_BASE,
  stonesControlled,
  timeOfDay,
  upkeep,
  type MatchState,
  type SideId,
} from '../rules';
import { onlineSide, useGame } from '../store';
import { useOnline } from '../online/session';
import { loadIdentity } from '../online/api';
import { animElapsed } from '../anim';
import { ELEMENT_COLORS, SIDE_COLORS, unitIconUrl } from '../render/sprites';
import { ClassIcon, Icon } from './icons';
import { SignatureStar } from './LoadoutView';
import { useLoadoutHover } from './HoverCard';
import { makePlan } from '../ai/plan';

/** How long the chunk just lost lingers before draining, and the pop number stays. */
const CHUNK_HOLD_MS = 450;
const CHUNK_DRAIN_MS = 550;

/** The Army Value: the total Cost of a Side's Familiars on the map (each Signature copy in full). */
export function armyValue(match: MatchState, side: SideId): number {
  return match.units.filter((u) => u.side === side && u.hp > 0 && !kindOf(u).isMaster).reduce((a, u) => a + kindOf(u).cost, 0);
}

/** A Master's HP as the board shows it: from each hit's impact on, before the turn ends. */
function useShownMasterHp(side: SideId): number {
  const match = useGame((s) => s.match);
  const master = match.units.find((u) => u.side === side && kindOf(u).isMaster);
  const [struck, setStruck] = useState<number | null>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const a = useGame.getState().anim;
      let hp: number | null = null;
      if (a && master) {
        const t = animElapsed(a);
        for (const imp of a.impacts) if (imp.unitId === master.id && t >= imp.t) hp = imp.hpAfter;
      }
      setStruck((x) => (x === hp ? x : hp));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [master?.id]);
  return struck ?? master?.hp ?? 0;
}

/** The chunk a bar just lost (as fractions of its full length), shown lingering then draining. */
interface Chunk {
  key: number;
  from: number;
  to: number;
  amount: number;
}

/** Watch `value` and report each drop (`when` says whether a drop counts). */
function useDrops(value: number, scale: number, when: (prev: number, next: number) => boolean = () => true): Chunk[] {
  const prev = useRef(value);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const whenRef = useRef(when);
  whenRef.current = when;
  useEffect(() => {
    const before = prev.current;
    prev.current = value;
    if (value >= before || !whenRef.current(before, value)) return;
    const c: Chunk = { key: performance.now() + Math.random(), from: Math.min(1, before / scale), to: Math.min(1, value / scale), amount: before - value };
    setChunks((cs) => [...cs, c]);
    const t = setTimeout(() => setChunks((cs) => cs.filter((x) => x.key !== c.key)), CHUNK_HOLD_MS + CHUNK_DRAIN_MS + 400);
    return () => clearTimeout(t);
  }, [value, scale]);
  return chunks;
}

function ChunkView({ c, kind }: { c: Chunk; kind: 'hp' | 'mana' }) {
  return (
    <>
      <div
        className={`hud-chunk ${kind}`}
        style={{ ['--from' as string]: c.from, ['--to' as string]: c.to, animationDuration: `${CHUNK_DRAIN_MS}ms`, animationDelay: `${CHUNK_HOLD_MS}ms` }}
      />
      <div className={`hud-loss ${kind}`} style={{ ['--at' as string]: (c.from + c.to) / 2 }}>
        −{c.amount}
      </div>
    </>
  );
}

/**
 * One bar running out from the centre (`fill` as a fraction of its full length; above 1
 * wraps into laps). `marks`: divider positions, as fractions of the full length.
 */
function Bar({ className, fill, chunks, kind, title, marks = [] }: { className: string; fill: number; chunks?: Chunk[]; kind?: 'hp' | 'mana'; title?: string; marks?: number[] }) {
  const lap1 = Math.min(1, Math.max(0, fill));
  const lap2 = Math.min(1, Math.max(0, fill - 1));
  const laps = Math.floor(Math.max(0, fill - 1e-9));
  return (
    <div className={`hud-bar ${className}`} title={title}>
      <div className="hud-fill" style={{ ['--f' as string]: lap1 }} />
      {lap2 > 0 && <div className="hud-fill lap2" style={{ ['--f' as string]: lap2 }} />}
      {laps >= 2 && <span className="hud-laps">×{laps + 1}</span>}
      {chunks?.map((c) => <ChunkView key={c.key} c={c} kind={kind!} />)}
      {marks.map((m) => (
        <div key={m} className="hud-mark" style={{ ['--at' as string]: m }} />
      ))}
    </div>
  );
}

function playerName(match: MatchState, side: SideId, online: ReturnType<typeof useOnline.getState>): string {
  if (match.sides[side].ai) return 'AI';
  const mine = onlineSide();
  if (mine !== null) return side === mine ? (online.me?.name ?? 'You') : (online.opponent?.name ?? 'Opponent');
  return loadIdentity()?.name ?? `Player ${side + 1}`;
}

function SideHud({ side }: { side: SideId }) {
  const match = useGame((s) => s.match);
  const online = useOnline();
  const master = match.units.find((u) => u.side === side && kindOf(u).isMaster);
  const mk = master ? kindOf(master) : null;
  // a fallen Master leaves the map, but stays in its portrait: the last one seen, else the match's start
  const startKind = useGame((s) => (s.replay?.replay.initial ?? s.recording?.initial)?.units.find((u) => u.side === side && kindOf(u).isMaster)?.kind ?? null);
  const lastKind = useRef<string | null>(null);
  if (master) lastKind.current = master.kind;
  const portraitKind = master?.kind ?? lastKind.current ?? startKind;
  const shownName = portraitKind ? kindOf(portraitKind).name : '';
  const hp = useShownMasterHp(side);
  const showPlans = useGame((s) => s.showPlans);
  const [loadoutOpen, setLoadoutOpen] = useState(false);
  const mana = match.sides[side].mana;
  // Mana per Stone-hour, with the Master's Alignment at the next hour mark
  const mp = mk ? INCOME_MULTIPLIER * Math.max(0, mk.stats.mp + alignmentBonus(mk.alignment, nextIncomeAt(match.clock))) : 0;
  const stones = stonesControlled(match, side);
  const gross = (STONE_BASE + stones) * mp;
  const up = upkeep(match, side);
  const net = manaIncome(match, side);
  const familiars = match.units.filter((u) => u.side === side && !kindOf(u).isMaster).length;
  const lastFamiliars = useRef(familiars);
  // Mana spent: a drop that came with a new Familiar (a Summon), not an hour of negative Income
  const manaChunks = useDrops(mana, MANA_MAX, () => familiars > lastFamiliars.current);
  useEffect(() => {
    lastFamiliars.current = familiars;
  });
  const hpChunks = useDrops(hp, MAX_HP);
  const [shake, setShake] = useState(0);
  useEffect(() => {
    if (hpChunks.length) setShake(hpChunks[hpChunks.length - 1].key);
  }, [hpChunks]);
  const base = STONE_BASE * mp;
  // where the base Income ends and each controlled Stone's share ends (on its lap of the bar)
  const stoneMarks = Array.from({ length: stones }, (_, i) => ((base + i * mp) % MANA_MAX) / MANA_MAX).filter((m) => m > 0);
  return (
    <div className={`hud-side s${side}`} style={{ ['--side' as string]: SIDE_COLORS[side] }}>
      <div className="hud-portrait">
        <div
          className={`hud-face ${loadoutOpen ? 'open' : ''}`}
          title="Show or hide this Master's Loadout"
          onClick={() => setLoadoutOpen((o) => !o)}
          onContextMenu={(e) => {
            e.preventDefault();
            setLoadoutOpen((o) => !o);
          }}
        >
          {portraitKind && <img src={unitIconUrl(portraitKind, side)} alt="" />}
        </div>
        <div className="hud-army" title="Army Value: the total Cost of this Side's Familiars on the map">
          <span className="lbl">ARMY</span>
          <span>{armyValue(match, side)}</span>
        </div>
      </div>
      <div className="hud-bars">
        <div key={shake} className={`hud-hp-wrap ${shake ? 'shake' : ''}`}>
          <Bar
            className="hp"
            fill={hp / MAX_HP}
            chunks={hpChunks}
            kind="hp"
            title={`${shownName || 'Master'}: ${hp}/${MAX_HP} HP`}
            marks={Array.from({ length: MAX_HP - 1 }, (_, i) => (i + 1) / MAX_HP)}
          />
          <span className="hud-num hp">{hp}</span>
        </div>
        <div className="hud-mana-wrap">
          <Bar className="mana" fill={mana / MANA_MAX} chunks={manaChunks} kind="mana" title={`Mana ${mana}/${MANA_MAX}`} />
          <span className="hud-num mana">{mana}</span>
        </div>
        <div className="hud-econ">
          <Bar className="income" fill={gross / MANA_MAX} marks={stoneMarks} />
          <Bar className="upkeep" fill={up / MANA_MAX} />
          <span className="hud-num econ">{Math.abs(net)}</span>
          <div className="hud-tip">
            Income +{gross} (base {base} + {stones} stone{stones === 1 ? '' : 's'} × {mp}) · Upkeep −{up} · Net {net >= 0 ? '+' : ''}
            {net}/h
          </div>
        </div>
        <div className="hud-names">
          <b>{shownName}</b> <span>{playerName(match, side, online)}</span>
        </div>
        {showPlans && match.sides[side].ai && match.winner === null && <AiPlanLine side={side} />}
      </div>
      {loadoutOpen && <PortraitLoadout side={side} />}
    </div>
  );
}

/** One line: what an AI Side is trying to do (docs/ai-plan.md). */
function AiPlanLine({ side }: { side: SideId }) {
  const match = useGame((s) => s.match);
  const text = useMemo(() => makePlan(match, side).text, [match, side]);
  return (
    <div className="hud-plan" title="The AI's Plan this turn">
      {text}
    </div>
  );
}

/**
 * A Master's Loadout, hanging below its portrait: its Familiars by Element, cheapest
 * first, the Signature starred, those already on the map and those it can't afford yet marked.
 */
function PortraitLoadout({ side }: { side: SideId }) {
  const match = useGame((s) => s.match);
  const mana = match.sides[side].mana;
  useEffect(() => () => useLoadoutHover.setState({ kind: null }), []);
  return (
    <div className="portrait-loadout window">
      {ELEMENTS.map((e) => {
        const row = FAMILIARS.filter((k) => k.element === e && inRoster(match, side, k.id))
          .slice()
          .sort((a, b) => a.cost - b.cost);
        if (!row.length) return null;
        return (
          <div key={e} className="summon-row">
            {row.map((k) => {
              const sig = isSignature(match, side, k.id);
              const have = onMap(match, side, k.id);
              const full = have >= summonLimit(match, side, k.id);
              const poor = mana < k.cost;
              return (
                <div
                  key={k.id}
                  className={`summon-tile ${full || poor ? 'disabled' : ''} ${full ? 'full' : ''} ${poor ? 'poor' : ''}`}
                  style={{ background: `${ELEMENT_COLORS[e]}2e`, borderColor: `${ELEMENT_COLORS[e]}66` }}
                  onMouseEnter={() => useLoadoutHover.setState({ kind: { id: k.id, side, signature: sig } })}
                  onMouseLeave={() => useLoadoutHover.setState({ kind: null })}
                >
                  <img src={unitIconUrl(k.id, side)} alt="" />
                  <span className="cls">
                    <ClassIcon kind={k} size={12} />
                  </span>
                  <span className="nm">{k.name}</span>
                  <span className="cost">{k.cost}</span>
                  {sig && (
                    <span className="sig-star">
                      <SignatureStar size={11} />
                    </span>
                  )}
                  {sig && (
                    <span className="sig-count">
                      {have}/{SIGNATURE_LIMIT}
                    </span>
                  )}
                  {full && <span className="on-map">on map</span>}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function Hud() {
  const match = useGame((s) => s.match);
  const tod = timeOfDay(match.clock);
  return (
    <div className="hud">
      <SideHud side={0} />
      <div className="hud-clock" title={`Game Clock · ${tod}`}>
        <Icon name={tod} size={22} />
        <span>{formatClock(match.clock)}</span>
      </div>
      <SideHud side={1} />
    </div>
  );
}
