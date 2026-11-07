'use client';
import { Area, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useLang } from '@/lib/i18n';
import { tenYearComparison } from '@/lib/engine';
import { money } from '@/lib/format';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import type { Profile } from '@/lib/types';
import { Section } from './Panels';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'motion/react';

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
  const reduce = useReducedMotion();
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (!inView) return;
    // after the habitat line (600ms from a 60ms start); onAnimationEnd also sets it, this covers no-animation
    const id = setTimeout(() => setDrawn(true), reduce ? 0 : 700);
    return () => clearTimeout(id);
  }, [inView, reduce]);
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
        <div ref={chartRef} className="h-[240px] w-full" role="img" aria-label={sentence}>
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
                contentStyle={{ border: '1px solid var(--line)', borderRadius: 8, boxShadow: 'none', fontSize: 13 }}
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
              <Line type="monotone" dataKey="rent" name={t('result.keepRenting')} stroke="var(--ink-2)" strokeWidth={2} dot={false} label={EndLabel(t('result.keepRenting'), 'var(--ink-2)')} animationDuration={600} animationEasing="ease-out" isAnimationActive={!reduce} />
              <Line type="monotone" dataKey="habitat" name={t('result.habitatHome')} stroke="var(--pine)" strokeWidth={2.5} dot={false} label={EndLabel(t('result.habitatHome'), 'var(--pine)')} animationDuration={600} animationEasing="ease-out" animationBegin={60} isAnimationActive={!reduce} onAnimationEnd={() => setDrawn(true)} />
            </ComposedChart>
          </ResponsiveContainer>
          )}
        </div>
        <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
          <span className="text-[15px] text-ink-2">{t('result.equityAt10')}</span>
          <span className="text-[28px] font-semibold leading-[34px] tracking-[-0.01em] text-pine">
            <AnimatedNumber value={inView ? cmp.equity10 : 0} format={(n) => money(n, lang)} />
          </span>
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
