'use client';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useLang } from '@/lib/i18n';
import { computeReadiness } from '@/lib/engine';
import { ease } from '@/lib/motion';
import { useVTRouter } from '@/lib/vt';
import { SEED_HOMES } from '@/lib/seedData';
import { Road } from '@/components/result/Road';
import { Intro, INTRO } from '@/components/Intro';
import { hasWebGL } from '@/components/three/HouseCanvas';
import { HeroHouse, preloadStage } from '@/components/three/HeroHouse';
import { brand } from '@/lib/brand';
import { HeroScene, streetLayout, type StreetLayout } from './scenes/HeroScene';
import { P } from '@/lib/illustrationPalette';
import { SectionArrow, SectionDots, SectionNavProvider, useSectionPlay } from './SectionNav';
import { DoorPanel, MagneticButton, SplitHeading } from './Type';
import { CostScene } from './CostScene';
import { HomeScene } from './scenes/HomeScene';
import { RepairScene } from './scenes/RepairScene';
import { NeighborhoodScene } from './scenes/NeighborhoodScene';
import { ClosingScene } from './scenes/ClosingScene';
import type { LotStatus } from '@/components/illustrations/landing/NeighborhoodMap';
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
  const cls = 't-display text-[44px] text-ink sm:text-[60px] lg:text-[64px] xl:text-[88px]';
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
        <span key={`${line}-${i}`} className="-mb-[0.1em] block overflow-hidden pb-[0.1em]" aria-hidden>
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

