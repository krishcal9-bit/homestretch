'use client';
import { motion } from 'motion/react';
import { useLang } from '@/lib/i18n';
import { money } from '@/lib/format';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { spring } from '@/lib/motion';
import type { ReadinessResult } from '@/lib/types';
import type { ReactNode } from 'react';

export function Section({ title, children, id, action }: { title: string; children: ReactNode; id?: string; action?: ReactNode }) {
  return (
    <section aria-labelledby={id ? `${id}-title` : undefined} className="mt-10">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 id={id ? `${id}-title` : undefined} className="t-section text-ink">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function WhyThisDate({ sentences }: { sentences: string[] }) {
  const { t } = useLang();
  return (
    <Section title={t('result.whyTitle')} id="why">
      <motion.ul layout transition={spring.smooth} className="panel flex flex-col gap-3 !p-5" data-testid="why">
        {sentences.map((s, i) => (
          <li key={i} className="flex gap-3 text-[16px] leading-[24px] text-ink">
            <span className="mt-[10px] h-[5px] w-[5px] shrink-0 rounded-full bg-pine" aria-hidden />
            <span className="tnum">{s}</span>
          </li>
        ))}
      </motion.ul>
    </Section>
  );
}

export function FinancePanel({ result, rent }: { result: ReadinessResult; rent: number }) {
  const { t, lang } = useLang();
  const fmt = (n: number) => money(n, lang);
  const diff = rent - result.maxPayment;
  const compare =
    Math.abs(diff) < 25 ? t('result.sameAsRent') : diff > 0 ? t('result.lessThanRent', { amount: fmt(diff) }) : t('result.moreThanRent', { amount: fmt(-diff) });
  return (
    <Section title={t('result.financeTitle')} id="finance">
      <div className="panel !p-0">
        <dl className="grid grid-cols-1 divide-y divide-line">
          <div className="flex items-baseline justify-between gap-4 p-4">
            <dt>
              <span className="block text-[15px] text-ink">{t('result.maxPayment')}</span>
              <span className="t-helper mt-1 block text-ink-2">{t('result.maxPaymentHelp')}</span>
            </dt>
            <dd className="text-[20px] font-semibold text-ink">
              <AnimatedNumber value={result.maxPayment} format={fmt} />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 p-4">
            <dt>
              <span className="block text-[15px] text-ink">{t('result.homePrice')}</span>
              <span className="t-helper mt-1 block text-ink-2">{t('result.homePriceHelp')}</span>
            </dt>
            <dd className="text-[20px] font-semibold text-ink">
              <AnimatedNumber value={result.financeableHome} format={fmt} />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 p-4">
            <dt className="text-[15px] text-ink">{t('result.cashToClose')}</dt>
            <dd className="text-[20px] font-semibold text-ink">
              <AnimatedNumber value={result.downPaymentTarget} format={fmt} />
            </dd>
          </div>
        </dl>
        {rent > 0 && <p className="tnum border-t border-line p-4 text-[15px] text-ink-2">{compare}</p>}
      </div>
    </Section>
  );
}
