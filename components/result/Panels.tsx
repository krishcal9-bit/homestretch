'use client';
import { motion, useInView } from 'motion/react';
import { memo, useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { money } from '@/lib/format';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { ease } from '@/lib/motion';
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

/** Money, percentages and month counts: the numbers each sentence turns on. */
const NUMBERS = /(\$[\d,]+|\d+\s?%|\d+ (?:months?|meses|mes)\b|\b(?:month|mes) \d+)/;

/** A sentence whose numbers get a pine-soft wash that fades out over 600ms once the sentence has risen in. */
function Washed({ text, wash, go, delay }: { text: string; wash: boolean; go: boolean; delay: number }) {
  const parts = text.split(NUMBERS);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="relative isolate whitespace-nowrap">
            <motion.span
              aria-hidden
              className="absolute -inset-x-[3px] inset-y-0 -z-10 rounded-[4px] bg-pine-soft"
              initial={{ opacity: wash ? 1 : 0 }}
              animate={go ? { opacity: 0 } : undefined}
              transition={{ duration: 0.6, ease: ease.out, delay }}
            />
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

export const WhyThisDate = memo(function WhyThisDate({ sentences }: { sentences: string[] }) {
  const { t } = useLang();
  const ref = useRef<HTMLUListElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  // Sentences rise (50ms apart) when the list first scrolls into view; numbers wash only during that beat,
  // never again while a slider rewrites them.
  const [washing, setWashing] = useState(true);
  useEffect(() => {
    if (!inView) return;
    const id = setTimeout(() => setWashing(false), 2000);
    return () => clearTimeout(id);
  }, [inView]);
  return (
    <Section title={t('result.whyTitle')} id="why">
      <ul ref={ref} className="panel flex flex-col gap-3 !p-5" data-testid="why">
        {sentences.map((s, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={inView ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.3, ease: ease.out, delay: washing ? i * 0.05 : 0 }}
            className="flex gap-3 text-[16px] leading-[24px] text-ink"
          >
            <span className="mt-[10px] h-[5px] w-[5px] shrink-0 rounded-full bg-pine" aria-hidden />
            <span className="tnum">
              <Washed text={s} wash={washing} go={inView} delay={i * 0.05 + 0.25} />
            </span>
          </motion.li>
        ))}
      </ul>
    </Section>
  );
});

export const FinancePanel = memo(function FinancePanel({ result, rent }: { result: ReadinessResult; rent: number }) {
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
});
