'use client';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, animate, useReducedMotion } from 'motion/react';
import { Road } from './Road';
import { useLang } from '@/lib/i18n';
import { computeReadiness, monthsUntil, solveForDate } from '@/lib/engine';
import { fittingHomes } from '@/lib/homes';
import { monthName, money } from '@/lib/format';
import { ease, exit as exitT, reveal } from '@/lib/motion';
import { P } from '@/lib/illustrationPalette';
import type { Home, Levers, Profile } from '@/lib/types';
import { Section } from './Panels';
import { IsoHouse } from '@/components/illustrations/IsoHouse';

type Outcome = { homeId: string; text: string[]; ok: boolean };
/** Where a flight starts: the row's house at the tap, and the page's scroll then. */
type Flight = { rect: DOMRect; scrollY: number };
/** The plan re-solves once the flying home has landed (cause, then effect; and the flight runs on a quiet frame budget). */
const LAND = 0.7;

/**
 * The chosen home, standing at the end of the small Road. On arrival it flies there from its row: a small
 * lift first (anticipation), then it travels on two springs (x settles before y, so it arcs rather than
 * sliding straight), grows to size, and lands with a little squash while its shadow gathers under it.
 * Positioned from its bottom centre, so it scales about the point it lands on.
 */
const FlyingHome = memo(function FlyingHome({ from }: { from: Flight | null }) {
  // three nested layers so each axis has its own curve: x settles first, y lifts then falls, the house scales
  const xs = useRef<HTMLDivElement>(null);
  const ys = useRef<HTMLDivElement>(null);
  const ss = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useLayoutEffect(() => {
    const [xe, ye, se, sh] = [xs.current, ys.current, ss.current, shadow.current];
    if (!xe || !ye || !se || !sh || !from || reduce) return;
    // hidden for one frame while the Road settles its own layout (its slot is placed in an effect), then measured
    xe.style.opacity = '0';
    sh.style.opacity = '0';
    const runs: { stop: () => void }[] = [];
    const raf = requestAnimationFrame(() => {
      const to = se.getBoundingClientRect();
      // the row was measured at the tap; the page may have scrolled since
      const scrolled = window.scrollY - from.scrollY;
      const s0 = from.rect.width / Math.max(1, to.width);
      const dx = from.rect.left + from.rect.width / 2 - (to.left + to.width / 2);
      const dy = from.rect.bottom - scrolled - to.bottom;
      const T = 0.74;
      const lift = 0.16; // share of the flight spent lifting off the row (anticipation)
      xe.style.opacity = '1';
      runs.push(
        // across fast and easing off; meanwhile it comes down gathering speed, so the path arcs and it lands with weight
        animate(xe, { x: [dx, dx, 0] }, { duration: 0.62, times: [0, lift, 1], ease: [ease.out, ease.out] }),
        animate(ye, { y: [dy, dy - 12, 0] }, { duration: T, times: [0, lift, 1], ease: [ease.out, [0.45, 0, 0.7, 0.55]] }),
        animate(se, { scale: [s0, s0 * 1.08, 1] }, { duration: T, times: [0, lift, 1], ease: [ease.out, ease.out] }),
        // the landing: a little squash and recovery from the ground up
        animate(se, { scaleY: [1, 0.88, 1.03, 1], scaleX: [1, 1.06, 0.99, 1] }, { duration: 0.4, ease: ease.out, delay: T - 0.02 }),
        // its shadow gathers under it as it comes down
        animate(sh, { opacity: [0, 1], scaleX: [0.4, 1] }, { duration: 0.4, ease: ease.out, delay: T - 0.32 }),
      );
    });
    return () => {
      cancelAnimationFrame(raf);
      runs.forEach((r) => r.stop());
      xe.style.opacity = '';
      sh.style.opacity = '';
    };
  }, [from, reduce]);
  return (
    <div className="relative h-full w-full" data-testid="aim-card">
      <div ref={shadow} aria-hidden className="absolute -bottom-[3px] left-[2%] h-[10px] w-[96%]" style={{ background: `radial-gradient(closest-side, ${P.shadow}, transparent)` }} />
      <div ref={xs} className="absolute inset-0 will-change-transform">
        <div ref={ys} className="absolute inset-0 will-change-transform">
          <div ref={ss} className="absolute inset-0 will-change-transform" style={{ transformOrigin: '50% 100%' }}>
            <IsoHouse size={100} lit porch doorBrass className="!h-auto !w-full" />
          </div>
        </div>
      </div>
    </div>
  );
});

