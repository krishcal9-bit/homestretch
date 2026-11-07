'use client';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { spring, exit as exitT } from '@/lib/motion';
import { emptyDraft, type Draft } from '@/lib/draft';
import { useStored } from '@/lib/useStored';
import { Button } from '@/components/ui/Button';
import { ProgressRoad } from '@/components/ui/ProgressRoad';
import { Skyline } from '@/components/ui/Skyline';
import { flushSync } from 'react-dom';
import { useVTRouter, vtSupported, withViewTransition } from '@/lib/vt';
import { computeReadiness } from '@/lib/engine';
import { draftToProfile } from '@/lib/draft';
import { Road } from '@/components/result/Road';
import { ease } from '@/lib/motion';
import { HouseholdScreen, HousingScreen, IncomeScreen, MoneyScreen, validate, type ScreenProps } from './Screens';
import { UploadCard } from './UploadCard';
import { VoiceControl } from './Voice';
import type { SpeechFields } from '@/lib/speech';
import { money } from '@/lib/format';
import type { DebtKind, StatementFindings } from '@/lib/types';
import { ResultScreen } from '@/components/result/ResultScreen';
import { FamilyExtras } from '@/components/result/FamilyExtras';

const INTAKE_STEPS = 4;

export function Flow() {
  const { t, lang } = useLang();
  const [draft, setDraft, ready] = useStored<Draft>('hs.draft', emptyDraft());
  const [rawStep, setStep] = useStored<number>('hs.step', 1);
  const step = Math.max(1, rawStep); // the landing page lives at / now
  const vtRouter = useVTRouter();
  // View Transitions where supported (and motion allowed); Motion AnimatePresence otherwise.
  const [useVT, setUseVT] = useState(false);
  useEffect(() => setUseVT(vtSupported()), []);
  const [dir, setDir] = useState(1);
  const [showErrors, setShowErrors] = useState(false);
  const [flash, setFlash] = useState<Record<string, number>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const firstPaint = useRef(true);
  useEffect(() => {
    if (ready) firstPaint.current = false;
  });

  const update = useCallback((patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch })), [setDraft]);
  /** Fill fields from voice or a scan, with a 600ms highlight on each. */
  const fill = useCallback(
    (patch: Partial<Draft>, keys: string[]) => {
      setDraft((d) => ({ ...d, ...patch }));
      const now = Date.now();
      // Each filled field gets its wash one after another (80ms apart), so the form visibly fills itself in.
      keys.forEach((k, i) => setTimeout(() => setFlash((f) => ({ ...f, [k]: now + i })), i * 80));
    },
    [setDraft],
  );

  const go = (to: number) => {
    if (to < 1) {
      vtRouter.push('/', 'back');
      return;
    }
    const kind = to < step ? 'back' : to > INTAKE_STEPS ? 'result' : 'forward';
    const apply = () => {
      setDir(to > step ? 1 : -1);
      setShowErrors(false);
      setStep(to);
      window.scrollTo({ top: 0 });
    };
    if (useVT) withViewTransition(kind, () => flushSync(apply));
    else apply();
  };
  const next = () => {
    if (!validate(step, draft)) {
      setShowErrors(true);
      requestAnimationFrame(() => (containerRef.current?.querySelector('[aria-invalid="true"], [role="alert"]:not(:empty)') as HTMLElement | null)?.focus?.());
      return;
    }
    go(step + 1);
  };

  // Move focus to the new screen's title for keyboard and screen-reader users.
  useEffect(() => {
    if (step === 0) return;
    const id = requestAnimationFrame(() => (containerRef.current?.querySelector(`[data-step="${step}"] [data-screen-title]`) as HTMLElement | null)?.focus());
    return () => cancelAnimationFrame(id);
  }, [step]);

  // Stable pieces, so a tap on a stepper re-renders only what changed (4× CPU throttle budget: no frame > 34ms).
  const speechRef = useRef<(f: SpeechFields) => number>(() => 0);
  const onSpeech = useCallback((f: SpeechFields) => speechRef.current(f), []);
  const skyline = useMemo(() => <Skyline mode="static" count={10} height={64} className="-mx-5 mt-6 opacity-40" />, []);
  const submit = useMemo(
    () => (
      <Button type="submit" size="lg" full>
        {step === INTAKE_STEPS ? t('flow.seePath') : t('app.continue')}
      </Button>
    ),
    [step, t],
  );

  if (!ready) return <div className="min-h-[60vh]" aria-busy />;

  /** D3: apply spoken fields to the draft (any screen), highlight each filled field. Returns how many. */
  const applySpeech = (f: SpeechFields): number => {
    const patch: Partial<Draft> = {};
    const keys: string[] = [];
    const set = <K extends keyof Draft>(k: K, v: Draft[K], flashKey: string = k) => {
      patch[k] = v;
      keys.push(flashKey);
    };
    if (f.householdSize !== undefined) set('householdSize', f.householdSize);
    if (f.inOC !== undefined) set('inOC', f.inOC);
    if (f.residentOrCitizen !== undefined) set('residentOrCitizen', f.residentOrCitizen);
    if (f.grossMonthlyIncome !== undefined) set('grossMonthlyIncome', f.grossMonthlyIncome);
    if (f.otherMonthlyIncome !== undefined) {
      set('otherMonthlyIncome', f.otherMonthlyIncome);
      patch.otherIncomeOn = true;
    }
    if (f.rent !== undefined) set('rent', f.rent);
    if (f.bedrooms !== undefined) set('bedrooms', f.bedrooms);
    if (f.occupants !== undefined) set('occupants', f.occupants);
    else if (f.householdSize !== undefined) patch.occupants = Math.max(draft.occupants, f.householdSize);
    if (f.unsafeConditions !== undefined) set('unsafeConditions', f.unsafeConditions);
    if (f.savings !== undefined) set('savings', f.savings);
    if (f.creditBand !== undefined) set('creditBand', f.creditBand);
    const debts = { ...draft.debts };
    let debtTouched = false;
    const debt = (kind: keyof Draft['debts'], part: 'payment' | 'balance', v?: number) => {
      if (v === undefined) return;
      debts[kind] = { ...debts[kind], [part]: v };
      keys.push(`debt-${kind}`);
      debtTouched = true;
    };
    debt('car', 'payment', f.carPayment);
    debt('card', 'payment', f.cardPayment);
    debt('student', 'payment', f.studentPayment);
    debt('collection', 'balance', f.collectionBalance);
    if (debtTouched) patch.debts = debts;
    fill(patch, keys);
    return keys.length;
  };
  speechRef.current = applySpeech;
  const mic = (screen: 'household' | 'income' | 'housing' | 'money') => <VoiceControl key={`${screen}-${lang}`} screen={screen} onFields={onSpeech} />;
  const props: ScreenProps = { draft, update, showErrors, flash };
  const stubCard = (
    <UploadCard
      id="paystub"
      title={t('flow.income.scanTitle')}
      body={t('flow.income.scanBody')}
      button={t('flow.income.scanButton')}
      endpoint="/api/extract/paystub"
      art="paystub"
      onResult={(d) => {
        const monthly = Number(d.monthlyGross) || 0;
        // The amount flies from the scanned stub into the field; the form fills when it lands.
        return {
          message: t('upload.stubDone', { employer: String(d.employer ?? '—'), amount: money(monthly, lang) }),
          fly: { text: money(monthly, lang), to: 'gross', land: () => fill({ grossMonthlyIncome: monthly, incomeSource: 'paystub' }, ['grossMonthlyIncome']) },
        };
      }}
    />
  );
  const statementCard = (
    <UploadCard
      id="statement"
      title={t('flow.money.statementTitle')}
      body={t('flow.money.statementBody')}
      button={t('flow.money.statementButton')}
      endpoint="/api/extract/statement"
      onResult={(d) => {
        const s = d as unknown as StatementFindings;
        const debts = { ...draft.debts };
        const keys: string[] = [];
        // Pre-fill monthly payments for debts the family left blank.
        for (const r of s.recurringDebts) {
          const kind = (r.kind ?? 'other') as DebtKind;
          if (kind === 'collection') continue;
          if (debts[kind].payment === null) {
            debts[kind] = { ...debts[kind], payment: Math.round(r.amount) };
            keys.push(`debt-${kind}`);
          } else if (kind === 'other') {
            debts.other = { ...debts.other, payment: (debts.other.payment ?? 0) + Math.round(r.amount) };
            keys.push('debt-other');
          }
        }
        fill({ debts, statement: s }, keys);
        return t('upload.statementDone', { debts: s.recurringDebts.length, fees: s.overdraftOrNsfCount });
      }}
    />
  );
  const screens: Record<number, React.ReactNode> = {
    1: <HouseholdScreen {...props} titleAction={mic('household')} />,
    2: <IncomeScreen {...props} extra={stubCard} titleAction={mic('income')} />,
    3: <HousingScreen {...props} titleAction={mic('housing')} />,
    4: <MoneyScreen {...props} extra={statementCard} titleAction={mic('money')} />,
  };

  return (
    <div ref={containerRef}>
      {step >= 1 && step <= INTAKE_STEPS && (
        <div className="sticky top-16 z-20 -mx-5 bg-paper pt-2">
          {/* The progress Road: lands from the landing CTA ("cta"); on the last step it grows into the result Road ("road"). */}
          <ProgressRoad value={step / INTAKE_STEPS} last={step === INTAKE_STEPS} vtName={step === INTAKE_STEPS ? 'road' : 'cta'} label={t('flow.progress', { n: step, total: INTAKE_STEPS })} />
        </div>
      )}
      {step >= 1 && (
        <div className="flex h-14 items-center justify-between">
          <button type="button" onClick={() => go(step - 1)} className="-ml-3 inline-flex min-h-[44px] items-center gap-1 rounded-[8px] px-3 text-[15px] font-medium text-pine transition-colors duration-[120ms] hover:bg-pine-soft">
            <ChevronLeft size={18} strokeWidth={1.75} className="-ml-1" aria-hidden />
            {t('app.back')}
          </button>
          {step <= INTAKE_STEPS && <span className="t-helper tnum text-ink-2">{t('flow.progress', { n: step, total: INTAKE_STEPS })}</span>}
        </div>
      )}
      {useVT ? (
        // View Transitions animate the swap; no AnimatePresence, so only one "flow" element ever exists.
        <div key={step} data-step={step} className="vt-flow">
          {step >= 1 && step <= INTAKE_STEPS && (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                next();
              }}
              className="pb-8 pt-2"
            >
              <div className="intake-screen">{screens[step]}</div>
              <div className="mt-10">{submit}</div>
            </form>
          )}
          {step > INTAKE_STEPS && <ResultScreen draft={draft} setDraft={setDraft} onEdit={() => go(1)} Extras={FamilyExtras} />}
        </div>
      ) : (
      <AnimatePresence mode="popLayout" custom={dir}>
        <motion.div
          key={step}
          data-step={step}
          custom={dir}
          variants={{
            enter: (d: number) => ({ x: d * 24, opacity: 0 }),
            center: { x: 0, opacity: 1 },
            exit: (d: number) => ({ x: d * -24, opacity: 0, transition: exitT }),
          }}
          initial={firstPaint.current ? false : 'enter'}
          animate="center"
          exit="exit"
          transition={{ duration: 0.28, ease: ease.out }}
        >
          {step >= 1 && step <= INTAKE_STEPS && (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                next();
              }}
              className="pb-8 pt-2"
            >
              <div className="intake-screen">{screens[step]}</div>
              <div className="mt-10">{submit}</div>
            </form>
          )}
          {step > INTAKE_STEPS && <ResultScreen draft={draft} setDraft={setDraft} onEdit={() => go(1)} Extras={FamilyExtras} />}
        </motion.div>
      </AnimatePresence>
      )}
      {step <= INTAKE_STEPS && skyline}
    </div>
  );
}
