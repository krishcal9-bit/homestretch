'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion, useSpring } from 'motion/react';
import { useLang } from '@/lib/i18n';
import { computeReadiness, monthsUntil, isEligible } from '@/lib/engine';
import { homeFits } from '@/lib/homes';
import { monthName, money } from '@/lib/format';
import { ease, spring } from '@/lib/motion';
import { useVTRouter } from '@/lib/vt';
import { SEED_FAMILIES, SEED_HOMES } from '@/lib/seedData';
import { Slider } from '@/components/ui/Slider';
import { Segmented } from '@/components/ui/Segmented';
import { AnimatedMonth } from '@/components/ui/AnimatedMonth';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Road } from '@/components/result/Road';
import { Skyline } from '@/components/ui/Skyline';
import { Intro, INTRO } from '@/components/Intro';
import { SectionArrow, SectionDots, SectionNavProvider, useSectionNav } from './SectionNav';
import { PhoneVoice } from '@/components/illustrations/landing/PhoneVoice';
import { JourneyRoad } from '@/components/illustrations/landing/JourneyRoad';
import { NeighborhoodMap } from '@/components/illustrations/landing/NeighborhoodMap';
import { HundredHouses } from '@/components/illustrations/landing/HundredHouses';
import { AnimatePresence } from 'motion/react';
import { StaffLink, Wordmark } from '@/components/FamilyHeader';
import type { Profile } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Load sequence (seconds from first paint). One movement, ~1.4s.      */
/* ------------------------------------------------------------------ */
const SEQ = {
  line: 0.45, // each headline line slides up from 100%
  lineStagger: 0.08,
  sub: 0.35, // subline + buttons fade up 12px
  roadAt: 0.5, // track draws 0.5 → 1.3s, markers pop as the line reaches them
  roadDraw: 0.8,
  dateAt: 0.9, // date odometer 0.9 → 1.4s
  date: 0.5,
  nudgeAt: 1.4, // slider thumb nudge
};

type Phase = 'pending' | 'opening' | 'play' | 'static' | 'reduced';
const animated = (p: Phase) => p === 'play' || p === 'opening';
/** In the opening, the hero assembles under the pull-back, so every hero beat shifts by this much. */
const offset = (p: Phase) => (p === 'opening' ? INTRO.pull : 0);

/** Decides once per visit whether the intro plays. Before hydration everything holds its final layout, invisibly. */
function useIntroPhase(): [Phase, (p: Phase) => void] {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('pending');
  useEffect(() => {
    const html = document.documentElement;
    if (reduce) {
      html.classList.remove('hs-veil');
      return setPhase('reduced');
    }
    // The intro plays on every load. Tests (and anyone linking past it) can opt out with ?nointro.
    let skip = false;
    try {
      skip = !!sessionStorage.getItem('hs.nointro') || new URLSearchParams(location.search).has('nointro');
    } catch {}
    if (skip) html.classList.remove('hs-veil');
    setPhase(skip ? 'play' : 'opening');
  }, [reduce]);
  return [phase, setPhase];
}

/* ------------------------------------------------------------------ */
/* Sample families                                                      */
/* ------------------------------------------------------------------ */
const FAMILIES: Record<'reyes' | 'nguyen', Profile> = {
  reyes: {
    householdSize: 4, inOC: true, residentOrCitizen: true, grossMonthlyIncome: 5200, otherMonthlyIncome: 0,
    rent: 2350, bedrooms: 1, occupants: 4, unsafeConditions: false,
    debts: [{ kind: 'card', balance: 2100, minPayment: 65 }, { kind: 'collection', balance: 1900, minPayment: 0 }],
    savings: 3100, creditBand: 'needs_work', openCollections: 1, levers: { extraDebt: 150, monthlySavings: 150, coApplicantIncome: 0 },
  },
  nguyen: {
    householdSize: 3, inOC: true, residentOrCitizen: true, grossMonthlyIncome: 6400, otherMonthlyIncome: 0,
    rent: 2200, bedrooms: 2, occupants: 3, unsafeConditions: false,
    debts: [{ kind: 'car', balance: 6000, minPayment: 290 }, { kind: 'card', balance: 1800, minPayment: 55 }],
    savings: 2400, creditBand: 'building', levers: { extraDebt: 100, monthlySavings: 300, coApplicantIncome: 0 },
  },
};

