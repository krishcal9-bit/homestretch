'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { ChevronLeft, Pencil } from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/lib/i18n';
import { spring } from '@/lib/motion';
import { withViewTransition } from '@/lib/vt';
import { demoState, patchProfile, useKeep, type KeepState } from '@/lib/keepStore';
import type { HomeType, KeepProfile } from '@/lib/keep';
import { Button } from '@/components/ui/Button';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Segmented } from '@/components/ui/Segmented';
import { Stepper } from '@/components/ui/Stepper';
import { DocumentDrop } from './DocumentDrop';
import type { Lang } from '@/lib/types';

const STEPS = ['payment', 'home', 'money'] as const;
type Step = (typeof STEPS)[number];
type Errors = Partial<Record<keyof KeepProfile, string>>;

const monthLabel = (m: number, lang: Lang) => new Intl.DateTimeFormat(lang === 'es' ? 'es-US' : 'en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, m - 1, 1)));

function validate(step: Step, p: KeepProfile, t: (k: string, v?: Record<string, string | number>) => string): Errors {
  const e: Errors = {};
  const year = new Date().getFullYear();
  if (step === 'payment') {
    if (!(p.mortgage > 0)) e.mortgage = t('keep.setup.required');
    if (!(p.premium > 0)) e.premium = t('keep.setup.required');
    if (!(p.propertyTax > 0)) e.propertyTax = t('keep.setup.required');
  }
  if (step === 'home') {
    if (p.zip && !/^\d{5}$/.test(p.zip)) e.zip = t('keep.setup.zipError');
    if (!(p.yearBuilt >= 1900 && p.yearBuilt <= year)) e.yearBuilt = t('keep.setup.yearError', { year });
  }
  if (step === 'money') {
    if (!(p.takeHome > 0)) e.takeHome = t('keep.setup.required');
  }
  return e;
}

/** A field with an optional "From your document" tag and an edit control that focuses it. */
function KField({ id, field, help, error, children, fromDoc }: { id: string; field: keyof KeepProfile; help?: string; error?: string; children: ReactNode; fromDoc: boolean }) {
  const { t } = useLang();
  return (
    <div className="flex flex-col">
      <div className="mb-2 flex min-h-[24px] flex-wrap items-center gap-x-2 gap-y-1">
        <label htmlFor={id} className="text-[15px] font-medium leading-[20px] text-ink">
          {t(`keep.field.${field}`)}
        </label>
        {fromDoc && (
          <span className="inline-flex items-center gap-1" data-testid={`from-doc-${field}`}>
            <span className="rounded-[6px] bg-pine-soft px-2 py-0.5 text-[13px] font-medium leading-[18px] text-pine">{t('keep.setup.fromDoc')}</span>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById(id) as HTMLInputElement | null;
                el?.focus();
                el?.select?.();
              }}
              className="hit inline-flex h-[24px] items-center gap-1 rounded-[6px] px-1.5 text-[13px] font-medium text-ink-2 hover:text-pine"
              aria-label={t('keep.setup.editField', { field: t(`keep.field.${field}`) })}
            >
              <Pencil size={13} strokeWidth={1.75} aria-hidden />
              {t('keep.setup.edit')}
            </button>
          </span>
        )}
      </div>
      {children}
      {help && (
        <p id={`${id}-help`} className="t-helper mt-2 text-ink-2">
          {help}
        </p>
      )}
      <p id={`${id}-error`} role={error ? 'alert' : undefined} className="t-helper mt-1 min-h-[15px] text-signal-red">
        {error ?? ''}
      </p>
    </div>
  );
}

function Switch({ id, checked, onChange, label, help }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; help?: string }) {
  return (
    <div className="flex items-start gap-3 py-1">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={help ? `${id}-help` : undefined}
        onClick={() => onChange(!checked)}
        className={`relative mt-[1px] h-[28px] w-[46px] shrink-0 rounded-full border transition-colors duration-[120ms] before:absolute before:-inset-2 before:content-[''] ${checked ? 'border-pine bg-pine' : 'border-line-strong bg-line'}`}
      >
        <motion.span className="absolute left-[2px] top-[2px] h-[22px] w-[22px] rounded-full bg-knob" initial={false} animate={{ x: checked ? 18 : 0 }} transition={spring.snappy} aria-hidden />
      </button>
      <div>
        <label htmlFor={id} className="cursor-pointer text-[15px] font-medium leading-[22px] text-ink">
          {label}
        </label>
        {help && (
          <p id={`${id}-help`} className="t-helper mt-1 text-ink-2">
            {help}
          </p>
        )}
      </div>
    </div>
  );
}