/** The two doors: keeping the keys (Keep) and getting them (Ready). Door-shaped panels over the family's street. */
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
      <p className="mb-3 text-[15px] text-ink-2 lg:text-[16px]">{t('landing.doorsLabel')}</p>
      {/* two equal columns, stretched: both arches always share one width and height (phones: stacked, equal rows) */}
      <div className="grid auto-rows-fr grid-cols-1 items-stretch gap-3 sm:[grid-template-columns:1fr_1fr] sm:gap-4">
        {doors.map((d, i) => (
          <motion.div
            className="h-full min-w-0"
            key={`${d.key}-${phase === 'pending'}`}
            initial={play ? { opacity: 0, y: 12 } : phase === 'reduced' ? { opacity: 0 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={play ? { duration: 0.45, ease: ease.out, delay: t0 + (phase === 'opening' ? 0.3 : SEQ.sub) + i * 0.08 } : { duration: 0.15 }}
          >
            <DoorPanel
              href={d.href}
              title={d.title}
              sub={d.sub}
              primary={d.primary}
              testId={d.testId}
              style={i === 1 ? { viewTransitionName: 'cta' } : undefined}
              onNavigate={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                e.preventDefault();
                router.push(d.href, d.kind);
              }}
            />
          </motion.div>
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
      <div className="relative z-[1] mx-auto grid max-w-[1440px] grid-cols-1 content-center items-center gap-x-8 gap-y-5 px-5 pb-4 pt-4 sm:px-8 lg:grid-cols-12 lg:gap-y-0 lg:px-20 lg:pb-6 lg:pt-6" style={{ minHeight: 'calc(100svh - 64px - var(--street-h))' }}>
        <div className="lg:col-span-6 xl:col-span-7">
          <motion.p key={`partner-${phase === 'pending'}`} {...fadeUp} transition={play ? { duration: 0.3, ease: ease.out, delay: t0 } : fadeUp.transition} className="mb-3 text-[15px] text-ink-2 lg:mb-4">
            {t('app.partner')}
          </motion.p>
          <Headline text={t('landing.headline')} phase={phase} />
          <motion.p key={`sub-${phase === 'pending'}`} {...fadeUp} className="mt-4 hidden max-w-[44ch] text-[18px] leading-[28px] text-ink-2 sm:block lg:mt-6 lg:text-[20px] lg:leading-[30px]" data-intro style={{ visibility: phase === 'pending' ? 'hidden' : undefined }}>
            {t('landing.sub')}
          </motion.p>
        </div>
        <div ref={controlsRef} className="mx-auto w-full max-w-[540px] lg:col-span-6 xl:col-span-5">
          <HeroDoors phase={phase} />
        </div>
      </div>
      {/* the street's room (the scene draws it; the Road and the house take input there) */}
      <div aria-hidden style={{ height: 'var(--street-h)' }} />
      <SectionArrow index={0} label={t('landing.arrowNext')} topLabel={t('landing.arrowTop')} />
    </section>
  );
}

/** Section body copy: fades up with the headline's second line (in place before the first visit). */
function Body({ play, children, className = '' }: { play: number; children: React.ReactNode; className?: string }) {
  const reduce = !!useReducedMotion();
  return (
    <motion.p
      key={play}
      initial={play === 0 ? false : reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0.15 : 0.45, ease: ease.out, delay: reduce ? 0 : 0.22 }}
      className={`mt-6 max-w-[40ch] text-[18px] leading-[28px] text-ink-2 lg:text-[20px] lg:leading-[31px] ${className}`}
    >
      {children}
    </motion.p>
  );
}
const H2 = 'text-[42px] text-ink sm:text-[56px] lg:text-[72px] xl:text-[84px]';

/**
 * A full-viewport section that IS one illustrated place: its scene (components/landing/scenes) fills the
 * section edge to edge and draws its own sky, ground and centrepiece; the text sits over a calm part of it.
 *  - 'split': text in the left 5 columns; the centrepiece is in the scene to the right (phones: text first,
 *    `minGraphic` px of room below it for the scene's centrepiece)
 *  - 'sky': the text sits alone in the calm sky at the top-left
 * `scene` receives the play count (0 until the first activation; it drops back to 0 once the section has left
 * the screen), so the centrepiece replays on each visit. The text reveals on activation, which SectionNav
 * only grants once the camera has landed.
 */
function SceneSection({ id, index, layout = 'split', bob = false, text, scene, minGraphic = 0, label, low = false }: { id: string; index: number; layout?: 'split' | 'sky'; bob?: boolean; text: (play: number) => React.ReactNode; scene: (play: number, reduce: boolean) => React.ReactNode; minGraphic?: number; label: string; /** desktop: the text sits low, under the scene's busy top (the shock room's shelf) */ low?: boolean }) {
  const { t } = useLang();
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  // up by one the moment the section becomes the target (the press, not the landing): the reveal runs during the
  // move; before the first visit everything is drawn in place, so a section is never blank
  const n = useSectionPlay(index, ref);
  const textEl = useMemo(() => text(n), [n, text]);
  const sceneEl = useMemo(() => scene(n, reduce), [n, reduce, scene]);
  return (
    <section ref={ref} id={id} data-testid={id} className={`snap-section relative flex min-h-[calc(100svh-64px)] overflow-hidden ${layout === 'sky' ? 'items-start' : low ? 'items-center lg:items-end' : 'items-center'}`} aria-label={label}>
      {sceneEl}
      {layout === 'sky' ? (
        <div className="relative z-[1] mx-auto w-full max-w-[1440px] px-5 pb-[max(300px,44svh)] pt-10 sm:px-8 lg:px-20 lg:pb-24 lg:pt-14">
          <div className="text-scrim max-w-[640px]">{textEl}</div>
        </div>
      ) : (
        <div className={`relative z-[1] mx-auto grid w-full max-w-[1440px] grid-cols-1 items-center gap-10 px-5 pb-24 pt-12 sm:px-8 lg:grid-cols-12 lg:gap-8 lg:px-20 lg:pt-8 ${low ? 'lg:pb-[13svh]' : 'lg:pb-20'}`}>
          <div className="text-scrim relative z-[2] lg:col-span-6 xl:col-span-5">{textEl}</div>
          {/* room for the scene's centrepiece under the text on phones (on desktop it stands to the right) */}
          <div className="min-h-[var(--mg)] lg:col-span-6 lg:min-h-0 xl:col-span-7" style={{ ['--mg' as string]: `${minGraphic}px` }} aria-hidden />
        </div>
      )}
      <SectionArrow index={index} label={t('landing.arrowNext')} topLabel={t('landing.arrowTop')} bob={bob} />
    </section>
  );
}

function SceneIntake() {
  const { t } = useLang();
  const text = useCallback(
    (play: number) => (
      <>
        <SplitHeading text={t('landing.shockTitle')} play={play} animate={play > 0} className={H2} />
        <Body play={play}>{t('landing.shockBody')}</Body>
        {/* the anchor: the number the section is about, with its source */}
        <motion.div
          key={`stat-${play}`}
          initial={play === 0 ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: ease.out, delay: 0.32 }}
          className="mt-8 flex items-end gap-5 lg:mt-10"
        >
          <span className="t-display text-[88px] leading-[0.9] text-ink tabular-nums lg:text-[128px]">{t('landing.shockStat')}</span>
          <span className="mb-2 max-w-[22ch] border-l-2 border-signal-amber pl-3 text-[15px] leading-[21px] text-ink-2 lg:mb-3">{t('landing.shockStatSource')}</span>
        </motion.div>
      </>
    ),
    [t],
  );
  return <SceneSection id="scene-intake" index={2} minGraphic={420} label={t('landing.nav1')} text={text} scene={homeScene} />;
}
const homeScene = (play: number, reduce: boolean) => <HomeScene play={play} reduce={reduce} />;
const repairScene = (play: number, reduce: boolean) => <RepairScene play={play} reduce={reduce} />;

