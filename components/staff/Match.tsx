'use client';
import { AnimatePresence, LayoutGroup, motion, useIsPresent, useReducedMotion, type Transition } from 'motion/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/Toast';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { monthName } from '@/lib/format';
import { dur, ease, exit, spring } from '@/lib/motion';
import { nextActionFor } from '@/lib/outreach';
import type { FamilyRow } from '@/lib/staffData';
import { TIER_LABEL, homeCounts, homeTitle, rankForHome, rulesReason, type Candidate } from '@/lib/staffLogic';
import type { Home, Lang } from '@/lib/types';
import { BuildArt } from './BuildArt';
import { buildStageOf } from './buildStage';

type Draft = { subject: string; body: string };

// Choosing a home re-ranks the list: families already listed slide to their new rank (layout, spring.smooth);
// families who no longer fit fold away (lifted out of the flow, clipped up, faded) and new ones fold open.
// "Draft outreach" streams the body in, a few words per frame over ~600ms, into a card that grows with it
// (layout on the card, its content position-only so the text is never stretched). Reduced motion: the
// whole draft appears at once and rows only fade.
const SORT: Transition = { layout: spring.smooth, default: { duration: dur.short, ease: ease.out } };
const OPEN_CLIP = 'inset(0% 0% 0% 0%)';
const SHUT_CLIP = 'inset(0% 0% 100% 0%)';
const STREAM_MS = dur.short * 3000; // ~600ms whatever the length
const wordEnds = (text: string) => Array.from(text.matchAll(/\S+/g), (m) => (m.index ?? 0) + m[0].length);
const whole = (n: number) => String(Math.round(n));
// The chosen home's site crossfades to the new one's stage (200ms, opacity and a 4px rise); the lawns line up.
const SITE_IN = { duration: dur.short, ease: ease.out };

export function Match({ homes, families }: { homes: Home[]; families: FamilyRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const asked = params.get('home') && homes.some((h) => h.id === params.get('home')) ? params.get('home')! : homes[0]?.id;
  // While the page leaves for another tab the URL has already lost ?home=; keep the home on screen as it was
  // (otherwise the list re-ranks for the first home and flashes its loading reasons on the way out).
  const present = useIsPresent();
  const shownHome = useRef(asked);
  if (present) shownHome.current = asked;
  const homeId = present ? asked : shownHome.current;
  const home = homes.find((h) => h.id === homeId);
  const candidates = useMemo(() => (home ? rankForHome(home, families) : []), [home, families]);
  const [reasons, setReasons] = useState<Record<string, string> | null>(null);
  const [openCode, setOpenCode] = useState<string | null>(null);
  const reduce = !!useReducedMotion();
  // Rows that climb the ranking pass over the ones they overtake (a row sliding under another would vanish).
  // Worked out once per re-ranking, so it holds for the whole slide even when the reasons arrive mid-way.
  const prevRanks = useRef(new Map<string, number>());
  const climbers = useMemo(() => new Set(candidates.filter((c, i) => (prevRanks.current.get(c.family.code) ?? i) > i).map((c) => c.family.code)), [candidates]);
  useLayoutEffect(() => {
    prevRanks.current = new Map(candidates.map((c, i) => [c.family.code, i]));
  }, [candidates]);

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
        <div className="flex items-end gap-4">
          <div className="relative -mb-1 h-[66px] w-[64px] shrink-0" aria-hidden data-testid="match-site" data-stage={buildStageOf(home.status)}>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div key={buildStageOf(home.status)} className="absolute inset-x-0 bottom-0" initial={{ opacity: 0, y: reduce ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: exit }} transition={SITE_IN}>
                <BuildArt stage={buildStageOf(home.status)} size={64} />
              </motion.div>
            </AnimatePresence>
          </div>
          <p className="pb-3 text-[15px] text-ink-2">
            {homeTitle(home)}, done <span className="tnum">{monthName(home.completion)}</span>, {home.status.toLowerCase()}.{' '}
            <AnimatedNumber speed="snappy" value={counts.projected} format={whole} className="font-medium text-ink" /> projected ready,{' '}
            <AnimatedNumber speed="snappy" value={counts.readyNow} format={whole} className="font-medium text-ink" /> ready now.
          </p>
        </div>
      </div>

      {candidates.length === 0 ? (
        <p className="mt-10 text-[15px] text-ink-2">No eligible families fit {home.bedrooms} bedrooms yet. Try another home.</p>
      ) : (
        <div className="relative mt-8 border-t border-line" role="list" aria-label={`Families ranked for ${home.address}`}>
          <div className="grid grid-cols-[40px_220px_120px_1fr_160px] gap-4 border-b border-line px-3 py-2 text-[13px] text-ink-2" aria-hidden>
            <span>Rank</span>
            <span>Family</span>
            <span>Ready date</span>
            <span>Why this match</span>
            <span />
          </div>
          <LayoutGroup>
            <AnimatePresence initial={false} mode="popLayout">
              {candidates.map((c, i) => (
                <CandidateRow
                  key={c.family.code}
                  rank={i + 1}
                  climbing={climbers.has(c.family.code)}
                  c={c}
                  home={home}
                  reduce={reduce}
                  reason={reasons?.[c.family.code] ?? null}
                  open={openCode === c.family.code}
                  onToggle={() => setOpenCode(openCode === c.family.code ? null : c.family.code)}
                />
              ))}
            </AnimatePresence>
          </LayoutGroup>
        </div>
      )}
    </>
  );
}

