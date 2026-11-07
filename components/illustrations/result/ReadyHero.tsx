'use client';
import { motion } from 'motion/react';
import { memo, useEffect, useState, type RefObject } from 'react';
import { MAX_MONTHS } from '@/lib/engine';
import { useLang } from '@/lib/i18n';
import { monthName } from '@/lib/format';
import { dur, ease } from '@/lib/motion';
import { OdometerMonth } from './OdometerMonth';
import { EyebrowWithPill } from './DeltaPill';
import { markPlayed, readPlayed, shiftMonth } from './timing';

/** Whether an entrance should play: once per session per key, never with reduced motion. Client-only. */
export function useEntrance(key: string): boolean {
  const [play] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    } catch {}
    return !readPlayed(key);
  });
  useEffect(() => markPlayed(key), [key]);
  return play;
}

/** Characters of the longest date the hero shows in each language ("September 2034", "septiembre de 2034"). */
const LONGEST = { en: 14, es: 18 };

/**
 * The ready date. On entrance: the eyebrow fades in, the date odometers up through the three months before
 * it (from `at`), then the two lines under it. Later changes swap vertically; a "N months sooner" pill rides
 * beside it while a lever moves (on phones it takes the eyebrow's place for those 1.5 seconds).
 */
export const ReadyHero = memo(function ReadyHero({
  months,
  readyDate,
  keysDate,
  noIncome,
  play = false,
  at = 0,
  onSettled,
  baseline,
  roll = 0.55,
}: {
  months: number;
  readyDate: string;
  keysDate: string;
  noIncome?: boolean;
  play?: boolean;
  at?: number;
  onSettled?: () => void;
  /** where the current lever change started (useDateDelta); shows the "N months sooner" pill */
  baseline?: RefObject<number | null>;
  /** seconds the odometer takes to land */
  roll?: number;
}) {
  const { t, lang } = useLang();
  // the odometer freezes its strip at mount, so the earlier months are worked out once
  const [earlier] = useState(() => (months >= MAX_MONTHS || !play ? [] : [-3, -2, -1].map((k) => monthName(shiftMonth(readyDate, k), lang))));
  if (noIncome) return null;
  const sub =
    months >= MAX_MONTHS ? t('result.tooFar') : months === 0 ? t('result.readyNow') : months === 1 ? t('result.oneMonth') : t('result.monthsAway', { n: months });
  const tenPlus = months >= MAX_MONTHS;
  const text = tenPlus ? t('result.tenPlus') : monthName(readyDate, lang);
  // One size per language (the longest month fits the column), so the date never resizes as it changes.
  const basis = tenPlus ? text.length : LONGEST[lang];
  const fade = (delay: number) => (play ? { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: dur.medium, ease: ease.out, delay } } : {});
  return (
    <div className="[container-type:inline-size]">
      <motion.div {...fade(0.05)}>
        <EyebrowWithPill eyebrow={t('result.eyebrow')} months={months} baseline={baseline} />
      </motion.div>
      <p className="mt-1 font-semibold tracking-[-0.01em] text-brass" style={{ fontSize: `min(56px, ${(100 / (basis * 0.6)).toFixed(2)}cqw)` }}>
        <OdometerMonth text={text} earlier={earlier} play={play} at={at} duration={roll} testId="ready-date" onSettled={onSettled} />
      </p>
      <motion.p {...fade(at + 0.3)} className="tnum mt-3 text-[16px] text-ink" data-testid="ready-sub">
        {sub}
      </motion.p>
      <motion.p {...fade(at + 0.36)} className="tnum t-helper mt-2 text-ink-2">
        {t('result.keys', { month: monthName(keysDate, lang) })}
      </motion.p>
    </div>
  );
});
