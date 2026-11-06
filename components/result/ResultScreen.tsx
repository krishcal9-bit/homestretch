'use client';
import { animate, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computeReadiness, isEligible, addMonths, MAX_MONTHS } from '@/lib/engine';
import { draftToProfile, type Draft } from '@/lib/draft';
import { whyThisDate } from '@/lib/explain';
import { useLang } from '@/lib/i18n';
import { monthName } from '@/lib/format';
import { spring, dur, ease } from '@/lib/motion';
import type { Levers as LeversT, Profile } from '@/lib/types';
import { AnimatedMonth } from '@/components/ui/AnimatedMonth';
import { Button } from '@/components/ui/Button';
import { Road } from './Road';
import { Levers } from './Levers';
import { FinancePanel, Section, WhyThisDate } from './Panels';
import { AimForHome } from './AimForHome';
import { TwoFutures } from './TwoFutures';

export type ResultExtrasProps = { profile: Profile; draft: Draft; setDraft: (d: Draft | ((p: Draft) => Draft)) => void };

export function ReadyHero({ months, readyDate, keysDate, reveal, noIncome }: { months: number; readyDate: string; keysDate: string; reveal: boolean; noIncome?: boolean }) {
  const { t, lang } = useLang();
  const sub =
    months >= MAX_MONTHS ? t('result.tooFar') : months === 0 ? t('result.readyNow') : months === 1 ? t('result.oneMonth') : t('result.monthsAway', { n: months });
  if (noIncome) return null;
  return (
    <motion.div initial={false} animate={{ opacity: reveal ? 1 : 0, y: reveal ? 0 : 8 }} transition={{ duration: dur.medium, ease: ease.out }}>
      <p className="text-[15px] text-ink-2">{t('result.eyebrow')}</p>
      <p className="mt-1 text-[clamp(40px,11vw,56px)] font-semibold leading-[1.07] tracking-[-0.01em] text-brass">
        <AnimatedMonth text={months >= MAX_MONTHS ? '2036+' : monthName(readyDate, lang)} testId="ready-date" />
      </p>
      <p className="tnum mt-3 text-[16px] text-ink" data-testid="ready-sub">
        {sub}
      </p>
      <p className="tnum t-helper mt-2 text-ink-2">{t('result.keys', { month: monthName(keysDate, lang) })}</p>
    </motion.div>
  );
}

export function ResultScreen({
  draft,
  setDraft,
  onEdit,
  Extras,
}: {
  draft: Draft;
  setDraft: (d: Draft | ((p: Draft) => Draft)) => void;
  onEdit: () => void;
  Extras?: React.ComponentType<ResultExtrasProps>;
}) {
  const { t, lang } = useLang();
  const reduce = useReducedMotion();
  // Live levers: updated at most once per animation frame while dragging.
  const [levers, setLevers] = useState<LeversT>(draft.levers);
  const pending = useRef<LeversT | null>(null);
  const raf = useRef<number | null>(null);
  const solving = useRef<{ stop: () => void }[]>([]);
  const [revealed, setRevealed] = useState(false);

  const commit = useCallback(
    (l: LeversT) => {
      pending.current = l;
      if (raf.current !== null) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        if (pending.current) setLevers(pending.current);
      });
    },
    [],
  );
  // Persist levers to the draft (debounced), so a refresh restores them.
  useEffect(() => {
    const id = setTimeout(() => setDraft((d) => ({ ...d, levers })), 250);
    return () => clearTimeout(id);
  }, [levers, setDraft]);

  const baseProfile = useMemo(() => draftToProfile(draft), [draft]);
  const profile = useMemo(() => ({ ...baseProfile, levers }), [baseProfile, levers]);
  const result = useMemo(() => computeReadiness(profile), [profile]);
  const why = useMemo(() => whyThisDate(profile, result, lang), [profile, result, lang]);
  const keysMonth = result.milestones.find((m) => m.key === 'keys')?.month ?? 0;

  // Haptic tick when the ready date crosses a month boundary.
  const lastMonth = useRef(result.monthsToReady);
  useEffect(() => {
    if (lastMonth.current !== result.monthsToReady) {
      lastMonth.current = result.monthsToReady;
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(8);
    }
  }, [result.monthsToReady]);

  const onUserLevers = (l: LeversT) => {
    solving.current.forEach((c) => c.stop());
    solving.current = [];
    commit(l);
  };

  /** D1: sliders animate to their solved positions with spring.smooth while the road re-flows. */
  const onSolve = (target: LeversT) => {
    solving.current.forEach((c) => c.stop());
    if (reduce) {
      setLevers(target);
      return;
    }
    const from = { ...levers };
    const live = { ...levers };
    solving.current = (['extraDebt', 'monthlySavings'] as const).map((k) =>
      animate(from[k], target[k], {
        ...spring.smooth,
        onUpdate: (v) => {
          live[k] = Math.round(v);
          commit({ ...live });
        },
        onComplete: () => {
          live[k] = target[k];
          commit({ ...live });
        },
      }),
    );
  };

  const eligible = isEligible(result);

  if (result.noIncome) {
    return (
      <section className="pt-4">
        <h1 data-screen-title tabIndex={-1} className="t-title text-ink focus:outline-none">
          {t('result.noIncomeTitle')}
        </h1>
        <p className="mt-3 text-ink-2">{t('result.noIncomeBody')}</p>
        <div className="mt-8">
          <Button onClick={onEdit}>{t('result.addIncome')}</Button>
        </div>
      </section>
    );
  }

  return (
    <div className="pb-16 pt-2">
      <h1 data-screen-title tabIndex={-1} className="sr-only">
        {t('result.roadTitle')}
      </h1>
      {!eligible && (
        <div className="mb-6 border-l-2 border-signal-amber pl-3" role="status" data-testid="not-eligible">
          <p className="text-[16px] font-medium text-signal-amber">{t('result.notEligibleTitle')}</p>
          <p className="mt-1 text-[15px] text-ink-2">{t('result.notEligibleBody')}</p>
        </div>
      )}
      <ReadyHero months={result.monthsToReady} readyDate={result.readyDate} keysDate={addMonths(new Date(), keysMonth)} reveal={revealed} />

      <div className="panel mt-8 !px-5 !pb-2 !pt-4">
        <Road result={result} onEntranceDone={() => setRevealed(true)} />
      </div>

      <div className="panel mt-4 !p-5">
        <h2 className="t-section text-ink">{t('result.leversTitle')}</h2>
        <p className="t-helper mb-5 mt-1 text-ink-2">{t('result.leversHelp')}</p>
        <Levers levers={levers} onChange={onUserLevers} />
      </div>

      <WhyThisDate sentences={why} />
      <FinancePanel result={result} rent={profile.rent} />
      <AimForHome profile={profile} onSolve={onSolve} />
      <TwoFutures profile={baseProfile} />
      {Extras && <Extras profile={profile} draft={{ ...draft, levers }} setDraft={setDraft} />}

      <Section title="">
        <button type="button" onClick={onEdit} className="min-h-[44px] text-[15px] font-medium text-pine underline-offset-4 hover:underline">
          {t('result.editAnswers')}
        </button>
      </Section>
    </div>
  );
}
