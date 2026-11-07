'use client';
import { useLang } from '@/lib/i18n';
import { DEBT_KINDS, type Draft } from '@/lib/draft';
import { Field } from '@/components/ui/Field';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Stepper } from '@/components/ui/Stepper';
import { Segmented } from '@/components/ui/Segmented';
import { Checkbox } from '@/components/ui/Checkbox';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { AnimatePresence, motion } from 'motion/react';
import { spring, exit as exitT } from '@/lib/motion';
import type { CreditBand } from '@/lib/types';
import { useMemo, type ReactNode } from 'react';
import { HouseholdArt } from '@/components/illustrations/intake/HouseholdArt';
import { OCOutline } from '@/components/illustrations/intake/OCOutline';
import { CoinStack } from '@/components/illustrations/intake/CoinStack';
import { RentShare } from '@/components/illustrations/intake/RentShare';
import { FloorPlan } from '@/components/illustrations/intake/FloorPlan';
import { DebtScale } from '@/components/illustrations/intake/DebtScale';
import { CreditGauge } from '@/components/illustrations/intake/CreditGauge';

export type ScreenProps = {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
  showErrors: boolean;
  /** Field names recently filled by voice or scan, with a flash key. */
  flash: Record<string, number>;
  /** Slot for the title action (mic button). */
  titleAction?: ReactNode;
  /** Slot for the upload card. */
  extra?: ReactNode;
};

export function ScreenTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-x-4">
      <h1 tabIndex={-1} data-screen-title className="t-title min-w-0 flex-1 overflow-hidden pb-[0.08em] text-ink focus:outline-none focus-visible:outline-none">
        {/* the question rises from a mask (same language as the landing headline, shorter) */}
        <span className="mask-rise block">{children}</span>
      </h1>
      {action}
    </div>
  );
}

const money = (n: number, lang: string) => new Intl.NumberFormat(lang === 'es' ? 'es-US' : 'en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

function InlineNote({ show, text }: { show: boolean; text: string }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0, transition: exitT }}
          transition={spring.smooth}
          className="overflow-hidden"
        >
          <span className="mt-3 block border-l-2 border-signal-amber pl-3 text-[15px] leading-[22px] text-signal-amber">{text}</span>
        </motion.p>
      )}
    </AnimatePresence>
  );
}

function YesNo({ id, label, value, onChange, art }: { id: string; label: string; value: boolean | null; onChange: (v: boolean) => void; art?: ReactNode }) {
  const { t } = useLang();
  const control = (
    <Segmented<'yes' | 'no'>
      label={label}
      value={value === null ? undefined : value ? 'yes' : 'no'}
      onChange={(v) => onChange(v === 'yes')}
      options={[
        { value: 'yes', label: t('flow.household.yes') },
        { value: 'no', label: t('flow.household.no') },
      ]}
    />
  );
  return (
    <div>
      <p id={id} className="mb-2 text-[15px] font-medium text-ink">
        {label}
      </p>
      {art ? (
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">{control}</div>
          {art}
        </div>
      ) : (
        control
      )}
    </div>
  );
}

/** "$62,400 a year": the amount rolls as the monthly figure is typed; screen readers get the settled text. */
function PerYear({ annual }: { annual: number }) {
  const { t, lang } = useLang();
  if (!(annual > 0)) return <span />;
  const [pre, post] = t('flow.income.perYear', { amount: '\u0000' }).split('\u0000');
  return (
    <span className="tnum text-[15px] text-ink-2">
      <span aria-hidden>
        {pre}
        <AnimatedNumber value={annual} format={(n) => money(Math.round(n), lang)} />
        {post}
      </span>
      <span className="sr-only" aria-live="polite">
        {t('flow.income.perYear', { amount: money(annual, lang) })}
      </span>
    </span>
  );
}

