'use client';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useLang } from '@/lib/i18n';
import { computeReadiness, monthsUntil, isEligible } from '@/lib/engine';
import { homeFits } from '@/lib/homes';
import { ease, spring } from '@/lib/motion';
import { useVTRouter } from '@/lib/vt';
import { SEED_FAMILIES, SEED_HOMES } from '@/lib/seedData';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Road } from '@/components/result/Road';
import { Intro, INTRO } from '@/components/Intro';
import { hasWebGL } from '@/components/three/HouseCanvas';
import { HeroHouse, preloadStage } from '@/components/three/HeroHouse';
import { P } from '@/lib/illustrationPalette';
import { brand } from '@/lib/brand';
import { HeroScene, streetLayout, type StreetLayout } from './scenes/HeroScene';
import { SectionArrow, SectionDots, SectionNavProvider, useSectionPlay } from './SectionNav';
import { PhoneVoice } from '@/components/illustrations/landing/PhoneVoice';
import { IntakeScene } from './scenes/IntakeScene';
import { RoadScene } from './scenes/RoadScene';
import { HomesGround, HomesScene, useBadgeFloat } from './scenes/HomesScene';
import { useSceneLive, useSceneShown } from './scenes/Scene';
import { DuskCount, DuskScene } from './scenes/DuskScene';
import { NeighborhoodMap } from '@/components/illustrations/landing/NeighborhoodMap';
import { AnimatePresence } from 'motion/react';
import { StaffLink, Wordmark } from '@/components/FamilyHeader';
import type { Profile } from '@/lib/types';

// The intro and the hero house are one 3D canvas: start fetching three.js the moment the landing code runs.
if (typeof window !== 'undefined' && hasWebGL()) {
  preloadStage().catch(() => {});
}

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
          <span key={i}>
            <span data-w>
              {w}
              {i < words.length - 1 ? ' ' : ''}
            </span>
            {/* each sentence starts its own line ("Get the keys." / "Keep the keys.") */}
            {/[.!?]$/.test(w) && i < words.length - 1 && <br />}
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


/* ------------------------------------------------------------------ */
/* Hero: one street scene (components/landing/scenes/HeroScene.tsx).   */
/* The demo lives in it: the date and slider in the sky, the Road      */
/* painted along the sidewalk into the 3D house's front path.          */
/* ------------------------------------------------------------------ */
/** The sample family demo's state, shared by the controls in the sky and the Road on the street. */
function useHeroDemo() {
  const { t } = useLang();
  const [family, setFamily] = useState<'reyes' | 'nguyen'>('reyes');
  const [extras, setExtras] = useState<Record<string, number>>({ reyes: FAMILIES.reyes.levers.extraDebt, nguyen: FAMILIES.nguyen.levers.extraDebt });
  const profile = FAMILIES[family];
  const extra = extras[family];
  const result = useMemo(() => computeReadiness({ ...profile, levers: { ...profile.levers, extraDebt: extra } }), [profile, extra]);
  // The 3D house answers the slider: the earlier the date, the warmer the sun and the more windows lit.
  const span = useMemo(() => {
    const at = (x: number) => computeReadiness({ ...profile, levers: { ...profile.levers, extraDebt: x } }).monthsToReady;
    return { base: at(profile.levers.extraDebt), best: at(400) };
  }, [profile]);
  const gain = span.base > span.best ? Math.min(1, Math.max(0, (span.base - result.monthsToReady) / (span.base - span.best))) : 0;
  const litWindows = 1 + Math.round(gain * 3);
  const sunStep = Math.round(gain * 20) / 20;

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
  const onSlide = useCallback(
    (v: number) => {
      if (baseline.current === null) baseline.current = lastMonths.current;
      setExtras((x) => ({ ...x, [family]: v }));
      setDragged((d) => {
        if (!d) {
          try {
            localStorage.setItem('hs.dragged', '1');
          } catch {}
        }
        return true;
      });
    },
    [family],
  );
  useEffect(() => {
    const m = result.monthsToReady;
    if (m === lastMonths.current) return;
    const earlier = m < lastMonths.current;
    lastMonths.current = m;
    if (baseline.current === null) return; // family switch, not a drag
    const n = m - baseline.current;
    if (earlier) setKeysGlow((k) => k + 1);
    if (n !== 0) setDelta({ n, id: Date.now() });
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => {
      setDelta(null);
      baseline.current = null;
    }, 1500);
  }, [result.monthsToReady]);
  const switchFamily = useCallback((f: 'reyes' | 'nguyen') => {
    baseline.current = null;
    setDelta(null);
    setFamily(f);
  }, []);
  const deltaText = delta ? (delta.n < 0 ? (delta.n === -1 ? t('landing.sooner1') : t('landing.sooner', { n: -delta.n })) : delta.n === 1 ? t('landing.later1') : t('landing.later', { n: delta.n })) : '';
  return { family, switchFamily, extra, onSlide, result, litWindows, sunStep, delta, deltaText, keysGlow, dragged };
}