/** K1: "My home, set up in 2 minutes": three short steps, a document drop, and a sample family. */
export function KeepSetup({ onDone }: { onDone?: () => void }) {
  const { t, lang } = useLang();
  const router = useRouter();
  const [state, update] = useKeep();
  const p = state.profile;
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const firstStep = useRef(true);
  // a field filled from a document gets the pine wash once
  const [flash, setFlash] = useState<Partial<Record<keyof KeepProfile, number>>>({});
  const seen = useRef(state.sources);
  useEffect(() => {
    const prev = seen.current;
    seen.current = state.sources;
    const now = Date.now();
    const keys = (Object.keys(state.sources) as (keyof KeepProfile)[]).filter((k) => state.sources[k] === 'document' && prev[k] !== 'document');
    if (keys.length) keys.forEach((k, i) => setTimeout(() => setFlash((f) => ({ ...f, [k]: now + i })), i * 80));
  }, [state.sources]);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    title.current?.focus();
  }, [step]);

  const cur = STEPS[step];
  const errors = showErrors ? validate(cur, p, t) : {};
  const set = (patch: Partial<KeepProfile>) => update((s) => patchProfile(s, patch, 'typed'));
  const doc = (k: keyof KeepProfile) => state.sources[k] === 'document';
  const money = (k: 'mortgage' | 'escrow' | 'premium' | 'propertyTax' | 'hoa' | 'income' | 'takeHome' | 'savings', help?: string) => (
    <KField id={`keep-${k}`} field={k} help={help} error={errors[k]} fromDoc={doc(k)}>
      <CurrencyInput
        id={`keep-${k}`}
        value={p[k] > 0 ? p[k] : null}
        onChange={(v) => set({ [k]: Math.max(0, v ?? 0) })}
        invalid={!!errors[k]}
        describedBy={`keep-${k}-error${help ? ` keep-${k}-help` : ''}`}
        flash={flash[k]}
      />
    </KField>
  );

  const finish = (next: (s: KeepState) => KeepState) => {
    const apply = () => {
      flushSync(() => update(next));
      onDone?.();
    };
    if (onDone) withViewTransition('forward', apply);
    else {
      update(next);
      router.push('/keep');
    }
  };

  const go = (to: number) => {
    if (to > step) {
      const e = validate(cur, p, t);
      if (Object.keys(e).length) {
        setShowErrors(true);
        const first = Object.keys(e)[0];
        document.getElementById(`keep-${first}`)?.focus();
        return;
      }
    }
    setShowErrors(false);
    if (to >= STEPS.length) {
      finish((s) => ({ ...s, ready: true }));
      return;
    }
    withViewTransition(to > step ? 'forward' : 'back', () => flushSync(() => setStep(to)));
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="mx-auto max-w-[560px] px-5 pb-20 pt-6 sm:pt-10" data-testid="keep-setup">
      <h1 className="t-title text-ink">{t('keep.setup.title')}</h1>
      <p className="mt-2 text-[16px] leading-[24px] text-ink-2">{t('keep.setup.lede')}</p>

      {step === 0 && (
        <div className="mt-6 flex flex-col gap-3 rounded-[14px] border border-line bg-pine-soft/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[15px] font-medium leading-[22px] text-ink">{t('keep.setup.sampleTitle')}</p>
            <p className="text-[15px] leading-[22px] text-ink-2">{t('keep.setup.sampleDetail')}</p>
          </div>
          <Button variant="secondary" className="shrink-0" onClick={() => finish(() => demoState())} data-testid="keep-try-sample">
            {t('keep.setup.sampleButton')}
          </Button>
        </div>
      )}

      <div className="mt-8 flex items-center gap-3" aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s} className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-line">
            <motion.span className="absolute inset-0 origin-left bg-pine" initial={false} animate={{ scaleX: i <= step ? 1 : 0 }} transition={spring.smooth} />
          </span>
        ))}
      </div>
      <p className="t-helper mt-2 text-ink-2">{t('keep.setup.stepOf', { n: step + 1, total: STEPS.length })}</p>

      <form
        className="vt-flow mt-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          go(step + 1);
        }}
        data-step={cur}
      >
        <h2 ref={title} tabIndex={-1} data-screen-title className="t-section text-ink">
          {t(`keep.setup.step.${cur}`)}
        </h2>
        <p className="mt-1 text-[15px] leading-[22px] text-ink-2">{t(`keep.setup.stepLede.${cur}`)}</p>

        {cur === 'payment' && (
          <div className="mt-5 flex flex-col gap-3">
            <DocumentDrop />
            <div className="mt-3 flex flex-col gap-2">
              {money('mortgage', t('keep.setup.help.mortgage'))}
              {money('escrow', t('keep.setup.help.escrow'))}
              <KField id="keep-insurer" field="insurer" fromDoc={doc('insurer')}>
                <input
                  id="keep-insurer"
                  className="field"
                  autoComplete="off"
                  placeholder={t('keep.setup.insurerPlaceholder')}
                  value={p.insurer}
                  onChange={(e) => {
                    const v = e.target.value;
                    set(/fair\s*plan/i.test(v) && !p.fairPlan ? { insurer: v, fairPlan: true } : { insurer: v });
                  }}
                />
              </KField>
              {money('premium', t('keep.setup.help.premium'))}
              <div className="-mt-1 mb-4" data-testid="fair-toggle">
                <Switch id="keep-fair" checked={p.fairPlan} onChange={(v) => set({ fairPlan: v })} label={t('keep.setup.fairPlan')} help={t('keep.setup.fairPlanHelp')} />
                {doc('fairPlan') && <p className="ml-[58px] mt-1 text-[13px] font-medium text-pine">{t('keep.setup.fromDoc')}</p>}
              </div>
              <KField id="keep-renewalMonth" field="renewalMonth" fromDoc={doc('renewalMonth')}>
                <select id="keep-renewalMonth" className="field" value={p.renewalMonth} onChange={(e) => set({ renewalMonth: Number(e.target.value) })}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {monthLabel(i + 1, lang)}
                    </option>
                  ))}
                </select>
              </KField>
              {money('propertyTax', t('keep.setup.help.propertyTax'))}
              {money('hoa', t('keep.setup.help.hoa'))}
            </div>
          </div>
        )}

        {cur === 'home' && (
          <div className="mt-5 flex flex-col gap-2">
            <KField id="keep-homeType" field="homeType" fromDoc={false}>
              <div id="keep-homeType">
                <Segmented<HomeType>
                  label={t('keep.field.homeType')}
                  value={p.homeType}
                  onChange={(v) => set({ homeType: v })}
                  options={(['single', 'townhome', 'condo'] as HomeType[]).map((v) => ({ value: v, label: t(`keep.homeType.${v}`) }))}
                />
              </div>
            </KField>
            <KField id="keep-yearBuilt" field="yearBuilt" error={errors.yearBuilt} fromDoc={false}>
              <input
                id="keep-yearBuilt"
                className={`field tnum ${errors.yearBuilt ? 'border-signal-red' : ''}`}
                inputMode="numeric"
                autoComplete="off"
                value={p.yearBuilt || ''}
                aria-invalid={!!errors.yearBuilt || undefined}
                aria-describedby="keep-yearBuilt-error"
                onChange={(e) => set({ yearBuilt: Number(e.target.value.replace(/\D/g, '').slice(0, 4)) || 0 })}
              />
            </KField>
            <KField id="keep-zip" field="zip" error={errors.zip} fromDoc={false}>
              <input
                id="keep-zip"
                className={`field tnum ${errors.zip ? 'border-signal-red' : ''}`}
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="92701"
                value={p.zip}
                aria-invalid={!!errors.zip || undefined}
                aria-describedby="keep-zip-error"
                onChange={(e) => set({ zip: e.target.value.replace(/\D/g, '').slice(0, 5) })}
              />
            </KField>
            <KField id="keep-householdSize" field="householdSize" fromDoc={false}>
              <Stepper id="keep-householdSize" value={p.householdSize} min={1} max={12} onChange={(n) => set({ householdSize: n })} decLabel={t('keep.setup.fewer')} incLabel={t('keep.setup.more')} />
            </KField>
          </div>
        )}

        {cur === 'money' && (
          <div className="mt-5 flex flex-col gap-2">
            {money('takeHome', t('keep.setup.help.takeHome'))}
            {money('income', t('keep.setup.help.income'))}
            {money('savings', t('keep.setup.help.savings'))}
          </div>
        )}

        <div className="mt-6 flex items-center gap-3">
          {step > 0 && (
            <Button type="button" variant="secondary" onClick={() => go(step - 1)} aria-label={t('keep.setup.back')}>
              <ChevronLeft size={18} strokeWidth={1.75} aria-hidden />
              {t('keep.setup.back')}
            </Button>
          )}
          <Button type="submit" size="lg" className="flex-1" data-testid="keep-continue">
            {step === STEPS.length - 1 ? t('keep.setup.finish') : t('keep.setup.continue')}
          </Button>
        </div>
      </form>
      <p className="t-helper mt-6 text-ink-2">{t('keep.setup.privacy')}</p>
    </div>
  );
}
