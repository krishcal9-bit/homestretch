'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { Mic } from 'lucide-react';
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
import { Opening, OPEN, OPEN_TOTAL } from './Opening';
import { AnimatePresence } from 'motion/react';
import { StaffLink, Wordmark } from '@/components/FamilyHeader';
import type { MilestoneKey, Profile } from '@/lib/types';

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
const offset = (p: Phase) => (p === 'opening' ? OPEN.pull : 0);

/** Decides once per visit whether the intro plays. Before hydration everything holds its final layout, invisibly. */
function useIntroPhase(): [Phase, (p: Phase) => void] {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('pending');
  useEffect(() => {
    if (reduce) {
      document.documentElement.classList.remove('hs-veil');
      return setPhase('reduced');
    }
    let opened = false;
    try {
      opened = !!sessionStorage.getItem('hs.opened');
      sessionStorage.setItem('hs.opened', '1');
    } catch {}
    // First visit in a session: the opening sequence. Return visits: the shorter hero sequence.
    setPhase(opened ? 'play' : 'opening');
    if (opened) document.documentElement.classList.remove('hs-veil');
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
  const at = phase === 'opening' ? OPEN.pull + 0.2 : SEQ.dateAt;
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
            entranceDelay={phase === 'opening' ? OPEN.pull + 0.3 : SEQ.roadAt}
            drawDuration={phase === 'opening' ? 0.5 : SEQ.roadDraw}
            drawEase="inOut"
            trackDrawn={phase === 'opening'}
            keysAt={phase === 'opening' ? OPEN_TOTAL - 0.12 : undefined}
            progressTo={result.monthsToReady}
            keysGlow={keysGlow}
          />
        )}
        {phase === 'pending' && <div className="h-[92px]" />}
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
          nudgeAt={play ? (phase === 'opening' ? OPEN_TOTAL + 0.3 : SEQ.nudgeAt) : undefined}
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
    <div className="relative overflow-hidden lg:min-h-[calc(100svh-64px)]">
      <section className="relative z-[1] mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-x-8 gap-y-14 px-5 pb-40 pt-10 lg:min-h-[calc(100svh-64px)] lg:grid-cols-12 lg:px-8 lg:pb-36 lg:pt-8">
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
      </section>
      {/* The street the Road heads toward. Living: one window glows at a time. */}
      <div className="absolute inset-x-0 bottom-0 z-0" style={{ visibility: phase === 'pending' ? 'hidden' : undefined }}>
        <Skyline mode="living" count={16} parallax drawInAt={phase === 'opening' ? OPEN_TOTAL : phase === 'play' ? 1.3 : false} flashKey={flash} height={120} />
      </div>
    </div>
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
    <div className="border-y border-line bg-surface" data-testid="ticker">
      <div className="mx-auto flex h-[56px] max-w-[1280px] items-center gap-6 px-5 lg:px-8">
        <span className="t-helper shrink-0 text-ink-2">{t('landing.tickerLabel')}</span>
        <div className="relative h-[40px] flex-1 overflow-hidden sm:h-[24px]" aria-live="off">
          <AnimatePresence initial={false}>
            <motion.p
              key={i}
              className="absolute inset-0 flex items-center gap-3 text-[13px] leading-[18px] text-ink sm:whitespace-nowrap sm:text-[15px]"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: ease.out }}
            >
              <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden className="shrink-0">
                <path d="M1 9h16" stroke="var(--line)" strokeWidth="2" strokeLinecap="round" />
                <circle cx="3" cy="9" r="2" fill="var(--brass)" />
                <path d="M19 10V5.5L23 2l4 3.5V10z" fill="none" stroke="var(--pine)" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              <span className="tnum">{lines[i]}</span>
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scroll story                                                         */
/* ------------------------------------------------------------------ */
/** Scene headline: rises from a mask the first time its scene enters, like the hero. */
function Caption({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  return (
    <h2 ref={ref} className="overflow-hidden pb-[0.06em] text-[32px] font-semibold leading-[38px] tracking-[-0.02em] text-ink lg:text-[40px] lg:leading-[44px]">
      <motion.span className="block" initial={reduce ? { opacity: 0 } : { y: '100%' }} animate={inView ? { y: '0%', opacity: 1 } : undefined} transition={{ duration: reduce ? 0.15 : SEQ.line, ease: ease.out }}>
        {children}
      </motion.span>
    </h2>
  );
}

/** Scene 1: a phone running the intake; fields fill one at a time as if spoken. */
function PhoneScene() {
  const { t } = useLang();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const [filled, setFilled] = useState(0);
  const [heard, setHeard] = useState(false);
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    if (p > 0.22) setHeard(true);
    setFilled(Math.max(0, Math.min(4, Math.floor((p - 0.26) / 0.05) + 1)));
  });
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const fields: [string, string][] = [
    [t('landing.phonePeople'), '4'],
    [t('landing.phoneOC'), t('landing.phoneYes')],
    [t('landing.phoneIncome'), '$5,200'],
    [t('landing.phoneRent'), '$2,350'],
  ];
  return (
    <section ref={ref} className="mx-auto grid min-h-[80vh] max-w-[1280px] grid-cols-1 items-center gap-12 px-5 py-20 lg:grid-cols-12 lg:px-8" data-testid="scene-intake">
      <div className="lg:col-span-5">
        <Caption>{t('landing.s1')}</Caption>
        <p className="mt-4 max-w-[40ch] text-[18px] leading-[28px] text-ink-2">{t('landing.s1b')}</p>
      </div>
      <motion.div style={{ y }} className="flex justify-center lg:col-span-7">
        {/* Phone: pure CSS frame */}
        <div className="w-[300px] rounded-[44px] border-[10px] border-ink bg-paper p-4 pt-3" aria-hidden>
          <div className="mx-auto mb-3 h-[22px] w-[96px] rounded-full bg-ink" />
          <div className="flex items-center justify-between border-b border-line pb-2">
            <span className="scale-90 origin-left">
              <Wordmark />
            </span>
          </div>
          <div className="mt-2 h-[3px] w-full bg-line">
            <div className="h-full w-1/4 bg-pine" />
          </div>
          <div className="mt-4 flex items-start justify-between gap-2">
            <p className="text-[19px] font-semibold leading-[24px] text-ink">{t('landing.phoneTitle')}</p>
            <motion.span
              className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-line bg-surface text-pine"
              animate={heard ? { scale: [1, 1.18, 1] } : undefined}
              transition={{ duration: 0.6, ease: ease.inOut }}
            >
              <motion.span className="absolute inset-0 rounded-full bg-pine-soft" initial={{ opacity: 0 }} animate={heard ? { opacity: [0, 1, 0] } : undefined} transition={{ duration: 0.6 }} />
              <Mic size={16} strokeWidth={1.75} className="relative" />
            </motion.span>
          </div>
          <motion.p className="mt-2 text-[12px] italic leading-[16px] text-ink-2" initial={{ opacity: 0 }} animate={{ opacity: heard ? 1 : 0 }} transition={{ duration: 0.3 }}>
            {t('landing.phoneSaid')}
          </motion.p>
          <div className="mt-3 flex flex-col gap-3 pb-4">
            {fields.map(([label, value], i) => (
              <div key={label}>
                <p className="mb-1 text-[11px] font-medium text-ink">{label}</p>
                <div className="tnum relative flex h-[34px] items-center overflow-hidden rounded-[6px] border border-line bg-surface px-2 text-[14px] text-ink">
                  {/* the just-filled pulse: an opacity-only overlay */}
                  <motion.span className="absolute inset-0 bg-pine-soft" initial={false} animate={{ opacity: i < filled ? [1, 0] : 0 }} transition={{ duration: 0.6 }} />
                  <motion.span className="relative" initial={false} animate={{ opacity: i < filled ? 1 : 0, y: i < filled ? 0 : 4 }} transition={{ duration: 0.2, ease: ease.out }}>
                    {value}
                  </motion.span>
                </div>
              </div>
            ))}
            <div className="mt-1 flex h-[38px] items-center justify-center rounded-[6px] bg-pine text-[13px] font-medium text-white">{t('app.continue')}</div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

/** One caption in the pinned-road scene; reports when it's the one in view. */
function StoryCaption({ title, body, onActive }: { title: string; body: string; onActive: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.6 });
  useEffect(() => {
    if (inView) onActive();
  }, [inView, onActive]);
  return (
    <div ref={ref} className="flex min-h-[70vh] items-center">
      <div>
        {/* Inactive captions dim only the large title (still ≥ 3:1); body text keeps full contrast. */}
        <motion.div animate={{ opacity: inView ? 1 : 0.6 }} transition={{ duration: 0.25, ease: ease.out }}>
          <Caption>{title}</Caption>
        </motion.div>
        <p className="mt-3 max-w-[36ch] text-[18px] leading-[28px] text-ink-2">{body}</p>
      </div>
    </div>
  );
}