const shiftMonth = (iso: string, k: number) => {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + k, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/* ------------------------------------------------------------------ */
/* Headline: measured line by line, each line slides up through a mask  */
/* ------------------------------------------------------------------ */
function Headline({ text, phase }: { text: string; phase: Phase }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [lines, setLines] = useState<string[] | null>(null);
  const words = text.split(' ');
  useLayoutEffect(() => {
    setLines(null);
  }, [text]);
  useLayoutEffect(() => {
    if (lines || !ref.current) return;
    const spans = Array.from(ref.current.querySelectorAll<HTMLSpanElement>('[data-w]'));
    const out: string[][] = [];
    let top = -1;
    for (const s of spans) {
      if (Math.abs(s.offsetTop - top) > 4) {
        out.push([]);
        top = s.offsetTop;
      }
      out[out.length - 1].push(s.textContent ?? '');
    }
    setLines(out.map((l) => l.join(' ')));
  }, [lines, text]);
  const cls = 'text-[40px] font-semibold leading-[44px] tracking-[-0.02em] text-ink sm:text-[52px] sm:leading-[56px] xl:mr-[-32px] xl:text-[64px] xl:leading-[68px]';
  if (!lines || phase === 'pending')
    return (
      <h1 ref={ref} className={cls} style={{ visibility: 'hidden', textWrap: 'wrap' }} data-intro>
        {words.map((w, i) => (
          <span key={i} data-w>
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </h1>
    );
  const play = animated(phase);
  const stag = phase === 'opening' ? 0.07 : SEQ.lineStagger;
  return (
    <h1 className={cls} aria-label={text} style={{ textWrap: 'wrap' }}>
      {lines.map((line, i) => (
        <span key={`${line}-${i}`} className="block overflow-hidden" aria-hidden>
          <motion.span
            className="block whitespace-nowrap"
            initial={play ? { y: '100%' } : phase === 'reduced' ? { opacity: 0 } : false}
            animate={{ y: '0%', opacity: 1 }}
            transition={play ? { duration: SEQ.line, ease: ease.out, delay: offset(phase) + i * stag } : { duration: 0.15 }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

/** Ready date that counts in like an odometer through earlier months, then swaps vertically on change. */
function OdometerDate({ iso, phase, lang }: { iso: string; phase: Phase; lang: 'en' | 'es' }) {
  // Unsettled only while the intro plays; decided when the phase is known (not during the pre-hydration render).
  const [settled, setSettled] = useState(true);
  useEffect(() => {
    setSettled(!animated(phase));
  }, [phase]);
  const at = phase === 'opening' ? INTRO.pull + 0.2 : SEQ.dateAt;
  const final = monthName(iso, lang);
  const lineH = 1.05; // em
  if (!settled) {
    const strip = [-3, -2, -1, 0].map((k) => monthName(shiftMonth(iso, k), lang));
    return (
      <span className="relative block overflow-hidden" style={{ height: `${lineH}em` }}>
        <motion.span
          className="block"
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: `-${(strip.length - 1) * lineH}em`, opacity: 1 }}
          transition={{ y: { duration: SEQ.date, ease: ease.out, delay: at }, opacity: { duration: 0.12, delay: at } }}
          onAnimationComplete={() => setSettled(true)}
        >
          {strip.map((s, i) => (
            <span key={i} className="block whitespace-nowrap" style={{ height: `${lineH}em`, lineHeight: `${lineH}em` }}>
              {s}
            </span>
          ))}
        </motion.span>
      </span>
    );
  }
  return (
    <motion.span className="block" style={{ height: `${lineH}em`, lineHeight: `${lineH}em` }} initial={phase === 'reduced' ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
      <AnimatedMonth text={final} testId="sample-date" />
    </motion.span>
  );
}

/* ------------------------------------------------------------------ */
/* Hero demo                                                            */
/* ------------------------------------------------------------------ */
function HeroDemo({ phase, onEarlier }: { phase: Phase; onEarlier: () => void }) {
  const { t, lang } = useLang();
  const reduce = useReducedMotion();
  const [family, setFamily] = useState<'reyes' | 'nguyen'>('reyes');
  const [extra, setExtra] = useState<Record<string, number>>({ reyes: FAMILIES.reyes.levers.extraDebt, nguyen: FAMILIES.nguyen.levers.extraDebt });
  const profile = FAMILIES[family];
  const result = useMemo(() => computeReadiness({ ...profile, levers: { ...profile.levers, extraDebt: extra[family] } }), [profile, extra, family]);
  const play = animated(phase);
  const t0 = offset(phase);

  // "7 months sooner" pill: delta since the drag began; fades 1.5s after the last change.
  const baseline = useRef<number | null>(null);
  const lastMonths = useRef(result.monthsToReady);
  const [delta, setDelta] = useState<{ n: number; id: number } | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [keysGlow, setKeysGlow] = useState(0);
  const [dragged, setDragged] = useState(true);
  useEffect(() => {
    try {
      setDragged(!!localStorage.getItem('hs.dragged'));
    } catch {}
  }, []);
  const onSlide = (v: number) => {
    if (baseline.current === null) baseline.current = result.monthsToReady;
    setExtra((x) => ({ ...x, [family]: v }));
    if (!dragged) {
      setDragged(true);
      try {
        localStorage.setItem('hs.dragged', '1');
      } catch {}
    }
  };
  useEffect(() => {
    const m = result.monthsToReady;
    if (m === lastMonths.current) return;
    const earlier = m < lastMonths.current;
    lastMonths.current = m;
    if (baseline.current === null) return; // family switch, not a drag
    const n = m - baseline.current;
    if (earlier) {
      setKeysGlow((k) => k + 1);
      onEarlier();
    }
    if (n !== 0) setDelta({ n, id: Date.now() });
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => {
      setDelta(null);
      baseline.current = null;
    }, 1500);
  }, [result.monthsToReady, onEarlier]);
  const switchFamily = (f: 'reyes' | 'nguyen') => {
    baseline.current = null;
    setDelta(null);
    setFamily(f);
  };

  // Cursor-aware depth (desktop pointers only): the Road tilts up to 2° toward the cursor.
  const rx = useSpring(0, { stiffness: 120, damping: 20 });
  const ry = useSpring(0, { stiffness: 120, damping: 20 });
  const [fine, setFine] = useState(false);
  useEffect(() => setFine(window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduce), [reduce]);
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!fine) return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set((((e.clientX - r.left) / r.width) * 2 - 1) * 2);
    rx.set(-(((e.clientY - r.top) / r.height) * 2 - 1) * 2);
  };
  const reset = () => {
    rx.set(0);
    ry.set(0);
  };

  const fade = (delay: number) =>
    play
      ? { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, ease: ease.out, delay: t0 + delay } }
      : { initial: phase === 'reduced' ? { opacity: 0 } : false, animate: { opacity: 1 }, transition: { duration: 0.15 } };
  const deltaText = delta ? (delta.n < 0 ? (delta.n === -1 ? t('landing.sooner1') : t('landing.sooner', { n: -delta.n })) : delta.n === 1 ? t('landing.later1') : t('landing.later', { n: delta.n })) : '';

  return (
    <div className="relative [perspective:1200px]" onPointerMove={onMove} onPointerLeave={reset} data-testid="sample-road" data-intro style={{ visibility: phase === 'pending' ? 'hidden' : undefined }}>
      <motion.div {...fade(phase === 'opening' ? 0.1 : SEQ.sub)} className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-[280px]">
          <Segmented<'reyes' | 'nguyen'>
            size="sm"
            label={t('landing.families')}
            value={family}
            onChange={switchFamily}
            options={[
              { value: 'reyes', label: t('landing.reyes') },
              { value: 'nguyen', label: t('landing.nguyen') },
            ]}
          />
        </div>
        <p className="t-helper min-h-[15px] text-ink-2">
          <AnimatedMonth wrap text={t(family === 'reyes' ? 'landing.reyesWho' : 'landing.nguyenWho')} />
        </p>
      </motion.div>

      <div className="relative mt-8 [container-type:inline-size]">
        <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 h-[260px] w-[520px] max-w-full" style={{ background: 'radial-gradient(closest-side, rgba(30,92,71,0.08), transparent)' }} />
        <div className="relative flex min-h-[28px] items-center justify-between gap-3">
          <motion.p {...fade(phase === 'opening' ? 0.15 : SEQ.dateAt - 0.1)} className="text-[15px] text-ink-2">
            {t('landing.readyBy')}
          </motion.p>
          {/* reserved slot: the pill never shifts layout */}
          <div className="relative h-[28px]" aria-live="polite">
            <AnimatePresence>
              {delta && (
                <motion.span
                  key="pill"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.2 } }}
                  transition={{ duration: 0.16, ease: ease.out }}
                  className={`tnum absolute right-0 top-0 inline-flex h-[28px] items-center whitespace-nowrap rounded-full px-3 text-[13px] font-medium transition-colors duration-200 ${delta.n < 0 ? 'bg-pine text-white' : 'bg-surface text-ink-2 ring-1 ring-line'}`}
                  data-testid="delta-pill"
                >
                  {/* one pill; only its text swaps while the drag continues */}
                  <AnimatedMonth text={deltaText} />
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
        <p className="tnum relative mt-1 text-[min(80px,13cqw)] font-semibold tracking-[-0.02em] text-brass" aria-live="polite">
          <OdometerDate iso={result.readyDate} phase={phase} lang={lang} />
        </p>
      </div>

      <motion.div className="mt-6 origin-center" style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}>
        {phase !== 'pending' && (
          <Road
            result={result}
            size="lg"
            entrance={play ? 'always' : 'none'}
            entranceDelay={phase === 'opening' ? INTRO.pull + 0.3 : SEQ.roadAt}
            drawDuration={phase === 'opening' ? 0.5 : SEQ.roadDraw}
            drawEase="inOut"
            trackDrawn={phase === 'opening'}
            keysAt={phase === 'opening' ? INTRO.total - 0.12 : undefined}
            progressTo={result.monthsToReady}
            keysGlow={keysGlow}
            keysVariant="house"
          />
        )}
        {phase === 'pending' && <div className="h-[114px]" />}
      </motion.div>

      <motion.div {...fade(phase === 'opening' ? 0.35 : SEQ.roadAt + 0.3)} className="mt-6">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="sample-extra" className="text-[16px] font-medium text-ink">
            {t('landing.lever')}
          </label>
          <span className="tnum text-[16px] font-medium text-ink">
            <AnimatedNumber value={extra[family]} format={(n) => t('result.perMonth', { amount: money(n, lang) })} />
          </span>
        </div>
        <Slider
          id="sample-extra"
          size="lg"
          value={extra[family]}
          min={0}
          max={400}
          step={10}
          onChange={onSlide}
          label={t('landing.lever')}
          valueText={money(extra[family], lang)}
          nudgeAt={play ? (phase === 'opening' ? INTRO.total + 0.3 : SEQ.nudgeAt) : undefined}
        />
        <div className="h-[20px]">
          <AnimatePresence>
            {!dragged && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: play ? t0 + 1.6 : 0, duration: 0.3 } }} exit={{ opacity: 0, transition: { duration: 0.15 } }} className="t-helper text-ink-2">
                {t('landing.hint')}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function Hero({ phase }: { phase: Phase }) {
  const { t } = useLang();
  const router = useVTRouter();
  const reduce = useReducedMotion();
  const play = animated(phase);
  const t0 = offset(phase);
  const [flash, setFlash] = useState(0);
  const onEarlier = useMemo(() => () => setFlash((f) => f + 1), []);
  const fadeUp = play
    ? { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, ease: ease.out, delay: t0 + (phase === 'opening' ? 0.25 : SEQ.sub) } }
    : { initial: phase === 'reduced' ? { opacity: 0 } : false, animate: { opacity: 1 }, transition: { duration: 0.15 } };
  return (
    <section id="hero" data-testid="hero" className="snap-section relative min-h-[calc(100svh-64px)] overflow-hidden">
      <div className="relative z-[1] mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-x-8 gap-y-14 px-5 pb-40 pt-10 lg:min-h-[calc(100svh-64px)] lg:grid-cols-12 lg:px-8 lg:pb-36 lg:pt-8">
        <div className="lg:col-span-6 xl:col-span-5">
          <motion.p {...fadeUp} transition={play ? { duration: 0.3, ease: ease.out, delay: t0 } : fadeUp.transition} className="mb-5 text-[15px] text-ink-2">
            {t('app.partner')}
          </motion.p>
          <Headline text={t('landing.headline')} phase={phase} />
          <motion.p {...fadeUp} className="mt-6 max-w-[44ch] text-[18px] leading-[28px] text-ink-2 lg:text-[20px] lg:leading-[30px]" data-intro style={{ visibility: phase === 'pending' ? 'hidden' : undefined }}>
            {t('landing.sub')}
          </motion.p>
          <motion.div {...fadeUp} className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4" data-intro style={{ visibility: phase === 'pending' ? 'hidden' : undefined }}>
            <motion.a
              href="/start"
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                e.preventDefault();
                router.push('/start', 'start');
              }}
              whileTap={{ scale: 0.97 }}
              transition={spring.snappy}
              className="inline-flex min-h-[56px] items-center rounded-[8px] bg-pine px-8 text-[20px] font-medium text-white transition-colors duration-[120ms] hover:bg-pine-hover"
              style={{ viewTransitionName: 'cta' }}
              data-testid="find-my-date"
            >
              {t('landing.cta')}
            </motion.a>
            <a
              href="#story"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('story')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
              }}
              className="hit inline-flex min-h-[44px] items-center text-[17px] font-medium text-pine underline-offset-4 hover:underline"
            >
              {t('landing.how')}
            </a>
          </motion.div>
        </div>
        <div className="lg:col-span-6 xl:col-span-7 xl:pl-8">
          <HeroDemo phase={phase} onEarlier={onEarlier} />
        </div>
      </div>
      {/* The street the Road heads toward. Living: one window glows at a time. */}
      <div className="absolute inset-x-0 bottom-0 z-0" style={{ visibility: phase === 'pending' ? 'hidden' : undefined }}>
        <Skyline mode="living" count={16} parallax stagger={0.03} drawInAt={phase === 'opening' ? INTRO.pull + 0.3 : phase === 'play' ? 1.3 : false} flashKey={flash} height={120} />
      </div>
      <SectionArrow index={0} label={t('landing.arrowNext')} topLabel={t('landing.arrowTop')} />
    </section>
  );
}

