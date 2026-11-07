'use client';
import { Check, Copy, X } from 'lucide-react';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { HOME_TYPE_LABEL, homeHealth, shieldMoves, shockSentence, usd, type HomeownerRow } from '@/lib/earlyWarning';
import { money } from '@/lib/format';
import { forecast, thisMonth } from '@/lib/forecast';
import { exitDrawer, reveal, spring } from '@/lib/motion';
import type { Lang } from '@/lib/types';
import { HomeownerForecast } from './HomeownerForecast';
import { RiskLevel } from './RiskLevel';

// Same drawer as the Ready pipeline's FamilyDrawer: slides in on spring.smooth, exits faster on the drawer curve,
// sections stagger in at 30ms. The only shadow in the product (--drawer-shadow).
const SECTION_STAGGER = 0.03;
const content: Variants = { hidden: {}, shown: { transition: { staggerChildren: SECTION_STAGGER } }, exit: { transition: { staggerChildren: SECTION_STAGGER, staggerDirection: -1 } } };
const section: Variants = { hidden: { opacity: 0, x: 16 }, shown: { opacity: 1, x: 0, transition: spring.smooth }, exit: { opacity: 0, x: 16, transition: spring.smooth } };

const REASON: Record<string, string> = {
  short: 'Breathing room drops below $0 within 6 months',
  tight: 'Breathing room runs tight within 6 months',
  shock: 'A coming rise cuts into a thin cushion',
  repair: 'A system due within a year that savings can’t cover',
  checkin: 'Missed the monthly check-in',
};