/** Scene 2: the Road pinned while captions scroll past, each lighting up its milestone. */
function RoadScene() {
  const { t } = useLang();
  const [active, setActive] = useState<MilestoneKey>('collections');
  const result = useMemo(() => computeReadiness(FAMILIES.reyes), []);
  const caps: { key: MilestoneKey; title: string; body: string }[] = [
    { key: 'collections', title: t('landing.c1'), body: t('landing.c1b') },
    { key: 'savings', title: t('landing.c2'), body: t('landing.c2b') },
    { key: 'keys', title: t('landing.c3'), body: t('landing.c3b') },
  ];
  return (
    <section className="mx-auto max-w-[1280px] px-5 lg:px-8" data-testid="scene-road">
      <div className="pt-20">
        <Caption>{t('landing.s2')}</Caption>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="sticky top-16 z-10 order-first bg-paper py-6 lg:order-last lg:col-span-7 lg:flex lg:h-[calc(100svh-64px)] lg:items-center lg:bg-transparent lg:py-0">
          <div className="w-full">
            <Road result={result} size="lg" entrance="none" highlight={[active]} />
            {/* the street again; the last house lights when "Keys" is reached */}
            <Skyline mode="static" count={12} height={84} className="mt-10 hidden lg:block" litIndex={active === 'keys' ? 11 : null} keysLit={active === 'keys'} />
          </div>
        </div>
        <div className="lg:col-span-5">
          {caps.map((c) => (
            <StoryCaption key={c.key} title={c.title} body={c.body} onActive={() => setActive(c.key)} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Scene 3: the staff Homes view in a browser frame; counts climb from 0 as it scrolls in. */
/** Small line-drawn house; wider for more bedrooms. */
function HouseGlyph({ bedrooms }: { bedrooms: number }) {
  const w = 16 + bedrooms * 5;
  return (
    <svg width={w + 2} height="22" viewBox={`-1 -1 ${w + 2} 22`} aria-hidden className="shrink-0">
      <path d={`M0 20V9L${w / 2} 1L${w} 9V20Z`} fill="none" stroke="var(--pine)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={`M${w / 2 - 3} 20v-6h6v6`} fill="none" stroke="var(--pine)" strokeWidth="1.5" />
    </svg>
  );
}

function HomesScene() {
  const { t, lang } = useLang();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4, once: true });
  const rows = useMemo(() => {
    const fams = SEED_FAMILIES.map((f) => ({ f, r: computeReadiness(f.profile) })).filter((x) => isEligible(x.r));
    return SEED_HOMES.slice(0, 6).map((h) => ({
      h,
      ready: fams.filter((x) => homeFits(x.f.profile.householdSize, h.bedrooms) && x.r.monthsToReady <= monthsUntil(h.completion)).length,
    }));
  }, []);
  return (
    <section className="mx-auto grid min-h-[80vh] max-w-[1280px] grid-cols-1 items-center gap-12 px-5 py-20 lg:grid-cols-12 lg:px-8" data-testid="scene-homes">
      <div className="lg:col-span-4">
        <Caption>{t('landing.s3')}</Caption>
        <p className="mt-4 max-w-[36ch] text-[18px] leading-[28px] text-ink-2">{t('landing.s3b')}</p>
      </div>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 24 }}
        animate={inView ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.6, ease: ease.out }}
        className="overflow-hidden rounded-[14px] border border-line bg-surface lg:col-span-8"
        aria-hidden
      >
        {/* Browser frame */}
        <div className="flex items-center gap-2 border-b border-line bg-paper px-4 py-3">
          <span className="h-[10px] w-[10px] rounded-full bg-line" />
          <span className="h-[10px] w-[10px] rounded-full bg-line" />
          <span className="h-[10px] w-[10px] rounded-full bg-line" />
          <span className="ml-4 rounded-[6px] bg-surface px-3 py-1 text-[12px] text-ink-2">homestretch · staff · homes</span>
        </div>
        <div className="p-6">
          <p className="text-[20px] font-semibold text-ink">{t('landing.browserTitle')}</p>
          <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-x-8 border-b border-line pb-2 text-[13px] text-ink-2">
            <span>{t('landing.colHome')}</span>
            <span>{t('landing.colDone')}</span>
            <span className="text-right">{t('landing.colReady')}</span>
          </div>
          {rows.map(({ h, ready }, i) => (
            <motion.div
              key={h.id}
              initial={{ opacity: 0, y: 8 }}
              animate={inView ? { opacity: 1, y: 0 } : undefined}
              transition={{ duration: 0.3, ease: ease.out, delay: 0.15 + Math.min(i, 5) * 0.05 }}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-x-8 border-b border-line py-3 text-[15px]"
            >
              <span className="flex items-center gap-3 text-ink">
                <HouseGlyph bedrooms={h.bedrooms} />
                <span>
                  {h.city} · {h.bedrooms}BR <span className="text-ink-2">{h.address}</span>
                </span>
              </span>
              <span className="tnum text-ink-2">{monthName(h.completion, lang, true)}</span>
              <span className="tnum w-[96px] text-right text-[20px] font-semibold text-ink">
                <AnimatedNumber value={inView ? ready : 0} format={(n) => String(Math.round(n))} />
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

/** The only dark section: a pine band; the numbers roll to 100 as it enters. */
function Closing() {
  const { t } = useLang();
  const router = useVTRouter();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const n = (v: number) => String(Math.round(v));
  const [a1, a2] = t('landing.closingA').split('{n}');
  const [b1, b2] = t('landing.closingB').split('{n}');
  return (
    <section className="bg-pine text-white" data-testid="closing">
      <div ref={ref} className="mx-auto max-w-[1280px] px-5 py-28 lg:px-8 lg:py-36">
        <p className="tnum max-w-[24ch] text-[36px] font-semibold leading-[42px] tracking-[-0.02em] lg:text-[56px] lg:leading-[60px]">
          {a1}
          <AnimatedNumber value={inView ? 100 : 0} format={n} />
          {a2} {b1}
          <AnimatedNumber value={inView ? 100 : 0} format={n} />
          {b2}
        </p>
        <motion.a
          href="/start"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            router.push('/start', 'start');
          }}
          whileTap={{ scale: 0.97 }}
          transition={spring.snappy}
          className="mt-12 inline-flex min-h-[56px] items-center rounded-[8px] bg-white px-8 text-[20px] font-medium text-pine transition-colors duration-[120ms] hover:bg-pine-soft focus-visible:outline-white"
        >
          {t('landing.cta')}
        </motion.a>
      </div>
    </section>
  );
}

/** A thin pine line down the left margin that draws as you scroll: the page reads as one road. */
function StorySpine({ target }: { target: React.RefObject<HTMLDivElement | null> }) {
  const { scrollYProgress } = useScroll({ target, offset: ['start 70%', 'end 70%'] });
  return (
    <div className="pointer-events-none absolute bottom-0 left-[max(16px,calc((100vw-1280px)/2+12px))] top-0 hidden w-[2px] lg:block" aria-hidden>
      <div className="absolute inset-0 bg-line opacity-60" />
      <motion.div className="absolute inset-0 origin-top bg-pine" style={{ scaleY: scrollYProgress }} />
    </div>
  );
}

function Footer() {
  const { t } = useLang();
  const router = useVTRouter();
  const [code, setCode] = useState('');
  return (
    <footer className="border-t border-line">
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

export function Landing() {
  const [phase, setPhase] = useIntroPhase();
  const [opening, setOpening] = useState(true);
  const story = useRef<HTMLDivElement>(null);
  const onOpeningDone = useCallback(() => setOpening(false), []);
  const onOpeningSkip = useCallback(() => {
    setOpening(false);
    setPhase('static');
  }, [setPhase]);
  return (
    <>
      {/* Without JavaScript the intro never runs: show everything. */}
      <noscript>
        <style>{`[data-intro]{visibility:visible!important}`}</style>
      </noscript>
      {phase === 'opening' && opening && <Opening onDone={onOpeningDone} onSkip={onOpeningSkip} />}
      {/* a skip remounts the hero straight into its final state */}
      <Hero key={phase === 'static' ? 'static' : 'live'} phase={phase} />
      <Ticker />
      <div id="story" ref={story} className="relative scroll-mt-16">
        <StorySpine target={story} />
        <PhoneScene />
        <RoadScene />
        <HomesScene />
      </div>
      <Closing />
      <Footer />
    </>
  );
}