/** The small Road with the chosen home standing where it ends. */
function AimLane({ home, from, label, result }: { home: Home; from: Flight | null; label: string; result: ReturnType<typeof computeReadiness> }) {
  return <Road result={result} entrance="none" progressTo={result.monthsToReady} keysVariant="slot" slotKind="home" keysLabel={label} keysSlot={<FlyingHome key={home.id} from={from} />} />;
}

export const AimForHome = memo(function AimForHome({ profile, onSolve, onChosen }: { profile: Profile; onSolve: (l: Levers) => void; onChosen?: (h: Home | null) => void }) {
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

  const [from, setFrom] = useState<Flight | null>(null);
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
  const solveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (solveTimer.current && clearTimeout(solveTimer.current)), []);
  // the chosen row's own house leaves while its copy flies to the Road, and comes back lit
  const [flying, setFlying] = useState<string | null>(null);
  useEffect(() => {
    if (!flying) return;
    const id = setTimeout(() => setFlying(null), 760);
    return () => clearTimeout(id);
  }, [flying]);
  // the home standing at the end of the result Road (only while a plan reaches it)
  const chosenId = outcome?.ok ? outcome.homeId : null;
  useEffect(() => {
    onChosen?.(chosenId && homes ? (homes.find((x) => x.id === chosenId) ?? null) : null);
  }, [chosenId, homes, onChosen]);
  const pick = (h: Home, el?: HTMLElement) => {
    // a second tap on the chosen home puts it back
    if (outcome?.homeId === h.id) {
      if (solveTimer.current) clearTimeout(solveTimer.current);
      setOutcome(null);
      return;
    }
    // the flight starts from this row's house drawing
    const g = el?.querySelector('[data-home-glyph] svg');
    setFrom(g ? { rect: g.getBoundingClientRect(), scrollY: window.scrollY } : null);
    const fly = () => !reduceMotion && setFlying(h.id);
    const target = monthsUntil(h.completion);
    const now = computeReadiness(profile);
    if (now.monthsToReady <= target) {
      fly();
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
    fly();
    setOutcome({
      homeId: h.id,
      ok: true,
      text: [
        t('result.aimSolved', { ...describe(h), debt: money(sol.extraDebt, lang), save: money(sol.monthlySavings, lang) }),
        delta > 0 ? t('result.aimMore', { amount: money(delta, lang) }) : delta < 0 ? t('result.aimLess', { amount: money(-delta, lang) }) : t('result.aimSame'),
      ],
    });
    const levers = { ...profile.levers, extraDebt: sol.extraDebt, monthlySavings: sol.monthlySavings };
    if (solveTimer.current) clearTimeout(solveTimer.current);
    if (reduceMotion || !g) onSolve(levers);
    else solveTimer.current = setTimeout(() => onSolve(levers), LAND * 1000);
  };

  // The rows don't change while a slider moves; they're built once per selection (pick reads the live profile).
  const pickRef = useRef(pick);
  pickRef.current = pick;
  const selectedId = outcome?.homeId;
  const flyingId = flying;
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
              <span data-home-glyph className={`block w-[46px] shrink-0 transition-opacity ${flyingId === h.id ? 'opacity-0 duration-0' : 'opacity-100 duration-200'}`}>
                <IsoHouse size={46} lit={selected} porch={selected} doorBrass={selected} />
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
    [fits, selectedId, flyingId, lang],
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
              <AimLane home={h} from={from} label={`${h.city} · ${t('result.done', { month: monthName(h.completion, lang, true) })}`} result={resultNow} />
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
