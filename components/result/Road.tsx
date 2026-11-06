'use client';
import { AnimatePresence, motion, useReducedMotion, useSpring } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { dur, ease, spring } from '@/lib/motion';
import { useLang } from '@/lib/i18n';
import { addMonths } from '@/lib/engine';
import { monthName, money } from '@/lib/format';
import type { Milestone, ReadinessResult } from '@/lib/types';

const BASE_H = 100;
const TRACK_Y = 40;
const PAD = 28;
const MIN_W = 340; // below this the road scrolls horizontally

type Placed = Milestone & { x: number; row: number; dx: number; anchor: 'start' | 'middle' | 'end' };
const textW = (s: string, bold = false) => s.length * (bold ? 7.4 : 6.9);

function place(ms: Milestone[], maxMonth: number, w: number): Placed[] {
  const usable = w - PAD * 2;
  const sorted = [...ms].sort((a, b) => a.month - b.month);
  const placed: Placed[] = [];
  let lastX = -Infinity;
  sorted.forEach((m, i) => {
    let x = PAD + (Math.min(m.month, maxMonth) / maxMonth) * usable;
    // keep markers at least 22px apart so each stays tappable; order is preserved
    if (x - lastX < 22) x = lastX + 22;
    lastX = x;
    placed.push({ ...m, x, row: 0, dx: 0, anchor: 'middle' });
    void i;
  });
  // if nudging pushed past the end, compress back from the right
  const overflow = lastX - (w - PAD);
  if (overflow > 0) {
    for (let i = placed.length - 1, edge = w - PAD; i >= 0; i--, edge -= 22) placed[i].x = Math.min(placed[i].x, edge);
  }
  // Greedy label layout: each label goes on the first row where it fits; otherwise the least-crowded row.
  const rows: number[] = [];
  for (const m of placed) {
    const lw = textW(m.label, m.key === 'keys');
    let left = Math.min(Math.max(m.x - lw / 2, 4), w - 4 - lw);
    let row = rows.findIndex((r) => left >= r + 10);
    if (row === -1 && rows.length < 4) row = rows.length;
    if (row === -1) {
      row = rows.indexOf(Math.min(...rows));
      left = Math.min(rows[row] + 10, w - 4 - lw);
    }
    rows[row] = left + lw;
    m.row = row;
    m.anchor = 'start';
    m.dx = left - m.x;
  }
  return placed;
}

function KeyGlyph() {
  // small key drawn in SVG, centred on (0,0)
  return (
    <g stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round">
      <circle cx="-2.5" cy="0" r="2.4" />
      <path d="M0 0h4.5M3 0v2" />
    </g>
  );
}

function Marker({ m, w, delay, play, active, onActive, onHover }: { m: Placed; w: number; delay: number; play: boolean; active: boolean; onActive: (k: string | null) => void; onHover: (k: string | null) => void }) {
  const reduce = useReducedMotion();
  const x = useSpring(m.x, spring.gentle);
  useEffect(() => {
    if (reduce) x.jump(m.x);
    else x.set(m.x);
  }, [m.x, x, reduce]);
  const isKeys = m.key === 'keys';
  return (
    <motion.g style={{ x }}>
      <motion.g
        initial={play ? { scale: 0.6, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...spring.gentle, delay }}
        style={{ originX: 0, originY: 0 }}
      >
        <g transform={`translate(0 ${TRACK_Y})`}>
          {/* 44px hit area */}
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
          {active && <circle r={isKeys ? 13 : 10} fill="none" stroke="var(--pine)" strokeWidth="2" pointerEvents="none" />}
          {isKeys ? (
            <g pointerEvents="none">
              <circle r="9" fill="var(--brass)" />
              <KeyGlyph />
            </g>
          ) : (
            <circle r="5" fill="var(--surface)" stroke="var(--pine)" strokeWidth="2" pointerEvents="none" />
          )}
        </g>
        <text
          y={TRACK_Y + 30 + m.row * 18}
          data-w={w}
          textAnchor={m.anchor}
          x={m.dx}
          className="fill-[var(--ink-2)] text-[13px]"
          style={{ fontWeight: isKeys ? 600 : 400, fill: isKeys ? 'var(--ink)' : undefined }}
          pointerEvents="none"
        >
          {m.label}
        </text>
      </motion.g>
    </motion.g>
  );
}

/**
 * The Road: Today → Keys with milestone markers placed proportionally by month.
 * Draws in once per visit; markers follow lever changes every frame with spring.gentle.
 */
