'use client';
// READY → KEEP bridge: what owning costs in the first year after closing (lib/readiness firstYearOwning):
// the 0% Habitat mortgage + escrow (property tax and insurance) + a repair set-aside, and a way into Keep.
import Link from 'next/link';
import { memo, useMemo } from 'react';
import { useLang } from '@/lib/i18n';
import { money } from '@/lib/format';
import { firstYearOwning } from '@/lib/readiness';
import type { Profile, ReadinessResult } from '@/lib/types';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Section } from './Panels';

export const FirstYear = memo(function FirstYear({ profile, result }: { profile: Profile; result: ReadinessResult }) {
  const { t, lang } = useLang();
  const fy = useMemo(() => firstYearOwning(profile, result), [profile, result]);
  const $ = (n: number) => money(n, lang);
  if (result.noIncome || fy.mortgage <= 0) return null;
  const rows = [
    { k: 'mortgage', v: fy.mortgage, help: t('firstYear.mortgageHelp') },
    { k: 'escrow', v: fy.escrow, help: t('firstYear.escrowHelp') },
    { k: 'setAside', v: fy.setAside, help: t('firstYear.setAsideHelp') },
  ];
  return (
    <Section title={t('firstYear.title')} id="first-year">
      <div className="panel !p-0" data-testid="first-year">
        <p className="px-4 pt-4 text-[15px] leading-[22px] text-ink-2">{t('firstYear.sub')}</p>
        <dl className="mt-2 divide-y divide-line">
          {rows.map((r) => (
            <div key={r.k} className="flex items-baseline justify-between gap-4 px-4 py-3">
              <dt>
                <span className="block text-[15px] text-ink">{t(`firstYear.${r.k}`)}</span>
                <span className="t-helper mt-1 block text-ink-2">{r.help}</span>
              </dt>
              <dd className="tnum text-[16px] font-medium text-ink">
                <AnimatedNumber value={r.v} format={$} />
              </dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4 px-4 py-4">
            <dt className="text-[16px] font-semibold text-ink">{t('firstYear.total')}</dt>
            <dd className="text-[20px] font-semibold text-ink" data-testid="first-year-total">
              <AnimatedNumber value={fy.monthly} format={(n) => t('firstYear.perMonth', { amount: $(n) })} />
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line px-4 py-3">
          <p className="t-helper text-ink-2">{t('firstYear.estimate')}</p>
          <Link href="/keep" className="inline-flex min-h-[44px] items-center text-[15px] font-medium text-pine underline-offset-4 hover:underline" data-testid="see-keep">
            {t('firstYear.seeKeep')}
          </Link>
        </div>
      </div>
    </Section>
  );
});
