'use client';
import { useMotionValueEvent, useReducedMotion, useSpring } from 'motion/react';
import { memo, useEffect, useMemo, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { P } from '@/lib/illustrationPalette';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Dial, clamp, useSvgId, type DialBand } from './shared';

/** The dial reads 0–60% of income; 30% is straight up. Past 60% the needle rests against its stop. */
const angleFor = (share: number) => clamp(-90 + (share / 0.6) * 180, -90, 92);
const TICKS = [-90, -60, -30, 0, 30, 60, 90];
const MAJOR = [0];

export const rentShare = (rent: number | null, income: number) => (income > 0 && rent !== null && rent > 0 ? rent / income : 0);

/**
 * Step 3: a rent meter beside the rent field: a shaded dial with a sage band up to 30% and an amber band
 * past it, ticks every 10%, and a needle that swings with a damped spring as the rent is typed. Past 30%
 * the amber band lights and the needle turns amber. Decorative: the line under the field says it in words.
 */
export const RentGauge = memo(function RentGauge({ share, active }: { share: number; active: boolean }) {
  const { t } = useLang();
  const id = useSvgId();
  const reduce = useReducedMotion();
  const over = share > 0.3;
  const target = angleFor(share);
  const angle = useSpring(target, { visualDuration: 0.6, bounce: 0.22 });
  useEffect(() => {
    if (reduce) angle.jump(target);
    else angle.set(target);
  }, [target, reduce, angle]);
  // the dial turns amber as the needle sweeps past the 30% mark (not before), and only if it stays past it
  const [past, setPast] = useState(() => angle.get() > 0);
  useMotionValueEvent(angle, 'change', (a) => {
    if (a > 0 !== past) setPast(a > 0);
  });
  const amber = over && past;
  const bands = useMemo<DialBand[]>(
    () => [
      { from: -88, to: -1.5, color: P.sage, on: active },
      { from: 1.5, to: 88, color: P.amber, on: amber, off: P.amberSoft },
    ],
    [active, amber],
  );
  return (
    <div className="pointer-events-none flex w-[84px] shrink-0 flex-col items-center" aria-hidden data-testid="rent-gauge">
      <span className="t-helper tnum mb-[2px] text-ink-2">{t('intakeArt.thirty')}</span>
      <Dial id={id} width={84} angle={angle} bands={bands} ticks={TICKS} major={MAJOR} tone={amber ? 'amber' : active ? 'pine' : 'idle'} />
    </div>
  );
});

/** "Rent is 45% of your income" under the field; past 30% it turns amber with the 2px amber rule. */
export function RentShare({ rent, income }: { rent: number | null; income: number }) {
  const { t } = useLang();
  if (!(income > 0)) return null;
  const share = rentShare(rent, income);
  const over = share > 0.3;
  // Never read "more than 30%: 30%" because of rounding.
  const pct = over ? Math.max(31, Math.round(share * 100)) : Math.round(share * 100);
  const [pre, post] = t(over ? 'intakeArt.rentOver' : 'intakeArt.rentShare', { pct: '\u0000' }).split('\u0000');
  return (
    <div className="mt-2 flex h-[18px] items-center" data-testid="rent-share">
      {rent !== null && (
        <p className={`t-helper tnum whitespace-nowrap ${over ? 'border-l-2 border-signal-amber pl-2 font-medium text-signal-amber' : 'text-ink-2'}`}>
          {pre}
          <AnimatedNumber value={pct} format={(n) => `${Math.round(n)}%`} />
          {post}
        </p>
      )}
    </div>
  );
}
