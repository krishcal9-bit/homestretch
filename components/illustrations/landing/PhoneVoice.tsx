'use client';
import { motion } from 'motion/react';
import { memo, useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { P, SKIN, mix } from '@/lib/illustrationPalette';
import { alpha, useOnScreen, useStaged } from './kit';

/**
 * Scene 1: a rendered phone running the intake, floating at a slight angle (CSS perspective). The mic glows,
 * honey-lit sound bars play while the household fields fill one by one; a paper pay stub slides in, a warm
 * scan beam passes down it, and the $5,200 lifts off the paper and flies into the phone's income field.
 * Replays every time the section becomes active (the section remounts it). Ambient loop: the phone floats.
 */
const EASE_IN = [0.23, 1, 0.32, 1] as const;
const TL = { phone: 0, mic: 0.4, voice: 0.55, fields: [0.85, 1.08, 1.31], stub: 1.35, scan: 1.95, lift: 2.78, land: 3.48 };
const ZERO = { phone: 0, mic: 0, voice: 0, fields: [0, 0, 0], stub: 0, scan: 0, lift: 0, land: 0 };
const BARS = [0.35, 0.6, 0.9, 0.55, 1, 0.75, 0.45, 0.85, 0.6, 0.95, 0.5, 0.7, 0.4, 0.3];
const STUB = { w: 136, h: 172, amt: { x: 10, y: 128, w: 116, h: 30 } };
const BODY = `linear-gradient(140deg, ${P.slateLight} 0%, ${P.slate} 22%, ${P.slateDark} 60%, ${P.ink} 100%)`;

export function PhoneVoice({ reduce }: { reduce: boolean }) {
  const { t } = useLang();
  const T = reduce ? ZERO : TL;
  const wrap = useRef<HTMLDivElement>(null);
  const onScreen = useOnScreen(wrap);
  // the phone mounts first; the blurred kitchen and the pay stub a frame later (keeps each frame's work small)
  const st = useStaged(2);
  const amtRef = useRef<HTMLSpanElement>(null);
  const valRef = useRef<HTMLSpanElement>(null);
  const [flight, setFlight] = useState<null | { x0: number; y0: number; x1: number; y1: number }>(null);
  const [landed, setLanded] = useState(reduce);

  // The amount lifts off the stub: measure where it is printed and where the income field's value sits, then fly.
  useEffect(() => {
    if (reduce) return;
    const a = setTimeout(() => {
      const w = wrap.current?.getBoundingClientRect();
      const s = amtRef.current?.getBoundingClientRect();
      const f = valRef.current?.getBoundingClientRect();
      if (!w || !s || !f) return setLanded(true);
      setFlight({ x0: s.left + s.width / 2 - w.left, y0: s.top + s.height / 2 - w.top, x1: f.left + f.width / 2 - w.left, y1: f.top + f.height / 2 - w.top });
    }, TL.lift * 1000);
    const b = setTimeout(() => setLanded(true), TL.land * 1000);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [reduce]);

  const fields: [string, string, number][] = [
    [t('landing.phonePeople'), '4', T.fields[0]],
    [t('landing.phoneOC'), t('landing.phoneYes'), T.fields[1]],
    [t('landing.phoneRent'), '$2,350', T.fields[2]],
  ];

  return (
    <div ref={wrap} className="relative isolate mx-auto w-[300px] pb-12 pt-2" style={{ perspective: 1400 }} aria-hidden data-testid="phone-voice">
      {/* the family's kitchen table, out of focus behind the phone (not on phones: too busy at that size) */}
      {st >= 2 && <Kitchen reduce={reduce} />}
      {/* contact shadow on the floor, falling right (light from the top-left); breathes with the float */}
      <div className={`la-float-shadow absolute bottom-[6px] left-[34px] z-[1] h-[44px] w-[270px] ${onScreen && !reduce ? '' : 'la-paused'}`}>
        <motion.div
          className="h-full w-full"
          style={{ background: `radial-gradient(closest-side, ${alpha(P.ink, 0.26)}, ${alpha(P.ink, 0.1)} 55%, ${alpha(P.ink, 0)})` }}
          initial={reduce ? false : { opacity: 0, scaleX: 0.7 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.6, ease: EASE_IN, delay: T.phone + 0.1 }}
        />
      </div>

      <div className={`la-float relative z-[1] ${onScreen && !reduce ? '' : 'la-paused'}`}>
        <motion.div
          className="relative"
          initial={reduce ? false : { opacity: 0, y: 36, rotateY: -26, rotateX: 12 }}
          animate={{ opacity: 1, y: 0, rotateY: -10, rotateX: 5 }}
          transition={{ type: 'spring', duration: 0.75, bounce: 0.18, delay: T.phone, opacity: { duration: 0.25, delay: T.phone } }}
        >
          {/* the body's thickness: the right edge, turned away from the light */}
          <div className="absolute inset-0 rounded-[50px]" style={{ background: `linear-gradient(180deg, ${P.slateDark}, ${P.ink})`, transform: 'translate(6px, 3px)' }} />
          {/* side buttons */}
          <div className="absolute -left-[3px] top-[118px] h-[30px] w-[5px] rounded-l-[3px]" style={{ background: P.slateLight }} />
          <div className="absolute -left-[3px] top-[160px] h-[52px] w-[5px] rounded-l-[3px]" style={{ background: P.slateLight }} />
          <div className="absolute -right-[5px] top-[150px] h-[70px] w-[6px] rounded-r-[3px]" style={{ background: P.ink }} />
          {/* body with a polished bezel: lit top-left edge, darker toward the bottom-right */}
          <div className="relative rounded-[50px] p-[11px]" style={{ background: BODY }}>
            <div className="pointer-events-none absolute inset-0 rounded-[50px] border-l-[1.5px] border-t-[1.5px]" style={{ borderColor: mix(P.slateLight, P.trim, 0.35) }} />
            <div className="relative overflow-hidden rounded-[40px] bg-paper px-4 pb-4 pt-3">
              {/* status bar + Dynamic Island */}
              <div className="relative flex h-[26px] items-center justify-between px-2">
                <span className="tnum text-[13px] font-semibold text-ink">9:41</span>
                <div className="absolute left-1/2 top-[1px] flex h-[24px] w-[88px] -translate-x-1/2 items-center justify-end rounded-full pr-[9px]" style={{ background: P.ink }}>
                  <span className="block h-[9px] w-[9px] rounded-full" style={{ background: `radial-gradient(circle at 35% 35%, ${P.glassLight}, ${P.slate} 55%, ${P.ink})` }} />
                </div>
                <StatusIcons />
              </div>
              <div className="mt-3 h-[3px] w-full rounded-full bg-line">
                <div className="h-full w-1/4 rounded-full bg-pine" />
              </div>
              <div className="mt-4 flex items-start justify-between gap-2">
                <p className="text-[19px] font-semibold leading-[24px] text-ink">{t('landing.phoneTitle')}</p>
                <Mic reduce={reduce} at={T.mic} />
              </div>
              {/* the family speaks: glowing sound bars, then the transcript */}
              <div className="relative mt-3 flex h-[34px] items-center gap-[3px] overflow-hidden rounded-full bg-pine-soft px-3">
                {!reduce && (
                  <motion.span
                    className="absolute left-[14px] top-1/2 h-[46px] w-[120px] -translate-y-1/2"
                    style={{ background: `radial-gradient(closest-side, ${P.honeyLight}, ${alpha(P.honeyLight, 0)})` }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.9, 0.9, 0] }}
                    transition={{ duration: 1.3, times: [0, 0.2, 0.75, 1], delay: T.voice }}
                  />
                )}
                {BARS.map((a, i) => (
                  <span
                    key={i}
                    className={`relative block h-[20px] w-[3px] rounded-full ${reduce ? '' : `la-bar la-bar-${i % 3}`}`}
                    style={{ background: `linear-gradient(180deg, ${P.pineLighter}, ${P.pine})`, transform: reduce ? 'scaleY(0.25)' : undefined, animationDelay: `${T.voice + i * 0.035}s`, scale: `1 ${a}` }}
                  />
                ))}
                <motion.span className="relative ml-2 truncate text-[11px] italic leading-[14px] text-ink-2" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: T.voice + 0.2 }}>
                  {t('landing.phoneSaid').slice(0, 34)}…
                </motion.span>
              </div>
              <div className="mt-3 flex flex-col gap-3">
                <Field label={fields[0][0]} value={fields[0][1]} at={fields[0][2]} reduce={reduce} />
                <Field label={fields[1][0]} value={fields[1][1]} at={fields[1][2]} reduce={reduce} />
                {/* income: filled by the amount that flies in from the pay stub */}
                <div>
                  <p className="mb-1 text-[11px] font-medium text-ink">{t('landing.phoneIncome')}</p>
                  <div className="tnum relative flex h-[34px] items-center overflow-hidden rounded-[6px] border border-line bg-surface px-2 text-[14px] text-ink">
                    <motion.span className="absolute inset-0 bg-pine-soft" initial={{ opacity: 0 }} animate={landed && !reduce ? { opacity: [0, 1, 0] } : { opacity: 0 }} transition={{ duration: 0.8, times: [0, 0.12, 1] }} />
                    <span ref={valRef} className="relative font-medium" style={{ opacity: landed ? 1 : 0, transition: 'opacity 120ms ease' }}>
                      $5,200
                    </span>
                  </div>
                </div>
                <Field label={fields[2][0]} value={fields[2][1]} at={fields[2][2]} reduce={reduce} />
                <div className="mt-1 flex h-[38px] items-center justify-center rounded-[8px] bg-pine text-[13px] font-medium text-white">{t('app.continue')}</div>
              </div>
              <div className="mx-auto mt-3 h-[4px] w-[100px] rounded-full" style={{ background: P.ink, opacity: 0.85 }} />
              {/* glass: a soft glare across the top-left of the screen */}
              <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(122deg, ${alpha(P.trim, 0.42)} 0%, ${alpha(P.trim, 0.1)} 17%, ${alpha(P.trim, 0)} 17.5%, ${alpha(P.trim, 0)} 60%, ${alpha(P.trim, 0.12)} 60.5%, ${alpha(P.trim, 0)} 74%)` }} />
            </div>
          </div>
        </motion.div>
      </div>

      {/* the pay stub slides in and settles at an angle; a warm scan beam passes down it */}
      {st >= 2 && (
      <motion.div
        className="absolute right-[-26px] top-[214px] z-[2] sm:right-[-92px]"
        style={{ width: STUB.w, height: STUB.h }}
        initial={reduce ? false : { x: 110, y: -24, rotate: 18, opacity: 0 }}
        animate={{ x: 0, y: 0, rotate: 5, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.7, bounce: 0.2, delay: T.stub, opacity: { duration: 0.2, delay: T.stub } }}
      >
        <PayStub label={t('landingArt.grossPay')} />
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `polygon(0 0, ${STUB.w - 24}px 0, ${STUB.w}px 24px, 100% 100%, 0 100%)`, borderRadius: 6 }}>
          {!reduce && (
            <motion.div
              className="absolute inset-x-0 top-0 h-[54px]"
              style={{ background: `linear-gradient(180deg, ${alpha(P.honeyLight, 0)} 0%, ${alpha(P.honeyLight, 0.55)} 42%, ${P.glow} 50%, ${alpha(P.honeyLight, 0.55)} 58%, ${alpha(P.honeyLight, 0)} 100%)` }}
              initial={{ y: -60, opacity: 0 }}
              animate={{ y: [-60, STUB.h + 6], opacity: [0, 1, 1, 0] }}
              transition={{ y: { duration: 0.85, ease: [0.65, 0, 0.35, 1], delay: T.scan }, opacity: { duration: 0.85, times: [0, 0.1, 0.85, 1], delay: T.scan } }}
            />
          )}
        </div>
        {/* gross-pay box: lights honey as the beam reads it; the printed amount stays on the paper */}
        <div className="absolute overflow-hidden rounded-[5px]" style={{ left: STUB.amt.x, top: STUB.amt.y, width: STUB.amt.w, height: STUB.amt.h }}>
          <motion.span className="absolute inset-0" style={{ background: P.honeyLight }} initial={{ opacity: 0 }} animate={reduce ? { opacity: 0 } : { opacity: [0, 0.9, 0.9, 0] }} transition={{ duration: 1.2, times: [0, 0.15, 0.7, 1], delay: T.scan + 0.6 }} />
          <span className="relative flex h-full items-center justify-center">
            <span ref={amtRef} className="tnum text-[15px] font-semibold" style={{ color: P.ink }}>
              $5,200
            </span>
          </span>
        </div>
      </motion.div>
      )}

      {/* the amount lifts off the paper (a little press first), arcs over, and lands in the income field */}
      {flight && !reduce && (
        <motion.div
          className="pointer-events-none absolute left-0 top-0 z-[3]"
          initial={{ x: flight.x0, y: flight.y0, rotate: 5, scale: 1, opacity: 1 }}
          animate={{
            x: [flight.x0, flight.x0, flight.x0 - 6, (flight.x0 + flight.x1) / 2, flight.x1],
            y: [flight.y0, flight.y0 + 1.5, flight.y0 - 12, Math.min(flight.y0, flight.y1) - 46, flight.y1],
            rotate: [5, 5, 3, -4, 0],
            scale: [1, 0.95, 1.16, 1.12, 0.93],
            opacity: [1, 1, 1, 1, 0],
          }}
          transition={{ duration: TL.land - TL.lift + 0.08, times: [0, 0.08, 0.27, 0.62, 1], ease: ['easeOut', [0.23, 1, 0.32, 1], [0.65, 0, 0.35, 1], [0.65, 0, 0.35, 1]] }}
        >
          <div className="relative -translate-x-1/2 -translate-y-1/2">
            <span className="absolute -inset-x-5 -inset-y-3 rounded-full" style={{ background: `radial-gradient(closest-side, ${P.glow}, ${alpha(P.glow, 0.5)} 60%, ${alpha(P.glow, 0)})` }} />
            <span className="absolute -bottom-4 left-1/2 h-[10px] w-[60px] -translate-x-1/2" style={{ background: `radial-gradient(closest-side, ${alpha(P.ink, 0.22)}, ${alpha(P.ink, 0)})` }} />
            <span className="tnum relative block whitespace-nowrap text-[15px] font-semibold" style={{ color: P.ink }}>
              $5,200
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/**
 * The kitchen table behind the phone, as a camera would see it with the phone in focus: a window onto the
 * neighborhood (its own little sky), a framed photo, the table top with a mug and a stack of mail. Drawn in soft,
 * low-contrast tones and blurred once (one static feGaussianBlur on the whole group, never animated); its edges
 * feather into the page. It fades in, then never changes.
 */
const Kitchen = memo(function Kitchen({ reduce }: { reduce: boolean }) {
  const id = 'la-kitchen';
  const soft = (c: string, k = 0.28) => mix(c, P.wall, k);
  return (
    <div
      className={`pointer-events-none absolute left-1/2 top-[-36px] z-0 hidden w-[620px] -translate-x-1/2 sm:block ${reduce ? '' : 'la-in la-in-0'}`}
      style={{ aspectRatio: '620 / 720', maskImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, #000 70%, transparent 100%)', WebkitMaskImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, #000 70%, transparent 100%)' }}
    >
      <svg viewBox="0 0 620 720" className="block h-full w-full">
        <defs>
          <filter id={`${id}-blur`} x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur stdDeviation="3.6" />
          </filter>
          <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={P.trim} />
            <stop offset="0.6" stopColor={P.wall} />
            <stop offset="1" stopColor={P.wallShade} />
          </linearGradient>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={P.skyTop} />
            <stop offset="1" stopColor={mix(P.skyBottom, P.honeyLight, 0.25)} />
          </linearGradient>
          <linearGradient id={`${id}-table`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={soft(P.timber, 0.15)} />
            <stop offset="1" stopColor={soft(P.timberShade, 0.1)} />
          </linearGradient>
          <linearGradient id={`${id}-mug`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={P.pineLighter} />
            <stop offset="0.55" stopColor={P.pineLight} />
            <stop offset="1" stopColor={P.pine} />
          </linearGradient>
        </defs>
        <g filter={`url(#${id}-blur)`} opacity={0.92}>
          <rect width="620" height="720" fill={`url(#${id}-wall)`} />
          <g transform="translate(-344 10)">
          {/* window onto the street: frame, sky, houses and a tree outside, mullions, sill */}
          <rect x={372} y={56} width={224} height={268} rx={6} fill={P.trim} />
          <rect x={384} y={68} width={200} height={244} fill={`url(#${id}-sky)`} />
          <path d="M384 262C430 252 470 258 520 252S570 256 584 254V312H384Z" fill={soft(P.sage, 0.2)} />
          <path d="M398 262V230L420 214L442 230V262Z" fill={soft(P.wall, 0.1)} />
          <path d="M420 214L442 230L452 224L430 208Z" fill={soft(P.slateLight, 0.2)} />
          <path d="M498 258V236L516 222L534 236V258Z" fill={soft(mix(P.wall, P.skyTop, 0.4), 0.1)} />
          <path d="M516 222L534 236L542 231L524 217Z" fill={soft(P.slateLight, 0.2)} />
          <circle cx={566} cy={226} r={20} fill={soft(P.treeLight, 0.25)} />
          <circle cx={472} cy={240} r={13} fill={soft(P.tree, 0.3)} />
          <rect x={480} y={68} width={8} height={244} fill={P.trim} />
          <rect x={384} y={186} width={200} height={8} fill={P.trim} />
          <rect x={362} y={322} width={244} height={14} rx={4} fill={P.trimShade} />
          {/* a pot of herbs on the sill */}
          <path d="M542 322l4 -26h26l4 26Z" fill={soft(P.amber, 0.35)} />
          <circle cx={552} cy={288} r={11} fill={soft(P.treeLight, 0.2)} />
          <circle cx={566} cy={282} r={13} fill={soft(P.tree, 0.25)} />
          </g>
          <g transform="translate(430 -10)">
          {/* a framed family photo on the wall */}
          <rect x={34} y={120} width={118} height={142} rx={4} fill={soft(P.bark, 0.3)} />
          <rect x={44} y={130} width={98} height={122} fill={soft(P.skyTop, 0.2)} />
          <circle cx={78} cy={186} r={14} fill={soft(SKIN[2], 0.25)} />
          <circle cx={110} cy={190} r={12} fill={soft(SKIN[1], 0.25)} />
          <path d="M56 252c4 -30 40 -34 46 -10c6 -26 38 -24 42 10Z" fill={soft(P.pineLight, 0.3)} />
          </g>
          {/* the table top and its front edge, light falling off toward us */}
          <path d="M-10 500H630V720H-10Z" fill={`url(#${id}-table)`} />
          <rect x={-10} y={500} width={640} height={6} fill={soft(mix(P.timber, P.trim, 0.5), 0.1)} />
          {[580, 640, 700].map((y) => (
            <rect key={y} x={-10} y={y} width={640} height={2} fill={soft(P.timberShade, 0.2)} opacity={0.6} />
          ))}
          {/* a mug: lit left side, handle in shade, coffee inside */}
          <ellipse cx={92} cy={598} rx={50} ry={10} fill={P.ink} opacity={0.12} />
          <path d="M52 516v72q0 12 38 12t38 -12v-72Z" fill={`url(#${id}-mug)`} />
          <ellipse cx={90} cy={516} rx={38} ry={10} fill={P.pineLight} />
          <ellipse cx={90} cy={518} rx={32} ry={7} fill={soft(P.bark, 0.1)} />
          <path d="M128 532q26 0 26 24t-26 24v-10q14 0 14 -14t-14 -14Z" fill={P.pine} />
          {/* a stack of mail: three envelopes, slightly askew */}
          <ellipse cx={498} cy={612} rx={84} ry={12} fill={P.ink} opacity={0.1} />
          <g transform="rotate(-4 500 590)">
            <rect x={420} y={570} width={160} height={36} rx={3} fill={soft(P.paperShade, 0.1)} />
          </g>
          <g transform="rotate(3 500 580)">
            <rect x={424} y={556} width={150} height={40} rx={3} fill={P.paper} />
            <path d="M424 556l75 22 75 -22" fill="none" stroke={P.paperShade} strokeWidth={3} />
            <rect x={548} y={562} width={18} height={14} rx={1} fill={soft(P.pine, 0.2)} />
          </g>
          <g transform="rotate(-2 498 566)">
            <rect x={432} y={544} width={140} height={38} rx={3} fill={P.trim} />
            <rect x={446} y={556} width={60} height={5} rx={2.5} fill={soft(P.ink2, 0.45)} />
            <rect x={446} y={566} width={40} height={5} rx={2.5} fill={soft(P.ink2, 0.55)} />
            <rect x={540} y={550} width={22} height={16} rx={1} fill={soft(P.honey, 0.2)} />
          </g>
        </g>
      </svg>
    </div>
  );
});

