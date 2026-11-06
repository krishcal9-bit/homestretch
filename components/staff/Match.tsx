'use client';
import { AnimatePresence, motion } from 'motion/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { monthName } from '@/lib/format';
import { exit, spring } from '@/lib/motion';
import { nextActionFor } from '@/lib/outreach';
import type { FamilyRow } from '@/lib/staffData';
import { TIER_LABEL, homeCounts, homeTitle, rankForHome, rulesReason, type Candidate } from '@/lib/staffLogic';
import type { Home, Lang } from '@/lib/types';

type Draft = { subject: string; body: string };

export function Match({ homes, families }: { homes: Home[]; families: FamilyRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const homeId = params.get('home') && homes.some((h) => h.id === params.get('home')) ? params.get('home')! : homes[0]?.id;
  const home = homes.find((h) => h.id === homeId);
  const candidates = useMemo(() => (home ? rankForHome(home, families) : []), [home, families]);
  const [reasons, setReasons] = useState<Record<string, string> | null>(null);
  const [openCode, setOpenCode] = useState<string | null>(null);

  useEffect(() => {
    if (!home) return;
    setReasons(null);
    setOpenCode(null);
    const ctrl = new AbortController();
    const fallback = Object.fromEntries(candidates.map((c) => [c.family.code, rulesReason(c, home)]));
    fetch('/api/match-reason', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        home: { id: home.id, address: home.address, city: home.city, bedrooms: home.bedrooms, completion: home.completion },
        candidates: candidates.slice(0, 30).map((c) => ({
          code: c.family.code,
          householdSize: c.family.householdSize,
          tier: c.family.result.tier,
          readyDate: c.family.result.readyDate,
          monthsToReady: c.family.result.monthsToReady,
          monthsSpare: c.monthsSpare,
          topBlocker: c.family.result.blockers[0]?.text,
          fallback: fallback[c.family.code],
        })),
      }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { reasons: { code: string; reason: string }[] }) => setReasons({ ...fallback, ...Object.fromEntries(d.reasons.map((x) => [x.code, x.reason])) }))
      .catch((e) => {
        if ((e as Error)?.name !== 'AbortError') setReasons(fallback);
      });
    return () => ctrl.abort();
  }, [home, candidates]);

  if (!home) return <div className="panel py-12 text-center text-[15px] text-ink-2">No homes yet. Add upcoming builds to match families to them.</div>;
  const counts = homeCounts(home, families);

  return (
    <>
      <h1 className="t-title">Match</h1>
      <div className="mt-6 flex flex-wrap items-end gap-6">
        <div>
          <label htmlFor="match-home" className="block text-[13px] text-ink-2">
            Home
          </label>
          <select
            id="match-home"
            className="field mt-1 w-[420px] text-[15px]"
            value={home.id}
            onChange={(e) => router.replace(`${pathname}?home=${e.target.value}`, { scroll: false })}
          >
            {homes.map((h) => (
              <option key={h.id} value={h.id}>
                {h.address}, {h.city} · {h.bedrooms} bedrooms · {monthName(h.completion, 'en', true)}
              </option>
            ))}
          </select>
        </div>
        <p className="pb-3 text-[15px] text-ink-2">
          {homeTitle(home)}, done <span className="tnum">{monthName(home.completion)}</span>, {home.status.toLowerCase()}.{' '}
          <span className="tnum font-medium text-ink">{counts.projected}</span> projected ready, <span className="tnum font-medium text-ink">{counts.readyNow}</span> ready now.
        </p>
      </div>

      {candidates.length === 0 ? (
        <p className="mt-10 text-[15px] text-ink-2">No eligible families fit {home.bedrooms} bedrooms yet. Try another home.</p>
      ) : (
        <div className="mt-8 border-t border-line" role="list" aria-label={`Families ranked for ${home.address}`}>
          <div className="grid grid-cols-[40px_220px_120px_1fr_160px] gap-4 border-b border-line px-3 py-2 text-[13px] text-ink-2" aria-hidden>
            <span>Rank</span>
            <span>Family</span>
            <span>Ready date</span>
            <span>Why this match</span>
            <span />
          </div>
          {candidates.map((c, i) => (
            <CandidateRow
              key={c.family.code}
              rank={i + 1}
              c={c}
              home={home}
              reason={reasons?.[c.family.code] ?? null}
              open={openCode === c.family.code}
              onToggle={() => setOpenCode(openCode === c.family.code ? null : c.family.code)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function CandidateRow({ rank, c, home, reason, open, onToggle }: { rank: number; c: Candidate; home: Home; reason: string | null; open: boolean; onToggle: () => void }) {
  const f = c.family;
  return (
    <motion.div layout="position" transition={spring.smooth} role="listitem" className="border-b border-line" data-testid="match-row" data-code={f.code} data-surname={f.surname}>
      <div className="grid grid-cols-[40px_220px_120px_1fr_160px] items-center gap-4 px-3 py-3 text-[15px]">
        <span className="tnum text-ink-2">{rank}</span>
        <span>
          <span className="font-medium">{f.surname}</span>
          <span className="ml-2 text-[13px] text-ink-2">
            <span className="tnum">{f.householdSize}</span> {f.householdSize === 1 ? 'person' : 'people'} · {TIER_LABEL[f.result.tier]}
          </span>
        </span>
        <span className={`tnum ${c.readyByCompletion ? '' : 'text-signal-amber'}`}>{f.result.monthsToReady === 0 ? 'Now' : monthName(f.result.readyDate, 'en', true)}</span>
        <span className="min-h-[24px] text-ink-2" data-testid="match-reason">
          {reason ?? <span className="skeleton block h-4 w-4/5" aria-label="Loading reason" />}
        </span>
        <span className="text-right">
          <Button variant={open ? 'secondary' : 'quiet'} onClick={onToggle} aria-expanded={open}>
            {open ? 'Close draft' : 'Draft outreach'}
          </Button>
        </span>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: exit }} transition={spring.smooth}>
            <OutreachEditor family={f} home={home} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function OutreachEditor({ family: f, home }: { family: FamilyRow; home: Home }) {
  const toast = useToast();
  const [lang, setLang] = useState<Lang>(f.language);
  const [drafts, setDrafts] = useState<Partial<Record<Lang, Draft>>>({});
  const [error, setError] = useState<string | null>(null);
  const draft = drafts[lang];

  useEffect(() => {
    if (drafts[lang]) return;
    const ctrl = new AbortController();
    setError(null);
    fetch('/api/outreach', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        lang,
        home: { id: home.id, address: home.address, city: home.city, bedrooms: home.bedrooms, completion: home.completion },
        family: {
          surname: f.surname,
          givenName: f.givenName,
          householdSize: f.householdSize,
          readyDate: f.result.readyDate,
          monthsToReady: f.result.monthsToReady,
          nextAction: nextActionFor(f.result, lang),
        },
      }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('bad'))))
      .then((d: Draft) => setDrafts((all) => ({ ...all, [lang]: { subject: d.subject, body: d.body } })))
      .catch((e) => {
        if ((e as Error)?.name !== 'AbortError') setError('Could not draft that. Try again.');
      });
    return () => ctrl.abort();
  }, [lang, drafts, f, home]);

  const edit = (patch: Partial<Draft>) => setDrafts((all) => ({ ...all, [lang]: { ...(all[lang] ?? { subject: '', body: '' }), ...patch } }));

  async function copy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`);
    } catch {
      // Clipboard can be blocked (http, permissions); the text is still selectable in the field.
    }
    toast('Copied');
  }

  return (
    <div className="mb-4 ml-[56px] mr-3 rounded-[14px] border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[13px] text-ink-2">Draft to the {f.surname} family. Nothing is sent; edit, copy and send it yourself.</p>
        <div className="w-[200px] shrink-0">
          <Segmented<Lang>
            size="sm"
            label="Draft language"
            value={lang}
            onChange={setLang}
            options={[
              { value: 'en', label: 'English' },
              { value: 'es', label: 'Spanish' },
            ]}
          />
        </div>
      </div>
      <label className="mt-3 block text-[13px] text-ink-2" htmlFor={`subj-${f.code}`}>
        Subject
      </label>
      {draft ? (
        <input id={`subj-${f.code}`} className="field mt-1 !min-h-[40px] text-[15px]" value={draft.subject} onChange={(e) => edit({ subject: e.target.value })} />
      ) : (
        <div className="skeleton mt-1 h-10" />
      )}
      <label className="mt-3 block text-[13px] text-ink-2" htmlFor={`body-${f.code}`}>
        Message
      </label>
      {draft ? (
        <textarea
          id={`body-${f.code}`}
          data-testid="outreach"
          className="field mt-1 block min-h-[320px] py-3 text-[15px] leading-[22px]"
          value={draft.body}
          onChange={(e) => edit({ body: e.target.value })}
        />
      ) : (
        <div className="skeleton mt-1 h-[220px]" aria-label="Drafting" />
      )}
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={copy} disabled={!draft}>
          Copy
        </Button>
        {draft && <span className="tnum text-[13px] text-ink-2">{draft.body.trim().split(/\s+/).length} words</span>}
        {error && (
          <span role="alert" className="text-[13px] text-signal-red">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
