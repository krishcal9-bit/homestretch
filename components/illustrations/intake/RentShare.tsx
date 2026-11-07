'use client';
import { motion, useReducedMotion } from 'motion/react';
import { useLang } from '@/lib/i18n';
import { spring } from '@/lib/motion';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';

/**
 * Rent as a share of monthly income: a bar that fills with a spring (scaleX), a mark at 30%, and a line
 * of text. Past 30% the bar and the text turn amber. Hidden when there is no income to compare against.
 */
export function RentShare({ rent, income }: { rent: number | null; income: number }) {
  const { t } = useLang();
  const reduce = useReducedMotion();
  if (!(income > 0)) return null;
  const share = rent !== null && rent > 0 ? rent / income : 0;
  const over = share > 0.3;
  // Never read "more than 30%: 30%" because of rounding.
  const pct = over ? Math.max(31, Math.round(share * 100)) : Math.round(share * 100);
  const [pre, post] = t(over ? 'intakeArt.rentOver' : 'intakeArt.rentShare', { pct: '\u0000' }).split('\u0000');
  const color = over ? 'var(--signal-amber)' : 'var(--pine)';
  return (
    <div className="mt-3" data-testid="rent-share">
      <div className="relative h-[6px]" aria-hidden>
        <div className="absolute inset-0 overflow-hidden rounded-full bg-line">
          <motion.div
            className="absolute inset-0 origin-left"
            style={{ background: color, transition: 'background-color 200ms ease' }}
            initial={false}
            animate={{ scaleX: Math.min(1, share) }}
            transition={reduce ? { duration: 0 } : spring.smooth}
          />
        </div>
        <span className="absolute top-[-4px] h-[14px] w-[2px] -translate-x-1/2 rounded-full bg-ink-2" style={{ left: '30%' }} />
      </div>
      <div className="relative mt-[6px] h-[15px]">
        <span className="t-helper tnum absolute -translate-x-1/2 text-ink-2" style={{ left: '30%' }} aria-hidden>
          {t('intakeArt.thirty')}
        </span>
        {rent !== null && (
          <p
            className={`t-helper tnum absolute right-0 top-0 whitespace-nowrap ${over ? 'border-l-2 border-signal-amber pl-2 font-medium' : ''}`}
            style={{ color: over ? 'var(--signal-amber)' : 'var(--ink-2)', transition: 'color 200ms ease' }}
          >
            {pre}
            <AnimatedNumber value={pct} format={(n) => `${Math.round(n)}%`} />
            {post}
          </p>
        )}
      </div>
    </div>
  );
}