/** One intake field that fills (value fades up 4px) with a pine-soft wash. Stable, so re-renders never replay it. */
const Field = memo(function Field({ label, value, at, reduce }: { label: string; value: string; at: number; reduce: boolean }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-ink">{label}</p>
      <div className="tnum relative flex h-[34px] items-center overflow-hidden rounded-[6px] border border-line bg-surface px-2 text-[14px] text-ink">
        {!reduce && <motion.span className="absolute inset-0 bg-pine-soft" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.7, times: [0, 0.15, 1], delay: at }} />}
        <motion.span className="relative" initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: EASE_IN, delay: at }}>
          {value}
        </motion.span>
      </div>
    </div>
  );
});

/** Mic button: pine, with a warm halo that pulses while it listens. */
function Mic({ reduce, at }: { reduce: boolean; at: number }) {
  return (
    <span className="relative flex h-[36px] w-[36px] shrink-0 items-center justify-center">
      {!reduce &&
        [0, 0.5].map((d) => (
          <motion.span
            key={d}
            className="absolute inset-0 rounded-full"
            style={{ background: P.honey }}
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: [0, 0.55, 0], scale: [1, 1.25, 1.9] }}
            transition={{ duration: 0.9, times: [0, 0.2, 1], ease: 'easeOut', delay: at + d }}
          />
        ))}
      <motion.span
        className="relative flex h-[36px] w-[36px] items-center justify-center rounded-full"
        style={{ background: `radial-gradient(circle at 35% 30%, ${P.pineLighter}, ${P.pine} 60%, ${P.pineDark})` }}
        initial={false}
        animate={reduce ? undefined : { scale: [1, 0.92, 1.1, 1] }}
        transition={{ duration: 0.5, times: [0, 0.2, 0.6, 1], ease: 'easeOut', delay: at }}
      >
        <svg width="14" height="18" viewBox="0 0 14 18">
          <rect x="4" y="1" width="6" height="10" rx="3" fill={P.trim} />
          <path d="M1.5 8.5a5.5 5.5 0 0 0 11 0M7 14v3" fill="none" stroke={P.trim} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </motion.span>
    </span>
  );
}