/** One line of real sample-family progress from the seed data, crossfading every 3s. */
function Ticker() {
  const { t } = useLang();
  const reduce = useReducedMotion();
  const lines = useMemo(() => {
    const out: string[] = [];
    for (const f of SEED_FAMILIES) {
      const r = computeReadiness(f.profile);
      if (!isEligible(r)) continue;
      const v = { city: f.city, n: f.profile.householdSize };
      const home = SEED_HOMES.find((h) => homeFits(f.profile.householdSize, h.bedrooms) && r.monthsToReady <= monthsUntil(h.completion));
      if (home && r.monthsToReady > 0) out.push(t('landing.tMatched', { ...v, br: home.bedrooms }));
      else if (r.monthsToReady === 0) out.push(t('landing.tReadyNow', v));
      else if (r.milestones.find((m) => m.key === 'savings')?.month === 0) out.push(t('landing.tSaved', v));
      else out.push(t('landing.tReady', { ...v, m: r.monthsToReady }));
    }
    return out;
  }, [t]);
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') setI((x) => (x + 1) % lines.length);
    }, 3000);
    return () => clearInterval(id);
  }, [lines.length]);
  return (
    <div className="border-l-2 border-line pl-4" data-testid="ticker">
      <p className="t-helper text-ink-2">{t('landing.tickerLabel')}</p>
      <div className="relative mt-2 h-[44px] overflow-hidden" aria-live="off">
        <AnimatePresence initial={false}>
          <motion.p
            key={i}
            className="absolute inset-x-0 top-0 flex items-start gap-3 text-[15px] leading-[22px] text-ink"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: ease.out }}
          >
            <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden className="mt-[5px] shrink-0">
              <path d="M1 9h16" stroke="var(--line)" strokeWidth="2" strokeLinecap="round" />
              <circle cx="3" cy="9" r="2" fill="var(--brass)" />
              <path d="M19 10V5.5L23 2l4 3.5V10z" fill="none" stroke="var(--pine)" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span className="tnum">{lines[i]}</span>
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                             */
/* ------------------------------------------------------------------ */
/** Section headline: rises from a mask every time its section becomes active. */
function MaskHeading({ children, reduce }: { children: React.ReactNode; reduce: boolean }) {
  return (
    <h2 className="overflow-hidden pb-[0.06em] text-[32px] font-semibold leading-[38px] tracking-[-0.02em] text-ink lg:text-[44px] lg:leading-[48px]">
      <motion.span className="block" initial={reduce ? { opacity: 0 } : { y: '100%' }} animate={{ y: '0%', opacity: 1 }} transition={{ duration: reduce ? 0.15 : SEQ.line, ease: ease.out }}>
        {children}
      </motion.span>
    </h2>
  );
}

