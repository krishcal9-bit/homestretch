'use client';
import { animate, AnimatePresence, motion, motionValue, useReducedMotion, useTransform, type MotionValue } from 'motion/react';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { dur, ease, exit, spring } from '@/lib/motion';

export type ChartDatum = { label: string; baseline: number; projected: number };
/** A home completion: a dashed line at its month, its title in the lowest label lane where it fits. */
export type ChartMarker = { id: string; index: number; title: string; lane: number };

export const BASE = '#B7C3BD'; // baseline bars beside a program: a quiet neutral next to pine
export const PINE = '#1E5C47';

const HEIGHT = 308; // the svg; the legend row (32px) sits under it, 340px in all
const LEFT = 40; // y-axis labels
const RIGHT = 48;
const AXIS = 26; // month labels under the baseline
const CAT_GAP = 0.18; // space between months, as a share of the month's band
const BAR_GAP = 2; // between the two bars of a month
const R = 4; // rounded data end

// Motion. Load: every bar grows from the baseline (scaleY, 300ms ease-out, 6ms apart left to right) and one
// band of light passes over the bars once (a masked gradient, translateX only, 300ms). A program toggled or
// edited: bars morph to their new height, width and place with spring.smooth (interruptible, keeps velocity
// when retargeted mid-way); the gridlines glide to the new scale. Hover is instant. Reduced motion: none.
const GROW = dur.short * 1.5;
const GROW_STAGGER = 0.006;
const SWEEP = dur.short * 1.5;
const SWEEP_DELAY = dur.micro;
const SWEEP_W = 90;
const SWEEP_SLANT = 56;

type BarMV = { x: MotionValue<number>; w: MotionValue<number>; h: MotionValue<number> };
type Target = { x: number; w: number; h: number };

/** Four integer ticks above zero (Recharts' default count): the step is the smallest of 1, 2, 3, 4, 5, 10 ×10ⁿ that covers the max. */
function ticksFor(max: number) {
  const raw = Math.max(1, max) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 3, 4, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow);
  return [0, 1, 2, 3, 4].map((k) => k * step);
}

/**
 * One bar, built from parts that only ever move or scale: a unit body scaled to the bar's width and its
 * height less the radius, and a rounded cap (two circles and a strip) translated to sit on top. So a bar
 * changes height and width with transforms alone and its 4px corners never stretch. Below the baseline is
 * clipped, so a cap on a bar shorter than the radius shows only the part above zero.
 */
function Bar({ m, fill }: { m: BarMV; fill: string }) {
  const body = useTransform(m.h, (v) => Math.max(0, v - R));
  const capY = useTransform(m.h, (v) => R - v);
  const strip = useTransform(m.w, (v) => Math.max(0, v - 2 * R));
  const right = useTransform(m.w, (v) => v - R);
  return (
    <motion.g style={{ x: m.x }}>
      <motion.rect x={0} y={-1} width={1} height={1} fill={fill} style={{ scaleX: m.w, scaleY: body, originX: 0, originY: 1 }} />
      <motion.rect x={0} y={-R} width={1} height={R} fill={fill} style={{ x: R, y: capY, scaleX: strip, originX: 0, originY: 1 }} />
      <motion.circle cx={0} cy={0} r={R} fill={fill} style={{ x: R, y: capY }} />
      <motion.circle cx={0} cy={0} r={R} fill={fill} style={{ x: right, y: capY }} />
    </motion.g>
  );
}