export function HouseholdScreen({ draft, update, titleAction, flash }: ScreenProps) {
  const { t } = useLang();
  // The yes/no questions only re-render when their own answer changes: a stepper tap must not make the
  // segmented highlights (Motion layoutId) re-measure the page.
  const { inOC, residentOrCitizen } = draft;
  const ocFlash = flash.inOC;
  const resFlash = flash.residentOrCitizen;
  const ocBlock = useMemo(
    () => (
      <div className={ocFlash ? 'just-filled rounded-[8px]' : ''} key={`oc-${ocFlash}`}>
        <YesNo id="inOC" label={t('flow.household.inOC')} value={inOC} onChange={(v) => update({ inOC: v })} art={<OCOutline value={inOC} />} />
        <InlineNote show={inOC === false} text={t('flow.inlineReq')} />
      </div>
    ),
    [inOC, ocFlash, t, update],
  );
  const residentBlock = useMemo(
    () => (
      <div className={resFlash ? 'just-filled rounded-[8px]' : ''} key={`res-${resFlash}`}>
        <YesNo id="resident" label={t('flow.household.resident')} value={residentOrCitizen} onChange={(v) => update({ residentOrCitizen: v })} />
        <InlineNote show={residentOrCitizen === false} text={t('flow.inlineReq')} />
      </div>
    ),
    [residentOrCitizen, resFlash, t, update],
  );
  return (
    <>
      <ScreenTitle action={titleAction}>{t('flow.household.title')}</ScreenTitle>
      <div className="flex flex-col gap-8">
        <Field id="householdSize" label={t('flow.household.size')} help={t('flow.household.sizeHelp')}>
          {/* the family in front of the house stands beside the stepper, rising into the label's empty right side */}
          <div className="relative">
            <Stepper
              id="householdSize"
              value={draft.householdSize}
              min={1}
              max={8}
              flash={flash.householdSize}
              decLabel={t('flow.household.decrease')}
              incLabel={t('flow.household.increase')}
              onChange={(n) => update({ householdSize: n, occupants: Math.max(draft.occupants, n) })}
            />
            <HouseholdArt count={draft.householdSize} className="!absolute bottom-0 right-0" />
          </div>
        </Field>
        {ocBlock}
        {residentBlock}
      </div>
    </>
  );
}

export function IncomeScreen({ draft, update, showErrors, titleAction, flash, extra }: ScreenProps) {
  const { t } = useLang();
  const err = showErrors && !draft.grossMonthlyIncome ? t('flow.income.required') : null;
  const monthly = (draft.grossMonthlyIncome ?? 0) + (draft.otherIncomeOn ? draft.otherMonthlyIncome ?? 0 : 0);
  return (
    <>
      <ScreenTitle action={titleAction}>{t('flow.income.title')}</ScreenTitle>
      <div className="flex flex-col gap-4">
        <Field id="gross" label={t('flow.income.gross')} help={t('flow.income.grossHelp')} error={err}>
          {/* coins stack up beside the field as income grows (rising into the label's empty right side) */}
          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <CurrencyInput id="gross" value={draft.grossMonthlyIncome} flash={flash.grossMonthlyIncome} invalid={!!err} describedBy="gross-help gross-error" onChange={(v) => update({ grossMonthlyIncome: v, incomeSource: undefined })} />
            </div>
            <CoinStack monthly={monthly} />
          </div>
          <div className="mt-2 flex min-h-[26px] items-center justify-between gap-2">
            <PerYear annual={monthly * 12} />
            <AnimatePresence initial={false}>
              {draft.incomeSource === 'paystub' && (
                <motion.span
                  key="from-paystub"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, transition: exitT }}
                  transition={spring.snappy}
                  className="t-helper inline-flex items-center gap-1 rounded-[6px] bg-pine-soft px-2 py-1 text-pine"
                  data-testid="from-paystub"
                >
                  {t('flow.income.fromStub')} ·
                  <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => document.getElementById('gross')?.focus()}>
                    {t('flow.income.edit')}
                  </button>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </Field>
        <Checkbox id="otherOn" checked={draft.otherIncomeOn} onChange={(v) => update({ otherIncomeOn: v })} label={t('flow.income.addOther')} help={t('flow.income.otherHelp')} />
        <AnimatePresence initial={false}>
          {draft.otherIncomeOn && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0, transition: exitT }} transition={spring.smooth} className="overflow-hidden px-[2px]">
              <div className="pt-2">
                <Field id="other" label={t('flow.income.other')}>
                  <CurrencyInput id="other" value={draft.otherMonthlyIncome} flash={flash.otherMonthlyIncome} onChange={(v) => update({ otherMonthlyIncome: v })} />
                </Field>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {extra}
      </div>
    </>
  );
}

