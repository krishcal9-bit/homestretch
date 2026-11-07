'use client';
import { animate, useReducedMotion } from 'motion/react';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { computeReadiness, isEligible, addMonths } from '@/lib/engine';
import { draftToProfile, type Draft } from '@/lib/draft';
import { whyThisDate } from '@/lib/explain';
import { useLang } from '@/lib/i18n';
import { spring, dur } from '@/lib/motion';
import type { Levers as LeversT, Profile } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Road } from './Road';
import { Levers } from './Levers';
import { FinancePanel, Section, WhyThisDate } from './Panels';
import { AimForHome } from './AimForHome';
import { TwoFutures } from './TwoFutures';
import { PanelStreet } from '@/components/illustrations/result/PanelStreet';
import { useDateDelta } from '@/components/illustrations/result/DeltaPill';
import { keysReachAt, panelRoadWidth } from '@/components/illustrations/result/timing';
import { ReadyHero, useEntrance } from '@/components/illustrations/result/ReadyHero';
import { RoadHouse } from '@/components/illustrations/result/RoadHouse';
import type { Home } from '@/lib/types';

export { ReadyHero };

/** The value, once it has stopped changing for `ms` (the first value immediately). */
function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (Object.is(value, settled)) return;
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, settled, ms]);
  return settled;
}

export type ResultExtrasProps = { profile: Profile; draft: Draft; setDraft: (d: Draft | ((p: Draft) => Draft)) => void };

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
  // Entrance, once per session (the Road's own key, so a revisit in the same tab is calm).
  const play = useEntrance('hs.roadPlayed');
  const [settled, setSettled] = useState(false);
  const onSettled = useCallback(() => setSettled(true), []);
  // The 3D house builds once per session as the road reaches it; its porch light comes on once the date has
  // settled and the house is finished.
  // Once built it stays built: the scene restarts its clock when it pauses off screen, so a house still set to
  // 'short' would build again on the way back into view.
  const [houseBuild, setHouseBuild] = useState(() => (play ? 'short' : 'none') as 'short' | 'none');
  const [built, setBuilt] = useState(!play);
  const onBuilt = useCallback(() => {
    setBuilt(true);
    setHouseBuild('none');
  }, []);
  // A home chosen in "Aim for a specific home" stands at the end of the Road instead of the 3D house.
  const [chosen, setChosen] = useState<Home | null>(null);
  const [ticks, setTicks] = useState(0);
  useEffect(() => {
    const on = (e: Event) => setTicks((e as CustomEvent<number>).detail);
    window.addEventListener('hs:ticks', on);
    return () => window.removeEventListener('hs:ticks', on);
  }, []);

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
  // The hero, the Road and the sliders follow every frame of a drag. "Aim for a specific home" follows a
  // deferred copy (rendered between frames, so its small Road still re-flows while a solve glides); the
  // sections nobody reads mid-drag (why, finance, plan, save, counselor) follow a copy that settles 160ms
  // after the last change. Keeps a drag under one frame at 4x CPU throttle.
  const deferredProfile = useDeferredValue(profile);
  const settledProfile = useSettled(profile, 160);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const settledResult = useMemo(() => (settledProfile === profile ? result : computeReadiness(settledProfile)), [settledProfile]);
  const why = useMemo(() => whyThisDate(settledProfile, settledResult, lang), [settledProfile, settledResult, lang]);
  const extrasDraft = useMemo(() => ({ ...draft, levers: settledProfile.levers }), [draft, settledProfile]);
  const leversRef = useRef(levers);
  leversRef.current = levers;
  const keysMonth = result.milestones.find((m) => m.key === 'keys')?.month ?? 0;
  // The Keys house builds as the drawing line reaches it; the date lands as its door turns brass.
  const [keysAt] = useState(() => keysReachAt(result, dur.long, panelRoadWidth(), 'inOut', 0, 'house'));
  const dateAt = Math.max(0.3, keysAt);
  const { baseline, keysGlow, begin } = useDateDelta(result.monthsToReady);

  // Haptic tick when the ready date crosses a month boundary.
  const lastMonth = useRef(result.monthsToReady);
  useEffect(() => {
    if (lastMonth.current !== result.monthsToReady) {
      lastMonth.current = result.monthsToReady;
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(8);
    }
  }, [result.monthsToReady]);

  const onUserLevers = (l: LeversT) => {
    begin();
    solving.current.forEach((c) => c.stop());
    solving.current = [];
    commit(l);
  };

  /** D1: sliders animate to their solved positions with spring.smooth while the road re-flows. */
  const onSolve = useCallback((target: LeversT) => {
    begin();
    solving.current.forEach((c) => c.stop());
    if (reduce) {
      setLevers(target);
      return;
    }
    const from = { ...leversRef.current };
    const live = { ...leversRef.current };
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
  }, [reduce, commit, begin]);

  const eligible = isEligible(result);

  if (result.noIncome) {
    return (
      <section className="pt-4">
        <h1 data-screen-title tabIndex={-1} className="t-title text-ink focus:outline-none focus-visible:outline-none">
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
      <ReadyHero months={result.monthsToReady} readyDate={result.readyDate} keysDate={addMonths(new Date(), keysMonth)} play={play} at={dateAt} onSettled={onSettled} baseline={baseline} />

      <div className="panel mt-8 !px-5 !pb-2 !pt-4">
        <Road
          result={result}
          entrance={play ? 'always' : 'none'}
          drawEase="inOut"
          vtName="road"
          keysVariant="slot"
          slotKind="house"
          keysSlot={<RoadHouse build={houseBuild} lit={ticks} porch={settled && built} chosen={chosen?.id ?? null} onBuilt={onBuilt} />}
          keysLabel={chosen ? chosen.city : undefined}
          progressTo={result.monthsToReady}
          keysGlow={keysGlow}
        />
        {/* the street the road runs along */}
        <PanelStreet />
      </div>

      <div className="panel mt-4 !p-5">
        <h2 className="t-section text-ink">{t('result.leversTitle')}</h2>
        <p className="t-helper mb-5 mt-1 text-ink-2">{t('result.leversHelp')}</p>
        <Levers levers={levers} onChange={onUserLevers} />
      </div>

      <WhyThisDate sentences={why} />
      <FinancePanel result={settledResult} rent={settledProfile.rent} />
      <AimForHome profile={deferredProfile} onSolve={onSolve} onChosen={setChosen} />
      <TwoFutures profile={baseProfile} />
      {Extras && <Extras profile={settledProfile} draft={extrasDraft} setDraft={setDraft} />}

      <Section title="">
        <button type="button" onClick={onEdit} className="min-h-[44px] text-[15px] font-medium text-pine underline-offset-4 hover:underline">
          {t('result.editAnswers')}
        </button>
      </Section>
    </div>
  );
}