/** A door glyph: the panel swings open when the door (button) is hovered. */
function DoorGlyph() {
  return (
    <svg viewBox="0 0 30 42" className="h-[42px] w-[30px] shrink-0 overflow-visible" aria-hidden>
      <rect x="1" y="1" width="28" height="40" rx="2" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.55" />
      <g className="origin-[4px_21px] transition-transform duration-[250ms] ease-[cubic-bezier(0.23,1,0.32,1)] [transform:perspective(80px)_rotateY(0deg)] group-hover:[transform:perspective(80px)_rotateY(-58deg)]">
        <rect x="4" y="4" width="22" height="37" rx="1" fill="currentColor" opacity="0.22" />
        <circle cx="21.5" cy="23" r="1.6" fill="currentColor" />
      </g>
    </svg>
  );
}

/** The two doors: getting the keys (Ready) and keeping them (Keep). In the sky, over the family's house. */
function HeroDoors({ phase }: { phase: Phase }) {
  const { t } = useLang();
  const router = useVTRouter();
  const play = animated(phase);
  const t0 = offset(phase);
  const doors = [
    { key: 'keep', href: '/keep', kind: 'forward' as const, title: t('landing.doorKeep'), sub: t('landing.doorKeepSub'), primary: true, testId: 'door-keep' },
    { key: 'ready', href: '/start', kind: 'start' as const, title: t('landing.doorReady'), sub: t('landing.doorReadySub'), primary: false, testId: 'find-my-date' },
  ];
  return (
    <nav aria-label={t('landing.doorsLabel')} className="w-full" data-intro style={{ visibility: phase === 'pending' ? 'hidden' : undefined }}>
      <p className="mb-3 text-[15px] text-ink-2">{t('landing.doorsLabel')}</p>
      <div className="flex flex-col gap-3">
        {doors.map((d, i) => (
          <motion.a
            key={`${d.key}-${phase === 'pending'}`}
            href={d.href}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) return;
              e.preventDefault();
              router.push(d.href, d.kind);
            }}
            initial={play ? { opacity: 0, y: 12 } : phase === 'reduced' ? { opacity: 0 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={play ? { duration: 0.45, ease: ease.out, delay: t0 + (phase === 'opening' ? 0.3 : SEQ.sub) + i * 0.08 } : { duration: 0.15 }}
            whileTap={{ scale: 0.98 }}
            className={`group flex min-h-[84px] items-center gap-4 rounded-[14px] border px-5 py-4 transition-colors duration-[120ms] ${d.primary ? 'border-pine bg-pine text-on-pine hover:bg-pine-hover' : 'border-line bg-surface text-ink hover:bg-pine-soft'}`}
            style={i === 1 ? { viewTransitionName: 'cta' } : undefined}
            data-testid={d.testId}
          >
            <DoorGlyph />
            <span className="min-w-0">
              <span className="block text-[18px] font-semibold leading-[24px]">{d.title}</span>
              <span className={`mt-0.5 block text-[15px] leading-[22px] ${d.primary ? 'opacity-85' : 'text-ink-2'}`}>{d.sub}</span>
            </span>
          </motion.a>
        ))}
      </div>
    </nav>
  );
}

