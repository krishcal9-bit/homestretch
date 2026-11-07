'use client';
import { X } from 'lucide-react';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Road } from '@/components/result/Road';
import { Segmented } from '@/components/ui/Segmented';
import { money, monthName, pct } from '@/lib/format';
import { dur, spring, exitDrawer } from '@/lib/motion';
import { ORG_NAME, type ReferralOrg } from '@/lib/referral';
import type { FamilyRow } from '@/lib/staffData';
import { TIER_LABEL } from '@/lib/staffLogic';
import type { Lang } from '@/lib/types';
import { BuildArt } from './BuildArt';
import { FAMILY_BUILD } from './buildStage';

const SECTION_STAGGER = 0.03; // §4.1 #6: content staggers in at 30ms per section
const content: Variants = { hidden: {}, shown: { transition: { staggerChildren: SECTION_STAGGER } }, exit: { transition: { staggerChildren: SECTION_STAGGER, staggerDirection: -1 } } };
const section: Variants = { hidden: { opacity: 0, x: 16 }, shown: { opacity: 1, x: 0, transition: spring.smooth }, exit: { opacity: 0, x: 16, transition: spring.smooth } };

const CREDIT: Record<string, string> = { good: 'Good', building: 'Building', needs_work: 'Needs work', unknown: 'Unknown' };

