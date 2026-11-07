'use client';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion, type Transition, type Variants } from 'motion/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { monthName } from '@/lib/format';
import { dur, ease } from '@/lib/motion';
import type { FamilyRow } from '@/lib/staffData';
import { STAGES, TIER_LABEL } from '@/lib/staffLogic';
import { ChipGroup } from './ChipGroup';
import { FamilyDrawer } from './FamilyDrawer';

const DAY = 86_400_000;

// Motion: rows stagger in once, on the first load of the session (20ms apart, rows past the 8th arrive
// with the 8th). After that, filtering opens and closes rows like a change in height: a leaving row is
// lifted out of the flow (popLayout) and its bottom edge clips up while the rows below glide up with the
// same timing, so the clip edge rides the next row's top edge; an arriving row clips open as the rows
// below glide down. Transform, opacity and clip-path only. Reduced motion: rows only fade.
const ROW_STAGGER = 0.02;
const STAGGER_CAP = 7; // index of the 8th row
const GLIDE_T: Transition = { duration: dur.short, ease: ease.out };
const FADE_OUT: Transition = { duration: dur.short * 0.7, ease: ease.out };
const GLIDE: Transition = { layout: GLIDE_T, default: GLIDE_T };
const OPEN_CLIP = 'inset(0% 0% 0% 0%)';
const SHUT_CLIP = 'inset(0% 0% 100% 0%)';
const fold = (reduce: boolean): Variants => ({
  shut: {
    opacity: 0,
    clipPath: reduce ? OPEN_CLIP : SHUT_CLIP,
    transition: { clipPath: GLIDE_T, opacity: FADE_OUT },
  },
  open: { opacity: 1, clipPath: OPEN_CLIP, y: 0 }, // timing comes from each element's transition (first-load stagger)
});
// A row or group header that would travel more than FAR slots (rows or headers) doesn't glide all that way
// (long travel reads as cheap and starts off screen): it folds away where it was and folds open where it
// lands, a beat later, as a new copy.
const FAR = 3;
const FAR_DELAY = 0.06;
// Six columns on a grid (not table layout) so a row lifted out of the flow keeps its column widths.
const COLS = 'grid grid-cols-[24%_11%_13%_minmax(0,1fr)_12%_9%] items-center';
const whole = (n: number) => String(Math.round(n));
let staggered = false; // module scope: one stagger per page load, not per tab visit
export function relativeDays(iso: string, now = Date.now()) {
  const d = Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY));
  return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`;
}

export function Pipeline({ families }: { families: FamilyRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const openCode = params.get('family');
  const pushed = useRef(false);
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('all');
  const [tier, setTier] = useState('all');
  const [blocker, setBlocker] = useState('all');
  const [lang, setLang] = useState('all');
  const reduce = !!useReducedMotion();
  const folds = useMemo(() => fold(reduce), [reduce]);
  // True only for the rows mounted on the first render of the session; rows that enter later just fade.
  const [firstLoad, setFirstLoad] = useState(() => !staggered);
  useEffect(() => {
    staggered = true;
    setFirstLoad(false);
  }, []);

  const blockerTypes = useMemo(() => Array.from(new Set(families.map((f) => f.blockerType).filter((b): b is string => !!b))).sort(), [families]);
  const tiers = useMemo(() => Array.from(new Set(families.map((f) => f.result.tier))), [families]);

  const filtered = families.filter((f) => {
    if (stage !== 'all' && f.stage !== stage) return false;
    if (tier !== 'all' && f.result.tier !== tier) return false;
    if (blocker !== 'all' && f.blockerType !== blocker) return false;
    if (lang !== 'all' && f.language !== lang) return false;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      const hay = `${f.surname} ${f.givenName} ${f.city} ${f.code}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  const open = (code: string) => {
    pushed.current = true;
    const next = new URLSearchParams(params.toString());
    next.set('family', code);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const close = () => {
    if (pushed.current) {
      pushed.current = false;
      router.back();
    } else {
      router.replace(pathname, { scroll: false });
    }
  };
  // Display order across stage groups, so the first-load stagger runs top to bottom.
  const order = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of STAGES)
      families
        .filter((f) => f.stage === s.key)
        .sort((a, b) => a.result.monthsToReady - b.result.monthsToReady || a.surname.localeCompare(b.surname))
        .forEach((f) => m.set(f.code, m.size));
    return m;
  }, [families]);
  const selected = families.find((f) => f.code === openCode) ?? null;
  const filtersOn = stage !== 'all' || tier !== 'all' || blocker !== 'all' || lang !== 'all' || q.trim() !== '';
  const groups = STAGES.map((s) => ({
    s,
    rows: filtered.filter((f) => f.stage === s.key).sort((a, b) => a.result.monthsToReady - b.result.monthsToReady || a.surname.localeCompare(b.surname)),
    total: families.filter((f) => f.stage === s.key).length,
  })).filter((g) => !(filtersOn && g.rows.length === 0));

  // Slot of every header and row in display order, compared with the last committed render to find far moves.
  const prevSlots = useRef(new Map<string, number>());
  const prevGens = useRef(new Map<string, number>());
  const slots = new Map<string, number>();
  let slot = 0;
  for (const g of groups) {
    slots.set(`h:${g.s.key}`, slot++);
    if (g.rows.length === 0) slot++; // the "No families in this stage" row
    for (const f of g.rows) slots.set(f.code, slot++);
  }
  const gens = new Map<string, number>();
  const farArrivals = new Set<string>();
  for (const [k, now] of slots) {
    const before = prevSlots.current.get(k);
    const g0 = prevGens.current.get(k) ?? 0;
    const far = before !== undefined && Math.abs(now - before) > FAR;
    gens.set(k, far ? g0 + 1 : g0);
    if (far) farArrivals.add(k);
  }
  useLayoutEffect(() => {
    prevSlots.current = slots;
    prevGens.current = gens;
  });
  const keyOf = (k: string) => `${k}:${gens.get(k) ?? 0}`;
  const enterT = (k: string): Transition => (farArrivals.has(k) ? { ...GLIDE, default: { ...GLIDE_T, delay: FAR_DELAY } } : GLIDE);

  return (
    <>
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="t-title">Pipeline</h1>
          <p className="mt-1 text-[15px] text-ink-2">
            <span className="tnum">{families.length}</span> {families.length === 1 ? 'family has' : 'families have'} shared a plan with Habitat OC.
          </p>
        </div>
        <Link
          href="/staff/checkin"
          className="press inline-flex min-h-[44px] items-center rounded-[8px] bg-pine px-4 text-[15px] font-medium text-on-pine transition-colors duration-[120ms] hover:bg-pine-hover"
          data-testid="run-checkin"
        >
          Run Monday check-in
        </Link>
      </div>

      {families.length === 0 ? (
        <div className="panel mt-8 py-12 text-center text-[15px] text-ink-2">No families yet. Share the family link at the next orientation.</div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-line py-3">
            <label className="relative flex items-center">
              <span className="sr-only">Search families</span>
              <Search size={18} strokeWidth={1.75} className="pointer-events-none absolute left-3 text-ink-2" aria-hidden />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search families" className="field !min-h-[36px] w-[240px] !pl-9 text-[15px]" />
            </label>
            <ChipGroup label="Stage" value={stage} onChange={setStage} options={STAGES.map((s) => ({ value: s.key, label: s.label }))} />
            <ChipGroup label="Tier" value={tier} onChange={setTier} options={tiers.map((t) => ({ value: t, label: TIER_LABEL[t] }))} />
            <ChipGroup label="Blocker" value={blocker} onChange={setBlocker} options={blockerTypes.map((b) => ({ value: b, label: b }))} />
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
                  setStage('all');
                  setTier('all');
                  setBlocker('all');
                  setLang('all');
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          <table role="table" className="relative mt-6 block w-full text-left text-[15px]">
            <thead role="rowgroup" className="block">
              <tr role="row" className={`${COLS} text-[13px] text-ink-2`}>
                <th role="columnheader" scope="col" className="px-3 py-2 font-medium">
                  Family
                </th>
                <th role="columnheader" scope="col" className="px-3 py-2 font-medium">
                  Tier
                </th>
                <th role="columnheader" scope="col" className="px-3 py-2 font-medium">
                  Ready date
                </th>
                <th role="columnheader" scope="col" className="px-3 py-2 font-medium">
                  Biggest blocker
                </th>
                <th role="columnheader" scope="col" className="px-3 py-2 font-medium">
                  Last activity
                </th>
                <th role="columnheader" scope="col" className="px-3 py-2 font-medium">
                  Plan code
                </th>
              </tr>
            </thead>
            <LayoutGroup>
              <AnimatePresence initial={false} mode="popLayout">
                {groups.map(({ s, rows, total }) => {
                  const h = `h:${s.key}`;
                  return (
                    <motion.tbody
                      key={s.key}
                      role="rowgroup"
                      className="relative block"
                      data-testid={`stage-${s.key}`}
                      data-count={rows.length}
                      variants={folds}
                      initial="shut"
                      animate="open"
                      exit="shut"
                      transition={GLIDE}
                    >
                      <AnimatePresence initial={false} mode="popLayout">
                        <motion.tr key={keyOf(h)} role="row" layout="position" variants={folds} initial="shut" animate="open" exit="shut" transition={enterT(h)} className="block">
                          <th role="columnheader" colSpan={6} scope="colgroup" className="block border-b border-line px-3 pb-2 pt-6 text-left">
                            <span className="text-[15px] font-semibold text-ink">{s.key === 'not_eligible' ? 'Not eligible (why)' : s.label}</span>
                            {/* Plain number on first paint; rolls to the new count when a filter changes it. */}
                            <span className="ml-2 text-[13px] font-normal text-ink-2" data-testid="stage-count">
                              <AnimatedNumber speed="snappy" value={rows.length} format={whole} />
                            </span>
                            {filtersOn && rows.length !== total && <span className="tnum text-[13px] font-normal text-ink-2"> of {total}</span>}
                          </th>
                        </motion.tr>
                      </AnimatePresence>
                      {rows.length === 0 && (
                        <motion.tr role="row" layout="position" transition={GLIDE} className="block">
                          <td role="cell" colSpan={6} className="block border-b border-line px-3 py-3 text-[13px] text-ink-2">
                            No families in this stage.
                          </td>
                        </motion.tr>
                      )}
                      <AnimatePresence initial={firstLoad} mode="popLayout">
                        {rows.map((f) => (
                          <motion.tr
                            key={keyOf(f.code)}
                            role="row"
                            layout="position"
                            variants={folds}
                            initial={
                              firstLoad
                                ? {
                                    opacity: 0,
                                    y: reduce ? 0 : 6,
                                    clipPath: OPEN_CLIP,
                                  }
                                : 'shut'
                            }
                            animate="open"
                            exit="shut"
                            transition={
                              firstLoad
                                ? {
                                    ...GLIDE,
                                    default: {
                                      ...GLIDE_T,
                                      delay: Math.min(order.get(f.code) ?? 0, STAGGER_CAP) * ROW_STAGGER,
                                    },
                                  }
                                : enterT(f.code)
                            }
                            data-testid="family-row"
                            data-code={f.code}
                            tabIndex={0}
                            aria-label={`Open ${f.surname} family`}
                            onClick={() => open(f.code)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                open(f.code);
                              }
                            }}
                            className={`${COLS} cursor-pointer border-b border-line transition-colors duration-[120ms] hover:bg-surface focus-visible:bg-surface ${openCode === f.code ? 'bg-surface' : ''}`}
                            style={{ outlineOffset: -2 }}
                          >
                            <td role="cell" className="px-3 py-3">
                              <span className="font-medium text-ink">{f.surname}</span>
                              <span className="ml-2 text-[13px] text-ink-2">
                                {f.givenName} · <span className="tnum">{f.householdSize}</span> {f.householdSize === 1 ? 'person' : 'people'}
                              </span>
                            </td>
                            <td role="cell" className="px-3 py-3 text-ink-2">
                              {TIER_LABEL[f.result.tier]}
                            </td>
                            <td role="cell" className="tnum px-3 py-3">
                              {f.eligible ? f.result.monthsToReady === 0 ? 'Now' : monthName(f.result.readyDate, 'en', true) : <span className="text-ink-2">n/a</span>}
                            </td>
                            <td role="cell" className="px-3 py-3 text-ink-2">
                              {f.stage === 'not_eligible' ? (
                                <span className="border-l-2 border-signal-amber pl-2 text-signal-amber">{f.result.blockers.find((b) => b.severity === 3)?.text ?? f.result.eligible.reasons[0]}</span>
                              ) : (
                                (f.result.blockers[0]?.text ?? 'None')
                              )}
                            </td>
                            <td role="cell" className="tnum px-3 py-3 text-ink-2">
                              {relativeDays(f.lastActivity)}
                            </td>
                            <td role="cell" className="tnum px-3 py-3 text-ink-2">
                              {f.code}
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </motion.tbody>
                  );
                })}
              </AnimatePresence>
            </LayoutGroup>
          </table>
          <AnimatePresence initial={false}>
            {filtered.length === 0 && (
              <motion.p className="mt-8 text-[15px] text-ink-2" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: GLIDE_T }} exit={{ opacity: 0, transition: FADE_OUT }}>
                No families match these filters. Clear a filter to see more.
              </motion.p>
            )}
          </AnimatePresence>
        </>
      )}
      <FamilyDrawer family={selected} onClose={close} />
    </>
  );
}
