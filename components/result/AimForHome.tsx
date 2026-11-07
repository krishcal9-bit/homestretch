'use client';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, animate, useReducedMotion, useSpring } from 'motion/react';
import { Road } from './Road';
import { useLang } from '@/lib/i18n';
import { computeReadiness, monthsUntil, solveForDate } from '@/lib/engine';
import { fittingHomes } from '@/lib/homes';
import { monthName, money } from '@/lib/format';
import { ease, spring, exit as exitT, reveal } from '@/lib/motion';
import type { Home, Levers, Profile } from '@/lib/types';
import { Section } from './Panels';
import { HomeGlyph } from '@/components/illustrations/result/HomeGlyph';
import { keysX } from '@/components/illustrations/result/timing';

type Outcome = { homeId: string; text: string[]; ok: boolean };

const GLYPH_C = 32; // the card's house drawing centre, from the card's near edge (12px padding + half of 40px)

/**
 * The chosen home flies from its row to sit right over the Keys marker of the small Road: its house drawing
 * travels on two springs (x settles before y, so it arcs rather than sliding straight) and grows to size,
 * then the card's frame and words settle in around it. Afterwards the card rides along with Keys (same
 * spring as the Road's markers) while the sliders glide and the Road re-flows.
 */
function LiftedHome({ home, from, label, kx, w }: { home: Home; from: DOMRect | null; label: string; kx: number; w: number }) {
  const glyph = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  // Near the right edge the words go to the left of the house, so the card never leaves the column.
  const textLeft = kx > w - 168;
  const target = textLeft ? Math.min(0, kx + GLYPH_C - w) : Math.max(0, kx - GLYPH_C);
  const x = useSpring(target, spring.gentle);
  const side = useRef(textLeft);
  useEffect(() => {
    if (reduce || side.current !== textLeft) x.jump(target);
    else x.set(target);
    side.current = textLeft;
  }, [target, textLeft, reduce, x]);
  useLayoutEffect(() => {
    const el = glyph.current;
    if (!el || !from || reduce) return;
    const to = el.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const runs = [
      animate(el, { x: [dx, 0] }, { type: 'spring', duration: 0.5, bounce: 0 }),
      animate(el, { y: [dy, 0] }, { type: 'spring', duration: 0.7, bounce: 0 }),
      animate(el, { scale: [from.width / Math.max(1, to.width), 1] }, { type: 'spring', duration: 0.6, bounce: 0.15 }),
    ];
    return () => runs.forEach((r) => r.stop());
  }, [from, reduce, home.id]);
  const settle = (delay: number) => ({ initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2, ease: ease.out, delay: reduce || !from ? 0 : delay } });
  return (
    <motion.div style={{ x }} className={`absolute top-0 flex items-center gap-3 px-3 py-2 ${textLeft ? 'right-0 flex-row-reverse text-right' : 'left-0'}`} data-testid="aim-card">
      <motion.span aria-hidden className="absolute inset-0 rounded-[8px] border border-line bg-surface" {...settle(0.3)} />
      <div ref={glyph} className="relative z-10 will-change-transform">
        <HomeGlyph bedrooms={home.bedrooms} size={40} brass />
      </div>
      <motion.div className="relative whitespace-nowrap" {...settle(0.38)}>
        <p className="text-[13px] font-medium leading-[18px] text-ink">{home.city}</p>
        <p className="t-helper tnum text-ink-2">{label}</p>
      </motion.div>
    </motion.div>
  );
}

/** The small Road with the chosen home standing over its Keys marker. */
function AimLane({ home, from, label, result }: { home: Home; from: DOMRect | null; label: string; result: ReturnType<typeof computeReadiness> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="relative">
      <div className="relative h-[60px]">{w !== null && <LiftedHome home={home} from={from} label={label} kx={keysX(result, w)} w={w} />}</div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: ease.out }}>
        <Road result={result} entrance="none" progressTo={result.monthsToReady} />
      </motion.div>
    </div>
  );
}

