'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { computeReadiness, addMonths } from '@/lib/engine';
import { whyThisDate } from '@/lib/explain';
import type { Profile } from '@/lib/types';
import type { PlanOutput } from '@/lib/plan';
import { Road } from '@/components/result/Road';
import { PanelStreet } from '@/components/illustrations/result/PanelStreet';
import { ReadyHero } from '@/components/illustrations/result/ReadyHero';
import { Section, WhyThisDate } from '@/components/result/Panels';
import { PlanChecklist, PlanSkeleton } from '@/components/result/PlanChecklist';
import { keysReachAt, markPlayed, panelRoadWidth, readPlayed } from '@/components/illustrations/result/timing';

const DRAW = 0.6; // families revisit this page: a shorter entrance than the result screen

export function PlanNotFound() {
  const { t } = useLang();
  return (
    <section className="pt-16" data-testid="plan-not-found">
      <h1 className="t-title text-ink">{t('plan.notFoundTitle')}</h1>
      <p className="mt-3 text-ink-2">{t('plan.notFound')}</p>
      <Link href="/start" onClick={() => { try { localStorage.removeItem('hs.step'); } catch {} }} className="press mt-8 inline-flex min-h-[48px] items-center rounded-[8px] bg-pine px-5 font-medium text-white hover:bg-pine-hover">
        {t('plan.startOver')}
      </Link>
    </section>
  );
}

export function PlanView({ code, createdAt, profile, initialPlan, initialChecklist }: { code: string; createdAt: string; profile: Profile; initialPlan: PlanOutput | null; initialChecklist: Record<string, boolean> }) {
  const { t, lang } = useLang();
  const [plan, setPlan] = useState<PlanOutput | null>(initialPlan);
  const [checklist, setChecklist] = useState(initialChecklist);
  // Decided after mount (this page is server-rendered): the entrance plays once per session per plan.
  const [phase, setPhase] = useState<'pending' | 'play' | 'static'>('pending');
  useEffect(() => {
    let reduce = false;
    try {
      reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {}
    const key = `hs.planPlayed:${code}`;
    const played = readPlayed(key);
    markPlayed(key);
    setKeysAt(keysReachAt(computeReadiness(profile), DRAW, panelRoadWidth(), 'inOut'));
    setPhase(!reduce && !played ? 'play' : 'static');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);
  const play = phase === 'play';
  const [settled, setSettled] = useState(false);
  const [roadDone, setRoadDone] = useState(false);
  const onSettled = useCallback(() => setSettled(true), []);
  const onRoadDone = useCallback(() => setRoadDone(true), []);
  const result = useMemo(() => computeReadiness(profile), [profile]);
  const why = useMemo(() => whyThisDate(profile, result, lang), [profile, result, lang]);
  // Months since the plan was made: the Road's pine fill shows progress so far.
  const elapsed = Math.max(0, (() => {
    const c = new Date(createdAt);
    const n = new Date();
    return (n.getUTCFullYear() - c.getUTCFullYear()) * 12 + n.getUTCMonth() - c.getUTCMonth();
  })());

  useEffect(() => {
    // Plans saved before Claude finished (or seeded) get one generated on first view.
    if (plan) return;
    fetch('/api/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile, lang }) })
      .then((r) => r.json())
      .then(async (d) => {
        if (!d.plan) return;
        // Keep the first plan: store it so every tab and reload ticks the same items.
        const res = await fetch(`/api/plans/${code}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan: d.plan, lang }) }).catch(() => null);
        const saved = res && res.ok ? await res.json() : null;
        setPlan(saved?.plan ?? d.plan);
      })
      .catch(() => {});
  }, [plan, profile, lang, code]);

  const toggle = async (index: string, done: boolean) => {
    setChecklist((c) => ({ ...c, [index]: done }));
    try {
      const res = await fetch(`/api/plans/${code}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ index, done }) });
      const data = await res.json();
      if (data.checklist) setChecklist(data.checklist);
    } catch {}
  };

  const keys = result.milestones.find((m) => m.key === 'keys')?.month ?? 0;
  const [keysAt, setKeysAt] = useState(0);
  return (
    <div className="pb-16 pt-8">
      <p className="t-helper tnum mb-4 text-ink-2">{t('plan.planFor', { code })}</p>
      <h1 className="sr-only">{t('result.roadTitle')}</h1>
      <div style={{ visibility: phase === 'pending' ? 'hidden' : undefined }}>
        <ReadyHero key={phase} months={result.monthsToReady} readyDate={result.readyDate} keysDate={addMonths(new Date(), keys)} noIncome={result.noIncome} play={play} at={Math.max(0.2, keysAt - 0.05)} roll={0.4} onSettled={onSettled} />
      </div>
      <div className="panel mt-8 !px-5 !pb-2 !pt-4">
        {phase === 'pending' ? (
          <div className="h-[78px]" />
        ) : (
          <Road
            result={result}
            elapsed={elapsed}
            entrance={play ? 'always' : 'none'}
            drawDuration={DRAW}
            drawEase="inOut"
            onEntranceDone={onRoadDone}
            keysVariant="house"
            keysBuild={play && !roadDone ? 'short' : 'none'}
            keysBuildDelay={keysAt}
          />
        )}
        <PanelStreet keysLit={settled} litCount={Object.values(checklist).filter(Boolean).length} />
      </div>
      <WhyThisDate sentences={why} />
      <Section title={t('plan.title')} id="plan">
        {plan ? <PlanChecklist plan={plan} checklist={checklist} onToggle={toggle} today={new Date(createdAt)} /> : <PlanSkeleton />}
      </Section>
      <p className="t-helper mt-8 text-ink-2">{t('plan.consent')}</p>
    </div>
  );
}