/** Measures the street for the hero section (and keeps --street-h on it, which reserves the street's room). */
function useStreetLayout(sectionRef: React.RefObject<HTMLElement | null>, controlsRef: React.RefObject<HTMLDivElement | null>) {
  const [layout, setLayout] = useState<StreetLayout | null>(null);
  useLayoutEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    let last = '';
    const measure = () => {
      const W = el.clientWidth;
      const s = el.getBoundingClientRect();
      const c = controlsRef.current?.getBoundingClientRect();
      const Xc = c && W >= 1024 ? Math.round(c.left - s.left + c.width / 2) : undefined;
      const next = streetLayout(W, window.innerHeight, Xc);
      const key = JSON.stringify(next);
      if (key === last) return;
      last = key;
      el.style.setProperty('--street-h', `${next.height}px`);
      setLayout(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [sectionRef, controlsRef]);
  return layout;
}

function Hero({ phase, intro }: { phase: Phase; intro: boolean | null }) {
  const { t } = useLang();
  const play = animated(phase);
  const t0 = offset(phase);
  const demo = useHeroDemo();
  const sectionRef = useRef<HTMLElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const layout = useStreetLayout(sectionRef, controlsRef);
  // the house element is stable (memoized on its few primitive props), so dragging never re-renders the canvas
  const house = useMemo(() => <HeroHouse intro={intro} lit={demo.litWindows} sun={demo.sunStep} frame="street" />, [intro, demo.litWindows, demo.sunStep]);
  const road = layout && (
    <Road
      result={demo.result}
      size={layout.phone ? 'md' : 'lg'}
      entrance={phase === 'pending' || play ? 'always' : 'none'}
      entranceDelay={SEQ.roadAt}
      drawDuration={SEQ.roadDraw}
      drawEase="inOut"
      progressTo={demo.result.monthsToReady}
      keysGlow={demo.keysGlow}
      keysVariant="slot"
      slotKind="street"
      slotWidth={layout.sw}
      keysSlot={house}
      pinKeys
      hold={phase === 'pending'}
      labelsAbove
      labelHalo={P.sage}
      noSlotLabel
    />
  );
  const fadeUp = play
    ? { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, ease: ease.out, delay: t0 + (phase === 'opening' ? 0.25 : SEQ.sub) } }
    : { initial: phase === 'reduced' ? { opacity: 0 } : false, animate: { opacity: 1 }, transition: { duration: 0.15 } };
  return (
    <section ref={sectionRef} id="hero" data-testid="hero" className="snap-section relative min-h-[calc(100svh-64px)] [--street-h:clamp(300px,46svh,400px)]">
      <HeroScene layout={layout} road={road} />
      {/* the sky: headline on the left, the ready date and slider over the family's house */}
      <div className="relative z-[1] mx-auto grid max-w-[1280px] grid-cols-1 content-center items-center gap-x-10 gap-y-5 px-5 pb-4 pt-4 lg:grid-cols-12 lg:gap-y-0 lg:px-8 lg:pb-6 lg:pt-6 xl:gap-x-14" style={{ minHeight: 'calc(100svh - 64px - var(--street-h))' }}>
        <div className="lg:col-span-5">
          <motion.p key={`partner-${phase === 'pending'}`} {...fadeUp} transition={play ? { duration: 0.3, ease: ease.out, delay: t0 } : fadeUp.transition} className="mb-3 text-[15px] text-ink-2 lg:mb-4">
            {t('app.partner')}
          </motion.p>
          <Headline text={t('landing.headline')} phase={phase} />
          <motion.p key={`sub-${phase === 'pending'}`} {...fadeUp} className="mt-4 hidden max-w-[44ch] text-[18px] leading-[28px] text-ink-2 sm:block lg:mt-5" data-intro style={{ visibility: phase === 'pending' ? 'hidden' : undefined }}>
            {t('landing.sub')}
          </motion.p>
        </div>
        <div ref={controlsRef} className="mx-auto w-full max-w-[480px] lg:col-span-7">
          <HeroDoors phase={phase} />
        </div>
      </div>
      {/* the street's room (the scene draws it; the Road and the house take input there) */}
      <div aria-hidden style={{ height: 'var(--street-h)' }} />
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

/**
 * A full-viewport section built around its scene: the scene fills the section behind everything (its own
 * background and depth layers, components/landing/scenes); the text sits on its calm side.
 *  - 'split': text in 5 columns, the centrepiece in 7 (text first on phones, the centrepiece below)
 *  - 'sky': the scene is the centrepiece; the text sits alone in the calm sky at the top-left
 * `scene` receives the play count (0 until the first activation), so it can replay its own moment.
 */
function SceneSection({ id, index, layout = 'split', bob = false, text, graphic, scene, anchor, minGraphic = 420 }: { id: string; index: number; layout?: 'split' | 'sky'; bob?: boolean; text: (reduce: boolean) => React.ReactNode; graphic?: (reduce: boolean) => React.ReactNode; scene?: (play: number, reduce: boolean) => React.ReactNode; /** a persistent box around the centrepiece with scenery registered to it (drawn under it) */ anchor?: React.ReactNode; minGraphic?: number }) {
  const { t } = useLang();
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const n = useSectionPlay(index, ref); // replays its animation each time the section becomes active
  // Elements are memoized by activation count, so another section's activation never re-renders this one's illustration.
  const textEl = useMemo(() => (n > 0 ? text(reduce) : <div className="invisible">{text(true)}</div>), [n, reduce, text]);
  // The illustration mounts one frame after the text, so the two commits land in separate frames.
  const [gn, setGn] = useState(n);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGn(n));
    return () => cancelAnimationFrame(id);
  }, [n]);
  const graphicEl = useMemo(() => (gn > 0 && graphic ? graphic(reduce) : null), [gn, reduce, graphic]);
  const sceneEl = useMemo(() => (scene ? scene(gn, reduce) : null), [gn, reduce, scene]);
  return (
    <section ref={ref} id={id} data-testid={id} className={`snap-section relative flex min-h-[calc(100svh-64px)] overflow-hidden ${layout === 'sky' ? 'items-start' : 'items-center'}`} aria-label={t(`landing.nav${index}`)}>
      {sceneEl}
      {layout === 'sky' ? (
        <div className="relative z-[1] mx-auto w-full max-w-[1280px] px-5 pb-[max(300px,44svh)] pt-10 lg:px-8 lg:pb-24 lg:pt-12">
          <div className="max-w-[520px]" key={`t${n}`}>
            {textEl}
          </div>
        </div>
      ) : (
        <div className="relative z-[1] mx-auto grid w-full max-w-[1280px] grid-cols-1 items-center gap-10 px-5 pb-24 pt-12 lg:grid-cols-12 lg:gap-12 lg:px-8 lg:pb-20 lg:pt-8">
          <div className="relative z-[2] lg:col-span-5" key={`t${n}`}>
            {textEl}
          </div>
          <div className="lg:col-span-7" style={{ minHeight: minGraphic }}>
            {anchor ? (
              <AnchorBox under={anchor} index={index}>
                {graphicEl && (
                  <div className="absolute inset-0" key={`g${gn}`}>
                    {graphicEl}
                  </div>
                )}
              </AnchorBox>
            ) : (
              graphicEl && <div key={`g${gn}`}>{graphicEl}</div>
            )}
          </div>
        </div>
      )}
      <SectionArrow index={index} label={t('landing.arrowNext')} topLabel={t('landing.arrowTop')} bob={bob} />
    </section>
  );
}

