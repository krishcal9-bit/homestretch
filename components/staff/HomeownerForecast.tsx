'use client';
import { motion, useReducedMotion } from 'motion/react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CAUSE_LABEL, usd } from '@/lib/earlyWarning';
import { money, monthName } from '@/lib/format';
import { forecast, type ForecastOptions } from '@/lib/forecast';
import type { KeepProfile } from '@/lib/keep';
import { dur, ease } from '@/lib/motion';

// The family's 24-month Payment Forecast for staff: breathing room each month (one pine line), the tight band
// (amber wash between $0 and the tight line) and the short zone (red wash below $0), a dashed rule at each shock.
// Calm by design: the line draws once in 250ms as the drawer settles, markers fade in after it; hover is instant.
// Self-contained (the family-side chart is components/keep/ForecastChart.tsx).

const H = 196;
const TOP = 30; // room for shock labels
const AXIS = 22;
const LEFT = 52;
const RIGHT = 12;

function niceStep(span: number) {
  const raw = Math.max(1, span) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
}

export function HomeownerForecast({ profile, options, label }: { profile: KeepProfile; options?: ForecastOptions; label?: string }) {
  const reduce = !!useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const f = useMemo(() => forecast(profile, options), [profile, options]);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setWidth(Math.round(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ms = f.months;
  const n = ms.length;
  const vals = ms.map((m) => m.breathing);
  const lo = Math.min(0, ...vals, -f.threshold * 0.5);
  const hi = Math.max(f.threshold * 1.6, ...vals);
  const step = niceStep(hi - lo);
  const y0 = Math.floor(lo / step) * step;
  const y1 = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = y0; t <= y1 + 1e-6; t += step) ticks.push(Math.round(t));
  const base = H - AXIS;
  const x1 = Math.max(LEFT + 10, width - RIGHT);
  const xOf = (i: number) => LEFT + ((x1 - LEFT) * i) / Math.max(1, n - 1);
  const yOf = (v: number) => TOP + ((base - TOP) * (y1 - v)) / Math.max(1, y1 - y0);
  const path = ms.map((m, i) => `${i ? 'L' : 'M'}${xOf(i).toFixed(1)} ${yOf(m.breathing).toFixed(1)}`).join('');
  const shocks = f.shocks.filter((s) => s.delta >= 15);
  const a = active === null ? null : ms[active];
  const sum = label ?? `Breathing room over the next 24 months, from ${money(ms[0]?.breathing ?? 0)} now to ${money(ms[n - 1]?.breathing ?? 0)}; lowest ${money(f.minBreathing)}.`;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / Math.max(1, r.width)) * (n - 1));
    setActive(Math.max(0, Math.min(n - 1, i)));
  };
  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key;
    if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End') return;
    e.preventDefault();
    setActive((v) => (k === 'Home' ? 0 : k === 'End' ? n - 1 : Math.max(0, Math.min(n - 1, (v ?? 0) + (k === 'ArrowLeft' ? -1 : 1)))));
  };

  return (
    <figure className="m-0">
      {/* readout: the hovered month, else the lowest point. Fixed height so nothing shifts. */}
      <div className="flex h-6 items-baseline justify-between gap-4 text-[13px] text-ink-2" aria-hidden>
        {a ? (
          <>
            <span className="tnum">{monthName(a.month)}</span>
            <span className="tnum">
              Pays <span className="font-medium text-ink">{money(a.effective)}</span> · breathing room{' '}
              <span className={`font-medium ${a.breathing < 0 ? 'text-signal-red' : a.breathing < f.threshold ? 'text-signal-amber' : 'text-ink'}`}>{usd(a.breathing)}</span>
            </span>
          </>
        ) : (
          <>
            <span>Breathing room each month</span>
            <span className="tnum">
              Lowest <span className={`font-medium ${f.minBreathing < 0 ? 'text-signal-red' : f.minBreathing < f.threshold ? 'text-signal-amber' : 'text-ink'}`}>{usd(f.minBreathing)}</span>
            </span>
          </>
        )}
      </div>
      <div
        ref={wrap}
        className="relative rounded-[8px] outline-offset-4"
        style={{ height: H }}
        role="img"
        aria-label={sum}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        data-testid="homeowner-forecast"
      >
        {width > 0 && (
          <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} className="block overflow-visible" aria-hidden>
            {/* zones: short below $0, tight between $0 and the tight line */}
            <rect x={LEFT} y={yOf(0)} width={x1 - LEFT} height={Math.max(0, base - yOf(0))} fill="var(--signal-red)" opacity={0.07} />
            <rect x={LEFT} y={yOf(f.threshold)} width={x1 - LEFT} height={Math.max(0, yOf(0) - yOf(f.threshold))} fill="var(--signal-amber)" opacity={0.09} />
            {ticks.map((t) => (
              <g key={t}>
                <line x1={LEFT} x2={x1} y1={Math.round(yOf(t)) + 0.5} y2={Math.round(yOf(t)) + 0.5} stroke={t === 0 ? 'var(--line-strong)' : 'var(--line)'} />
                <text x={LEFT - 8} y={yOf(t)} dy="0.36em" textAnchor="end" fontSize={12} fill="var(--ink-2)" className="tnum">
                  {usd(t)}
                </text>
              </g>
            ))}
            <text x={x1 - 4} y={yOf(f.threshold) + 13} textAnchor="end" fontSize={11} fill="var(--signal-amber)">
              Tight
            </text>
            {/* shocks: a dashed rule and the rise, above the plot */}
            {shocks.map((s, k) => (
              <motion.g key={s.i} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: dur.short, ease: ease.out, delay: reduce ? 0 : dur.short + k * 0.03 }}>
                <line x1={Math.round(xOf(s.i)) + 0.5} x2={Math.round(xOf(s.i)) + 0.5} y1={TOP - 4} y2={base} stroke="var(--ink-2)" strokeDasharray="2 3" />
                <text x={xOf(s.i)} y={TOP - 18} textAnchor={s.i > n - 4 ? 'end' : 'middle'} fontSize={11} fill="var(--ink)" className="tnum" fontWeight={600}>
                  +{money(s.delta)}
                </text>
                <text x={xOf(s.i)} y={TOP - 7} textAnchor={s.i > n - 4 ? 'end' : 'middle'} fontSize={11} fill="var(--ink-2)">
                  {CAUSE_LABEL[s.cause].split(' ')[0]}
                </text>
              </motion.g>
            ))}
            {/* the breathing-room line */}
            <motion.path
              d={path}
              fill="none"
              stroke="var(--pine)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: dur.short + 0.05, ease: ease.out, delay: dur.micro }}
            />
            {/* shock points on the line */}
            {shocks.map((s) => (
              <circle key={s.i} cx={xOf(s.i)} cy={yOf(ms[s.i].breathing)} r={4} fill="var(--pine)" stroke="var(--surface)" strokeWidth={2} />
            ))}
            {/* x axis: now and every 6 months */}
            {ms.map((m, i) =>
              i % 6 === 0 || i === n - 1 ? (
                <text key={m.month} x={xOf(i)} y={H - 4} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize={12} fill="var(--ink-2)" className="tnum">
                  {i === 0 ? 'Now' : monthName(m.month, 'en', true)}
                </text>
              ) : null,
            )}
            {/* hover */}
            {active !== null && (
              <g pointerEvents="none">
                <line x1={Math.round(xOf(active)) + 0.5} x2={Math.round(xOf(active)) + 0.5} y1={TOP} y2={base} stroke="var(--ink)" strokeOpacity={0.35} />
                <circle cx={xOf(active)} cy={yOf(ms[active].breathing)} r={5} fill="var(--surface)" stroke="var(--pine)" strokeWidth={2} />
              </g>
            )}
            <rect x={LEFT} y={0} width={x1 - LEFT} height={H} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setActive(null)} />
          </svg>
        )}
      </div>
      <figcaption className="sr-only">
        {sum} {shocks.map((s) => `${CAUSE_LABEL[s.cause]} in ${monthName(s.month)} adds ${money(s.delta)} a month.`).join(' ')}
      </figcaption>
    </figure>
  );
}
