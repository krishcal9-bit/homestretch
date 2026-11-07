'use client';
// The Payment Forecast chart (KEEP's signature). Hand-built SVG so the flatten can spring:
//  • a step line of what the family pays each month (forecast.months[].effective) draws in left → right (pathLength);
//  • a dashed ghost of the same months without the set-aside, shown while one is set;
//  • shock markers (forecast.shocks) drop in with a small bounce and ride the line;
//  • the breathing-room band below: one cell a month, pine when safe, amber below the engine's threshold, red below 0.
// Every value is the engine's. When the forecast changes (the set-aside slider, a Shock Shield move) the drawn values
// spring to the new ones in one motion/react frame loop that writes the SVG directly: no React render per frame.
import { motion, useAnimationFrame, useReducedMotion } from 'motion/react';
import { memo, useDeferredValue, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { money, monthName } from '@/lib/format';
import { dur, ease, spring, stagger } from '@/lib/motion';
import { zoneOf, type Forecast, type Zone } from '@/lib/forecast';
import type { Lang } from '@/lib/types';

export type ChartDomain = { y: [number, number]; b: [number, number] };

function niceStep(x: number) {
  const p = 10 ** Math.floor(Math.log10(Math.max(1e-9, x)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= x) return m * p;
  return 10 * p;
}

/** A stable y-domain for a set of forecasts (e.g. the slider's two ends), so the axis never rescales mid-drag. */
export function forecastDomain(fs: Forecast[]): ChartDomain {
  let lo = Infinity;
  let hi = -Infinity;
  let blo = Infinity;
  let bhi = -Infinity;
  let threshold = 0;
  for (const f of fs) {
    threshold = Math.max(threshold, f.threshold);
    for (const m of f.months) {
      lo = Math.min(lo, m.total, m.effective);
      hi = Math.max(hi, m.total, m.effective);
      blo = Math.min(blo, m.breathing);
      bhi = Math.max(bhi, m.breathing);
    }
  }
  if (!Number.isFinite(lo)) [lo, hi, blo, bhi] = [0, 100, 0, 100];
  const step = niceStep(Math.max(40, hi - lo) / 3);
  const y: [number, number] = [Math.max(0, Math.floor((lo - step * 0.35) / step) * step), Math.ceil((hi + step * 0.25) / step) * step];
  // the band always shows zero and the threshold, with room above
  blo = Math.min(blo, 0, -threshold * 0.35);
  bhi = Math.max(bhi, threshold * 1.15, 1);
  return { y, b: [blo, bhi] };
}

const ZONE_FILL: Record<Zone, string> = { safe: 'fill-pine', tight: 'fill-signal-amber', short: 'fill-signal-red' };
const N = 24;
const shortMonth = (iso: string, lang: Lang) => monthName(iso, lang, true).replace(/\s*(de\s+)?\d{4}$/, '').replace('.', '');

type Geometry = { w: number; flagH: number; plotH: number; axisH: number; bandH: number; left: number; right: number };

export const ForecastChart = memo(function ForecastChart({
  forecast,
  setAside,
  compact = false,
  baseline,
  domain: domainIn,
  causeLabel,
}: {
  forecast: Forecast;
  /** the monthly set-aside this forecast was run with (shows the ghost line and changes the marker text) */
  setAside: number;
  compact?: boolean;
  /** the same months with no set-aside (the dashed ghost); defaults to the forecast's own totals */
  baseline?: Forecast;
  /** fixed y-domains; default: this forecast's own */
  domain?: ChartDomain;
  /** label for a shock cause (defaults to the Keep messages) */
  causeLabel?: (cause: string) => string;
}) {
  const { t, lang } = useLang();
  const reduce = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const domain = useMemo(() => domainIn ?? forecastDomain([forecast, ...(baseline ? [baseline] : [])]), [domainIn, forecast, baseline]);
  const g: Geometry = useMemo(() => {
    const narrow = w < 560;
    return {
      w,
      flagH: compact ? 30 : 44,
      plotH: compact ? 120 : narrow ? 176 : 236,
      axisH: 26,
      bandH: compact ? 36 : narrow ? 52 : 64,
      left: narrow ? 46 : 54,
      right: 10,
    };
  }, [w, compact]);
  const plotW = Math.max(1, g.w - g.left - g.right);
  const cellW = plotW / N;
  const X = (i: number) => g.left + i * cellW;
  const [y0, y1] = domain.y;
  const Y = (v: number) => g.flagH + g.plotH - ((v - y0) / Math.max(1, y1 - y0)) * g.plotH;
  const [b0, b1] = domain.b;
  const B = (v: number) => g.bandH - ((v - b0) / Math.max(1, b1 - b0)) * g.bandH;

  // targets (the engine's numbers) and the drawn values that spring toward them
  const targets = useMemo(
    () => ({
      e: forecast.months.map((m) => m.effective),
      g: (baseline ?? forecast).months.map((m) => m.total),
      b: forecast.months.map((m) => m.breathing),
    }),
    [forecast, baseline],
  );
  const sim = useRef<{ e: number[]; g: number[]; b: number[]; ve: number[]; vg: number[]; vb: number[]; moving: boolean } | null>(null);
  if (!sim.current) sim.current = { e: [...targets.e], g: [...targets.g], b: [...targets.b], ve: Array(N).fill(0), vg: Array(N).fill(0), vb: Array(N).fill(0), moving: false };

  const line = useRef<SVGPathElement>(null);
  const ghost = useRef<SVGPathElement>(null);
  const cells = useRef<(SVGRectElement | null)[]>([]);
  const tints = useRef<(SVGRectElement | null)[]>([]);
  const markers = useRef<(SVGGElement | null)[]>([]);
  const stems = useRef<(SVGLineElement | null)[]>([]);
  const shocks = forecast.shocks;
  const geo = useRef({ X, Y, B, cellW });
  geo.current = { X, Y, B, cellW };

  const stepPath = (vals: number[]) => {
    const { X: x, Y: y } = geo.current;
    let d = `M${x(0).toFixed(1)} ${y(vals[0] ?? 0).toFixed(1)}`;
    for (let i = 0; i < vals.length; i++) {
      if (i > 0) d += `V${y(vals[i]).toFixed(1)}`;
      d += `H${x(i + 1).toFixed(1)}`;
    }
    return d;
  };

  const paint = () => {
    const s = sim.current!;
    const { X: x, Y: y, B: b, cellW: cw } = geo.current;
    line.current?.setAttribute('d', stepPath(s.e));
    ghost.current?.setAttribute('d', stepPath(s.g));
    const zero = b(0);
    for (let i = 0; i < N; i++) {
      const r = cells.current[i];
      const tint = tints.current[i];
      if (!r) continue;
      const v = s.b[i] ?? 0;
      const h = Math.max(3, Math.abs(b(v) - zero));
      r.setAttribute('x', (x(i) + 1).toFixed(1));
      r.setAttribute('width', Math.max(0.5, cw - 2).toFixed(1));
      r.setAttribute('y', (v >= 0 ? zero - h : zero).toFixed(1));
      r.setAttribute('height', h.toFixed(1));
      tint?.setAttribute('x', x(i).toFixed(1));
      tint?.setAttribute('width', cw.toFixed(1));
      const cls = ZONE_FILL[zoneOf(v, forecast.threshold)];
      if (r.getAttribute('data-zone') !== cls) {
        r.setAttribute('data-zone', cls);
        r.setAttribute('class', `${cls} transition-[fill] duration-200`);
        tint?.setAttribute('class', `${cls} transition-[fill] duration-200`);
      }
    }
    shocks.forEach((sh, k) => {
      const yy = y(s.e[sh.i] ?? 0);
      markers.current[k]?.setAttribute('transform', `translate(${x(sh.i).toFixed(1)} ${yy.toFixed(1)})`);
      stems.current[k]?.setAttribute('y2', (yy - 6).toFixed(1));
    });
  };

  // new targets: spring there (or jump with reduced motion)
  useLayoutEffect(() => {
    const s = sim.current!;
    if (reduce) {
      s.e = [...targets.e];
      s.g = [...targets.g];
      s.b = [...targets.b];
      s.moving = false;
      paint();
    } else s.moving = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets, reduce]);
  // geometry changed: repaint at once
  useLayoutEffect(() => {
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, domain, compact, shocks.length]);

  // one frame loop for every drawn value: semi-implicit spring (lib/motion spring.smooth), settles and idles
  useAnimationFrame((_, delta) => {
    const s = sim.current!;
    if (!s.moving) return;
    const { stiffness: k, damping: c } = spring.smooth;
    let dt = Math.min(delta, 64) / 1000;
    let still = true;
    while (dt > 0) {
      const h = Math.min(dt, 1 / 120);
      dt -= h;
      for (const [cur, vel, tgt] of [
        [s.e, s.ve, targets.e],
        [s.g, s.vg, targets.g],
        [s.b, s.vb, targets.b],
      ] as const) {
        for (let i = 0; i < N; i++) {
          const a = -k * ((cur[i] ?? 0) - (tgt[i] ?? 0)) - c * vel[i];
          vel[i] += a * h;
          cur[i] = (cur[i] ?? 0) + vel[i] * h;
        }
      }
    }
    for (const [cur, vel, tgt] of [
      [s.e, s.ve, targets.e],
      [s.g, s.vg, targets.g],
      [s.b, s.vb, targets.b],
    ] as const) {
      for (let i = 0; i < N; i++) {
        if (Math.abs(cur[i] - (tgt[i] ?? 0)) > 0.02 || Math.abs(vel[i]) > 0.02) still = false;
      }
    }
    if (still) {
      s.e = [...targets.e];
      s.g = [...targets.g];
      s.b = [...targets.b];
      s.ve.fill(0);
      s.vg.fill(0);
      s.vb.fill(0);
      s.moving = false;
    }
    paint();
  });

  // scrub: the month under the pointer (default: this month)
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? 0;
  const m = forecast.months[shown];
  const yTicks = useMemo(() => {
    const step = niceStep((y1 - y0) / 3);
    const out: number[] = [];
    for (let v = Math.ceil(y0 / step) * step; v <= y1 + 0.01; v += step) out.push(v);
    return out;
  }, [y0, y1]);
  const every = w < 560 || compact ? 6 : 3;
  const cause = causeLabel ?? ((c: string) => t(`keep.cause.${c}`));

  // flags: placed left→right, skipped (dot only) when they would overlap the previous one
  const flagText = (sh: (typeof shocks)[number]) => ({
    head: monthName(sh.month, lang, true).replace('.', ''),
    amount: sh.felt > 0 ? t('keep.chart.flagRise', { amount: money(sh.felt, lang) }) : t('keep.chart.flagCovered'),
    cause: cause(sh.cause),
  });
  const flags = useMemo(() => {
    let lastRight = -Infinity;
    const px = compact ? 6.4 : 7;
    return shocks.map((sh) => {
      const x = g.left + sh.i * cellW;
      const ft = flagText(sh);
      const fw = Math.max(ft.head.length + ft.amount.length + 1, ft.cause.length) * px + 14;
      let right = x + fw > g.w;
      const lo = right ? x - fw : x - 1;
      const hi = right ? x + 1 : x + fw;
      const show = lo > lastRight + 10 && lo >= 0;
      if (show) lastRight = hi;
      if (!show) right = false;
      return { x, right, show, ...ft };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shocks, cellW, g.left, g.w, compact, lang]);

  const totalH = g.flagH + g.plotH + g.axisH;
  const firstD = useMemo(() => (w ? stepPath(sim.current!.e) : ''), [w > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  // the screen-reader summary and table follow at low priority, so a slider frame only pays for what is drawn
  const quiet = useDeferredValue(forecast);
  const summary = t('keep.chart.aria', {
    now: money(quiet.months[0]?.effective ?? 0, lang),
    shocks: quiet.shocks.length ? quiet.shocks.map((s) => t('keep.chart.marker', { month: monthName(s.month, lang), amount: money(s.felt, lang), cause: cause(s.cause) })).join('; ') : t('keep.chart.noShocks'),
  });

  return (
    <div ref={wrap} className="relative select-none" data-testid="forecast-chart">
      <figure aria-label={summary} className="m-0">
        {!compact && (
          <p className="tnum t-helper mb-1 min-h-[15px] text-ink-2" aria-hidden data-testid="chart-readout">
            {m ? t('keep.chart.readout', { month: monthName(m.month, lang, true).replace('.', ''), pay: money(m.effective, lang), room: money(m.breathing, lang) }) : ''}
          </p>
        )}
        {w > 0 && (
          <div
            className="relative"
            style={{ height: totalH }}
            onPointerMove={(e) => {
              if (compact) return;
              const r = e.currentTarget.getBoundingClientRect();
              const i = Math.floor((e.clientX - r.left - g.left) / cellW);
              setHover(i >= 0 && i < N ? i : null);
            }}
            onPointerLeave={() => setHover(null)}
          >
            <svg width={g.w} height={totalH} className="absolute inset-0 block overflow-visible" aria-hidden>
              {yTicks.map((v) => (
                <g key={v}>
                  <line x1={g.left} x2={g.w - g.right} y1={Y(v)} y2={Y(v)} className="stroke-line" strokeWidth={1} />
                  <text x={g.left - 8} y={Y(v) + 4} textAnchor="end" className="tnum fill-ink-2 text-[12px]">
                    {money(v, lang)}
                  </text>
                </g>
              ))}
              {forecast.months.map((mm, i) => {
                if (i % every !== 0) return null;
                const yearShown = i === 0 || mm.month.slice(0, 4) !== forecast.months[i - every].month.slice(0, 4);
                return (
                  <text key={mm.month} x={X(i) + cellW / 2} y={g.flagH + g.plotH + 18} textAnchor="middle" className={`tnum text-[12px] ${yearShown ? 'fill-ink' : 'fill-ink-2'}`}>
                    {yearShown ? `${shortMonth(mm.month, lang)} ${mm.month.slice(0, 4)}` : shortMonth(mm.month, lang)}
                  </text>
                );
              })}
              {hover !== null && <line x1={X(hover) + cellW / 2} x2={X(hover) + cellW / 2} y1={g.flagH - 4} y2={g.flagH + g.plotH} className="stroke-line-strong" strokeWidth={1} />}
              <path ref={ghost} fill="none" className="stroke-[var(--chart-base)] transition-opacity duration-200" strokeWidth={1.5} strokeDasharray="4 4" style={{ opacity: setAside > 0 ? 1 : 0 }} />
              {shocks.map((sh, k) => (
                <line key={`s${sh.month}`} ref={(el) => void (stems.current[k] = el)} x1={X(sh.i)} x2={X(sh.i)} y1={compact ? 30 : 36} y2={g.flagH} className={`${sh.felt > 0 ? 'stroke-signal-amber' : 'stroke-pine'} transition-opacity duration-200`} strokeWidth={1} style={{ opacity: flags[k]?.show ? 0.6 : 0 }} />
              ))}
              <motion.path
                ref={line}
                d={firstD}
                fill="none"
                className="stroke-pine"
                strokeWidth={compact ? 2 : 2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                initial={reduce ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: dur.long, ease: ease.out }}
              />
              {shocks.map((sh, k) => (
                <g key={sh.month} ref={(el) => void (markers.current[k] = el)}>
                  <motion.g initial={reduce ? false : { opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.drop, delay: reduce ? 0 : dur.long * 0.55 + k * stagger * 2 }}>
                    <circle r={compact ? 4 : 5.5} className={`${sh.felt > 0 ? 'fill-signal-amber' : 'fill-pine'} stroke-surface transition-[fill] duration-200`} strokeWidth={2} />
                  </motion.g>
                </g>
              ))}
            </svg>
            {/* flags: HTML over the SVG's top row (sentence text wraps and reads cleanly) */}
            {shocks.map((sh, k) =>
              flags[k]?.show ? (
                <motion.div
                  key={sh.month}
                  className={`pointer-events-none absolute top-0 border-l-2 pl-2 ${sh.felt > 0 ? 'border-signal-amber' : 'border-pine'} ${flags[k].right ? 'text-right' : ''}`}
                  style={flags[k].right ? { right: g.w - flags[k].x - 1, borderLeftWidth: 0, borderRightWidth: 2, paddingLeft: 0, paddingRight: 8 } : { left: flags[k].x - 1 }}
                  initial={reduce ? false : { opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring.drop, delay: reduce ? 0 : dur.long * 0.55 + k * stagger * 2 }}
                  data-testid="shock-marker"
                >
                  <p className={`tnum whitespace-nowrap leading-[17px] ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
                    <span className="text-ink">{flags[k].head}</span>{' '}
                    <span className={`font-semibold ${sh.felt > 0 ? 'text-signal-amber' : 'text-pine'}`} data-testid="shock-marker-amount">
                      {flags[k].amount}
                    </span>
                  </p>
                  <p className={`whitespace-nowrap leading-[17px] text-ink-2 ${compact ? 'text-[12px]' : 'text-[13px]'}`}>{flags[k].cause}</p>
                </motion.div>
              ) : null,
            )}
          </div>
        )}
        {/* breathing room */}
        <div className={compact ? 'mt-1' : 'mt-3'}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1" style={{ paddingLeft: g.left }}>
            <p className="text-[13px] font-medium text-ink">{t('keep.chart.breathing')}</p>
            {!compact && (
              <ul className="flex gap-3 text-[12px] text-ink-2">
                {(['safe', 'tight', 'short'] as Zone[]).map((z) => (
                  <li key={z} className="flex items-center gap-1.5">
                    <span className={`inline-block h-2 w-2 rounded-[2px] ${z === 'safe' ? 'bg-pine' : z === 'tight' ? 'bg-signal-amber' : 'bg-signal-red'}`} aria-hidden />
                    {t(`keep.zone.${z}`)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {w > 0 && (
            <svg width={g.w} height={g.bandH + 2} className="mt-1 block overflow-visible" aria-hidden data-testid="breathing-band">
              <text x={g.left - 8} y={B(0) + 4} textAnchor="end" className="tnum fill-ink-2 text-[12px]">
                {money(0, lang)}
              </text>
              {Array.from({ length: N }, (_, i) => (
                <rect key={`t${i}`} ref={(el) => void (tints.current[i] = el)} y={0} height={g.bandH} fillOpacity={0.12} />
              ))}
              {Array.from({ length: N }, (_, i) => (
                <rect key={i} ref={(el) => void (cells.current[i] = el)} rx={1.5} />
              ))}
              <line x1={g.left} x2={g.w - g.right} y1={B(0)} y2={B(0)} className="stroke-ink-2" strokeWidth={1} />
              <line x1={g.left} x2={g.w - g.right} y1={B(forecast.threshold)} y2={B(forecast.threshold)} className="stroke-ink-2" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="2 3" />
            </svg>
          )}
        </div>
      </figure>
      <table className="sr-only">
        <caption>{t('keep.chart.tableCaption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('keep.chart.colMonth')}</th>
            <th scope="col">{t('keep.chart.colPay')}</th>
            <th scope="col">{t('keep.chart.breathing')}</th>
          </tr>
        </thead>
        <tbody>
          {quiet.months.map((mm) => (
            <tr key={mm.month}>
              <th scope="row">{monthName(mm.month, lang)}</th>
              <td>{money(mm.effective, lang)}</td>
              <td>{money(mm.breathing, lang)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
