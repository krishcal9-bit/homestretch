'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { computeReadiness, addMonths } from '@/lib/engine';
import { whyThisDate } from '@/lib/explain';
import type { Profile } from '@/lib/types';
import type { PlanOutput } from '@/lib/plan';
import { Road } from '@/components/result/Road';
import { ReadyHero } from '@/components/result/ResultScreen';
import { Section, WhyThisDate } from '@/components/result/Panels';
import { PlanChecklist, PlanSkeleton } from '@/components/result/PlanChecklist';

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
  const [revealed, setRevealed] = useState(false);
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
  return (
    <div className="pb-16 pt-8">
      <p className="t-helper tnum mb-4 text-ink-2">{t('plan.planFor', { code })}</p>
      <h1 className="sr-only">{t('result.roadTitle')}</h1>
      <ReadyHero months={result.monthsToReady} readyDate={result.readyDate} keysDate={addMonths(new Date(), keys)} reveal={revealed} noIncome={result.noIncome} />
      <div className="panel mt-8 !px-5 !pb-2 !pt-4">
        <Road result={result} elapsed={elapsed} onEntranceDone={() => setRevealed(true)} />
      </div>
      <WhyThisDate sentences={why} />
      <Section title={t('plan.title')} id="plan">
        {plan ? <PlanChecklist plan={plan} checklist={checklist} onToggle={toggle} today={new Date(createdAt)} /> : <PlanSkeleton />}
      </Section>
      <p className="t-helper mt-8 text-ink-2">{t('plan.consent')}</p>
    </div>
  );
}
