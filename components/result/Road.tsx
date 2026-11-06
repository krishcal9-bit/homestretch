'use client';
import { AnimatePresence, motion, useReducedMotion, useSpring } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { dur, ease, spring } from '@/lib/motion';
import { useLang } from '@/lib/i18n';
import { addMonths } from '@/lib/engine';
import { monthName, money } from '@/lib/format';
import type { Milestone, MilestoneKey, ReadinessResult } from '@/lib/types';

const PAD = 28;
const MIN_W = 340; // below this the road scrolls horizontally
const MERGE_GAP = 72; // markers closer than this share one label
const MIN_MARKER_GAP = 22; // markers stay at least this far apart so each stays tappable

type Size = 'md' | 'lg';
const GEOM: Record<Size, { trackY: number; h: number; r: number; keysR: number; track: number; font: number; above: number; below: number; charW: number }> = {
  md: { trackY: 40, h: 78, r: 5, keysR: 9, track: 3, font: 13, above: 15, below: 27, charW: 6.9 },
  lg: { trackY: 46, h: 92, r: 7, keysR: 12, track: 4, font: 15, above: 19, below: 33, charW: 8 },
};

/** cubic-bezier(x1,y1,x2,y2) as a function of time → progress, and its inverse (progress → time). */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (t: number, a: number, b: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  const progressAt = (time: number) => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (at(mid, x1, x2) < time) lo = mid;
      else hi = mid;
    }
    return at((lo + hi) / 2, y1, y2);
  };
  /** time (0–1) at which progress first reaches p */
  const timeFor = (p: number) => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (progressAt(mid) < p) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  return { progressAt, timeFor };
}
const CURVES = { out: bezier(...ease.out), inOut: bezier(...ease.inOut) };

type Placed = Milestone & { x: number };
type Cluster = { id: string; keys: MilestoneKey[]; x: number; text: string; side: 'above' | 'below'; left: number; width: number };

function placeMarkers(ms: Milestone[], maxMonth: number, w: number): Placed[] {
  const usable = w - PAD * 2;
  const sorted = [...ms].sort((a, b) => a.month - b.month);
  const placed: Placed[] = [];
  let lastX = -Infinity;
  for (const m of sorted) {
    let x = PAD + (Math.min(m.month, maxMonth) / maxMonth) * usable;
    if (x - lastX < MIN_MARKER_GAP) x = lastX + MIN_MARKER_GAP;
    lastX = x;
    placed.push({ ...m, x });
  }
  if (lastX > w - PAD) for (let i = placed.length - 1, edge = w - PAD; i >= 0; i--, edge -= MIN_MARKER_GAP) placed[i].x = Math.min(placed[i].x, edge);
  return placed;
}

/**
 * Label layout that never overlaps: markers closer than 72px share one label; labels alternate above and
 * below the track; if a label would still collide with its same-side neighbour (or with "Today"), it flips
 * side or merges with its neighbour, repeating until nothing overlaps.
 */