export const AimForHome = memo(function AimForHome({ profile, onSolve }: { profile: Profile; onSolve: (l: Levers) => void }) {
  const { t, lang } = useLang();
  const [homes, setHomes] = useState<Home[] | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  useEffect(() => {
    fetch('/api/homes')
      .then((r) => r.json())
      .then((d) => setHomes(d.homes))
      .catch(() => setHomes([]));
  }, []);
  const fits = useMemo(() => (homes ? fittingHomes(homes, profile.householdSize) : []), [homes, profile.householdSize]);
  const describe = (h: Home) => ({ city: h.city, br: h.bedrooms, month: monthName(h.completion, lang) });

  const [from, setFrom] = useState<DOMRect | null>(null);
  const resultNow = useMemo(() => computeReadiness(profile), [profile]);
  const reduceMotion = useReducedMotion();
  const outRef = useRef<HTMLDivElement>(null);
  // Bring the answer into view (the landing card, the Road and the sentence under it), only if it's below the fold.
  const outcomeKey = outcome ? outcome.homeId + outcome.text.join() : '';
  useEffect(() => {
    if (!outcomeKey) return;
    const id = requestAnimationFrame(() => {
      const el = outRef.current;
      if (!el) return;
      const need = el.getBoundingClientRect().bottom + 112 - window.innerHeight;
      if (need > 0) window.scrollBy({ top: need, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [outcomeKey, reduceMotion]);
  const pick = (h: Home, el?: HTMLElement) => {
    // the flight starts from this row's house drawing
    const g = el?.querySelector('[data-home-glyph]');
    setFrom(g ? g.getBoundingClientRect() : null);
    const target = monthsUntil(h.completion);
    const now = computeReadiness(profile);
    if (now.monthsToReady <= target) {
      setOutcome({ homeId: h.id, ok: true, text: [t('result.aimAlready', describe(h))] });
      return;
    }
    const sol = solveForDate(profile, target);
    if (!sol) {
      const earliest = fits.find((x) => solveForDate(profile, monthsUntil(x.completion)) !== null);
      setOutcome({ homeId: h.id, ok: false, text: [t('result.aimImpossible', describe(h)), earliest ? t('result.aimEarliest', describe(earliest)) : t('result.aimNoneWorks')] });
      return;
    }
    const delta = sol.addedPerMonth;
    setOutcome({
      homeId: h.id,
      ok: true,
      text: [
        t('result.aimSolved', { ...describe(h), debt: money(sol.extraDebt, lang), save: money(sol.monthlySavings, lang) }),
        delta > 0 ? t('result.aimMore', { amount: money(delta, lang) }) : delta < 0 ? t('result.aimLess', { amount: money(-delta, lang) }) : t('result.aimSame'),
      ],
    });
    onSolve({ ...profile.levers, extraDebt: sol.extraDebt, monthlySavings: sol.monthlySavings });
  };

  // The rows don't change while a slider moves; they're built once per selection (pick reads the live profile).
  const pickRef = useRef(pick);
  pickRef.current = pick;
  const selectedId = outcome?.homeId;
  const rows = useMemo(
    () => (
    <ul className="panel flex flex-col divide-y divide-line !p-0" data-testid="homes">
      {fits.map((h) => {
        const selected = selectedId === h.id;
        const done = t('result.done', { month: monthName(h.completion, lang, true) });
        return (
          <li key={h.id}>
            <button
              type="button"
              onClick={(e) => pickRef.current(h, e.currentTarget)}
              aria-pressed={selected}
              className={`relative flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-[120ms] first:rounded-t-[13px] last:rounded-b-[13px] ${selected ? 'bg-pine-soft' : 'hover:bg-paper'}`}
            >
              <span data-home-glyph className="shrink-0">
                <HomeGlyph bedrooms={h.bedrooms} size={30} brass={selected} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-medium text-ink">
                  {h.city} · {t('result.bedrooms', { n: h.bedrooms })}
                </span>
                <span className="t-helper tnum mt-1 block text-ink-2">
                  {h.address}
                  <span className="sm:hidden"> · {done}</span>
                </span>
              </span>
              <span className="tnum hidden shrink-0 text-[15px] text-ink-2 sm:block">{done}</span>
            </button>
          </li>
        );
      })}
    </ul>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fits, selectedId, lang],
  );

  return (
    <Section title={t('result.aimTitle')} id="aim">
      <p className="mb-4 text-[15px] text-ink-2">{t('result.aimHelp')}</p>
      {homes === null ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-[60px]" />
          ))}
        </div>
      ) : fits.length === 0 ? (
        <p className="panel text-[15px] text-ink-2">{t('result.aimNone', { n: profile.householdSize })}</p>
      ) : (
        rows
      )}
      <div ref={outRef}>
      {/* the solved plan: the chosen home lands beside Keys while the sliders glide and the Road re-flows */}
      <AnimatePresence initial={false} mode="popLayout">
        {outcome?.ok && homes && (() => {
          const h = homes.find((x) => x.id === outcome.homeId);
          if (!h) return null;
          return (
            <motion.div key={`lift-${h.id}`} exit={{ opacity: 0, transition: exitT }} className="mt-4">
              <AimLane home={h} from={from} label={t('result.done', { month: monthName(h.completion, lang, true) })} result={resultNow} />
            </motion.div>
          );
        })()}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {outcome && (
          <motion.div
            key={outcome.homeId + outcome.text.join()}
            {...reveal}
          >
            <p data-testid="aim-sentence" className={`tnum mt-4 border-l-2 pl-3 text-[16px] leading-[24px] ${outcome.ok ? 'border-pine text-ink' : 'border-signal-amber text-ink'}`}>
              {outcome.text.join(' ')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </Section>
  );
});