/** The homes block's box: the ground plane under it stays put while the block replays on each activation. */
function AnchorBox({ under, index, children }: { under: React.ReactNode; index: number; children: React.ReactNode }) {
  const live = useSceneLive(index);
  const shown = useSceneShown(index);
  return (
    <div className="relative mx-auto aspect-[600/350] w-full max-w-[620px]" data-live={live ? 'true' : 'false'}>
      <div className="absolute inset-0" style={shown ? undefined : { contentVisibility: 'hidden' }}>
        {under}
      </div>
      {children}
    </div>
  );
}

function SceneIntake() {
  const { t } = useLang();
  return (
    <SceneSection
      id="scene-intake"
      index={1}
      minGraphic={600}
      text={(reduce) => (
        <>
          <MaskHeading reduce={reduce}>{t('landing.s1')}</MaskHeading>
          <motion.p initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: ease.out, delay: 0.15 }} className="mt-5 max-w-[40ch] text-[18px] leading-[28px] text-ink-2">
            {t('landing.s1b')}
          </motion.p>
        </>
      )}
      graphic={(reduce) => <PhoneVoice reduce={reduce} backdrop={false} />}
      scene={intakeScene}
    />
  );
}
const intakeScene = () => <IntakeScene />;
const roadScene = (play: number, reduce: boolean) => <RoadScene play={play} reduce={reduce} />;

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
      layout="sky"
      bob
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
      scene={roadScene}
    />
  );
}