function layoutLabels(placed: Placed[], w: number, charW: number, todayW: number, joinText: (labels: string[]) => string, pinned: MilestoneKey[] = []): Cluster[] {
  const isPinned = (g: Placed[]) => g.some((m) => pinned.includes(m.key));
  // 1. initial clusters by distance
  let groups: Placed[][] = [];
  for (const m of placed) {
    const g = groups[groups.length - 1];
    // A highlighted milestone always keeps a label of its own.
    if (g && m.x - g[g.length - 1].x < MERGE_GAP && !pinned.includes(m.key) && !isPinned(g)) g.push(m);
    else groups.push([m]);
  }
  const build = (gs: Placed[][]): Cluster[] =>
    gs.map((g, i) => {
      const text = joinText(g.map((m) => m.label));
      const width = text.length * charW + 4;
      const x = (g[0].x + g[g.length - 1].x) / 2;
      const left = Math.min(Math.max(x - width / 2, 2), w - 2 - width);
      return { id: g.map((m) => m.key).join('+'), keys: g.map((m) => m.key), x, text, side: i % 2 === 0 ? 'below' : 'above', left, width };
    });
  for (let guard = 0; guard < 12; guard++) {
    const cs = build(groups);
    const lastRight: Record<'above' | 'below', number> = { above: PAD + todayW + 8, below: -Infinity };
    let conflict = -1;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (c.left >= lastRight[c.side] + 8) {
        lastRight[c.side] = c.left + c.width;
        continue;
      }
      const other = c.side === 'above' ? 'below' : 'above';
      if (c.left >= lastRight[other] + 8) {
        c.side = other;
        lastRight[other] = c.left + c.width;
        continue;
      }
      conflict = i;
      break;
    }
    if (conflict < 0) return cs;
    // Merge the conflicting cluster into a neighbour that isn't highlighted and try again.
    const i = conflict;
    const left = i - 1 >= 0 && !isPinned(groups[i - 1]) && !isPinned(groups[i]) ? i - 1 : -1;
    const right = i + 1 < groups.length && !isPinned(groups[i + 1]) && !isPinned(groups[i]) ? i + 1 : -1;
    if (left >= 0) groups = [...groups.slice(0, left), [...groups[left], ...groups[i]], ...groups.slice(i + 1)];
    else if (right >= 0) groups = [...groups.slice(0, i), [...groups[i], ...groups[right]], ...groups.slice(right + 1)];
    else {
      // Last resort: drop the label of the non-highlighted cluster next to a highlighted one.
      const victim = isPinned(groups[i]) ? i - 1 : i;
      if (victim < 0) return cs;
      const kept = build(groups).filter((_, k) => k !== victim);
      return kept;
    }
  }
  return build(groups);
}

function KeyGlyph({ s = 1 }: { s?: number }) {
  return (
    <g stroke="white" strokeWidth={1.5} fill="none" strokeLinecap="round" transform={`scale(${s})`}>
      <circle cx="-2.5" cy="0" r="2.4" />
      <path d="M0 0h4.5M3 0v2" />
    </g>
  );
}

function Marker({ m, g, delay, play, active, highlighted, onActive, onHover }: { m: Placed; g: (typeof GEOM)[Size]; delay: number; play: boolean; active: boolean; highlighted: boolean; onActive: (k: string | null) => void; onHover: (k: string | null) => void }) {
  const reduce = useReducedMotion();
  const x = useSpring(m.x, spring.gentle);
  useEffect(() => {
    if (reduce) x.jump(m.x);
    else x.set(m.x);
  }, [m.x, x, reduce]);
  const isKeys = m.key === 'keys';
  return (
    <motion.g style={{ x, y: g.trackY }}>
      <motion.g
        initial={play ? { scale: 0.9, opacity: 0 } : false}
        animate={{ scale: highlighted ? 1.15 : 1, opacity: 1 }}
        transition={{ scale: play && !highlighted ? { duration: 0.2, ease: ease.out, delay } : spring.snappy, opacity: { duration: 0.2, ease: ease.out, delay: play ? delay : 0 } }}
      >
        <circle
          r="22"
          fill="transparent"
          tabIndex={0}
          role="button"
          aria-label={m.label}
          data-milestone={m.key}
          className="cursor-pointer outline-none"
          onPointerEnter={(e) => (e.pointerType === 'mouse' ? onHover(m.key) : undefined)}
          onPointerLeave={(e) => (e.pointerType === 'mouse' ? onHover(null) : undefined)}
          onFocus={() => onActive(m.key)}
          onBlur={() => onActive(null)}
          onClick={() => onActive(active ? null : m.key)}
        />
        {active && <circle r={(isKeys ? g.keysR : g.r) + 5} fill="none" stroke="var(--pine)" strokeWidth="2" pointerEvents="none" />}
        {isKeys ? (
          <g pointerEvents="none">
            <circle r={g.keysR} fill="var(--brass)" />
            <KeyGlyph s={g.keysR / 9} />
          </g>
        ) : (
          <circle r={g.r} fill="var(--surface)" stroke="var(--pine)" strokeWidth={g.r > 5 ? 2.5 : 2} pointerEvents="none" />
        )}
      </motion.g>
    </motion.g>
  );
}

