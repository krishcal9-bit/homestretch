'use client';
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useLang } from '@/lib/i18n';
import { tenYearComparison } from '@/lib/engine';
import { money } from '@/lib/format';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { dur } from '@/lib/motion';
import type { Profile } from '@/lib/types';
import { Section } from './Panels';
import { useMemo } from 'react';

const compact = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);

export function TwoFutures({ profile }: { profile: Profile }) {
  const { t, lang } = useLang();
  // Rent/home comparison uses the base levers so the chart doesn't jitter while sliders move.
  const cmp = useMemo(() => tenYearComparison(profile), [profile]);
  const data = cmp.points.map((p) => ({ year: p.year, rent: p.rentCost, habitat: p.habitatCost }));
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
        <div className="h-[240px] w-full" role="img" aria-label={sentence}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 12, right: 104, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeOpacity={0.6} />
              <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: 'var(--line)' }} tick={{ fontSize: 13, fill: 'var(--ink-2)' }} />
              <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={48} tick={{ fontSize: 13, fill: 'var(--ink-2)' }} />
              <Tooltip
                formatter={(v) => money(Number(v), lang)}
                labelFormatter={(y) => t('result.year', { n: String(y) })}
                contentStyle={{ border: '1px solid var(--line)', borderRadius: 8, boxShadow: 'none', fontSize: 13 }}
              />
              <Line type="monotone" dataKey="rent" name={t('result.keepRenting')} stroke="var(--ink-2)" strokeWidth={2} dot={false} label={EndLabel(t('result.keepRenting'), 'var(--ink-2)')} animationDuration={dur.medium * 1000} />
              <Line type="monotone" dataKey="habitat" name={t('result.habitatHome')} stroke="var(--pine)" strokeWidth={2.5} dot={false} label={EndLabel(t('result.habitatHome'), 'var(--pine)')} animationDuration={dur.medium * 1000} animationBegin={20} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
          <span className="text-[15px] text-ink-2">{t('result.equityAt10')}</span>
          <span className="text-[28px] font-semibold leading-[34px] tracking-[-0.01em] text-pine">
            <AnimatedNumber value={cmp.equity10} format={(n) => money(n, lang)} />
          </span>
        </div>
        <p className="tnum mt-3 text-[15px] leading-[22px] text-ink-2" data-testid="futures-sentence">
          {sentence}
        </p>
      </div>
    </Section>
  );
}
