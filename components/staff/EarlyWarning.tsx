'use client';
import { Search } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CAUSE_LABEL, CHECKIN_MISSED_DAYS, HOME_TYPE_LABEL, riskCounts, usd, type HomeownerRow } from '@/lib/earlyWarning';
import { money, monthName } from '@/lib/format';
import { dur, ease } from '@/lib/motion';
import { ChipGroup } from './ChipGroup';
import { HomeownerDrawer } from './HomeownerDrawer';
import { RiskLevel } from './RiskLevel';

// Staff never moves on its own: rows fade up once per page load (20ms apart, capped at the 8th), filters are
// instant, the drawer slides in on request. Reduced motion: the fade only.
const ROW_STAGGER = 0.02;
const STAGGER_CAP = 7;
const COLS = 'grid grid-cols-[21%_23%_17%_15%_10%_minmax(0,1fr)] items-center';
let staggered = false;

const days = (n: number) => (n === 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n} days ago`);

export function EarlyWarning({ rows, today }: { rows: HomeownerRow[]; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const openId = params.get('home');
  const pushed = useRef(false);
  const reduce = !!useReducedMotion();
  const [q, setQ] = useState('');
  const [level, setLevel] = useState('all');
  const [lang, setLang] = useState('all');
  const [firstLoad, setFirstLoad] = useState(() => !staggered);
  useEffect(() => {
    staggered = true;
    setFirstLoad(false);
  }, []);

  const counts = useMemo(() => riskCounts(rows), [rows]);
  const atRisk = counts.act + counts.watch;
  const filtered = rows.filter((r) => {
    if (level !== 'all' && r.risk.level !== level) return false;
    if (lang !== 'all' && r.language !== lang) return false;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      if (!`${r.surname} ${r.givenName} ${r.address} ${r.code}`.toLowerCase().includes(s)) return false;
    }
    return true;
  });
  const filtersOn = level !== 'all' || lang !== 'all' || q.trim() !== '';
  const selected = rows.find((r) => r.id === openId) ?? null;

  const open = (id: string) => {
    pushed.current = true;
    const next = new URLSearchParams(params.toString());
    next.set('home', id);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      router.back();
    } else {
      router.replace(pathname, { scroll: false });
    }
  }, [router, pathname]);

  return (
    <>
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="t-title">Early warning</h1>
          <p className="mt-1 text-[15px] text-ink-2">Every Habitat homeowner, sorted by risk of payment stress in the next 6 months.</p>
        </div>
      </div>

      <section className="mt-6 border-y border-line py-5" aria-label="Summary">
        <p className="max-w-[60ch] text-balance text-[20px] leading-[28px]" data-testid="ew-summary" data-at-risk={atRisk}>
          {atRisk === 0 ? (
            <>No homeowner is heading toward payment stress in the next 6 months.</>
          ) : (
            <>
              <span className="tnum font-semibold">{atRisk}</span> {atRisk === 1 ? 'homeowner is' : 'homeowners are'} heading toward payment stress, before anyone has missed a payment.
            </>
          )}
        </p>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-[15px]">
          {(['act', 'watch', 'stable'] as const).map((l) => (
            <span key={l} data-testid={`ew-count-${l}`} data-count={counts[l]}>
              <RiskLevel level={l} count={counts[l]} />
            </span>
          ))}
          <span className="text-[13px] text-ink-2">Renewals at 15%, 29.1% on the FAIR Plan; property tax +2% each July.</span>
        </div>
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="relative flex items-center">
          <span className="sr-only">Search homeowners</span>
          <Search size={18} strokeWidth={1.75} className="pointer-events-none absolute left-3 text-ink-2" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search homeowners" className="field !min-h-[36px] w-[240px] !pl-9 text-[15px]" />
        </label>
        <ChipGroup
          label="Risk"
          value={level}
          onChange={setLevel}
          options={[
            { value: 'act', label: 'Act now' },
            { value: 'watch', label: 'Watch' },
            { value: 'stable', label: 'Stable' },
          ]}
        />
        <ChipGroup
          label="Language"
          value={lang}
          onChange={setLang}
          options={[
            { value: 'en', label: 'English' },
            { value: 'es', label: 'Spanish' },
          ]}
        />
        {filtersOn && (
          <button
            type="button"
            className="hit min-h-[36px] rounded-[8px] px-2 text-[13px] font-medium text-pine hover:bg-pine-soft"
            onClick={() => {
              setQ('');
              setLevel('all');
              setLang('all');
            }}
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto tnum text-[13px] text-ink-2" aria-live="polite">
          {filtersOn ? `${filtered.length} of ${rows.length}` : `${rows.length} homeowners`}
        </span>
      </div>

      <table role="table" className="mt-4 block w-full text-left text-[15px]" data-testid="ew-table">
        <thead role="rowgroup" className="block border-b border-line">
          <tr role="row" className={`${COLS} text-[13px] text-ink-2`}>
            {['Household', 'Home', 'Next shock', 'Breathing room', 'Risk', 'Last check-in'].map((h) => (
              <th key={h} role="columnheader" scope="col" className="px-3 py-2 font-medium">
                {h}
                {h === 'Breathing room' && <span className="block font-normal">now → in 6 months</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup" className="block">
          {filtered.map((r, i) => {
            const s = r.nextShock;
            const missed = r.checkinDaysAgo > CHECKIN_MISSED_DAYS;
            return (
              <motion.tr
                key={r.id}
                role="row"
                initial={firstLoad ? { opacity: 0, y: reduce ? 0 : 6 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: dur.short, ease: ease.out, delay: firstLoad ? Math.min(i, STAGGER_CAP) * ROW_STAGGER : 0 }}
                data-testid="homeowner-row"
                data-id={r.id}
                data-level={r.risk.level}
                data-lang={r.language}
                tabIndex={0}
                aria-label={`Open ${r.surname} family`}
                onClick={() => open(r.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    open(r.id);
                  }
                }}
                className={`${COLS} cursor-pointer border-b border-line transition-colors duration-[120ms] hover:bg-surface focus-visible:bg-surface ${openId === r.id ? 'bg-surface' : ''}`}
                style={{ outlineOffset: -2 }}
              >
                <td role="cell" className="px-3 py-3">
                  <span className="font-medium text-ink">{r.surname}</span>
                  <span className="ml-2 text-[13px] text-ink-2">
                    {r.givenName} · <span className="tnum">{r.householdSize}</span> people{r.language === 'es' ? ' · ES' : ''}
                  </span>
                </td>
                <td role="cell" className="px-3 py-3">
                  <span className="block truncate text-ink">{r.address.split(',')[0]}</span>
                  <span className="block truncate text-[13px] text-ink-2">
                    {r.city} · {HOME_TYPE_LABEL[r.homeType]}
                    {r.fairPlan ? ' · FAIR Plan' : ''}
                  </span>
                </td>
                <td role="cell" className={`tnum px-3 py-3 ${s && s.i <= 6 ? 'text-ink' : 'text-ink-2'}`}>
                  {s ? (
                    <>
                      <span className="block">
                        {monthName(s.month, 'en', true)} · <span className="font-medium">+{money(s.delta)}</span>/mo
                      </span>
                      <span className="block text-[13px] text-ink-2">{CAUSE_LABEL[s.cause]}</span>
                    </>
                  ) : (
                    <span className="text-ink-2">None in 24 months</span>
                  )}
                </td>
                <td role="cell" className="tnum px-3 py-3">
                  <span className={r.risk.now < 0 ? 'text-signal-red' : 'text-ink-2'}>{usd(r.risk.now)}</span>
                  <span className="px-1.5 text-ink-2" aria-label="to">
                    →
                  </span>
                  <span className={`font-medium ${r.risk.in6 < 0 ? 'text-signal-red' : 'text-ink'}`}>{usd(r.risk.in6)}</span>
                </td>
                <td role="cell" className="px-3 py-3">
                  <RiskLevel level={r.risk.level} />
                </td>
                <td role="cell" className="tnum px-3 py-3 text-ink-2">
                  {days(r.checkinDaysAgo)}
                  {missed && <span className="block text-[13px] text-signal-amber">Missed</span>}
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
      {filtered.length === 0 && <p className="mt-8 text-[15px] text-ink-2">No homeowners match these filters. Clear a filter to see more.</p>}
      <HomeownerDrawer row={selected} today={today} onClose={close} />
    </>
  );
}