export function Road({ result, today = new Date(), elapsed = 0, onEntranceDone, entrance = 'session', entranceDelay = 0, drawDuration = dur.long, markerStagger = 0.06 }: { result: ReadinessResult; today?: Date; elapsed?: number; onEntranceDone?: () => void; /** 'always' replays the draw-in (landing page) without using up the result screen's once-per-visit play. */ entrance?: 'session' | 'always' | 'none'; entranceDelay?: number; drawDuration?: number; markerStagger?: number }) {
  const { t, lang } = useLang();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(MIN_W);
  const [overflows, setOverflows] = useState(false);
  const [ready, setReady] = useState(false);
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
  useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);
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
    });
    ro.observe(el);
    setReady(true);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!play) onEntranceDone?.();
    else {
      const id = setTimeout(() => onEntranceDone?.(), (entranceDelay + drawDuration) * 1000 + 6 * markerStagger * 1000);
      return () => clearTimeout(id);
    }
  }, [play, onEntranceDone, entranceDelay, drawDuration, markerStagger]);

  const keysMonth = result.milestones.find((m) => m.key === 'keys')?.month ?? 9;
  // Domain: stable-ish so markers glide rather than rescale wildly; round up to 6 months.
  const maxMonth = Math.max(12, Math.ceil((keysMonth + 1) / 6) * 6);
  const collectionAmount = result.blockers.find((b) => b.key === 'collections')?.text.match(/\$[\d,]+/)?.[0] ?? '';
  const ms: Milestone[] = result.milestones.map((m) => ({
    ...m,
    label: t(`road.labels.${m.key}`),
    action:
      m.key === 'credit' && m.month === 0
        ? t('road.actions.creditGood')
        : t(`road.actions.${m.key}`, { amount: m.key === 'savings' ? money(result.downPaymentTarget, lang) : collectionAmount }),
  }));
  const placed = useMemo(() => place(ms, maxMonth, w), [ms, maxMonth, w]);
  const H = BASE_H + Math.max(0, ...placed.map((p) => p.row)) * 18;
  const usable = w - PAD * 2;
  const curX = PAD + (Math.min(elapsed, maxMonth) / maxMonth) * usable;
  const activeM = placed.find((p) => p.key === active);

  return (
    <div className="relative">
      <div ref={wrapRef} className="relative -mx-5 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:px-0" tabIndex={-1}>
        <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} data-ready={ready || undefined} role="group" aria-label={t('result.roadTitle')} className="block select-none">
          <motion.line
            x1={PAD}
            x2={w - PAD}
            y1={TRACK_Y}
            y2={TRACK_Y}
            stroke="var(--line)"
            strokeWidth="3"
            strokeLinecap="round"
            initial={play ? { pathLength: 0 } : false}
            animate={{ pathLength: 1 }}
            transition={{ duration: drawDuration, ease: ease.out, delay: entranceDelay }}
          />
          {elapsed > 0 && <line x1={PAD} x2={curX} y1={TRACK_Y} y2={TRACK_Y} stroke="var(--pine)" strokeWidth="3" strokeLinecap="round" />}
          {/* Today label + current position (brass) */}
          <text x={PAD} y={TRACK_Y - 16} textAnchor="start" className="text-[13px]" style={{ fill: 'var(--ink-2)' }}>
            {t('result.today')}
          </text>
          {placed.map((m, i) => (
            <Marker key={m.key} m={m} w={w} onHover={onHover} delay={play ? entranceDelay + drawDuration + i * markerStagger : 0} play={play} active={active === m.key} onActive={setActive} />
          ))}
          <motion.circle cx={curX} cy={TRACK_Y} r="4" fill="var(--brass)" initial={play ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: dur.short }} />
        </svg>
        <AnimatePresence>
        {activeM && (
          <motion.div
            key="tip"
            role="tooltip"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1 } }}
            transition={{ duration: 0.15, ease: ease.out }}
            className="pointer-events-none absolute top-[64px] z-10 w-[240px] rounded-[8px] bg-ink px-3 py-2 text-[13px] leading-[18px] text-white"
            style={{ left: Math.min(Math.max(activeM.x - 120, 8), w - 248), transformOrigin: `${activeM.x - Math.min(Math.max(activeM.x - 120, 8), w - 248)}px 0px` }}
          >
            <span className="tnum block font-medium">
              {activeM.label} · {monthName(addMonths(today, activeM.month), lang, true)}
            </span>
            <span className="mt-1 block text-white/85">{activeM.action}</span>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
      {/* faint fade at the right edge on mobile, where the road scrolls */}
      {overflows && <div className="pointer-events-none absolute inset-y-0 -right-5 w-10 bg-gradient-to-l from-[var(--surface)] to-transparent" aria-hidden />}
    </div>
  );
}
