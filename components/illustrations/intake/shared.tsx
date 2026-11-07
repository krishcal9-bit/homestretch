'use client';
import { motion, type MotionValue } from 'motion/react';
import { memo, useId, type ReactNode } from 'react';
import { P, type ClothKey } from '@/lib/illustrationPalette';
import type { FigureKind, HairStyle } from '@/components/illustrations/Figure';

/**
 * Pieces shared by the intake illustrations (round 5): the family's looks, soft shadows, coins, the glass
 * jar and the dial. Everything is filled and shaded with light from the top-left; colours come only from
 * lib/illustrationPalette. Soft shadows are radial gradients rather than blur filters, so a moving
 * illustration repaints cheaply at 4x CPU throttle.
 */

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** A stable id for <defs> inside one SVG (useId without the colons SVG url() can't take). */
export const useSvgId = () => useId().replace(/[^a-zA-Z0-9]/g, '');

/** The household, slot by slot: the same household always looks the same (step 1 and the dollhouse in step 3). */
export type Look = { kind: FigureKind; skin: number; hair: number; hairStyle: HairStyle; top: ClothKey; bottom: ClothKey; build?: 'slim' | 'broad' };
export const FAMILY: Look[] = [
  { kind: 'adult', skin: 2, hair: 0, hairStyle: 'long', top: 'pine', bottom: 'slate' },
  { kind: 'adult', skin: 3, hair: 0, hairStyle: 'short', top: 'sky', bottom: 'slate', build: 'broad' },
  { kind: 'child', skin: 2, hair: 1, hairStyle: 'curly', top: 'sage', bottom: 'sky' },
  { kind: 'teen', skin: 3, hair: 0, hairStyle: 'cap', top: 'slate', bottom: 'sky' },
  { kind: 'adult', skin: 2, hair: 4, hairStyle: 'bun', top: 'wall', bottom: 'sage' },
  { kind: 'toddler', skin: 1, hair: 2, hairStyle: 'short', top: 'sky', bottom: 'wall' },
  { kind: 'adult', skin: 1, hair: 1, hairStyle: 'short', top: 'sage', bottom: 'slate', build: 'broad' },
  { kind: 'child', skin: 3, hair: 0, hairStyle: 'long', top: 'pine', bottom: 'sage' },
];
export const look = (i: number) => FAMILY[((i % FAMILY.length) + FAMILY.length) % FAMILY.length];

/** <defs> for a soft shadow (a radial falloff of P.shadow): use with <Shadow id={id} />. */
export function ShadowDef({ id, strength = 1 }: { id: string; strength?: number }) {
  return (
    <radialGradient id={`${id}-sh`}>
      <stop offset="0" stopColor={P.ink} stopOpacity={0.2 * strength} />
      <stop offset="0.55" stopColor={P.ink} stopOpacity={0.11 * strength} />
      <stop offset="1" stopColor={P.ink} stopOpacity={0} />
    </radialGradient>
  );
}
export function Shadow({ id, cx, cy, rx, ry, opacity }: { id: string; cx: number; cy: number; rx: number; ry: number; opacity?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${id}-sh)`} opacity={opacity} />;
}

/* ---------- coins ---------- */

export const COIN = { rx: 8, ry: 2.7, t: 2.4 };

/** Gradients for honey coins: a lit face and a rim that turns from honey to brass. */
export function CoinDefs({ id }: { id: string }) {
  return (
    <>
      <linearGradient id={`${id}-cf`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={P.glow} />
        <stop offset="0.45" stopColor={P.honeyLight} />
        <stop offset="1" stopColor={P.honey} />
      </linearGradient>
      <linearGradient id={`${id}-ce`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={P.honey} />
        <stop offset="0.6" stopColor={P.brass} />
        <stop offset="1" stopColor={P.brassDark} />
      </linearGradient>
    </>
  );
}

/** One coin lying flat, its face centred on (0,0): a milled edge below, the lit face, a raised rim and a glint. */
export function Coin({ id }: { id: string }) {
  const { rx, ry, t } = COIN;
  return (
    <>
      <path d={`M${-rx} 0V${t}A${rx} ${ry} 0 0 0 ${rx} ${t}V0Z`} fill={`url(#${id}-ce)`} />
      <ellipse cx={0} cy={0} rx={rx} ry={ry} fill={`url(#${id}-cf)`} />
      <ellipse cx={0} cy={0.15} rx={rx - 2.2} ry={ry - 0.9} fill="none" stroke={P.brass} strokeWidth={0.6} opacity={0.45} />
      <ellipse cx={-3} cy={-0.6} rx={2.2} ry={0.6} fill={P.trim} opacity={0.7} />
    </>
  );
}

/* ---------- the glass jar ---------- */

/** Jar geometry: 40 wide, 56 tall, origin at the bottom centre (y grows down, so the jar is drawn at negative y). */
const JAR_BODY = 'M-20 -6V-41Q-20 -47 -14.5 -49L-12.5 -50V-54H12.5V-50L14.5 -49Q20 -47 20 -41V-6Q20 0 14 0H-14Q-20 0 -20 -6Z';
/** The inside, open at the top so coins can fall in through the neck. */
const JAR_INSIDE = 'M-18.4 -6V-40.6Q-18.4 -45.6 -13.6 -47.4L-11 -48.6V-120H11V-48.6L13.6 -47.4Q18.4 -45.6 18.4 -40.6V-6Q18.4 -1.6 13.6 -1.6H-13.6Q-18.4 -1.6 -18.4 -6Z';
export const JAR = { w: 40, h: 56, floor: -3.4, innerW: 36 };

export function JarDefs({ id }: { id: string }) {
  return (
    <>
      <linearGradient id={`${id}-jb`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={P.skyTop} stopOpacity={0.75} />
        <stop offset="0.45" stopColor={P.skyTop} stopOpacity={0.35} />
        <stop offset="1" stopColor={P.glassLight} stopOpacity={0.45} />
      </linearGradient>
      <linearGradient id={`${id}-je`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={P.glassLight} stopOpacity={0} />
        <stop offset="1" stopColor={P.glass} stopOpacity={0.32} />
      </linearGradient>
      <clipPath id={`${id}-ji`}>
        <path d={JAR_INSIDE} />
      </clipPath>
    </>
  );
}

/**
 * A glass jar (origin bottom centre): the back of the glass, then `children` (the contents, clipped to the
 * inside and free to fall in through the neck), then the front of the glass with its highlights.
 */
export function Jar({ id, children, shadow = true }: { id: string; children?: ReactNode; shadow?: boolean }) {
  return (
    <>
      {shadow && <Shadow id={id} cx={5} cy={0.5} rx={27} ry={4.2} />}
      {/* back of the glass */}
      <path d={JAR_BODY} fill={`url(#${id}-jb)`} />
      <ellipse cx={0} cy={-3.5} rx={16.5} ry={2.4} fill={P.glassLight} opacity={0.18} />
      <g clipPath={`url(#${id}-ji)`}>{children}</g>
      {/* front of the glass: shade on the right, a long highlight on the left, a thick base, the threaded neck */}
      <path d="M14 -48.6Q20 -47 20 -41V-6Q20 0 14 0H9Q16 -1 16 -7V-40Q16 -46 11 -49Z" fill={`url(#${id}-je)`} />
      <rect x={-16.2} y={-40} width={3} height={31} rx={1.5} fill={P.trim} opacity={0.75} />
      <rect x={-11.6} y={-38} width={1.3} height={12} rx={0.65} fill={P.trim} opacity={0.5} />
      <path d="M-15 -47.2Q-10 -49.6 -4 -49.8" fill="none" stroke={P.trim} strokeWidth={1.2} strokeLinecap="round" opacity={0.75} />
      <path d="M-18 -2.6Q0 0.8 18 -2.6" fill="none" stroke={P.glassLight} strokeWidth={1.6} strokeLinecap="round" opacity={0.35} />
      <path d={JAR_BODY} fill="none" stroke={P.glassLight} strokeWidth={0.9} opacity={0.6} />
      <rect x={-13.2} y={-56.6} width={26.4} height={7.2} rx={1.6} fill={P.glassLight} opacity={0.28} />
      <path d="M-13 -54H13M-13 -51.4H13" stroke={P.glassLight} strokeWidth={0.8} opacity={0.55} />
      <rect x={-11} y={-56} width={6} height={1.2} rx={0.6} fill={P.trim} opacity={0.8} />
    </>
  );
}

/* ---------- the dial (rent meter, credit gauge) ---------- */

/** Dial geometry in a 100×64 box: pivot at (50,54); angles in degrees from straight up (−90 left … +90 right). */
export const DIAL = { w: 100, h: 64, cx: 50, cy: 54, band: 31, needle: 33 };
const polar = (deg: number, r: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [DIAL.cx + r * Math.cos(a), DIAL.cy + r * Math.sin(a)] as const;
};
export const arcPath = (from: number, to: number, r: number = DIAL.band) => {
  const [x1, y1] = polar(from, r);
  const [x2, y2] = polar(to, r);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

export type DialBand = { from: number; to: number; color: string; on: boolean; off?: string };
export type NeedleTone = 'idle' | 'pine' | 'amber' | 'ink';
const NEEDLE: Record<NeedleTone, [string, string]> = {
  idle: [P.wallShade, P.wallDeep],
  pine: [P.pineLight, P.pineDark],
  amber: [P.honey, P.amber],
  ink: [P.slateLight, P.slateDark],
};

/**
 * An instrument dial: a bezel with thickness, a recessed paper face, coloured bands (each fades between a
 * muted and a lit state: opacity only), ticks, a two-tone needle with its own shadow, a hub and a glass glare.
 * The needle follows `angle` (a spring the caller owns), so it swings and settles with weight. Memoized:
 * while the needle moves (typing), the dial itself never re-renders; pass stable `bands` (useMemo).
 */
export const Dial = memo(function Dial({ id, width, angle, bands, ticks, major = [], tone, children }: { id: string; width: number; angle: MotionValue<number>; bands: DialBand[]; ticks: number[]; major?: number[]; tone: NeedleTone; children?: ReactNode }) {
  const { cx, cy, needle } = DIAL;
  return (
    <svg width={width} height={(width * DIAL.h) / DIAL.w} viewBox={`0 0 ${DIAL.w} ${DIAL.h}`} className="block overflow-visible" aria-hidden>
      <defs>
        <ShadowDef id={id} />
        <linearGradient id={`${id}-bz`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.trim} />
          <stop offset="0.5" stopColor={P.trimShade} />
          <stop offset="1" stopColor={P.wallDeep} />
        </linearGradient>
        <radialGradient id={`${id}-fc`} cx="0.5" cy="0.84" r="0.62">
          <stop offset="0.72" stopColor={P.paper} />
          <stop offset="1" stopColor={P.paperShade} />
        </radialGradient>
        <radialGradient id={`${id}-hb`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={P.slateLight} />
          <stop offset="1" stopColor={P.slateDark} />
        </radialGradient>
      </defs>
      <Shadow id={id} cx={55} cy={62} rx={50} ry={5} />
      {/* bezel: a half-round housing with a front edge that shows its thickness */}
      <path d="M3 56V54A47 47 0 0 1 97 54V56Q97 62 91 62H9Q3 62 3 56Z" fill={P.wallDeep} />
      <path d="M3 54A47 47 0 0 1 97 54V55Q97 59 92 59H8Q3 59 3 55Z" fill={`url(#${id}-bz)`} />
      <path d={`M9 55A41 41 0 0 1 91 55Z`} fill={`url(#${id}-fc)`} />
      {/* bands */}
      {bands.map((b) => (
        <g key={`${b.from}`}>
          <path d={arcPath(b.from, b.to)} fill="none" stroke={b.off ?? P.wallShade} strokeWidth={6.5} />
          <motion.path d={arcPath(b.from, b.to)} fill="none" stroke={b.color} strokeWidth={6.5} initial={false} animate={{ opacity: b.on ? 1 : 0 }} transition={{ duration: 0.2 }} />
        </g>
      ))}
      {/* ticks */}
      {ticks.map((a) => {
        const big = major.includes(a);
        const [x1, y1] = polar(a, big ? 21 : 23.5);
        const [x2, y2] = polar(a, 27);
        return <path key={a} d={`M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`} stroke={big ? P.ink : P.ink2} strokeWidth={big ? 1.6 : 0.9} strokeLinecap="round" opacity={big ? 0.9 : 0.5} />;
      })}
      {children}
      {/* needle shadow (offset down-right), then the needle; both pivot on the hub */}
      <g transform="translate(1.4 1.8)">
        <motion.g style={{ rotate: angle, originX: 0.5, originY: 0.5 }}>
          <circle cx={cx} cy={cy} r={needle} fill="none" />
          <path d={`M${cx - 1.9} ${cy + 5}L${cx} ${cy - needle}L${cx + 1.9} ${cy + 5}Z`} fill={P.shadow} />
        </motion.g>
      </g>
      <motion.g style={{ rotate: angle, originX: 0.5, originY: 0.5 }}>
        <circle cx={cx} cy={cy} r={needle} fill="none" />
        {(Object.keys(NEEDLE) as NeedleTone[]).map((k) => (
          <motion.g key={k} initial={false} animate={{ opacity: tone === k ? 1 : 0 }} transition={{ duration: 0.2 }}>
            <path d={`M${cx - 2} ${cy + 6}L${cx} ${cy - needle}V${cy + 6}Z`} fill={NEEDLE[k][0]} />
            <path d={`M${cx} ${cy - needle}L${cx + 2} ${cy + 6}H${cx}Z`} fill={NEEDLE[k][1]} />
          </motion.g>
        ))}
      </motion.g>
      <circle cx={cx} cy={cy} r={4.6} fill={`url(#${id}-hb)`} />
      <circle cx={cx - 1.4} cy={cy - 1.5} r={1.2} fill={P.trim} opacity={0.7} />
      {/* glass glare across the upper left of the face */}
      <path d="M17 44A36 36 0 0 1 44 20.6A40 40 0 0 0 21 46Z" fill={P.trim} opacity={0.55} />
    </svg>
  );
});

