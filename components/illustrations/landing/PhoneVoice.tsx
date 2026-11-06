'use client';
import { motion } from 'motion/react';
import { useLang } from '@/lib/i18n';
import { ease } from '@/lib/motion';

/**
 * Scene 1: a phone running the intake. The mic pulses, five sound-wave bars play while the
 * household fields fill one by one; a pay stub slides in, a scan line sweeps down it, and the
 * income field fills with $5,200. Replays every time the section becomes active (remount via key).
 */
export function PhoneVoice({ reduce }: { reduce: boolean }) {
  const { t } = useLang();
  const T = reduce ? { mic: 0, bars: 0, fields: [0, 0, 0], doc: 0, scan: 0, income: 0 } : { mic: 0.15, bars: 0.45, fields: [0.75, 1.0, 1.25], doc: 1.45, scan: 1.65, income: 2.5 };
  const fields: [string, string, number][] = [
    [t('landing.phonePeople'), '4', T.fields[0]],
    [t('landing.phoneOC'), t('landing.phoneYes'), T.fields[1]],
    [t('landing.phoneRent'), '$2,350', T.fields[2]],
  ];
  const fill = (at: number) => ({ initial: reduce ? false : ({ opacity: 0, y: 4 } as const), animate: { opacity: 1, y: 0 }, transition: { duration: 0.2, ease: ease.out, delay: at } });
  const wash = (at: number) => ({ initial: { opacity: reduce ? 0 : 0 }, animate: reduce ? { opacity: 0 } : { opacity: [0, 1, 0] }, transition: { duration: 0.6, times: [0, 0.15, 1], delay: at } });
  const Field = ({ label, value, at }: { label: string; value: string; at: number }) => (
    <div>
      <p className="mb-1 text-[11px] font-medium text-ink">{label}</p>
      <div className="tnum relative flex h-[34px] items-center overflow-hidden rounded-[6px] border border-line bg-surface px-2 text-[14px] text-ink">
        <motion.span className="absolute inset-0 bg-pine-soft" {...wash(at)} />
        <motion.span className="relative" {...fill(at)}>
          {value}
        </motion.span>
      </div>
    </div>
  );
  return (
    <div className="relative mx-auto w-[300px]" aria-hidden>
      {/* phone: pure CSS frame */}
      <div className="w-[300px] rounded-[44px] border-[10px] border-ink bg-paper p-4 pt-3">
        <div className="mx-auto mb-3 h-[22px] w-[96px] rounded-full bg-ink" />
        <div className="h-[3px] w-full bg-line">
          <div className="h-full w-1/4 bg-pine" />
        </div>
        <div className="mt-4 flex items-start justify-between gap-2">
          <p className="text-[19px] font-semibold leading-[24px] text-ink">{t('landing.phoneTitle')}</p>
          <motion.span
            className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-pine bg-surface"
            initial={false}
            animate={reduce ? undefined : { scale: [1, 1.18, 1] }}
            transition={{ duration: 0.5, ease: ease.inOut, delay: T.mic }}
          >
            <svg width="14" height="18" viewBox="0 0 14 18">
              <rect x="4" y="1" width="6" height="10" rx="3" fill="none" stroke="var(--pine)" strokeWidth="1.6" />
              <path d="M1.5 8.5a5.5 5.5 0 0 0 11 0M7 14v3" fill="none" stroke="var(--pine)" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </motion.span>
        </div>
        {/* sound-wave bars while the family speaks */}
        <div className="mt-2 flex h-[22px] items-center gap-[3px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.span
              key={i}
              className="block h-[18px] w-[3px] origin-center rounded-full bg-pine"
              initial={{ scaleY: 0.2, opacity: 0 }}
              animate={reduce ? { opacity: 0 } : { scaleY: [0.2, 1, 0.35, 0.85, 0.3, 0.7, 0.2], opacity: [0, 1, 1, 1, 1, 1, 0] }}
              transition={{ duration: 1.05, ease: 'easeInOut', delay: T.bars + i * 0.06 }}
            />
          ))}
          <motion.span className="ml-2 text-[11px] italic leading-[14px] text-ink-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: T.bars + 0.1 }}>
            {t('landing.phoneSaid').slice(0, 42)}…
          </motion.span>
        </div>
        <div className="mt-3 flex flex-col gap-3 pb-3">
          <Field label={fields[0][0]} value={fields[0][1]} at={fields[0][2]} />
          <Field label={fields[1][0]} value={fields[1][1]} at={fields[1][2]} />
          <Field label={t('landing.phoneIncome')} value="$5,200" at={T.income} />
          <Field label={fields[2][0]} value={fields[2][1]} at={fields[2][2]} />
          <div className="mt-1 flex h-[38px] items-center justify-center rounded-[6px] bg-pine text-[13px] font-medium text-white">{t('app.continue')}</div>
        </div>
      </div>
      {/* the pay stub slides in; a scan line sweeps down it */}
      <motion.div
        className="absolute -right-10 top-[168px] w-[124px] rounded-[6px] border border-line bg-surface p-3 sm:-right-24"
        initial={reduce ? false : { x: 40, opacity: 0, rotate: 4 }}
        animate={{ x: 0, opacity: 1, rotate: 4 }}
        transition={{ duration: 0.35, ease: ease.out, delay: T.doc }}
      >
        <svg width="100" height="120" viewBox="0 0 100 120" className="block">
          <rect x="0" y="0" width="60" height="7" rx="2" fill="var(--pine)" opacity="0.8" />
          {[18, 30, 42, 54, 66, 78].map((y, i) => (
            <line key={y} x1="0" x2={i % 2 ? 78 : 96} y1={y} y2={y} stroke="var(--line)" strokeWidth="3" strokeLinecap="round" />
          ))}
          <rect x="54" y="92" width="46" height="14" rx="3" fill="none" stroke="var(--pine)" strokeWidth="1.5" />
          <text x="77" y="102.5" textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--ink)">
            $2,400
          </text>
          {/* scan line */}
          <motion.line
            x1="-6"
            x2="106"
            y1="0"
            y2="0"
            stroke="var(--pine)"
            strokeWidth="2"
            initial={{ y: 0, opacity: 0 }}
            animate={reduce ? { opacity: 0 } : { y: [0, 118], opacity: [0, 1, 1, 0] }}
            transition={{ y: { duration: 0.8, ease: 'linear', delay: T.scan }, opacity: { duration: 0.8, times: [0, 0.05, 0.9, 1], delay: T.scan } }}
          />
        </svg>
      </motion.div>
    </div>
  );
}