/** A full-viewport section: text on one side, a large illustration on the other (alternating); graphic first on phones. */
function SceneSection({ id, index, flip = false, bob = false, text, graphic, minGraphic = 420 }: { id: string; index: number; flip?: boolean; bob?: boolean; text: (reduce: boolean) => React.ReactNode; graphic: (reduce: boolean) => React.ReactNode; minGraphic?: number }) {
  const { t } = useLang();
  const reduce = !!useReducedMotion();
  const { activations } = useSectionNav();
  const n = activations[index] ?? 0; // replays its animation each time the section becomes active
  return (
    <section id={id} data-testid={id} className="snap-section relative flex min-h-[calc(100svh-64px)] items-center overflow-hidden" aria-label={t(`landing.nav${index}`)}>
      <div className="mx-auto grid w-full max-w-[1280px] grid-cols-1 items-center gap-10 px-5 pb-24 pt-12 lg:grid-cols-12 lg:gap-12 lg:px-8 lg:pb-20 lg:pt-8">
        <div className={`lg:col-span-5 ${flip ? 'lg:order-2' : ''}`} key={`t${n}`}>
          {n > 0 ? text(reduce) : <div className="invisible">{text(true)}</div>}
        </div>
        <div className={`order-first lg:col-span-7 ${flip ? 'lg:order-1' : 'lg:order-2'}`} style={{ minHeight: minGraphic }}>
          {n > 0 && <div key={`g${n}`}>{graphic(reduce)}</div>}
        </div>
      </div>
      <SectionArrow index={index} label={t('landing.arrowNext')} topLabel={t('landing.arrowTop')} bob={bob} />
    </section>
  );
}