/** Fix it before it breaks (the text in the sky above the house). */
function SceneRoad() {
  const { t } = useLang();
  const text = useCallback(
    (play: number) => (
      <>
        <SplitHeading text={t('landing.fixTitle')} play={play} animate={play > 0} className={H2} />
        <Body play={play}>{t('landing.fixBody')}</Body>
      </>
    ),
    [t],
  );
  return <SceneSection id="scene-road" index={3} layout="sky" bob label={t('landing.nav2')} text={text} scene={repairScene} />;
}

/** Habitat sees it first (its early-warning view of a block of homeowners). */
function SceneHomes() {
  const { t } = useLang();
  const lots = useMemo(() => {
    // a block of homeowners: most stable, two drifting toward Watch, one that needs a call now
    const status: { status: LotStatus; turnsAt?: number }[] = [{ status: 'stable' }, { status: 'watch', turnsAt: 1.5 }, { status: 'stable' }, { status: 'act', turnsAt: 1.1 }, { status: 'watch', turnsAt: 1.9 }, { status: 'stable' }];
    return SEED_HOMES.slice(0, 6).map((h, i) => ({ id: h.id, label: `${h.city} · ${h.bedrooms}BR`, ready: 0, stage: 'finished' as const, ...status[i] }));
  }, []);
  const scene = useCallback((play: number, reduce: boolean) => <NeighborhoodScene play={play} reduce={reduce} lots={lots} />, [lots]);
  const text = useCallback(
    (play: number) => (
      <>
        <SplitHeading text={t('landing.watchTitle')} play={play} animate={play > 0} className={H2} />
        <Body play={play}>{t('landing.watchBody')}</Body>
      </>
    ),
    [t],
  );
  return <SceneSection id="scene-homes" index={4} minGraphic={300} label={t('landing.nav3')} text={text} scene={scene} />;
}

/**
 * The closing band: a dusk street of a hundred homes (ClosingScene) fills it; the lamps come on, then the windows
 * light in a wave toward the horizon; the headline and the button rise in the open sky above. The footer sits
 * below the band, on paper.
 */
function Closing() {
  const { t } = useLang();
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const n = useSectionPlay(5, ref);
  return (
    <section ref={ref} id="closing" data-testid="closing" className="snap-section relative flex min-h-[calc(100svh-64px)] flex-col text-on-band" aria-label={t('landing.nav4')}>
      <div className="relative flex flex-1 flex-col">
        <ClosingScene play={n} reduce={reduce} />
        {/* light text on the dusk scene (≈12:1 measured from pixels; axe can't see the scene, see e2e/a11y.spec.ts) */}
        <div className="relative z-[1] mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-5 pb-[34svh] pt-10 sm:px-8 lg:px-20 lg:pb-[30svh] lg:pt-14" data-axe-scene-bg>
          <ClosingBody play={n} />
        </div>
        {/* the up arrow sits in the band, above the footer */}
        <div className="relative z-[1] h-[76px]">
          <SectionArrow index={5} label={t('landing.arrowNext')} topLabel={t('landing.arrowTop')} tone="dark" />
        </div>
      </div>
      <Footer />
    </section>
  );
}

/** The closing's headline and the main call to action (magnetic). Drawn in place before the first visit. */
const ClosingBody = memo(function ClosingBody({ play }: { play: number }) {
  const { t } = useLang();
  const router = useVTRouter();
  return (
    <>
      <SplitHeading text={t('landing.closingTitle')} play={play} animate={play > 0} delay={0.15} className="max-w-[14ch] text-[44px] text-on-band sm:text-[64px] lg:text-[88px] xl:text-[96px]" />
      <motion.div key={`cta-${play}`} initial={play === 0 ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: ease.out, delay: 0.45 }} className="mt-10">
        <MagneticButton
          href="/start"
          onNavigate={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            router.push('/start', 'start');
          }}
          className="min-h-[60px] items-center rounded-[8px] bg-on-band px-9 text-[20px] font-medium text-band transition-colors duration-[120ms] hover:bg-on-band/90 focus-visible:outline-on-band"
        >
          <span className="flex h-[60px] items-center">{t('landing.cta')}</span>
        </MagneticButton>
      </motion.div>
    </>
  );
});

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

const SECTIONS = ['hero', 'scene-cost', 'scene-intake', 'scene-road', 'scene-homes', 'closing'];
const NAV_LABELS = ['landing.nav0', 'landing.navCost', 'landing.nav1', 'landing.nav2', 'landing.nav3', 'landing.nav4'];
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
      <CostScene index={1} />
      <SceneIntakeM />
      <SceneRoadM />
      <SceneHomesM />
      <ClosingM />
      <SectionDots labels={NAV_LABELS.map((k) => t(k))} />
      <div className="grain" aria-hidden />
    </SectionNavProvider>
  );
}