export function HousingScreen({ draft, update, showErrors, titleAction, flash }: ScreenProps) {
  const { t } = useLang();
  const err = showErrors && draft.rent === null ? t('flow.housing.required') : null;
  const income = (draft.grossMonthlyIncome ?? 0) + (draft.otherIncomeOn ? draft.otherMonthlyIncome ?? 0 : 0);
  // Each block re-renders only when its own value changes, so a stepper tap touches just that stepper and the plan.
  const { rent, bedrooms, occupants, unsafeConditions } = draft;
  const rentBlock = useMemo(
    () => (
      <Field id="rent" label={t('flow.housing.rent')} help={t('flow.housing.rentHelp')} error={err}>
        <CurrencyInput id="rent" value={rent} flash={flash.rent} invalid={!!err} describedBy="rent-help rent-error" onChange={(v) => update({ rent: v })} />
        <RentShare rent={rent} income={income} />
      </Field>
    ),
    [rent, flash.rent, err, income, t, update],
  );
  const bedroomsBlock = useMemo(
    () => (
      <Field id="bedrooms" label={t('flow.housing.bedrooms')}>
        <Stepper id="bedrooms" value={bedrooms} min={0} max={8} flash={flash.bedrooms} decLabel={t('flow.housing.fewerBedrooms')} incLabel={t('flow.housing.moreBedrooms')} onChange={(n) => update({ bedrooms: n })} />
      </Field>
    ),
    [bedrooms, flash.bedrooms, t, update],
  );
  const occupantsBlock = useMemo(
    () => (
      <Field id="occupants" label={t('flow.housing.occupants')}>
        <Stepper id="occupants" value={occupants} min={1} max={16} flash={flash.occupants} decLabel={t('flow.housing.fewerPeople')} incLabel={t('flow.housing.morePeople')} onChange={(n) => update({ occupants: n })} />
      </Field>
    ),
    [occupants, flash.occupants, t, update],
  );
  const unsafeBlock = useMemo(
    () => <Checkbox id="unsafe" checked={unsafeConditions} onChange={(v) => update({ unsafeConditions: v })} label={t('flow.housing.unsafe')} help={t('flow.housing.unsafeHelp')} />,
    [unsafeConditions, t, update],
  );
  return (
    <>
      <ScreenTitle action={titleAction}>{t('flow.housing.title')}</ScreenTitle>
      <div className="flex flex-col gap-6">
        {rentBlock}
        <div className="grid grid-cols-2 gap-4">
          {bedroomsBlock}
          {occupantsBlock}
        </div>
        <div className="-mt-4">
          <FloorPlan bedrooms={bedrooms} occupants={occupants} />
        </div>
        {unsafeBlock}
      </div>
    </>
  );
}