function SceneIntake() {
  const { t } = useLang();
  return (
    <SceneSection
      id="scene-intake"
      index={1}
      bob
      minGraphic={560}
      text={(reduce) => (
        <>
          <MaskHeading reduce={reduce}>{t('landing.s1')}</MaskHeading>
          <motion.p initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: ease.out, delay: 0.15 }} className="mt-5 max-w-[40ch] text-[18px] leading-[28px] text-ink-2">
            {t('landing.s1b')}
          </motion.p>
        </>
      )}
      graphic={(reduce) => <PhoneVoice reduce={reduce} />}
    />
  );
}

function SceneRoad() {
  const { t } = useLang();
  const caps = [
    [t('landing.c1'), t('landing.c1b')],
    [t('landing.c2'), t('landing.c2b')],
    [t('landing.c3'), t('landing.c3b')],
  ];
  return (
    <SceneSection
      id="scene-road"
      index={2}
      flip
      bob
      minGraphic={400}
      text={(reduce) => (
        <>
          <MaskHeading reduce={reduce}>{t('landing.s2')}</MaskHeading>
          <ul className="mt-6 flex flex-col gap-4">
            {caps.map(([title, body], i) => (
              <motion.li key={title} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: ease.out, delay: 0.2 + i * 0.6 }} className="border-l-2 border-pine pl-4">
                <span className="block text-[17px] font-semibold text-ink">{title}</span>
                <span className="mt-1 block text-[16px] leading-[24px] text-ink-2">{body}</span>
              </motion.li>
            ))}
          </ul>
        </>
      )}
      graphic={(reduce) => <JourneyRoad reduce={reduce} />}
    />
  );
}