type RoadProps = {
  result: ReadinessResult;
  today?: Date;
  elapsed?: number;
  onEntranceDone?: () => void;
  /** 'always' replays the draw-in (landing page) without using up the result screen's once-per-visit play. */
  entrance?: 'session' | 'always' | 'none';
  entranceDelay?: number;
  drawDuration?: number;
  drawEase?: 'out' | 'inOut';
  size?: Size;
  /** Milestones to emphasise (landing scroll story). */
  highlight?: MilestoneKey[];
  /** CSS view-transition-name for shared-element transitions. */
  vtName?: string;
  className?: string;
};

/**
 * The Road: Today → Keys with milestone markers placed proportionally by month. The track draws in;
 * each marker pops in as the line reaches it; markers follow lever changes with spring.gentle.
 */
export function Road({ result, today = new Date(), elapsed = 0, onEntranceDone, entrance = 'session', entranceDelay = 0, drawDuration = dur.long, drawEase = 'out', size = 'md', highlight = [], vtName, className = '' }: RoadProps) {
  const { t, lang } = useLang();
  const g = GEOM[size];
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(MIN_W);
  const [overflows, setOverflows] = useState(false);
  // Nothing is drawn until the real width is known, so markers never slide from a fallback layout.
  const [measured, setMeasured] = useState(false);
  // Entrance delays apply only during the first draw; later changes (sliders, family switch) respond at once.
  const [entranceOver, setEntranceOver] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  // Tooltip etiquette: first hover waits 400ms; once one is open, neighbours open instantly.
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onHover = (k: string | null) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (k === null) {
      hoverTimer.current = setTimeout(() => setActive(null), 80);
      return;
    }
    if (active) setActive(k);
    else hoverTimer.current = setTimeout(() => setActive(k), 400);
  };
  useEffect(
    () => () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    },
    [],
  );
  const [play] = useState(() => {
    if (entrance === 'always') return true;
    if (entrance === 'none') return false;
    try {
      if (sessionStorage.getItem('hs.roadPlayed')) return false;
      sessionStorage.setItem('hs.roadPlayed', '1');
      return true;
    } catch {
      return true;
    }
  });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setW(Math.max(MIN_W, Math.round(e.contentRect.width)));
      setOverflows(e.contentRect.width < MIN_W);
      setMeasured(true);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!play) {
      setEntranceOver(true);
      onEntranceDone?.();
    } else {
      const id = setTimeout(() => {
        setEntranceOver(true);
        onEntranceDone?.();
      }, (entranceDelay + drawDuration + 0.2) * 1000);
      return () => clearTimeout(id);
    }
  }, [play, onEntranceDone, entranceDelay, drawDuration]);

  const keysMonth = result.milestones.find((m) => m.key === 'keys')?.month ?? 9;
  // Domain rounds up to 6 months so markers glide rather than rescale wildly.
  const maxMonth = Math.max(12, Math.ceil((keysMonth + 1) / 6) * 6);
  const collectionAmount = result.blockers.find((b) => b.key === 'collections')?.text.match(/\$[\d,]+/)?.[0] ?? '';
  const ms: Milestone[] = result.milestones.map((m) => ({
    ...m,
    label: t(`road.labels.${m.key}`),
    action: m.key === 'credit' && m.month === 0 ? t('road.actions.creditGood') : t(`road.actions.${m.key}`, { amount: m.key === 'savings' ? money(result.downPaymentTarget, lang) : collectionAmount }),
  }));
  const placed = useMemo(() => placeMarkers(ms, maxMonth, w), [ms, maxMonth, w]);
  const joinText = (labels: string[]) =>
    labels.length === 1 ? labels[0] : labels.length === 2 ? `${labels[0]} + ${labels[1].charAt(0).toLowerCase()}${labels[1].slice(1)}` : `${labels[0]} + ${t('road.more', { n: labels.length - 1 })}`;
  const todayLabel = t('result.today');
  // Keys always keeps its own label: it's the brass marker the levers move.
  const clusters = useMemo(() => layoutLabels(placed, w, g.charW, todayLabel.length * g.charW, joinText, [...highlight, 'keys']), [placed, w, g.charW, todayLabel, lang, highlight.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const usable = w - PAD * 2;
  const curX = PAD + (Math.min(elapsed, maxMonth) / maxMonth) * usable;
  const activeM = placed.find((p) => p.key === active);
  const curve = CURVES[drawEase];
  // A marker pops in when the drawing line reaches it.
  const reachDelay = (x: number) => entranceDelay + drawDuration * curve.timeFor(Math.min(1, Math.max(0, (x - PAD) / usable)));

  return (
    <div className={`relative ${className}`} style={vtName ? { viewTransitionName: vtName } : undefined}>
      <div ref={wrapRef} className="relative -mx-5 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:px-0" tabIndex={-1}>
        <svg width={w} height={g.h} viewBox={`0 0 ${w} ${g.h}`} role="group" aria-label={t('result.roadTitle')} className="block select-none overflow-visible">
          {measured && (<>
          <motion.line
            x1={PAD}
            x2={w - PAD}
            y1={g.trackY}
            y2={g.trackY}
            stroke="var(--line)"
            strokeWidth={g.track}
            strokeLinecap="round"
            initial={play ? { pathLength: 0 } : false}
            animate={{ pathLength: 1 }}
            transition={{ duration: drawDuration, ease: drawEase === 'inOut' ? ease.inOut : ease.out, delay: entranceDelay }}
          />
          {elapsed > 0 && <line x1={PAD} x2={curX} y1={g.trackY} y2={g.trackY} stroke="var(--pine)" strokeWidth={g.track} strokeLinecap="round" />}
          <motion.text
            x={PAD}
            y={g.trackY - g.above}
            textAnchor="start"
            style={{ fill: 'var(--ink-2)', fontSize: g.font }}
            initial={play ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: play ? entranceDelay : 0 }}
          >
            {todayLabel}
          </motion.text>
          {placed.map((m) => (
            <Marker key={m.key} m={m} g={g} onHover={onHover} delay={play && !entranceOver ? reachDelay(m.x) : 0} play={play} highlighted={highlight.includes(m.key)} active={active === m.key} onActive={setActive} />
          ))}
          <AnimatePresence initial={play}>
            {clusters.map((c) => {
              const strong = c.keys.includes('keys') || c.keys.some((k) => highlight.includes(k));
              return (
                <motion.text
                  key={c.id}
                  y={c.side === 'above' ? g.trackY - g.above : g.trackY + g.below}
                  textAnchor="start"
                  style={{ fontSize: g.font, fontWeight: c.keys.includes('keys') ? 600 : 400 }}
                  initial={{ opacity: 0, x: c.left }}
                  animate={{ opacity: 1, x: c.left, fill: strong ? 'var(--ink)' : 'var(--ink-2)' }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  transition={{ x: spring.gentle, fill: { duration: 0.2 }, opacity: { duration: 0.2, ease: ease.out, delay: play && !entranceOver ? reachDelay(c.x) + 0.05 : 0 } }}
                  pointerEvents="none"
                  data-label={c.id}
                >
                  {c.text}
                </motion.text>
              );
            })}
          </AnimatePresence>
          <motion.circle cx={curX} cy={g.trackY} r={g.r - 1} fill="var(--brass)" initial={play ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: dur.short, delay: play ? entranceDelay : 0 }} />
          </>)}
        </svg>
        <AnimatePresence>
          {activeM && (
            <motion.div
              key="tip"
              role="tooltip"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1 } }}
              transition={{ duration: 0.16, ease: ease.out }}
              className="pointer-events-none absolute z-10 w-[240px] rounded-[8px] bg-ink px-3 py-2 text-[13px] leading-[18px] text-white"
              style={{
                top: g.trackY + g.keysR + 8,
                left: Math.min(Math.max(activeM.x - 120, 8), w - 248),
                transformOrigin: `${activeM.x - Math.min(Math.max(activeM.x - 120, 8), w - 248)}px -8px`,
              }}
            >
              <span className="tnum block font-medium">
                {activeM.label} · {monthName(addMonths(today, activeM.month), lang, true)}
              </span>
              <span className="mt-1 block text-white/85">{activeM.action}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {overflows && <div className="pointer-events-none absolute inset-y-0 -right-5 w-10 bg-gradient-to-l from-[var(--surface)] to-transparent" aria-hidden />}
    </div>
  );
}