export function HomeownerDrawer({ row, today, onClose }: { row: HomeownerRow | null; today: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const open = !!row;
  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      lastFocus.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {row && (
        <div className="fixed inset-0 z-40" key="drawer-root">
          <motion.div className="absolute inset-0" style={{ background: 'var(--scrim)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: exitDrawer }} transition={spring.smooth} onClick={onClose} aria-hidden />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="ho-drawer-title"
            data-testid="homeowner-drawer"
            className="absolute inset-y-0 right-0 flex w-[640px] max-w-full flex-col border-l border-line bg-surface"
            style={{ boxShadow: 'var(--drawer-shadow)' }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%', transition: exitDrawer }}
            transition={spring.smooth}
          >
            <Body key={row.id} row={row} today={today} onClose={onClose} closeRef={closeRef} />
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

function Body({ row: r, today, onClose, closeRef }: { row: HomeownerRow; today: string; onClose: () => void; closeRef: React.RefObject<HTMLButtonElement | null> }) {
  const opts = useMemo(() => ({ start: thisMonth(new Date(today)) }), [today]);
  const f = useMemo(() => forecast(r.profile, opts), [r.profile, opts]);
  const moves = useMemo(() => shieldMoves(r, f), [r, f]);
  const health = useMemo(() => homeHealth(r.profile.systems), [r.profile.systems]);
  const doneCount = moves.filter((m) => m.done).length;

  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
        <div className="min-w-0">
          <h2 id="ho-drawer-title" className="t-section">
            {r.surname} family
          </h2>
          <p className="text-[13px] leading-[20px] text-ink-2">
            {r.givenName} · {r.address} · {HOME_TYPE_LABEL[r.homeType]} · {r.language === 'es' ? 'Spanish' : 'English'} · <span className="tnum">{r.householdSize}</span> people ·{' '}
            <span className="tnum">{r.code}</span>
          </p>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] text-ink-2 hover:bg-paper hover:text-ink">
          <X size={18} strokeWidth={1.75} />
        </button>
      </div>
      <motion.div className="flex-1 overflow-y-auto px-6 pb-10" variants={content} initial="hidden" animate="shown" exit="exit">
        <motion.section variants={section} className="pt-5">
          <div className="flex items-baseline justify-between gap-4">
            <RiskLevel level={r.risk.level} className="text-[16px]" />
            <p className="tnum text-[13px] text-ink-2">
              {r.insurer}
              {r.fairPlan ? ' · 29.1% renewal path' : ' · 15% renewal path'}
            </p>
          </div>
          <p className="mt-3 text-[20px] leading-[28px]">
            Breathing room <Money v={r.risk.now} /> now, <Money v={r.risk.in6} /> in 6 months.
          </p>
          <p className="mt-1 text-[15px] text-ink-2">{shockSentence(r.nextShock)}</p>
          {r.risk.reasons.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-2">
              {r.risk.reasons.map((x) => (
                <li key={x}>{REASON[x]}</li>
              ))}
            </ul>
          )}
        </motion.section>

        <motion.section variants={section} className="mt-6">
          <h3 className="text-[15px] font-semibold">Payment forecast</h3>
          <div className="mt-2">
            <HomeownerForecast profile={r.profile} options={opts} />
          </div>
        </motion.section>

        <motion.section variants={section} className="mt-6">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="text-[15px] font-semibold">Shock Shield moves</h3>
            <p className="tnum text-[13px] text-ink-2">
              {doneCount} of {moves.length} done
            </p>
          </div>
          <ul className="mt-2 divide-y divide-line border-y border-line" data-testid="shield-moves">
            {moves.map((m) => (
              <li key={m.key} className="flex gap-3 py-3" data-done={m.done}>
                <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${m.done ? 'border-pine bg-pine text-on-pine' : 'border-line-strong'}`} aria-hidden>
                  {m.done && <Check size={13} strokeWidth={2.5} />}
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-medium">
                    {m.title}
                    <span className="sr-only">{m.done ? ' (done)' : ' (not done yet)'}</span>
                    {m.done && <span className="ml-2 text-[13px] font-normal text-pine">Done</span>}
                  </p>
                  <p className="tnum mt-0.5 text-[13px] leading-[18px] text-ink-2">{m.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </motion.section>

        <motion.section variants={section} className="mt-6">
          <h3 className="text-[15px] font-semibold">Home health</h3>
          {health.length === 0 ? (
            <p className="mt-2 text-[15px] text-ink-2">No systems on file yet.</p>
          ) : (
            <table className="mt-2 w-full border-t border-line text-left text-[15px]">
              <thead>
                <tr className="text-[13px] text-ink-2">
                  <th scope="col" className="py-2 pr-3 font-medium">System</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Age</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Typical life</th>
                  <th scope="col" className="py-2 font-medium">Replacement</th>
                </tr>
              </thead>
              <tbody>
                {health.map((h) => (
                  <tr key={h.id} className="border-t border-line" data-due={h.dueSoon}>
                    <th scope="row" className={`py-2 pr-3 font-medium ${h.dueSoon ? 'border-l-2 border-signal-amber pl-2' : ''}`}>
                      {h.label}
                      {h.dueSoon && <span className="block text-[13px] font-normal text-signal-amber">{h.remaining === 0 ? 'Due now' : `Due within ${h.remaining} ${h.remaining === 1 ? 'year' : 'years'}`}</span>}
                    </th>
                    <td className="tnum py-2 pr-3">{h.ageYears} yrs</td>
                    <td className="tnum py-2 pr-3 text-ink-2">{h.lifeYears} yrs</td>
                    <td className="tnum py-2">
                      {money(h.costLow)}–{money(h.costHigh)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="tnum mt-2 text-[13px] text-ink-2">
            Savings {money(r.profile.savings)}
            {r.risk.shortfall > 0 ? ` · ${money(r.risk.shortfall)} short of what's due within a year` : ''}. Maintenance set-aside in the forecast: {money(f.maintenance)} a month.
          </p>
        </motion.section>

        <motion.section variants={section} className="mt-6">
          <Outreach row={r} />
        </motion.section>
      </motion.div>
    </>
  );
}

function Money({ v }: { v: number }) {
  return <span className={`tnum font-semibold ${v < 0 ? 'text-signal-red' : ''}`}>{usd(v)}</span>;
}

type Draft = { subject: string; body: string; translation?: string; lang: Lang; source: string };

function Outreach({ row }: { row: HomeownerRow }) {
  const toast = useToast();
  const [lang, setLang] = useState<Lang>(row.language);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [body, setBody] = useState('');
  const [approved, setApproved] = useState(false);

  const run = async () => {
    setState('loading');
    setApproved(false);
    try {
      const res = await fetch('/api/outreach/homeowner', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: row.id, lang }) });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error?.message ?? 'failed');
      setDraft(j);
      setBody(j.body);
      setState('ready');
    } catch {
      setState('error');
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      toast('Draft copied');
    } catch {
      toast('Copy didn’t work here. Select the text instead.');
    }
  };
  const approve = () => {
    // Sample send: nothing leaves HomeStretch. Logged for the demo.
    console.info('[outreach:sample-send]', { to: `${row.surname} family`, id: row.id, lang: draft?.lang, subject: draft?.subject, body });
    setApproved(true);
    toast(`Approved. Sample send to the ${row.surname} family logged; nothing left HomeStretch.`);
  };

  return (
    <div className="rounded-[14px] border border-line p-4" data-testid="homeowner-outreach">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-semibold">Draft outreach</h3>
          <p className="mt-1 text-[13px] leading-[18px] text-ink-2">A short note with one next step, in the family’s language. Nothing sends automatically.</p>
        </div>
        <div className="w-[180px] shrink-0">
          <Segmented<Lang>
            size="sm"
            label="Note language"
            value={lang}
            onChange={(v) => {
              setLang(v);
              setState('idle');
              setDraft(null);
            }}
            options={[
              { value: 'en', label: 'English' },
              { value: 'es', label: 'Spanish' },
            ]}
          />
        </div>
      </div>
      {state !== 'ready' && (
        <Button className="mt-3" variant="primary" onClick={run} loading={state === 'loading'} data-testid="draft-outreach">
          {state === 'error' ? 'Try the draft again' : 'Draft outreach'}
        </Button>
      )}
      {state === 'error' && <p className="mt-2 border-l-2 border-signal-red pl-3 text-[13px] text-signal-red">The draft didn’t come through. Try again.</p>}
      <AnimatePresence initial={false}>
        {state === 'ready' && draft && (
          <motion.div key="draft" {...reveal} className="mt-3">
            <p className="text-[13px] text-ink-2">
              Subject <span className="text-ink">{draft.subject}</span>
            </p>
            <label htmlFor={`ho-note-${row.id}`} className="mt-3 block text-[13px] font-medium text-ink-2">
              Note ({draft.lang === 'es' ? 'Spanish' : 'English'})
            </label>
            <textarea id={`ho-note-${row.id}`} value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="field mt-1 block w-full resize-y py-3 text-[15px] leading-[22px]" data-testid="homeowner-note" lang={draft.lang} />
            {draft.translation && (
              <div className="mt-3 border-l-2 border-line pl-3">
                <p className="text-[13px] font-medium text-ink-2">English translation, for staff</p>
                <p className="mt-1 whitespace-pre-line text-[13px] leading-[19px] text-ink-2" data-testid="homeowner-translation" lang="en">
                  {draft.translation}
                </p>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button variant={approved ? 'secondary' : 'primary'} onClick={approve} disabled={approved} data-testid="approve-outreach">
                {approved ? 'Approved' : 'Approve and send'}
              </Button>
              <Button variant="secondary" onClick={copy}>
                <Copy size={16} strokeWidth={1.75} aria-hidden />
                Copy
              </Button>
              <Button variant="quiet" onClick={run}>
                Redraft
              </Button>
            </div>
            <p className="mt-2 text-[13px] text-ink-2">Sample data: approving logs the send; nothing reaches a family.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