function SceneHomes() {
  const { t } = useLang();
  const lots = useMemo(() => {
    const fams = SEED_FAMILIES.map((f) => ({ f, r: computeReadiness(f.profile) })).filter((x) => isEligible(x.r));
    return SEED_HOMES.slice(0, 6).map((h) => ({
      id: h.id,
      label: `${h.city} · ${h.bedrooms}BR`,
      ready: fams.filter((x) => homeFits(x.f.profile.householdSize, h.bedrooms) && x.r.monthsToReady <= monthsUntil(h.completion)).length,
    }));
  }, []);
  return (
    <SceneSection
      id="scene-homes"
      index={3}
      minGraphic={380}
      text={(reduce) => (
        <>
          <MaskHeading reduce={reduce}>{t('landing.s3')}</MaskHeading>
          <motion.p initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: ease.out, delay: 0.15 }} className="mt-5 max-w-[40ch] text-[18px] leading-[28px] text-ink-2">
            {t('landing.s3b')}
          </motion.p>
          <div className="mt-8">
            <Ticker />
          </div>
        </>
      )}
      graphic={(reduce) => <NeighborhoodMap lots={lots} reduce={reduce} />}
    />
  );
}

/** The only dark section: 100 houses fill in white while the counter rolls to 100; then the sentence and button rise. */
function Closing() {
  const { t } = useLang();
  const router = useVTRouter();
  const reduce = !!useReducedMotion();
  const { activations } = useSectionNav();
  const n = activations[4] ?? 0;
  const [a1, a2] = t('landing.closingA').split('{n}');
  const [b1, b2] = t('landing.closingB').split('{n}');
  const fmt = (v: number) => String(Math.round(v));
  return (
    <section id="closing" data-testid="closing" className="snap-section relative flex min-h-[calc(100svh-64px)] flex-col bg-pine text-white" aria-label={t('landing.nav4')}>
      <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col justify-center px-5 py-16 lg:px-8" key={n}>
        {n > 0 && (
          <>
            <div className="flex flex-wrap items-end gap-x-10 gap-y-6">
              <HundredHouses reduce={reduce} />
              <p className="tnum text-[72px] font-semibold leading-none tracking-[-0.02em] lg:text-[96px]">
                <RollTo to={100} reduce={reduce} format={fmt} />
              </p>
            </div>
            <motion.p
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: ease.out, delay: reduce ? 0 : 0.9 }}
              className="tnum mt-12 max-w-[24ch] text-[34px] font-semibold leading-[40px] tracking-[-0.02em] lg:text-[52px] lg:leading-[56px]"
            >
              {a1}
              <RollTo to={100} reduce={reduce} format={fmt} />
              {a2} {b1}
              <RollTo to={100} reduce={reduce} format={fmt} />
              {b2}
            </motion.p>
            <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: ease.out, delay: reduce ? 0 : 1.1 }}>
              <motion.a
                href="/start"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                  e.preventDefault();
                  router.push('/start', 'start');
                }}
                whileTap={{ scale: 0.97 }}
                transition={spring.snappy}
                className="mt-10 inline-flex min-h-[56px] items-center rounded-[8px] bg-white px-8 text-[20px] font-medium text-pine transition-colors duration-[120ms] hover:bg-pine-soft focus-visible:outline-white"
              >
                {t('landing.cta')}
              </motion.a>
            </motion.div>
          </>
        )}
      </div>
      {/* the up arrow sits in the pine band, above the footer */}
      <div className="relative h-[76px]">
        <SectionArrow index={4} label={t('landing.arrowNext')} topLabel={t('landing.arrowTop')} tone="dark" />
      </div>
      <Footer />
    </section>
  );
}

