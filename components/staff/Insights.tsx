'use client';
import { useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { addMonths, monthsUntil, simulateProgram, type Program } from '@/lib/engine';
import { money, monthName } from '@/lib/format';
import { dur } from '@/lib/motion';

// Bars grow from the baseline on load and morph when a program is toggled: 300ms, ease-out (staff ≤ 300ms).
const BAR_MS = dur.short * 1500;
import { homeTitle } from '@/lib/staffLogic';
import type { Home, Profile } from '@/lib/types';

type Fam = { profile: Profile; eligible: boolean; monthsToReady: number; blockerType: string | null };
const HORIZON = 24;
const BASE = '#B7C3BD'; // baseline bars: a quiet neutral beside pine
const PINE = '#1E5C47';

function median(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export function Insights({ homes, families }: { homes: Home[]; families: Fam[] }) {
  const [today] = useState(() => new Date());
  const reduce = !!useReducedMotion();
  const [on, setOn] = useState({ matched: false, counseling: false, grant: false });
  const [vals, setVals] = useState({ matched: 100, counseling: 3, grant: 2000 });
  const program: Program = {
    matchedSavings: on.matched ? vals.matched : 0,
    counselingMonths: on.counseling ? vals.counseling : 0,
    grant: on.grant ? vals.grant : 0,
  };
  const anyOn = on.matched || on.counseling || on.grant;
  const profiles = useMemo(() => families.map((f) => f.profile), [families]);
  const sim = useMemo(
    () => simulateProgram(profiles, program, HORIZON, { today }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profiles, program.matchedSavings, program.counselingMonths, program.grant, today],
  );

  // Headline target: December of next year (the board's planning horizon, per the demo script).
  const target = (today.getUTCFullYear() + 1 - today.getUTCFullYear()) * 12 + (11 - today.getUTCMonth());
  const more = sim.moreReadyBy(target);

  const eligible = families.filter((f) => f.eligible);
  const within12 = eligible.filter((f) => f.monthsToReady <= 12).length;
  const med = median(eligible.map((f) => f.monthsToReady));
  const blockerCounts = new Map<string, number>();
  for (const f of eligible) if (f.blockerType) blockerCounts.set(f.blockerType, (blockerCounts.get(f.blockerType) ?? 0) + 1);
  const topBlocker = [...blockerCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const data = sim.baseline.map((b, i) => ({ month: addMonths(today, i), label: monthName(addMonths(today, i), 'en', true), baseline: b, projected: anyOn ? sim.projected[i] : 0 }));
  const homeLines = homes.filter((h) => {
    const m = monthsUntil(h.completion, today);
    return m >= 0 && m < HORIZON;
  });

  if (families.length === 0) {
    return (
      <>
        <h1 className="t-title">Insights</h1>
        <div className="panel mt-8 py-12 text-center text-[15px] text-ink-2">No families yet. Share the family link at the next orientation.</div>
      </>
    );
  }

  return (
    <>
      <h1 className="t-title">Insights</h1>
      <dl className="mt-8 grid grid-cols-4 border-y border-line">
        {[
          ['Families tracked', String(families.length), 'tracked'],
          ['Projected ready within 12 months', String(within12), 'within12'],
          ['Median months to ready', String(med), 'median'],
          ['Most common blocker', topBlocker ? topBlocker[0] : 'None', 'blocker'],
        ].map(([label, value, id], i) => (
          <div key={id} className={`py-6 ${i ? 'border-l border-line pl-6' : ''}`}>
            <dt className="text-[13px] text-ink-2">{label}</dt>
            <dd className={`tnum mt-2 font-semibold tracking-[-0.01em] ${id === 'blocker' ? 'text-[28px] leading-[60px]' : 'text-[56px] leading-[60px]'}`} data-testid={`stat-${id}`}>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <section className="mt-10" aria-labelledby="chart-title">
        <div className="flex items-baseline justify-between gap-6">
          <h2 id="chart-title" className="t-section">
            Families by projected-ready month
          </h2>
          <p className="text-[13px] text-ink-2">Next 24 months. Vertical lines mark home completions.</p>
        </div>
        <div className="mt-4 h-[340px]" role="img" aria-label={`Bar chart of eligible families by projected-ready month over the next 24 months${anyOn ? ', with the program projection beside the baseline' : ''}.`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 28, right: 48, bottom: 0, left: -20 }} barGap={2} barCategoryGap="18%">
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--line)' }} tick={{ fill: 'var(--ink-2)', fontSize: 12 }} interval={2} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-2)', fontSize: 12 }} />
              <Tooltip
                cursor={{ fill: 'var(--pine-soft)', opacity: 0.5 }}
                contentStyle={{ border: '1px solid var(--line)', borderRadius: 8, boxShadow: 'none', fontSize: 13 }}
                formatter={(v, name) => [v as number, name === 'baseline' ? 'Today' : 'With program']}
              />
              {anyOn && <Legend verticalAlign="bottom" align="left" height={32} iconType="square" iconSize={10} formatter={(v) => <span className="text-[13px] text-ink-2">{v === 'baseline' ? 'Today' : 'With program'}</span>} />}
              {homeLines.map((h) => (
                <ReferenceLine
                  key={h.id}
                  x={monthName(h.completion, 'en', true)}
                  stroke="var(--ink-2)"
                  strokeDasharray="2 3"
                  strokeWidth={1}
                  label={{ value: homeTitle(h), position: 'top', fill: 'var(--ink-2)', fontSize: 11 }}
                />
              ))}
              <Bar dataKey="baseline" fill={anyOn ? BASE : PINE} radius={[4, 4, 0, 0]} animationDuration={BAR_MS} animationEasing="ease-out" isAnimationActive={!reduce} />
              <Bar dataKey="projected" fill={PINE} radius={[4, 4, 0, 0]} animationDuration={BAR_MS} animationEasing="ease-out" isAnimationActive={!reduce} hide={!anyOn} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-10 rounded-[14px] border border-line bg-surface p-6" aria-labelledby="sim-title">
        <h2 id="sim-title" className="t-section">
          What if Habitat funded a program?
        </h2>
        <p className="mt-1 text-[15px] text-ink-2">Turn on a program to see the projection beside today. Same engine as the family app.</p>
        <div className="mt-6 grid grid-cols-3 gap-6">
          <ProgramToggle label="Matched savings" unit="per family per month" prefix="$" on={on.matched} value={vals.matched} step={25} max={1000}
            onToggle={() => setOn({ ...on, matched: !on.matched })} onValue={(v) => setVals({ ...vals, matched: v })} />
          <ProgramToggle label="Credit counseling" unit="months shortened" on={on.counseling} value={vals.counseling} step={1} max={24}
            onToggle={() => setOn({ ...on, counseling: !on.counseling })} onValue={(v) => setVals({ ...vals, counseling: v })} />
          <ProgramToggle label="Down-payment grant" unit="per family" prefix="$" on={on.grant} value={vals.grant} step={250} max={50000}
            onToggle={() => setOn({ ...on, grant: !on.grant })} onValue={(v) => setVals({ ...vals, grant: v })} />
        </div>
        {/* The numbers roll on screen; screen readers get the settled sentence once, not every frame. */}
        <p className="sr-only" aria-live="polite">
          {more} more {more === 1 ? 'family' : 'families'} ready by {monthName(addMonths(today, target))}, for {money(sim.cost)}.
        </p>
        <p className="mt-8 border-t border-line pt-6 text-[20px] leading-[28px]" aria-hidden>
          <span className="tnum font-semibold" data-testid="more-ready">
            <AnimatedNumber value={more} format={(n) => String(Math.round(n))} />
          </span>{' '}
          more {more === 1 ? 'family' : 'families'} ready by {monthName(addMonths(today, target))}, for{' '}
          <span className="tnum font-semibold">
            <AnimatedNumber value={sim.cost} format={(n) => money(n)} />
          </span>
          .
        </p>
      </section>
    </>
  );
}

function ProgramToggle({ label, unit, prefix, on, value, step, max, onToggle, onValue }: {
  label: string; unit: string; prefix?: string; on: boolean; value: number; step: number; max: number; onToggle: () => void; onValue: (v: number) => void;
}) {
  const id = label.toLowerCase().replace(/\W+/g, '-');
  return (
    <div className={`rounded-[8px] border p-4 transition-colors duration-[120ms] ${on ? 'border-pine bg-pine-soft' : 'border-line'}`}>
      <button type="button" role="switch" aria-checked={on} onClick={onToggle} className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left">
        <span className="text-[15px] font-medium">{label}</span>
        <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-[120ms] ${on ? 'bg-pine' : 'bg-line'}`} aria-hidden>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-[120ms] ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
        </span>
      </button>
      <label htmlFor={id} className="mt-2 block text-[13px] text-ink-2">{unit}</label>
      <div className="relative mt-1">
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-2">{prefix}</span>}
        <input id={id} type="number" inputMode="numeric" min={0} max={max} step={step} value={value}
          onChange={(e) => onValue(Math.max(0, Math.min(max, Number(e.target.value) || 0)))}
          className={`field tnum !min-h-[44px] ${prefix ? '!pl-7' : ''}`} />
      </div>
    </div>
  );
}