export function ReadyChart({ data, markers, laneCount, anyOn, label }: { data: ChartDatum[]; markers: ChartMarker[]; laneCount: number; anyOn: boolean; label: string }) {
  const id = useId().replace(/:/g, '');
  const reduce = !!useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [sweep, setSweep] = useState(true);
  const n = data.length;

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setWidth(Math.round(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const top = 14 + laneCount * 14;
  const base = HEIGHT - AXIS;
  const x0 = LEFT;
  const x1 = Math.max(LEFT + n, width - RIGHT);
  const band = (x1 - x0) / Math.max(1, n);
  const max = Math.max(0, ...data.map((d) => Math.max(d.baseline, anyOn ? d.projected : 0)));
  const ticks = useMemo(() => ticksFor(max), [max]);
  const yOf = (v: number) => Math.round(base - ((base - top) * v) / ticks[4]);

  // Where every bar should be: one wide bar a month, or the baseline and the program side by side.
  const targets = useMemo<Target[][] | null>(() => {
    if (!width) return null;
    const inner = band * (1 - CAT_GAP);
    const half = (inner - BAR_GAP) / 2;
    const unit = (base - top) / ticks[4];
    return data.map((d, i) => {
      const start = x0 + i * band + (band - inner) / 2;
      return [
        { x: start, w: anyOn ? half : inner, h: d.baseline * unit },
        { x: start + half + BAR_GAP, w: half, h: anyOn ? d.projected * unit : 0 },
      ];
    });
  }, [width, band, base, top, ticks, data, x0, anyOn]);

  const mvs = useMemo<BarMV[][]>(() => Array.from({ length: n }, () => [0, 1].map(() => ({ x: motionValue(0), w: motionValue(0), h: motionValue(0) }))), [n]);
  // Driven imperatively: the console's page-level AnimatePresence (initial={false}) blocks mount animations
  // declared on elements inside a directly loaded page.
  const sweepX = useMemo(() => motionValue(0), []);
  const grown = useRef(false);
  const lastWidth = useRef(0);
  const latest = useRef<Target[][] | null>(null);
  useEffect(() => {
    if (!targets) return;
    const first = !grown.current;
    const resized = !first && lastWidth.current !== width;
    grown.current = true;
    lastWidth.current = width;
    latest.current = targets;
    if (first && reduce) setSweep(false);
    if (first && !reduce) {
      // Start from a fresh frame: the page's render was a long task, and timing from its frame would skip
      // most of the growth before the first visible frame.
      sweepX.jump(x0 - SWEEP_W - SWEEP_SLANT);
      requestAnimationFrame(() => {
        animate(sweepX, x1, { duration: SWEEP, ease: ease.inOut, delay: SWEEP_DELAY }).then(() => setSweep(false));
        latest.current?.forEach((pair, i) => pair.forEach((t, s) => animate(mvs[i][s].h, t.h, { duration: GROW, ease: ease.out, delay: i * GROW_STAGGER })));
      });
    }
    targets.forEach((pair, i) =>
      pair.forEach((t, s) => {
        const m = mvs[i][s];
        if (first) {
          m.x.jump(t.x);
          m.w.jump(t.w);
          if (reduce) m.h.jump(t.h);
          return;
        }
        for (const k of ['x', 'w', 'h'] as const) {
          if (m[k].get() === t[k] && !m[k].isAnimating()) continue;
          if (reduce || resized) m[k].jump(t[k]);
          else animate(m[k], t[k], spring.smooth);
        }
      }),
    );
  }, [targets, width, mvs, reduce, sweepX, x0, x1]);

  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key;
    if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End') return;
    e.preventDefault();
    setActive((a) => (k === 'Home' ? 0 : k === 'End' ? n - 1 : Math.max(0, Math.min(n - 1, (a ?? 0) + (k === 'ArrowLeft' ? -1 : 1)))));
  };

  const tipLeft = active === null ? 0 : x0 + (active + 1) * band + 8;
  const tipFlip = active !== null && tipLeft + 168 > width;
  const d = active === null ? null : data[active];

  return (
    <>
      <div
        ref={wrap}
        className="relative mt-4 h-[340px] rounded-[8px] outline-offset-4"
        role="img"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKey}
        onFocus={(e) => e.currentTarget.matches(':focus-visible') && setActive((a) => a ?? 0)}
        onBlur={() => setActive(null)}
        data-testid="ready-chart"
      >
        <svg width="100%" height={HEIGHT} viewBox={width ? `0 0 ${width} ${HEIGHT}` : undefined} aria-hidden className="block overflow-visible" onPointerLeave={() => setActive(null)}>
          {width > 0 && targets && (
            <>
              <defs>
                <clipPath id={`${id}c`}>
                  <rect x={0} y={0} width={width} height={base} />
                </clipPath>
                <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
                  <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.5" />
                  <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
                </linearGradient>
                {sweep && !reduce && (
                  <mask id={`${id}m`} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={HEIGHT}>
                    <g clipPath={`url(#${id}c)`} transform={`translate(0 ${base})`}>
                      {mvs.map((pair, i) => pair.map((m, s) => <Bar key={`${i}${s}`} m={m} fill="#FFFFFF" />))}
                    </g>
                  </mask>
                )}
              </defs>

              {/* gridlines and the y scale: glide to a new scale, fade in and out */}
              <AnimatePresence initial={false}>
                {ticks.map((t) => (
                  <motion.g
                    key={t}
                    initial={{ opacity: 0, y: yOf(t) }}
                    animate={{ opacity: 1, y: yOf(t) }}
                    exit={{ opacity: 0, transition: exit }}
                    transition={{ y: reduce ? { duration: 0 } : spring.smooth, opacity: { duration: dur.short, ease: ease.out } }}
                  >
                    <line x1={x0} x2={x1} y1={0.5} y2={0.5} stroke="var(--line)" />
                    <text x={x0 - 10} y={0} dy="0.36em" textAnchor="end" fill="var(--ink-2)" fontSize={12} className="tnum">
                      {t}
                    </text>
                  </motion.g>
                ))}
              </AnimatePresence>

              {/* the hovered month */}
              {active !== null && <rect x={x0 + active * band} y={top} width={band} height={base - top} fill="var(--pine-soft)" opacity={0.6} />}

              {/* home completions: a dashed line through the month, labels in lanes above the plot */}
              {markers.map((mk) => {
                const cx = Math.round(x0 + (mk.index + 0.5) * band) + 0.5;
                return (
                  <g key={mk.id}>
                    <line x1={cx} x2={cx} y1={top} y2={base} stroke="var(--ink-2)" strokeDasharray="2 3" strokeWidth={1} />
                    <text x={cx} y={top - 6 - mk.lane * 14} textAnchor="middle" fill="var(--ink-2)" fontSize={11}>
                      {mk.title}
                    </text>
                  </g>
                );
              })}

              {/* bars: the baseline in neutral, a pine copy over it that fades away when a program is on, the program bars */}
              <g clipPath={`url(#${id}c)`}>
                <g transform={`translate(0 ${base})`}>
                  {mvs.map((pair, i) => (
                    <Bar key={i} m={pair[0]} fill={BASE} />
                  ))}
                  <motion.g initial={false} animate={{ opacity: anyOn ? 0 : 1 }} transition={{ duration: dur.short, ease: ease.out }}>
                    {mvs.map((pair, i) => (
                      <Bar key={i} m={pair[0]} fill={PINE} />
                    ))}
                  </motion.g>
                  {mvs.map((pair, i) => (
                    <Bar key={i} m={pair[1]} fill={PINE} />
                  ))}
                </g>
              </g>

              {/* one band of light passes over the bars as they grow, once */}
              {sweep && !reduce && (
                <g mask={`url(#${id}m)`}>
                  <motion.path
                    d={`M0 ${base}h${SWEEP_W}l${SWEEP_SLANT} ${top - base}h${-SWEEP_W}Z`}
                    fill={`url(#${id}g)`}
                    style={{ x: sweepX }}
                  />
                </g>
              )}

              {/* x axis */}
              <line x1={x0} x2={x1} y1={base + 0.5} y2={base + 0.5} stroke="var(--line)" />
              {data.map((dd, i) =>
                i % 3 === 0 ? (
                  <text key={dd.label} x={x0 + (i + 0.5) * band} y={base + 18} textAnchor="middle" fill="var(--ink-2)" fontSize={12}>
                    {dd.label}
                  </text>
                ) : null,
              )}

              {/* hover targets: the whole month, labels included */}
              {data.map((dd, i) => (
                <rect key={dd.label} x={x0 + i * band} y={top} width={band} height={base - top + AXIS} fill="transparent" onPointerEnter={() => setActive(i)} />
              ))}
            </>
          )}
        </svg>

        {/* legend: only with a program beside the baseline (one series needs none) */}
        <motion.div className="flex h-8 items-center gap-4 text-[13px] text-ink-2" style={{ paddingLeft: x0 }} initial={false} animate={{ opacity: anyOn ? 1 : 0 }} transition={{ duration: dur.short, ease: ease.out }} aria-hidden>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: BASE }} />
            Today
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: PINE }} />
            With program
          </span>
        </motion.div>

        {/* tooltip: values lead, series follow; appears and moves instantly */}
        {d && (
          <div
            className="pointer-events-none absolute z-10 min-w-[136px] rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] leading-[20px]"
            style={{ left: tipFlip ? x0 + (active ?? 0) * band - 8 : tipLeft, top, transform: tipFlip ? 'translateX(-100%)' : undefined }}
            data-testid="chart-tooltip"
          >
            <p className="text-ink-2">{d.label}</p>
            <p className="flex items-center gap-2">
              <span className="h-[2px] w-3 rounded-full" style={{ background: anyOn ? BASE : PINE }} />
              <span className="tnum font-semibold text-ink">{d.baseline}</span>
              <span className="text-ink-2">Today</span>
            </p>
            {anyOn && (
              <p className="flex items-center gap-2">
                <span className="h-[2px] w-3 rounded-full" style={{ background: PINE }} />
                <span className="tnum font-semibold text-ink">{d.projected}</span>
                <span className="text-ink-2">With program</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* the same numbers as a table, for screen readers */}
      <table className="sr-only">
        <caption>Eligible families by projected-ready month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Today</th>
            {anyOn && <th scope="col">With program</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((dd) => (
            <tr key={dd.label}>
              <th scope="row">{dd.label}</th>
              <td>{dd.baseline}</td>
              {anyOn && <td>{dd.projected}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