export function FamilyDrawer({ family, onClose }: { family: FamilyRow | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!family) return;
    lastFocus.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      lastFocus.current?.focus?.();
    };
  }, [family, onClose]);

  return (
    <AnimatePresence>
      {family && (
        <div className="fixed inset-0 z-40" key="drawer-root">
          <motion.div
            className="absolute inset-0"
            style={{ background: 'rgba(24,36,32,0.2)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: exitDrawer }}
            transition={spring.smooth}
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
            data-testid="drawer"
            className="absolute inset-y-0 right-0 flex w-[600px] max-w-full flex-col border-l border-line bg-surface"
            style={{ boxShadow: '0 1px 3px rgba(24,36,32,0.06), 0 16px 48px rgba(24,36,32,0.14)' }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%', transition: exitDrawer }}
            transition={spring.smooth}
          >
            <DrawerBody family={family} onClose={onClose} closeRef={closeRef} />
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

function DrawerBody({ family: f, onClose, closeRef }: { family: FamilyRow; onClose: () => void; closeRef: React.RefObject<HTMLButtonElement | null> }) {
  const r = f.result;
  const gross = f.profile.grossMonthlyIncome + f.profile.otherMonthlyIncome + (f.profile.levers?.coApplicantIncome ?? 0);
  const minPayments = f.profile.debts.reduce((s, d) => s + d.minPayment, 0);
  const numbers: [string, string][] = [
    ['Gross monthly income', money(gross)],
    ['Rent', `${money(f.profile.rent)} · ${pct(r.costBurden)} of income`],
    ['Savings', money(f.profile.savings)],
    ['Down payment goal', money(r.downPaymentTarget)],
    ['Debt payments', `${money(minPayments)} · ${pct(r.dti)} DTI`],
    ['Max payment', money(r.maxPayment)],
    ['Financeable home', money(r.financeableHome)],
    ['Credit', CREDIT[f.profile.creditBand] + (f.profile.creditScore ? ` · ${f.profile.creditScore}` : '')],
  ];

  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
        <div>
          <h2 id="drawer-title" className="t-section">
            {f.surname} family
          </h2>
          <p className="text-[13px] leading-[20px] text-ink-2">
            {f.givenName} · {f.city} · {f.language === 'es' ? 'Spanish' : 'English'} · <span className="tnum">{f.householdSize}</span> {f.householdSize === 1 ? 'person' : 'people'} ·{' '}
            <span className="tnum">{f.code}</span>
          </p>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-[8px] text-ink-2 hover:bg-paper hover:text-ink">
          <X size={18} strokeWidth={1.75} />
        </button>
      </div>
      <motion.div className="flex-1 overflow-y-auto px-6 pb-10" variants={content} initial="hidden" animate="shown" exit="exit">
        <motion.section variants={section} className="flex items-center gap-5 pt-5">
          {/* The family's house, as far along as their readiness (ready now: finished, window lit). Static. */}
          <div className="shrink-0" aria-hidden data-testid="drawer-house" data-stage={FAMILY_BUILD[f.stage]}>
            <BuildArt stage={FAMILY_BUILD[f.stage]} size={72} lit={f.stage === 'ready_now'} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-ink-2">{r.monthsToReady === 0 ? 'Mortgage-ready now' : 'Projected mortgage-ready'}</p>
            <div className="flex items-baseline justify-between gap-4">
              <p className="t-title tnum text-brass" data-testid="drawer-ready-date">
                {monthName(r.readyDate)}
              </p>
              <p className="tnum text-[13px] text-ink-2" title="Readiness score, staff only">
                Score {r.score}
              </p>
            </div>
            <p className="text-[13px] text-ink-2">
              {TIER_LABEL[r.tier]} income tier{r.monthsToReady > 0 ? ` · ${r.monthsToReady} months away` : ''}
            </p>
          </div>
        </motion.section>

        <motion.section variants={section} className="mt-4">
          {/* Draws on every open, quickly (300ms): staff open many drawers a day. Starts as the panel settles. */}
          <Road key={f.code} result={r} entrance="always" drawDuration={dur.short * 1.5} entranceDelay={dur.micro} />
        </motion.section>

        {!f.eligible && (
          <motion.section variants={section} className="mt-6">
            <h3 className="text-[15px] font-semibold">Why not eligible</h3>
            <ul className="mt-2 space-y-1">
              {r.eligible.reasons.map((x) => (
                <li key={x} className="border-l-2 border-signal-amber pl-3 text-[15px] text-signal-amber">
                  {x}
                </li>
              ))}
            </ul>
          </motion.section>
        )}

        <motion.section variants={section} className="mt-6">
          <h3 className="text-[15px] font-semibold">Blockers</h3>
          {r.blockers.length === 0 ? (
            <p className="mt-2 text-[15px] text-ink-2">None. This family meets every milestone today.</p>
          ) : (
            <ol className="mt-2 divide-y divide-line border-y border-line">
              {r.blockers.map((b) => (
                <li key={b.key} className={`py-2 pl-3 text-[15px] ${b.severity === 3 ? 'border-l-2 border-signal-red' : b.severity === 2 ? 'border-l-2 border-signal-amber' : 'border-l-2 border-transparent'}`}>
                  {b.text}
                </li>
              ))}
            </ol>
          )}
          {f.eligible && (
            <p className="mt-2 text-[13px] text-ink-2">Eligible on need, income ({TIER_LABEL[r.tier].toLowerCase()}) and residency.</p>
          )}
        </motion.section>

        <motion.section variants={section} className="mt-6">
          <h3 className="text-[15px] font-semibold">Key numbers</h3>
          <dl className="mt-2 grid grid-cols-2 border-t border-line">
            {numbers.map(([k, v]) => (
              <div key={k} className="border-b border-line py-2 pr-3">
                <dt className="text-[13px] text-ink-2">{k}</dt>
                <dd className="tnum text-[15px] font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </motion.section>

        <motion.section variants={section} className="mt-6">
          <h3 className="text-[15px] font-semibold">Checklist</h3>
          <p className="mt-1 text-[15px] text-ink-2">
            <span className="tnum font-medium text-ink">{f.checklistDone}</span>
            {f.checklistTotal ? (
              <>
                {' '}
                of <span className="tnum">{f.checklistTotal}</span> actions done
              </>
            ) : (
              <> {f.checklistDone === 1 ? 'action' : 'actions'} ticked off</>
            )}
            .
          </p>
          {f.checklistTotal ? (
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line" aria-hidden>
              <div className="h-full bg-pine" style={{ width: `${Math.min(100, (f.checklistDone / f.checklistTotal) * 100)}%` }} />
            </div>
          ) : null}
        </motion.section>

        <motion.section variants={section} className="mt-6">
          <ReferralPacket code={f.code} defaultLang={f.language} />
        </motion.section>
      </motion.div>
    </>
  );
}

function ReferralPacket({ code, defaultLang }: { code: string; defaultLang: Lang }) {
  const [org, setOrg] = useState<ReferralOrg>('sparkpoint');
  const [lang, setLang] = useState<Lang>(defaultLang);
  return (
    <div className="rounded-[14px] border border-line p-4">
      <h3 className="text-[15px] font-semibold">Referral packet</h3>
      <p className="mt-1 text-[13px] leading-[18px] text-ink-2">One page for the counselor: household summary, top three blockers, the engine timeline and what Habitat needs to see at the end.</p>
      <div className="mt-3 grid grid-cols-[1fr_180px] gap-3">
        <Segmented<ReferralOrg>
          size="sm"
          label="Counselor"
          value={org}
          onChange={setOrg}
          options={[
            { value: 'sparkpoint', label: ORG_NAME.sparkpoint },
            { value: 'hope', label: ORG_NAME.hope },
          ]}
        />
        <Segmented<Lang>
          size="sm"
          label="Packet language"
          value={lang}
          onChange={setLang}
          options={[
            { value: 'en', label: 'English' },
            { value: 'es', label: 'Spanish' },
          ]}
        />
        <a
          href={`/api/referral/${code}?org=${org}&lang=${lang}`}
          target="_blank"
          rel="noopener"
          data-testid="referral-link"
          className="col-span-2 inline-flex min-h-[44px] justify-center items-center rounded-[8px] border border-line px-4 text-[15px] font-medium text-ink hover:bg-paper"
        >
          Open packet
        </a>
      </div>
    </div>
  );
}
