'use client';
import { AnimatePresence, motion, useReducedMotion, useSpring, useTransform, useVelocity, type MotionValue } from 'motion/react';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLang } from '@/lib/i18n';
import { money } from '@/lib/format';
import { P } from '@/lib/illustrationPalette';
import { exit } from '@/lib/motion';
import { DEBT_KINDS, draftToProfile, type Draft } from '@/lib/draft';
import { JarCoins } from './CoinJar';
import { CoinDefs, Jar, JarDefs, Shadow, ShadowDef, clamp, useSvgId } from './shared';

const W = 340;
const H = 194;
const PX = W / 2; // pivot
const PY = 50;
const ARM = 98;
const MAX_TILT = 8; // degrees
const DROP = 82; // hook to pan rim
const PAN_RX = 52;
const BASE_Y = 172;
const ING_H = 19;
const ING_TOP = 3.4; // the lit top face of a weight
const JAR_X = 17; // the jar sits right of centre in its pan, its tag hangs to the left

type TagSpec = { key: string; label: string };

/** Savings coins in the jar: one per $600, at most 10. */
const coinsForSavings = (s: number) => (s > 0 ? Math.min(10, Math.max(1, Math.round(s / 600))) : 0);

/** A debt as a cast weight: a slate ingot (lit top face, front face, shaded end) with its amount on the front. */
function Ingot({ label, w, id }: { label: string; w: number; id: string }) {
  const h = ING_H;
  return (
    <>
      <path d={`M${-w / 2} 0L${-w / 2 + 2.6} ${-h}H${w / 2 - 2.6}L${w / 2} 0Z`} fill={`url(#${id}-ing)`} />
      <path d={`M${-w / 2 + 2.6} ${-h}L${-w / 2 + 5.6} ${-h - ING_TOP}H${w / 2 + 0.4}L${w / 2 - 2.6} ${-h}Z`} fill={P.slateLight} />
      <path d={`M${w / 2 - 2.6} ${-h}L${w / 2 + 0.4} ${-h - ING_TOP}L${w / 2 + 3} ${-ING_TOP}L${w / 2} 0Z`} fill={P.slateDark} />
      <path d={`M${-w / 2 + 4} ${-h + 1.4}H${w / 2 - 5}`} stroke={P.glassLight} strokeWidth={0.8} opacity={0.55} />
      <text x={0} y={-5.4} textAnchor="middle" className="tnum" fontSize={13} fill={P.boardInk}>
        {label}
      </text>
    </>
  );
}

/** The savings tag: a paper gift tag on a cord from the jar's neck, its two lines in pine. */
function SavingsTag({ word, amount, w }: { word: string; amount: string; w: number }) {
  const right = JAR_X - 15;
  return (
    <g>
      <path d={`M${JAR_X - 9} -53Q${right - 2} -50 ${right - 5} -42`} fill="none" stroke={P.brassDark} strokeWidth={0.8} />
      <g transform={`rotate(-5 ${right - 5} -42)`}>
        <rect x={right - w + 1.4} y={-44 + 1.8} width={w} height={36} rx={3.5} fill={P.ink} opacity={0.12} />
        <path d={`M${right - w} -40.5Q${right - w} -44 ${right - w + 3.5} -44H${right - 8}L${right} -37V-11.5Q${right} -8 ${right - 3.5} -8H${right - w + 3.5}Q${right - w} -8 ${right - w} -11.5Z`} fill={P.paper} />
        <rect x={right - w} y={-10.5} width={w} height={2.5} rx={1.2} fill={P.paperShade} />
        <circle cx={right - 5} cy={-39.5} r={1.5} fill={P.paperShade} />
        <text x={right - w / 2 - 1} y={-29} textAnchor="middle" className="tnum" fontSize={13} fill={P.ink2}>
          {word}
        </text>
        <text x={right - w / 2 - 1} y={-14} textAnchor="middle" className="tnum" fontSize={13} fontWeight={500} fill="var(--pine)">
          {amount}
        </text>
      </g>
    </g>
  );
}

/**
 * One pan hanging from a beam end: three cords to a shallow brass dish that stays level, swinging a little
 * as the beam moves (follow-through). `children` sit in the dish (drawn between its back rim and its bowl).
 */
function Pan({ hx, hy, swing, id, children }: { hx: MotionValue<number>; hy: MotionValue<number>; swing: MotionValue<number>; id: string; children: ReactNode }) {
  return (
    <motion.g style={{ x: hx, y: hy }}>
      <motion.g style={{ rotate: swing, transformBox: 'view-box', originX: 0, originY: 0 }}>
        <path d={`M0 0L${-PAN_RX + 4} ${DROP}M0 0L${PAN_RX - 4} ${DROP}M0 0L0 ${DROP - 5}`} stroke={P.brassDark} strokeWidth={0.9} opacity={0.7} />
        <circle cx={0} cy={0} r={2.4} fill={P.brassDark} />
        <g transform={`translate(0 ${DROP})`}>
          <ellipse cx={0} cy={0} rx={PAN_RX} ry={6.5} fill={`url(#${id}-dish)`} />
          {children}
          <path d={`M${-PAN_RX} 0Q${-PAN_RX + 6} 15 0 15Q${PAN_RX - 6} 15 ${PAN_RX} 0Q0 9 ${-PAN_RX} 0Z`} fill={`url(#${id}-bowl)`} />
          <path d={`M${-PAN_RX + 1} 0.4Q0 8.6 ${PAN_RX - 1} 0.4`} fill="none" stroke={P.glow} strokeWidth={1.2} opacity={0.8} />
        </g>
      </motion.g>
    </motion.g>
  );
}