function CandidateRow({
  rank,
  c,
  home,
  reduce,
  climbing,
  reason,
  open,
  onToggle,
  ref,
}: {
  rank: number;
  c: Candidate;
  home: Home;
  reduce: boolean;
  climbing: boolean;
  reason: string | null;
  open: boolean;
  onToggle: () => void;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const f = c.family;
  return (
    <motion.div
      ref={ref}
      layout="position"
      transition={SORT}
      initial={{ opacity: 0, clipPath: reduce ? OPEN_CLIP : SHUT_CLIP }}
      animate={{ opacity: 1, clipPath: OPEN_CLIP }}
      exit={{ opacity: 0, clipPath: reduce ? OPEN_CLIP : SHUT_CLIP, transition: exit }}
      role="listitem"
      className="relative border-b border-line bg-paper"
      style={{ zIndex: climbing ? 2 : 1 }}
      data-testid="match-row"
      data-code={f.code}
      data-surname={f.surname}
    >
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: exit }} transition={{ duration: dur.short, ease: ease.out }}>
            <OutreachEditor family={f} home={home} reduce={reduce} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function OutreachEditor({ family: f, home, reduce }: { family: FamilyRow; home: Home; reduce: boolean }) {
  const toast = useToast();
  const [lang, setLang] = useState<Lang>(f.language);
  const [drafts, setDrafts] = useState<Partial<Record<Lang, Draft>>>({});
  const [error, setError] = useState<string | null>(null);
  // The draft that just arrived streams in; one already fetched (switching back a language) shows at once.
  const [streamLang, setStreamLang] = useState<Lang | null>(null);
  const [shown, setShown] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);
  const draft = drafts[lang];
  const body = draft?.body ?? '';
  const streaming = !!draft && streamLang === lang;
  const ends = useMemo(() => wordEnds(body), [body]);
  const value = streaming ? body.slice(0, ends[shown - 1] ?? 0) : body;

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
      .then((d: Draft) => {
        setShown(0);
        setStreamLang(reduce ? null : lang);
        setDrafts((all) => ({ ...all, [lang]: { subject: d.subject, body: d.body } }));
      })
      .catch((e) => {
        if ((e as Error)?.name !== 'AbortError') setError('Could not draft that. Try again.');
      });
    return () => ctrl.abort();
  }, [lang, drafts, f, home, reduce]);

  // Reveal by elapsed time, so any length takes ~600ms (a few words per frame).
  useEffect(() => {
    if (!streaming) return;
    const total = ends.length;
    const t0 = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const k = Math.ceil(total * Math.min(1, (now - t0) / STREAM_MS));
      setShown(k);
      if (k >= total) setStreamLang(null);
      else raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [streaming, ends]);

  // The message field fits its text, so the card grows as the draft streams in (and as staff type).
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [value]);

  const edit = (patch: Partial<Draft>) => setDrafts((all) => ({ ...all, [lang]: { ...(all[lang] ?? { subject: '', body: '' }), ...patch } }));
  const pickLang = (l: Lang) => {
    setStreamLang(null);
    setLang(l);
  };

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
    <motion.div layout transition={{ layout: spring.smooth }} style={{ borderRadius: 14 }} className="mb-4 ml-[56px] mr-3 overflow-hidden border border-line bg-surface">
      <motion.div layout="position" transition={{ layout: spring.smooth }} className="p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[13px] text-ink-2">Draft to the {f.surname} family. Nothing is sent; edit, copy and send it yourself.</p>
          <div className="w-[200px] shrink-0">
            <Segmented<Lang>
              size="sm"
              label="Draft language"
              value={lang}
              onChange={pickLang}
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
          <input id={`subj-${f.code}`} className="field mt-1 !min-h-[40px] text-[15px]" value={draft.subject} readOnly={streaming} onChange={(e) => edit({ subject: e.target.value })} />
        ) : (
          <div className="skeleton mt-1 h-10" />
        )}
        <label className="mt-3 block text-[13px] text-ink-2" htmlFor={`body-${f.code}`}>
          Message
        </label>
        {draft ? (
          <textarea
            ref={area}
            id={`body-${f.code}`}
            data-testid="outreach"
            className="field mt-1 block !min-h-[90px] resize-none overflow-hidden py-3 text-[15px] leading-[22px]"
            value={value}
            readOnly={streaming}
            aria-busy={streaming || undefined}
            onChange={(e) => edit({ body: e.target.value })}
          />
        ) : (
          <div className="skeleton mt-1 h-[90px]" aria-label="Drafting" />
        )}
        {/* Hidden while the text streams (the growing card would clip it); fades in once the draft is whole. */}
        <motion.div className="mt-3 flex min-h-[44px] items-center gap-3" initial={false} animate={{ opacity: streaming ? 0 : 1 }} transition={{ duration: dur.short, ease: ease.out }}>
          <Button onClick={copy} disabled={!draft || streaming}>
            Copy
          </Button>
          {draft && !streaming && <span className="tnum text-[13px] text-ink-2">{ends.length} words</span>}
          {error && (
            <span role="alert" className="text-[13px] text-signal-red">
              {error}
            </span>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
