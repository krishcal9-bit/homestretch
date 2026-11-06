'use client';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { spring } from '@/lib/motion';
import { emptyDraft, type Draft } from '@/lib/draft';
import { useStored } from '@/lib/useStored';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Welcome } from './Welcome';
import { HouseholdScreen, HousingScreen, IncomeScreen, MoneyScreen, validate, type ScreenProps } from './Screens';
import { UploadCard } from './UploadCard';
import { money } from '@/lib/format';
import type { DebtKind, StatementFindings } from '@/lib/types';
import { ResultScreen } from '@/components/result/ResultScreen';
import { FamilyExtras } from '@/components/result/FamilyExtras';

const INTAKE_STEPS = 4;

export function Flow() {
  const { t, lang } = useLang();
  const [draft, setDraft, ready] = useStored<Draft>('hs.draft', emptyDraft());
  const [step, setStep] = useStored<number>('hs.step', 0);
  const [dir, setDir] = useState(1);
  const [showErrors, setShowErrors] = useState(false);
  const [flash, setFlash] = useState<Record<string, number>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const update = useCallback((patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch })), [setDraft]);
  /** Fill fields from voice or a scan, with a 600ms highlight on each. */
  const fill = useCallback(
    (patch: Partial<Draft>, keys: string[]) => {
      setDraft((d) => ({ ...d, ...patch }));
      const now = Date.now();
      setFlash((f) => ({ ...f, ...Object.fromEntries(keys.map((k) => [k, now])) }));
    },
    [setDraft],
  );

  const go = (to: number) => {
    setDir(to > step ? 1 : -1);
    setShowErrors(false);
    setStep(to);
    window.scrollTo({ top: 0 });
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

  if (!ready) return <div className="min-h-[60vh]" aria-busy />;

  const props: ScreenProps = { draft, update, showErrors, flash };
  const stubCard = (
    <UploadCard
      id="paystub"
      title={t('flow.income.scanTitle')}
      body={t('flow.income.scanBody')}
      button={t('flow.income.scanButton')}
      endpoint="/api/extract/paystub"
      onResult={(d) => {
        const monthly = Number(d.monthlyGross) || 0;
        fill({ grossMonthlyIncome: monthly, incomeSource: 'paystub' }, ['grossMonthlyIncome']);
        return t('upload.stubDone', { employer: String(d.employer ?? '—'), amount: money(monthly, lang) });
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
    1: <HouseholdScreen {...props} />,
    2: <IncomeScreen {...props} extra={stubCard} />,
    3: <HousingScreen {...props} />,
    4: <MoneyScreen {...props} extra={statementCard} />,
  };

  return (
    <div ref={containerRef}>
      {step >= 1 && step <= INTAKE_STEPS && (
        <div className="sticky top-14 z-20 -mx-5 bg-paper">
          <ProgressBar value={step / (INTAKE_STEPS + 1)} label={t('flow.progress', { n: step, total: INTAKE_STEPS })} />
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
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.div
          key={step}
          data-step={step}
          custom={dir}
          variants={{
            enter: (d: number) => ({ x: d * 24, opacity: 0 }),
            center: { x: 0, opacity: 1 },
            exit: (d: number) => ({ x: d * -24, opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={spring.smooth}
        >
          {step === 0 && <Welcome onStart={() => go(1)} />}
          {step >= 1 && step <= INTAKE_STEPS && (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                next();
              }}
              className="pb-8 pt-2"
            >
              {screens[step]}
              <div className="mt-10">
                <Button type="submit" size="lg" full>
                  {step === INTAKE_STEPS ? t('flow.seePath') : t('app.continue')}
                </Button>
              </div>
            </form>
          )}
          {step > INTAKE_STEPS && <ResultScreen draft={draft} setDraft={setDraft} onEdit={() => go(1)} Extras={FamilyExtras} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