/** Widths of some 13px labels, measured before paint (estimated until then). */
function useWidths(labels: string[]) {
  const refs = useRef<(SVGTextElement | null)[]>([]);
  const [w, setW] = useState(() => labels.map((l) => l.length * 7.2));
  const key = labels.join('|');
  useLayoutEffect(() => {
    setW(labels.map((l, i) => refs.current[i]?.getComputedTextLength() || l.length * 7.2));
    // labels are compared by their joined text
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const probes = labels.map((l, i) => (
    <text
      key={i}
      ref={(el) => {
        refs.current[i] = el;
      }}
      className="tnum"
      fontSize={13}
      opacity={0}
    >
      {l}
    </text>
  ));
  return [w, probes] as const;
}

/**
 * Step 4: what the family owes against what they've saved, on a brass balance. Each debt with a value is a
 * slate weight on the left pan ("Car $320"), stacked neatly at one width; savings is a glass jar of coins on
 * the right with a paper tag. The beam tips toward the heavier side (debts weighed by balance, estimated
 * from the payment when only that is known), up to 8°, and settles with a damped swing; the pans swing a
 * little behind it.
 */
export const BalanceScale = memo(function BalanceScale({ debts, savings }: { debts: Draft['debts']; savings: number | null }) {
  const { t, lang } = useLang();
  const id = useSvgId();
  const reduce = useReducedMotion();
  const { left, saved, tilt, coins } = useMemo(() => {
    const owed = draftToProfile({ debts } as Draft).debts.reduce((s, d) => s + d.balance, 0);
    const saved = Math.max(0, savings ?? 0);
    const left: TagSpec[] = [];
    for (const kind of DEBT_KINDS) {
      const { payment, balance } = debts[kind];
      const v = balance ?? payment;
      if (v && v > 0) left.push({ key: kind, label: `${t(`intakeArt.tag.${kind}`)} ${money(v, lang)}` });
    }
    // A pan holds three readable weights; past that the rest fold into "+2 more".
    if (left.length > 3) left.splice(2, left.length - 2, { key: 'more', label: t('intakeArt.more', { n: left.length - 2 }) });
    const tilt = owed + saved > 0 ? clamp((saved - owed) / (owed + saved), -1, 1) * MAX_TILT : 0;
    return { left, saved, tilt, coins: coinsForSavings(saved) };
  }, [debts, savings, t, lang]);
  const word = t('intakeArt.tag.savings');
  const amount = money(saved, lang);
  const [widths, probes] = useWidths([...left.map((l) => l.label), word, amount]);
  // each weight is as wide as its label; the widest sit at the bottom, so the pile is stable (a new one
  // settles into its place in the pile and the others make room with a spring, never a jump in size)
  const pile = left.map((tag, i) => ({ ...tag, w: widths[i] + 22 })).sort((a, b) => b.w - a.w);
  const tagW = Math.max(widths[left.length], widths[left.length + 1]) + 18;

  const angle = useSpring(tilt, { visualDuration: 0.8, bounce: 0.25 });
  useEffect(() => {
    if (reduce) angle.jump(tilt);
    else angle.set(tilt);
  }, [tilt, reduce, angle]);
  const rad = useTransform(angle, (a) => (a * Math.PI) / 180);
  const lx = useTransform(rad, (r) => PX - ARM * Math.cos(r));
  const ly = useTransform(rad, (r) => PY - ARM * Math.sin(r));
  const rx = useTransform(rad, (r) => PX + ARM * Math.cos(r));
  const ry = useTransform(rad, (r) => PY + ARM * Math.sin(r));
  const vel = useVelocity(angle);
  const swing = useTransform(vel, (v) => clamp(-v * 0.06, -4, 4));

  const step = ING_H + ING_TOP;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block h-auto max-w-full overflow-visible" aria-hidden data-testid="debt-scale">
      <defs>
        <ShadowDef id={id} />
        <JarDefs id={id} />
        <CoinDefs id={id} />
        <linearGradient id={`${id}-post`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={P.honey} />
          <stop offset="0.3" stopColor={P.glow} />
          <stop offset="0.55" stopColor={P.brass} />
          <stop offset="1" stopColor={P.brassDark} />
        </linearGradient>
        <linearGradient id={`${id}-beam`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.honeyLight} />
          <stop offset="0.45" stopColor={P.brass} />
          <stop offset="1" stopColor={P.brassDark} />
        </linearGradient>
        <linearGradient id={`${id}-bowl`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={P.honeyLight} />
          <stop offset="0.4" stopColor={P.brass} />
          <stop offset="1" stopColor={P.brassDark} />
        </linearGradient>
        <radialGradient id={`${id}-dish`} cx="0.6" cy="0.6" r="0.7">
          <stop offset="0" stopColor={P.brass} />
          <stop offset="1" stopColor={P.brassDark} />
        </radialGradient>
        <radialGradient id={`${id}-cap`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={P.glow} />
          <stop offset="0.5" stopColor={P.honey} />
          <stop offset="1" stopColor={P.brassDark} />
        </radialGradient>
        <linearGradient id={`${id}-ing`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.slateLight} />
          <stop offset="1" stopColor={P.slateDark} />
        </linearGradient>
        <linearGradient id={`${id}-base`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={P.honey} />
          <stop offset="0.5" stopColor={P.brass} />
          <stop offset="1" stopColor={P.brassDark} />
        </linearGradient>
      </defs>
      {probes}
      {/* stand: a stepped base with its shadow, a turned post */}
      <Shadow id={id} cx={PX + 8} cy={BASE_Y + 14} rx={62} ry={5} />
      <path d={`M${PX - 44} ${BASE_Y + 14}L${PX - 40} ${BASE_Y + 6}H${PX + 40}L${PX + 44} ${BASE_Y + 14}Z`} fill={`url(#${id}-base)`} />
      <rect x={PX - 40} y={BASE_Y + 5} width={80} height={1.6} fill={P.glow} opacity={0.7} />
      <path d={`M${PX - 26} ${BASE_Y + 6}L${PX - 22} ${BASE_Y}H${PX + 22}L${PX + 26} ${BASE_Y + 6}Z`} fill={`url(#${id}-base)`} />
      <rect x={PX - 6} y={PY + 6} width={12} height={BASE_Y - PY - 6} fill={`url(#${id}-post)`} />
      <rect x={PX - 8} y={BASE_Y - 6} width={16} height={6} rx={1.5} fill={`url(#${id}-post)`} />
      <rect x={PX - 7.5} y={PY + 14} width={15} height={4} rx={1.5} fill={`url(#${id}-post)`} />

      {/* left pan: debts as weights */}
      <Pan hx={lx} hy={ly} swing={swing} id={id}>
        <AnimatePresence initial={false}>
          {pile.map((tag, i) => (
            <motion.g
              key={tag.key}
              initial={{ opacity: 0, y: -2 - i * step - 26 }}
              animate={{ opacity: 1, y: -2 - i * step }}
              exit={{ opacity: 0, y: -2 - i * step - 10, transition: exit }}
              transition={{ y: { type: 'spring', duration: 0.5, bounce: 0.22 }, opacity: { duration: 0.1 } }}
            >
              <Ingot label={tag.label} id={id} w={tag.w} />
            </motion.g>
          ))}
        </AnimatePresence>
      </Pan>

      {/* right pan: the savings jar and its tag */}
      <Pan hx={rx} hy={ry} swing={swing} id={id}>
        <AnimatePresence initial={false}>
          {saved > 0 && (
            <motion.g key="jar" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: -1 }} exit={{ opacity: 0, y: -8, transition: exit }} transition={{ y: { type: 'spring', duration: 0.5, bounce: 0.2 }, opacity: { duration: 0.12 } }}>
              <g transform={`translate(${JAR_X} 0)`}>
                <Jar id={id} shadow={false}>
                  <JarCoins n={coins} max={10} id={id} />
                </Jar>
              </g>
              <SavingsTag word={word} amount={amount} w={tagW} />
            </motion.g>
          )}
        </AnimatePresence>
      </Pan>

      {/* the beam pivots on the post (centred on the pivot, so it turns about it) */}
      <motion.g style={{ rotate: angle, originX: 0.5, originY: 0.5 }}>
        <path d={`M${PX - ARM - 3} ${PY - 2}Q${PX} ${PY - 4.4} ${PX + ARM + 3} ${PY - 2}V${PY + 2}Q${PX} ${PY + 4.4} ${PX - ARM - 3} ${PY + 2}Z`} fill={`url(#${id}-beam)`} />
        <path d={`M${PX - ARM} ${PY - 2.2}Q${PX} ${PY - 4.2} ${PX + ARM} ${PY - 2.2}`} fill="none" stroke={P.glow} strokeWidth={0.9} opacity={0.8} />
        <circle cx={PX - ARM - 3} cy={PY} r={3.4} fill={`url(#${id}-cap)`} />
        <circle cx={PX + ARM + 3} cy={PY} r={3.4} fill={`url(#${id}-cap)`} />
      </motion.g>
      {/* the pivot cap and finial */}
      <circle cx={PX} cy={PY} r={7.5} fill={`url(#${id}-cap)`} />
      <circle cx={PX - 2.4} cy={PY - 2.6} r={2} fill={P.glow} opacity={0.85} />
      <circle cx={PX} cy={PY - 11} r={3.2} fill={`url(#${id}-cap)`} />
    </svg>
  );
});