export function MoneyScreen({ draft, update, showErrors, titleAction, flash, extra }: ScreenProps) {
  const { t } = useLang();
  const savingsErr = showErrors && draft.savings === null ? t('flow.money.savingsRequired') : null;
  const creditErr = showErrors && !draft.creditBand ? t('flow.money.creditRequired') : null;
  const setDebt = (kind: (typeof DEBT_KINDS)[number], part: 'payment' | 'balance', v: number | null) =>
    update({ debts: { ...draft.debts, [kind]: { ...draft.debts[kind], [part]: v } } });
  return (
    <>
      <ScreenTitle action={titleAction}>{t('flow.money.title')}</ScreenTitle>
      <section aria-labelledby="debts-title">
        <h2 id="debts-title" className="t-section text-ink">
          {t('flow.money.debtsTitle')}
        </h2>
        <p className="t-helper mt-1 text-ink-2">{t('flow.money.debtsHelp')}</p>
        <div className="mt-4 divide-y divide-line rounded-[14px] border border-line bg-surface">
          {DEBT_KINDS.map((kind) => (
            <div key={kind} className="p-4">
              <p className="mb-3 text-[15px] font-medium text-ink">{t(`flow.debt.${kind}`)}</p>
              {kind === 'collection' ? (
                <>
                  <CurrencyInput id={`debt-${kind}-balance`} aria-label={`${t('flow.debt.collection')}: ${t('flow.money.balance')}`} value={draft.debts.collection.balance} flash={flash[`debt-${kind}`]} onChange={(v) => setDebt(kind, 'balance', v)} describedBy="collection-help" />
                  <p id="collection-help" className="t-helper mt-2 text-ink-2">
                    {t('flow.money.collectionHelp')}
                  </p>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="t-helper mb-1 block text-ink-2">{t('flow.money.payment')}</span>
                    <CurrencyInput id={`debt-${kind}-payment`} aria-label={`${t(`flow.debt.${kind}`)}: ${t('flow.money.payment')}`} value={draft.debts[kind].payment} flash={flash[`debt-${kind}`]} onChange={(v) => setDebt(kind, 'payment', v)} />
                  </label>
                  <label className="block">
                    <span className="t-helper mb-1 block text-ink-2">{t('flow.money.balance')}</span>
                    <CurrencyInput id={`debt-${kind}-balance`} aria-label={`${t(`flow.debt.${kind}`)}: ${t('flow.money.balance')}`} value={draft.debts[kind].balance} flash={flash[`debt-${kind}`]} onChange={(v) => setDebt(kind, 'balance', v)} />
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
      {/* what's owed against what's saved: tags drop onto the pans as values are entered */}
      <div className="mt-6 flex justify-center">
        <DebtScale debts={draft.debts} savings={draft.savings} />
      </div>
      <div className="mt-6 flex flex-col gap-6">
        <Field id="savings" label={t('flow.money.savings')} help={t('flow.money.savingsHelp')} error={savingsErr}>
          <CurrencyInput id="savings" value={draft.savings} flash={flash.savings} invalid={!!savingsErr} describedBy="savings-help savings-error" onChange={(v) => update({ savings: v })} />
        </Field>
        <div>
          <div className="mb-2 flex items-end justify-between gap-3">
            <p className="text-[15px] font-medium text-ink">{t('flow.money.credit')}</p>
            <CreditGauge value={draft.creditBand} />
          </div>
          <Segmented<CreditBand>
            label={t('flow.money.credit')}
            value={draft.creditBand ?? undefined}
            onChange={(v) => update({ creditBand: v })}
            options={(['good', 'building', 'needs_work', 'unknown'] as CreditBand[]).map((v) => ({ value: v, label: t(`flow.credit.${v}`) }))}
          />
          <p className="t-helper mt-2 text-ink-2">{t('flow.money.creditHelp')}</p>
          <p role={creditErr ? 'alert' : undefined} className="t-helper mt-1 min-h-[15px] text-signal-red">
            {creditErr ?? ''}
          </p>
        </div>
        {extra}
      </div>
    </>
  );
}

export function validate(step: number, d: Draft): boolean {
  if (step === 2) return !!d.grossMonthlyIncome && d.grossMonthlyIncome > 0;
  if (step === 3) return d.rent !== null;
  if (step === 4) return d.savings !== null && !!d.creditBand;
  return true;
}