/** Starts at 0 and rolls to `to` (springs), unless reduced motion. */
function RollTo({ to, reduce, format }: { to: number; reduce: boolean; format: (n: number) => string }) {
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setV(to));
    return () => cancelAnimationFrame(id);
  }, [to]);
  return <AnimatedNumber value={v} format={format} />;
}

function Footer() {
  const { t } = useLang();
  const router = useVTRouter();
  const [code, setCode] = useState('');
  return (
    <footer className="border-t border-white/20 bg-paper text-ink">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-8 px-5 py-10 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div>
          <Wordmark />
          <p className="t-helper mt-3 text-ink-2">{t('landing.footerPartner')}</p>
        </div>
        <form
          className="flex items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) router.push(`/plan/${code.trim().toUpperCase()}`, 'forward');
          }}
        >
          <label>
            <span className="mb-2 block text-[13px] font-medium text-ink-2">{t('welcome.haveCode')}</span>
            <input className="field w-[160px] uppercase tracking-[0.08em] placeholder:normal-case placeholder:tracking-normal" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" aria-label={t('welcome.codeLabel')} placeholder={t('welcome.codeLabel')} />
          </label>
          <button type="submit" className="press min-h-[48px] rounded-[8px] border border-line bg-surface px-4 text-[15px] font-medium text-ink hover:bg-paper">
            {t('welcome.openPlan')}
          </button>
        </form>
        <StaffLink />
      </div>
    </footer>
  );
}

