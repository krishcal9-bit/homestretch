'use client';
import { Area, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useLang } from '@/lib/i18n';
import { computeReadiness, tenYearComparison } from '@/lib/engine';
import { money } from '@/lib/format';
import { alpha } from '@/lib/illustrationPalette';
import type { Profile } from '@/lib/types';
import { Section } from './Panels';
import { memo, useMemo, useRef } from 'react';
import { useInView, useReducedMotion } from 'motion/react';
import { EquityHouse } from '@/components/illustrations/result/EquityHouse';
import { useLineDraw } from '@/components/illustrations/result/useLineDraw';

/** The glowing dot riding a line's leading end while it draws (core in the series colour, a soft halo). */
function LeadDot({ color, halo, setRef, on }: { color: string; halo: string; setRef: (el: HTMLDivElement | null) => void; on: boolean }) {
  return (
    <div ref={setRef} aria-hidden className="pointer-events-none absolute left-0 top-0 z-10" style={{ transform: 'translate(-99px, -99px)' }}>
      <div className="absolute h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-300" style={{ background: `radial-gradient(closest-side, ${halo}, transparent)`, opacity: on ? 1 : 0 }} />
      <div className="absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-300" style={{ background: color, boxShadow: '0 0 0 1.5px var(--surface)', opacity: on ? 1 : 0 }} />
    </div>
  );
}

const compact = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);

/** Only rent, income and the co-applicant change this chart; debt and savings sliders must not replay or re-render it. */
const chartKey = (p: Profile) => JSON.stringify([p.rent, p.grossMonthlyIncome, p.otherMonthlyIncome, p.levers.coApplicantIncome, p.householdSize]);

export const TwoFutures = memo(
  function TwoFutures({ profile }: { profile: Profile }) {
  const { t, lang } = useLang();
  const key = chartKey(profile);
  const chartRef = useRef<HTMLDivElement>(null);
  const inView = useInView(chartRef, { once: true, amount: 0.4 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cmp = useMemo(() => tenYearComparison(profile), [key]);
  // band: the money between the two futures, washed pine once both lines have drawn
  const data = useMemo(() => cmp.points.map((p) => ({ year: p.year, rent: p.rentCost, habitat: p.habitatCost, band: [Math.min(p.habitatCost, p.rentCost), Math.max(p.habitatCost, p.rentCost)] })), [cmp]);
  const reduce = !!useReducedMotion();
  // the lines draw left to right with a glowing dot at their leading ends; the band between them washes in after
  const dots = useRef<(HTMLDivElement | null)[]>([]);
  const phase = useLineDraw(chartRef, '.recharts-line-curve', dots, inView, reduce);
  const drawn = phase === 'done';
  // the share of the home's value (after 3% a year, as the engine projects) the family would own at year 10
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const share = useMemo(() => Math.min(1, cmp.equity10 / Math.max(1, computeReadiness(profile).financeableHome * Math.pow(1.03, 10))), [key]);
  const diff = cmp.rentTotal - cmp.habitatTotal;
  const sentence =
    diff >= 0
      ? t('result.futuresSentence', { diff: money(diff, lang), equity: money(cmp.equity10, lang) })
      : t('result.futuresSentenceLess', { diff: money(-diff, lang), equity: money(cmp.equity10, lang) });
  const EndLabel = (name: string, color: string) =>
    function Lbl(props: { x?: number | string; y?: number | string; index?: number }) {
      if (props.index !== data.length - 1) return null;
      return (
        <text x={Number(props.x ?? 0) + 8} y={Number(props.y ?? 0) + 4} fontSize={13} fill={color} fontWeight={500}>
          {name}
        </text>
      );
    };
  return (
    <Section title={t('result.futuresTitle')} id="futures">
      <div className="panel">
        <div ref={chartRef} className="relative h-[240px] w-full" role="img" aria-label={sentence} data-draw={phase}>
          <LeadDot color="var(--ink-2)" halo={alpha('var(--ink-2)', 0.28)} setRef={(el) => void (dots.current[0] = el)} on={phase === 'drawing'} />
          <LeadDot color="var(--pine)" halo={alpha('var(--pine)', 0.4)} setRef={(el) => void (dots.current[1] = el)} on={phase === 'drawing'} />
          {/* mounted when scrolled into view, so the lines draw left to right where the reader can see them */}
          {inView && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 12, right: 104, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeOpacity={0.6} />
              <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: 'var(--line)' }} tick={{ fontSize: 13, fill: 'var(--ink-2)' }} />
              <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={48} tick={{ fontSize: 13, fill: 'var(--ink-2)' }} />
              <Tooltip
                formatter={(v) => money(Number(v), lang)}
                labelFormatter={(y) => t('result.year', { n: String(y) })}
                contentStyle={{ background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 8, boxShadow: 'none', fontSize: 13 }}
                labelStyle={{ color: 'var(--ink)' }}
                cursor={{ stroke: 'var(--line)' }}
              />
              <Area
                type="monotone"
                dataKey="band"
                stroke="none"
                fill="var(--pine)"
                fillOpacity={0.12}
                isAnimationActive={false}
                tooltipType="none"
                legendType="none"
                activeDot={false}
                className={`transition-opacity duration-[600ms] ease-out ${drawn ? 'opacity-100' : 'opacity-0'}`}
              />
              <Line type="monotone" dataKey="rent" name={t('result.keepRenting')} stroke="var(--ink-2)" strokeWidth={2} dot={false} label={EndLabel(t('result.keepRenting'), 'var(--ink-2)')} isAnimationActive={false} />
              <Line type="monotone" dataKey="habitat" name={t('result.habitatHome')} stroke="var(--pine)" strokeWidth={2.5} dot={false} label={EndLabel(t('result.habitatHome'), 'var(--pine)')} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
          )}
        </div>
        <div className="mt-4 flex items-end justify-between gap-4 border-t border-line pt-4">
          <span className="pb-[6px] text-[15px] text-ink-2">{t('result.equityAt10')}</span>
          <EquityHouse value={cmp.equity10} share={share} go={inView} delay={0.5} format={(n) => money(n, lang)} />
        </div>
        <p className="tnum mt-3 text-[15px] leading-[22px] text-ink-2" data-testid="futures-sentence">
          {sentence}
        </p>
      </div>
    </Section>
  );
},
  (a, b) => chartKey(a.profile) === chartKey(b.profile),
);
