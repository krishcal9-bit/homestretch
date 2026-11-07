'use client';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useLang } from '@/lib/i18n';
import { ease } from '@/lib/motion';
import { SwapText } from './SwapText';

/**
 * Where a lever change starts: `begin()` (call it before applying the change) remembers the months to ready
 * at that moment. The pill compares against it and clears it 1.5s after the last change. `keysGlow` counts
 * the times the date got earlier during a change (worked out while rendering, so it costs no extra render).
 */
export function useDateDelta(months: number) {
  const baseline = useRef<number | null>(null);
  const monthsRef = useRef(months);
  monthsRef.current = months;
  const begin = useCallback(() => {
    if (baseline.current === null) baseline.current = monthsRef.current;
  }, []);
  const glow = useRef({ last: months, n: 0 });
  if (months !== glow.current.last) {
    if (months < glow.current.last && baseline.current !== null) glow.current.n += 1;
    glow.current.last = months;
  }
  return { baseline, begin, keysGlow: glow.current.n };
}

/** The months moved since `baseline`, shown while a change is under way; null when there's nothing to show. */
function useDelta(months: number, baseline: RefObject<number | null>) {
  const [delta, setDelta] = useState<number | null>(null);
  const last = useRef(months);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (months === last.current) return;
    last.current = months;
    if (baseline.current === null) return; // not a lever change (e.g. answers edited)
    const n = months - baseline.current;
    setDelta(n === 0 ? null : n);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setDelta(null);
      baseline.current = null;
    }, 1500);
  }, [months, baseline]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return delta;
}

/** One persistent pill: pine "N months sooner", or ink-2 "N months later"; only its text swaps mid-drag. */
function DeltaPill({ n }: { n: number | null }) {
  const { t } = useLang();
  const text = n === null ? '' : n < 0 ? (n === -1 ? t('resultArt.sooner1') : t('resultArt.sooner', { n: -n })) : n === 1 ? t('resultArt.later1') : t('resultArt.later', { n });
  return (
    <AnimatePresence>
      {n !== null && (
        <motion.span
          key="pill"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          transition={{ duration: 0.16, ease: ease.out }}
          className={`tnum inline-flex h-[28px] items-center whitespace-nowrap rounded-full px-3 text-[13px] font-medium ${n < 0 ? 'bg-pine text-on-pine' : 'bg-surface text-ink-2 ring-1 ring-line'}`}
          data-testid="delta-pill"
        >
          <SwapText text={text} />
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/**
 * The line above the date: the eyebrow, with the pill beside it while a lever moves (right-aligned from
 * 640px; on phones it takes the eyebrow's place for those 1.5 seconds). Holds the pill's state itself, so a
 * pill update re-renders this row only.
 */
export function EyebrowWithPill({ eyebrow, months, baseline }: { eyebrow: string; months: number; baseline?: RefObject<number | null> }) {
  const fallback = useRef<number | null>(null);
  const delta = useDelta(months, baseline ?? fallback);
  return (
    <div className="relative flex min-h-[28px] items-center">
      <p className="text-[15px] text-ink-2">
        <span className={`block transition-opacity duration-150 ${delta !== null ? 'max-sm:opacity-0' : ''}`}>{eyebrow}</span>
      </p>
      <div className="absolute left-0 top-0 sm:left-auto sm:right-0">
        <DeltaPill n={delta} />
      </div>
    </div>
  );
}
