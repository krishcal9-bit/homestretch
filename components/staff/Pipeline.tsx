'use client';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { monthName } from '@/lib/format';
import type { FamilyRow } from '@/lib/staffData';
import { STAGES, TIER_LABEL } from '@/lib/staffLogic';
import { ChipGroup } from './ChipGroup';
import { FamilyDrawer } from './FamilyDrawer';

const DAY = 86_400_000;
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
  const selected = families.find((f) => f.code === openCode) ?? null;
  const filtersOn = stage !== 'all' || tier !== 'all' || blocker !== 'all' || lang !== 'all' || q.trim() !== '';

  return (
    <>
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="t-title">Pipeline</h1>
          <p className="mt-1 text-[15px] text-ink-2">
            <span className="tnum">{families.length}</span> {families.length === 1 ? 'family has' : 'families have'} shared a plan with Habitat OC.
          </p>
        </div>
        <Link href="/staff/checkin" className="inline-flex min-h-[44px] items-center rounded-[8px] bg-pine px-4 text-[15px] font-medium text-white transition-colors duration-[120ms] hover:bg-pine-hover" data-testid="run-checkin">
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
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search families"
                className="field !min-h-[36px] w-[240px] !pl-9 text-[15px]"
              />
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
                className="min-h-[36px] rounded-[8px] px-2 text-[13px] font-medium text-pine hover:bg-pine-soft"
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

          <table className="mt-6 w-full border-collapse text-left text-[15px]">
            <thead>
              <tr className="text-[13px] text-ink-2">
                <th scope="col" className="w-[24%] px-3 py-2 font-medium">Family</th>
                <th scope="col" className="w-[11%] px-3 py-2 font-medium">Tier</th>
                <th scope="col" className="w-[13%] px-3 py-2 font-medium">Ready date</th>
                <th scope="col" className="px-3 py-2 font-medium">Biggest blocker</th>
                <th scope="col" className="w-[12%] px-3 py-2 font-medium">Last activity</th>
                <th scope="col" className="w-[9%] px-3 py-2 font-medium">Plan code</th>
              </tr>
            </thead>
            {STAGES.map((s) => {
              const rows = filtered.filter((f) => f.stage === s.key).sort((a, b) => a.result.monthsToReady - b.result.monthsToReady || a.surname.localeCompare(b.surname));
              const total = families.filter((f) => f.stage === s.key).length;
              if (filtersOn && rows.length === 0) return null;
              return (
                <tbody key={s.key} data-testid={`stage-${s.key}`} data-count={rows.length}>
                  <tr>
                    <th colSpan={6} scope="colgroup" className="border-b border-line px-3 pb-2 pt-6 text-left">
                      <span className="text-[15px] font-semibold text-ink">{s.key === 'not_eligible' ? 'Not eligible (why)' : s.label}</span>
                      <span className="tnum ml-2 text-[13px] font-normal text-ink-2" data-testid="stage-count">
                        {rows.length}
                      </span>
                      {filtersOn && rows.length !== total && <span className="tnum text-[13px] font-normal text-ink-2"> of {total}</span>}
                    </th>
                  </tr>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="border-b border-line px-3 py-3 text-[13px] text-ink-2">
                        No families in this stage.
                      </td>
                    </tr>
                  )}
                  {rows.map((f) => (
                    <tr
                      key={f.code}
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
                      className={`cursor-pointer border-b border-line transition-colors duration-[120ms] hover:bg-surface focus-visible:bg-surface ${openCode === f.code ? 'bg-surface' : ''}`}
                      style={{ outlineOffset: -2 }}
                    >
                      <td className="px-3 py-3">
                        <span className="font-medium text-ink">{f.surname}</span>
                        <span className="ml-2 text-[13px] text-ink-2">
                          {f.givenName} · <span className="tnum">{f.householdSize}</span> {f.householdSize === 1 ? 'person' : 'people'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-ink-2">{TIER_LABEL[f.result.tier]}</td>
                      <td className="tnum px-3 py-3">{f.eligible ? (f.result.monthsToReady === 0 ? 'Now' : monthName(f.result.readyDate, 'en', true)) : <span className="text-ink-2">n/a</span>}</td>
                      <td className="px-3 py-3 text-ink-2">
                        {f.stage === 'not_eligible' ? (
                          <span className="border-l-2 border-signal-amber pl-2 text-signal-amber">{f.result.blockers.find((b) => b.severity === 3)?.text ?? f.result.eligible.reasons[0]}</span>
                        ) : (
                          (f.result.blockers[0]?.text ?? 'None')
                        )}
                      </td>
                      <td className="tnum px-3 py-3 text-ink-2">{relativeDays(f.lastActivity)}</td>
                      <td className="tnum px-3 py-3 text-ink-2">{f.code}</td>
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
          {filtered.length === 0 && <p className="mt-8 text-[15px] text-ink-2">No families match these filters. Clear a filter to see more.</p>}
        </>
      )}
      <FamilyDrawer family={selected} onClose={close} />
    </>
  );
}