const SECTIONS = ['hero', 'scene-intake', 'scene-road', 'scene-homes', 'closing'];

export function Landing() {
  const { t } = useLang();
  const [phase, setPhase] = useIntroPhase();
  const [intro, setIntro] = useState(true);
  const onIntroDone = useCallback(() => setIntro(false), []);
  const onIntroSkip = useCallback(() => {
    setIntro(false);
    setPhase('static');
  }, [setPhase]);
  return (
    <SectionNavProvider ids={SECTIONS} enabled={!(phase === 'opening' && intro)}>
      {/* Without JavaScript the intro never runs: show everything. */}
      <noscript>
        <style>{`[data-intro]{visibility:visible!important}`}</style>
      </noscript>
      <AnimatePresence>
        {phase === 'opening' && intro && (
          <motion.div key="intro" exit={{ opacity: 0, transition: { duration: 0.2 } }}>
            <Intro onDone={onIntroDone} onSkip={onIntroSkip} />
          </motion.div>
        )}
      </AnimatePresence>
      {/* a skip remounts the hero straight into its final state */}
      <Hero key={phase === 'static' ? 'static' : 'live'} phase={phase} />
      <SceneIntake />
      <SceneRoad />
      <SceneHomes />
      <Closing />
      <SectionDots labels={SECTIONS.map((_, i) => t(`landing.nav${i}`))} />
    </SectionNavProvider>
  );
}