/** Signal, wi-fi and battery glyphs for the status bar (filled). */
function StatusIcons() {
  return (
    <svg width="62" height="12" viewBox="0 0 62 12" className="block">
      <g fill={P.ink}>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={i * 4.4} y={8 - i * 2.4} width={3} height={3.6 + i * 2.4} rx={0.8} />
        ))}
        <path d="M25.5 3.4a8.6 8.6 0 0 1 11 0l-1.3 1.4a6.7 6.7 0 0 0-8.4 0Z M27.9 6a5 5 0 0 1 6.2 0l-1.3 1.4a3.1 3.1 0 0 0-3.6 0Z M31 10.6l-1.7-1.8a2.4 2.4 0 0 1 3.4 0Z" />
        <rect x={41.5} y={1.5} width={17} height={9} rx={2.6} fill="none" stroke={P.ink} strokeOpacity={0.45} strokeWidth={1} />
        <rect x={43} y={3} width={11.5} height={6} rx={1.5} />
        <rect x={59.4} y={4.4} width={1.6} height={3.2} rx={0.8} opacity={0.45} />
      </g>
    </svg>
  );
}

/** The pay stub: fibrous paper lit from the top-left, folded corner, pine header band, printed rows, gross-pay box. */
function PayStub({ label }: { label: string }) {
  const { w, h, amt } = STUB;
  const ink2 = P.ink2;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 overflow-visible">
      <defs>
        <pattern id="la-fiber" width="7" height="7" patternUnits="userSpaceOnUse">
          <rect width="7" height="7" fill={P.paper} />
          <path d="M0.5 1.5h2.2M4 4.6l1.8 0.6M1.6 5.8h1.4" stroke={P.paperShade} strokeWidth="0.6" strokeLinecap="round" />
          <circle cx="5.6" cy="1.6" r="0.35" fill={P.stoneShade} opacity="0.5" />
        </pattern>
        <linearGradient id="la-paperLight" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.trim} stopOpacity="0.7" />
          <stop offset="0.45" stopColor={P.trim} stopOpacity="0" />
          <stop offset="1" stopColor={P.paperShade} stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="la-fold" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={P.paperShade} />
          <stop offset="1" stopColor={P.trim} />
        </linearGradient>
        <filter id="la-stubShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      {/* soft shadow, offset down-right */}
      <rect x={8} y={12} width={w - 6} height={h - 4} rx={8} fill={P.ink} opacity={0.2} filter="url(#la-stubShadow)" />
      {/* paper with the corner folded back */}
      <path d={`M0 6Q0 0 6 0H${w - 24}L${w} 24V${h - 6}Q${w} ${h} ${w - 6} ${h}H6Q0 ${h} 0 ${h - 6}Z`} fill="url(#la-fiber)" />
      <path d={`M0 6Q0 0 6 0H${w - 24}L${w} 24V${h - 6}Q${w} ${h} ${w - 6} ${h}H6Q0 ${h} 0 ${h - 6}Z`} fill="url(#la-paperLight)" />
      {/* the fold: flap + the little shadow it casts */}
      <path d={`M${w - 24} 0L${w} 24L${w - 3} 27Z`} fill={P.ink} opacity={0.08} />
      <path d={`M${w - 24} 0V20Q${w - 24} 24 ${w - 20} 24H${w}Z`} fill="url(#la-fold)" />
      {/* header band: employer */}
      <rect x={10} y={12} width={92} height={18} rx={3.5} fill={P.pine} />
      <rect x={10} y={12} width={92} height={7} rx={3.5} fill={P.pineLight} opacity={0.6} />
      <rect x={16} y={18} width={38} height={4} rx={2} fill={P.trim} />
      <rect x={58} y={18} width={20} height={4} rx={2} fill={P.trim} opacity={0.6} />
      <rect x={10} y={38} width={58} height={3.5} rx={1.75} fill={ink2} opacity={0.4} />
      <rect x={10} y={46} width={36} height={3.5} rx={1.75} fill={ink2} opacity={0.25} />
      {/* perforation */}
      {Array.from({ length: 21 }, (_, i) => (
        <rect key={i} x={6 + i * 6} y={56} width={3} height={1.2} rx={0.6} fill={P.stoneShade} />
      ))}
      {/* earnings rows */}
      {[66, 78, 90, 102].map((y, i) => (
        <g key={y}>
          <rect x={10} y={y} width={[40, 30, 46, 34][i]} height={3.5} rx={1.75} fill={ink2} opacity={0.32} />
          <rect x={w - 10 - [22, 18, 26, 20][i]} y={y} width={[22, 18, 26, 20][i]} height={3.5} rx={1.75} fill={P.ink} opacity={0.45} />
        </g>
      ))}
      <rect x={10} y={111} width={w - 20} height={1} fill={P.paperShade} />
      {/* gross pay */}
      <rect x={amt.x} y={amt.y} width={amt.w} height={amt.h} rx={5} fill={P.pineSoft} />
      <rect x={amt.x} y={amt.y + amt.h - 2} width={amt.w} height={2} rx={1} fill={P.pine} opacity={0.35} />
      <text x={amt.x} y={amt.y - 5} fontSize="9.5" fontWeight="500" fill={ink2}>
        {label}
      </text>
    </svg>
  );
}
