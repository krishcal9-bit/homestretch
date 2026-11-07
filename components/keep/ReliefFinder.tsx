'use client';
// KEEP · Relief Finder (/keep/relief): one checklist of programs that lower what the home costs, personalized from
// the Keep profile. The rules (lib/relief.ts) render at once; Claude's personalized sentences replace them when they
// arrive (POST /api/relief). Marking the Homeowners' Exemption done sets profile.homeownersExemption.
import { motion } from 'motion/react';
import { ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { money } from '@/lib/format';
import { dur, ease, stagger } from '@/lib/motion';
import { patchProfile, type KeepState } from '@/lib/keepStore';
import { fallbackRelief, reliefWorth, RELIEF_IDS, type ReliefId, type ReliefItem } from '@/lib/relief';
import type { KeepProfile } from '@/lib/keep';
import type { Lang } from '@/lib/types';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { CheckMark } from '@/components/ui/Checkbox';
import { KeepGate, KeepHead } from './KeepFrame';
import { HomePlanDownload } from './HomePlanDownload';

type Update = (u: Partial<KeepState> | ((s: KeepState) => KeepState)) => void;

export function ReliefFinder() {
  const { t } = useLang();
  return (
    <KeepGate>
      {(state, update) => (
        <>
          <KeepHead title={t('keepRelief.title')} sub={t('keepRelief.sub')} />
          <ReliefBody state={state} update={update} />
        </>
      )}
    </KeepGate>
  );
}

/** What each program flips on the profile when it's marked done. */
const PROFILE_FLAG: Partial<Record<ReliefId, keyof KeepProfile>> = { exemption: 'homeownersExemption', careFera: 'careFera' };

/** Items done: the ticks, plus anything the profile already says is claimed. */
export function doneIds(state: KeepState): string[] {
  const d = new Set(state.reliefDone);
  if (state.profile.homeownersExemption) d.add('exemption');
  if (state.profile.careFera) d.add('careFera');
  return [...d];
}

const cacheKey = (p: KeepProfile, lang: Lang) => `hs.relief.${lang}.${JSON.stringify([p.householdSize, p.income, p.takeHome, p.premium, p.fairPlan, p.insurer, p.zip, p.systems.map((s) => [s.kind, s.ageYears, s.lifeYears])])}`;

function usePersonalized(profile: KeepProfile, lang: Lang) {
  const base = useMemo(() => fallbackRelief(profile, lang), [profile, lang]);
  const key = cacheKey(profile, lang);
  const [got, setGot] = useState<{ key: string; items: ReliefItem[] } | null>(null);
  useEffect(() => {
    let alive = true;
    try {
      const hit = sessionStorage.getItem(key);
      if (hit) {
        setGot({ key, items: JSON.parse(hit) });
        return;
      }
    } catch {}
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    fetch('/api/relief', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile, lang }), signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.items) return;
        setGot({ key, items: d.items });
        try {
          sessionStorage.setItem(key, JSON.stringify(d.items));
        } catch {}
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
    return () => {
      alive = false;
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return got?.key === key ? got.items : base;
}

function ReliefBody({ state, update }: { state: KeepState; update: Update }) {
  const { t, lang } = useLang();
  const items = usePersonalized(state.profile, lang);
  const done = doneIds(state);
  const worth = reliefWorth(items, done);
  const claimed = reliefWorth(items, items.map((i) => i.id).filter((id) => !done.includes(id)));
  const count = RELIEF_IDS.filter((id) => done.includes(id)).length;

  const toggle = (id: ReliefId, on: boolean) =>
    update((s) => {
      const reliefDone = on ? [...new Set([...s.reliefDone, id])] : s.reliefDone.filter((x) => x !== id);
      const flag = PROFILE_FLAG[id];
      const next = { ...s, reliefDone };
      return flag ? patchProfile(next, { [flag]: on } as Partial<KeepProfile>) : next;
    });

  const $ = (n: number) => money(n, lang);
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
      <aside className="lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:self-start">
        <div className="panel !p-5" data-testid="relief-summary">
          <p className="text-[15px] font-medium text-ink-2">{t('keepRelief.stillToClaim')}</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <AnimatedNumber value={worth} format={(n) => $(n)} className="text-[40px] font-semibold leading-[44px] tracking-[-0.01em] text-ink" />
            <span className="text-[16px] text-ink-2">{t('keepRelief.perYear')}</span>
          </p>
          <p className="mt-2 text-[15px] leading-[22px] text-ink-2">{t('keepRelief.conservative')}</p>
          <div className="mt-4 border-t border-line pt-4">
            <p className="tnum text-[15px] text-ink" data-testid="relief-count">
              {t('keepRelief.doneCount', { n: count, total: RELIEF_IDS.length })}
            </p>
            {/* progress: five segments, one per program */}
            <div className="mt-2 grid grid-cols-5 gap-1" aria-hidden>
              {RELIEF_IDS.map((id) => (
                <span key={id} className="h-1.5 overflow-hidden rounded-full bg-line">
                  <motion.span className="block h-full origin-left rounded-full bg-pine" initial={false} animate={{ scaleX: done.includes(id) ? 1 : 0 }} transition={{ duration: dur.medium, ease: ease.out }} />
                </span>
              ))}
            </div>
            {claimed > 0 && <p className="tnum mt-3 text-[13px] leading-[18px] text-ink-2">{t('keepRelief.claimedWorth', { amount: $(claimed) })}</p>}
          </div>
          <div className="mt-5 border-t border-line pt-5 max-lg:hidden">
            <HomePlanDownload state={state} />
          </div>
        </div>
      </aside>

      <ol className="panel divide-y divide-line !p-0 lg:col-start-1 lg:row-start-1" data-testid="relief-list">
        {items.map((it, i) => (
          <ReliefRow key={it.id} item={it} index={i} done={done.includes(it.id)} onToggle={(on) => toggle(it.id, on)} />
        ))}
      </ol>
      {/* phones: the download comes after the checklist */}
      <div className="lg:hidden">
        <HomePlanDownload state={state} />
      </div>
    </div>
  );
}

function ReliefRow({ item, index, done, onToggle }: { item: ReliefItem; index: number; done: boolean; onToggle: (on: boolean) => void }) {
  const { t } = useLang();
  const id = `relief-${item.id}`;
  const host = item.link.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  const tag = item.likelihood === 'likely' ? 'text-pine' : item.likelihood === 'maybe' ? 'text-ink-2' : 'text-ink-2';
  return (
    <motion.li initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur.medium, ease: ease.out, delay: Math.min(index, 5) * stagger }} className="p-5" data-testid={`relief-item-${item.id}`} data-done={done || undefined}>
      <div className="flex items-start gap-4">
        <input id={id} type="checkbox" className="peer sr-only" checked={done} onChange={(e) => onToggle(e.target.checked)} data-testid={`relief-check-${item.id}`} />
        <label htmlFor={id} className="hit mt-[1px] cursor-pointer rounded-[6px] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-pine">
          <CheckMark checked={done} />
          <span className="sr-only">{t('keepRelief.markDone', { name: item.name })}</span>
        </label>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <label htmlFor={id} className={`cursor-pointer text-[16px] font-medium leading-[22px] transition-colors duration-[120ms] ${done ? 'text-ink-2' : 'text-ink'}`}>
              {item.name}
            </label>
            <span className={`text-[13px] font-medium ${done ? 'text-pine' : tag}`}>{done ? t('keepRelief.done') : t(`keepRelief.likelihood.${item.likelihood}`)}</span>
          </div>
          <p className="mt-1.5 text-[15px] leading-[22px] text-ink-2">{item.why}</p>
          <dl className="mt-3 grid gap-2 text-[15px] leading-[22px] sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-x-3">
            <dt className="text-[13px] font-medium leading-[22px] text-ink-2">{t('keepRelief.worth')}</dt>
            <dd className="tnum -mt-2 text-ink sm:mt-0">{item.worth}</dd>
            <dt className="text-[13px] font-medium leading-[22px] text-ink-2">{t('keepRelief.nextStep')}</dt>
            <dd className="-mt-2 text-ink sm:mt-0">{item.nextStep}</dd>
          </dl>
          <a href={item.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-medium text-pine underline-offset-4 hover:underline">
            {t('keepRelief.open', { site: host })}
            <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
            <span className="sr-only">{t('keepRelief.newTab')}</span>
          </a>
        </div>
      </div>
    </motion.li>
  );
}