function SceneHomes() {
  const { t } = useLang();
  const probe = useRef<HTMLSpanElement>(null);
  const badgeY = useBadgeFloat(probe);
  const lots = useMemo(() => {
    const fams = SEED_FAMILIES.map((f) => ({ f, r: computeReadiness(f.profile) })).filter((x) => isEligible(x.r));
    const homes = SEED_HOMES.slice(0, 6);
    // build stage for the illustration, by completion: two finished, the next one finishing (its scaffolding comes
    // down), then one roofing and two framing
    const order = [...homes].sort((a, b) => a.completion.localeCompare(b.completion)).map((h) => h.id);
    return homes.map((h) => {
      const rank = order.indexOf(h.id);
      return {
        id: h.id,
        label: `${h.city} · ${h.bedrooms}BR`,
        ready: fams.filter((x) => homeFits(x.f.profile.householdSize, h.bedrooms) && x.r.monthsToReady <= monthsUntil(h.completion)).length,
        stage: (['finished', 'finished', 'finished', 'roofing', 'framing', 'framing'] as const)[rank],
        finishing: rank === 2,
      };
    });
  }, []);
  return (
    <SceneSection
      id="scene-homes"
      index={3}
      minGraphic={210}
      text={(reduce) => (
        <>
          <MaskHeading reduce={reduce}>{t('landing.s3')}</MaskHeading>
          <motion.p initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: ease.out, delay: 0.15 }} className="mt-5 max-w-[40ch] text-[18px] leading-[28px] text-ink-2">
            {t('landing.s3b')}
          </motion.p>
          <div className="mt-8">
            <Ticker />
          </div>
          <span ref={probe} className="hidden" />
        </>
      )}
      graphic={(reduce) => <NeighborhoodMap lots={lots} reduce={reduce} plain badgeY={badgeY} />}
      anchor={homesAnchor}
      scene={homesScene}
    />
  );
}
const homesAnchor = (
  <>
    <HomesGround />
  </>
);
const homesScene = () => <HomesScene />;

/**
 * The closing band: a dusk street of a hundred homes (DuskScene) fills it; the lamps come on, then the windows
 * light in a wave toward the horizon while the counter rolls to 100; the sentence and the button rise in the
 * open sky above. The footer sits below the band, on paper.
 */
function Closing() {
  const { t } = useLang();
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const n = useSectionPlay(4, ref);
  return (
    <section ref={ref} id="closing" data-testid="closing" className="snap-section relative flex min-h-[calc(100svh-64px)] flex-col text-on-band" aria-label={t('landing.nav4')}>
      <div className="relative flex flex-1 flex-col">
        <DuskScene play={n} reduce={reduce} />
        <div className="relative z-[1] mx-auto flex w-full max-w-[1280px] flex-1 flex-col px-5 pb-[34svh] pt-10 lg:px-8 lg:pb-[30svh] lg:pt-12" key={n}>
          {n > 0 && <ClosingBody reduce={reduce} />}
        </div>
        {/* the up arrow sits in the band, above the footer */}
        <div className="relative z-[1] h-[76px]">
          <SectionArrow index={4} label={t('landing.arrowNext')} topLabel={t('landing.arrowTop')} tone="dark" />
        </div>
      </div>
      <Footer />
    </section>
  );
}

