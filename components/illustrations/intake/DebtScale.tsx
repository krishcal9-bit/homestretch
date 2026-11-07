'use client';
import { AnimatePresence, motion, useReducedMotion, useSpring, useTransform, type MotionValue } from 'motion/react';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { money } from '@/lib/format';
import { exit, spring } from '@/lib/motion';
import { DEBT_KINDS, draftToProfile, type Draft } from '@/lib/draft';
import { clamp, line } from './shared';

const W = 340;
const H = 116;
const PX = W / 2; // pivot
const PY = 92;
const ARM = 104;
const MAX_TILT = 6; // degrees
const PAN_Y = PY - 10;
const TAG_H = 18;
const STACK = 60; // tallest a pile of tags may get
const JITTER = [0, -5, 4, -3, 5];

type TagSpec = { key: string; label: string; tone: 'debt' | 'savings' };

/** A tag that sizes itself to its text (measured before paint). */
function Tag({ label, tone, showText }: { label: string; tone: TagSpec['tone']; showText: boolean }) {
  const ref = useRef<SVGTextElement>(null);
  const [tw, setTw] = useState(label.length * 7.2);
  useLayoutEffect(() => {
    const n = ref.current?.getComputedTextLength();
    if (n) setTw(n);
  }, [label]);
  const w = tw + 16;
  const savings = tone === 'savings';
  return (
    <>
      <rect x={-w / 2} y={0} width={w} height={TAG_H} rx={4} {...line} stroke={savings ? 'var(--pine)' : 'var(--ink-2)'} fill={savings ? 'var(--pine-soft)' : 'var(--surface)'} />
      <text ref={ref} x={0} y={13.5} textAnchor="middle" className="tnum" fontSize={13} fill={savings ? 'var(--pine)' : 'var(--ink)'} opacity={showText ? 1 : 0}>
        {label}
      </text>
    </>
  );
}

/** One pan: a tray on a post at the end of the beam, kept level, carrying a pile of tags. */
function Pan({ cx, y, tags }: { cx: number; y: MotionValue<number>; tags: TagSpec[] }) {
  const n = tags.length;
  const step = n <= 1 ? 0 : Math.min(TAG_H + 3, (STACK - TAG_H) / (n - 1));
  return (
    <motion.g style={{ y }}>
      <path d={`M${cx} ${PY}V${PAN_Y}`} {...line} />
      <path d={`M${cx - 62} ${PAN_Y - 4}L${cx - 58} ${PAN_Y}H${cx + 58}L${cx + 62} ${PAN_Y - 4}`} {...line} />
      <AnimatePresence initial={false}>
        {tags.map((tag, i) => {
          const ty = PAN_Y - 2 - TAG_H - i * step;
          return (
            <motion.g
              key={tag.key}
              initial={{ opacity: 0, x: cx + JITTER[i % JITTER.length], y: ty - 14 }}
              animate={{ opacity: 1, x: cx + JITTER[i % JITTER.length], y: ty }}
              exit={{ opacity: 0, transition: exit }}
              transition={spring.snappy}
            >
              <Tag label={tag.label} tone={tag.tone} showText={i === n - 1 || step >= TAG_H} />
            </motion.g>
          );
        })}
      </AnimatePresence>
    </motion.g>
  );
}

/**
 * What the family owes against what they've saved, on a balance. Each debt with a value drops a tag
 * ("Car $320") onto the left pan; savings sits on the right. The beam tips with a spring toward the heavier
 * side (debts weighed by balance, estimated from the payment when only that is known), up to 6°.
 */
export const DebtScale = memo(function DebtScale({ debts, savings }: { debts: Draft['debts']; savings: number | null }) {
  const { t, lang } = useLang();
  const reduce = useReducedMotion();
  const { left, right, tilt } = useMemo(() => {
    const owed = draftToProfile({ debts } as Draft).debts.reduce((s, d) => s + d.balance, 0);
    const saved = Math.max(0, savings ?? 0);
    const left: TagSpec[] = [];
    for (const kind of DEBT_KINDS) {
      const { payment, balance } = debts[kind];
      const v = balance ?? payment;
      if (v && v > 0) left.push({ key: kind, label: `${t(`intakeArt.tag.${kind}`)} ${money(v, lang)}`, tone: 'debt' });
    }
    // A pan holds three readable tags; past that the rest fold into "+2 more".
    if (left.length > 3) left.splice(2, left.length - 2, { key: 'more', label: t('intakeArt.more', { n: left.length - 2 }), tone: 'debt' });
    const right: TagSpec[] = saved > 0 ? [{ key: 'savings', label: `${t('intakeArt.tag.savings')} ${money(saved, lang)}`, tone: 'savings' }] : [];
    const tilt = owed + saved > 0 ? clamp((saved - owed) / (owed + saved), -1, 1) * MAX_TILT : 0;
    return { left, right, tilt };
  }, [debts, savings, t, lang]);

  const angle = useSpring(tilt, spring.smooth);
  useEffect(() => {
    if (reduce) angle.jump(tilt);
    else angle.set(tilt);
  }, [tilt, reduce, angle]);
  const lift = useTransform(angle, (a) => -ARM * Math.sin((a * Math.PI) / 180));
  const drop = useTransform(lift, (v) => -v);

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block h-auto max-w-full overflow-visible" aria-hidden data-testid="debt-scale">
      <path d={`M${PX - 44} ${H - 2.5}H${PX + 44}`} stroke="var(--line)" strokeWidth={1.5} strokeLinecap="round" />
      <path d={`M${PX} ${PY}L${PX - 13} ${H - 3}H${PX + 13}Z`} {...line} fill="var(--surface)" />
      <Pan cx={PX - ARM} y={lift} tags={left} />
      <Pan cx={PX + ARM} y={drop} tags={right} />
      <motion.path d={`M${PX - ARM - 6} ${PY}H${PX + ARM + 6}`} {...line} strokeWidth={2} style={{ rotate: angle, originX: 0.5, originY: 0.5 }} />
      <circle cx={PX} cy={PY} r={3} {...line} fill="var(--surface)" />
    </svg>
  );
});