/** The closing's animated content; memoized so it only renders when the section (re)activates. */
const ClosingBody = memo(function ClosingBody({ reduce }: { reduce: boolean }) {
  const { t } = useLang();
  const router = useVTRouter();
  const [a1, a2] = t('landing.closingA').split('{n}');
  const [b1, b2] = t('landing.closingB').split('{n}');
  const fmt = (v: number) => String(Math.round(v));
  return (
          <>
            <div className="flex flex-col gap-x-10 gap-y-5 lg:flex-row lg:items-end">
              <p className="tnum text-[64px] font-semibold leading-none tracking-[-0.02em] lg:text-[112px] lg:leading-[0.9]">
                <DuskCount reduce={reduce} format={fmt} />
              </p>
              <motion.p
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: ease.out, delay: reduce ? 0 : 1.6 }}
                className="tnum max-w-[24ch] text-[30px] font-semibold leading-[36px] tracking-[-0.02em] lg:pb-[2px] lg:text-[40px] lg:leading-[46px]"
              >
                {a1}
                <RollTo to={100} reduce={reduce} format={fmt} />
                {a2} {b1}
                <RollTo to={100} reduce={reduce} format={fmt} />
                {b2}
              </motion.p>
            </div>
            <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: ease.out, delay: reduce ? 0 : 1.8 }}>
              <motion.a
                href="/start"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                  e.preventDefault();
                  router.push('/start', 'start');
                }}
                whileTap={{ scale: 0.97 }}
                transition={spring.snappy}
                className="mt-8 inline-flex min-h-[56px] items-center rounded-[8px] bg-on-band px-8 text-[20px] font-medium text-band transition-colors duration-[120ms] hover:bg-on-band/85 focus-visible:outline-on-band"
              >
                {t('landing.cta')}
              </motion.a>
            </motion.div>
          </>
  );
});

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
// Memoized so the intro ending (a Landing state change) doesn't re-render every section mid-animation.
const HeroM = memo(Hero);
const SceneIntakeM = memo(SceneIntake);
const SceneRoadM = memo(SceneRoad);
const SceneHomesM = memo(SceneHomes);
const ClosingM = memo(Closing);

export function Landing() {
  const { t } = useLang();
  const [phase, setPhase] = useIntroPhase();
  const [intro, setIntro] = useState(true);
  // The intro's 3D stage is torn down later, when the page is idle (WebGL teardown is a long task).
  const [introMounted, setIntroMounted] = useState(true);
  useEffect(() => {
    if (intro) return;
    let idle = 0;
    const t = window.setTimeout(() => {
      const ric = (window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      idle = ric ? ric(() => setIntroMounted(false), { timeout: 6000 }) : window.setTimeout(() => setIntroMounted(false), 0);
    }, 4000);
    return () => {
      clearTimeout(t);
      (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(idle);
    };
  }, [intro]);
  const [handoff, setHandoff] = useState(false);
  const onHandoff = useCallback(() => setHandoff(true), []);
  const onIntroDone = useCallback(() => {
    setIntro(false);
    brand.set({ stage: 'header', fly: false });
  }, []);
  // While the film runs the hero waits (laid out, invisible); at the hand-off it plays its own sequence.
  const heroPhase: Phase = phase === 'opening' ? (handoff || !intro ? 'play' : 'pending') : phase;
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
      {phase === 'opening' && introMounted && <Intro live={intro} onHandoff={onHandoff} onDone={onIntroDone} onSkip={onIntroSkip} />}
      {/* a skip remounts the hero straight into its final state */}
      <HeroM key={phase === 'static' ? 'static' : 'live'} phase={heroPhase} intro={phase === 'pending' ? null : phase === 'opening'} />
      <SceneIntakeM />
      <SceneRoadM />
      <SceneHomesM />
      <ClosingM />
      <SectionDots labels={SECTIONS.map((_, i) => t(`landing.nav${i}`))} />
    </SectionNavProvider>
  );
}
