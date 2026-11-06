'use client';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { ease } from '@/lib/motion';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';

/**
 * Scene 3: a top-down neighborhood. Six lots on a street draw in one by one; a count badge rolls up
 * on each ("4 ready"); family dots drift in from the map edge and settle into their lots; lots with
 * ready families gain a brass outline. Counts come from the real seed data (passed in).
 */
/** Starts at 0 and rolls up to `to` at `at` seconds. */
function RollUp({ to, at, format }: { to: number; at: number; format: (n: number) => string }) {
  const [v, setV] = useState(at === 0 ? to : 0);
  useEffect(() => {
    if (at === 0) return setV(to);
    const id = setTimeout(() => setV(to), at * 1000);
    return () => clearTimeout(id);
  }, [to, at]);
  return <AnimatedNumber value={v} format={format} />;
}

export type Lot = { id: string; label: string; ready: number };
const LOTS = [
  { x: 24, y: 36 }, { x: 176, y: 36 }, { x: 328, y: 36 },
  { x: 24, y: 236 }, { x: 176, y: 236 }, { x: 328, y: 236 },
];
const LW = 128;
const LH = 108;

export function NeighborhoodMap({ lots, reduce }: { lots: Lot[]; reduce: boolean }) {
  const { t } = useLang();
  // deterministic edge starts for the family dots
  const dots = useMemo(() => {
    const out: { lot: number; sx: number; sy: number; tx: number; ty: number; k: number }[] = [];
    lots.slice(0, 6).forEach((lot, i) => {
      for (let j = 0; j < Math.min(lot.ready, 4); j++) {
        const p = LOTS[i];
        const k = out.length;
        const fromTop = i < 3;
        out.push({ lot: i, sx: (k * 97) % 470, sy: fromTop ? -16 : 396, tx: p.x + 22 + j * 16, ty: p.y + LH - 18, k });
      }
    });
    return out;
  }, [lots]);
  const at = (base: number) => (reduce ? 0 : base);
  return (
    <svg viewBox="0 0 480 380" className="mx-auto block w-full max-w-[540px] overflow-visible" aria-hidden data-testid="neighborhood-map">
      {/* the street */}
      <motion.g initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        <line x1="0" x2="480" y1="166" y2="166" stroke="var(--line)" strokeWidth="1.75" />
        <line x1="0" x2="480" y1="214" y2="214" stroke="var(--line)" strokeWidth="1.75" />
        <line x1="8" x2="472" y1="190" y2="190" stroke="var(--brass)" strokeWidth="1.5" strokeDasharray="10 12" opacity="0.6" />
      </motion.g>
      {lots.slice(0, 6).map((lot, i) => {
        const p = LOTS[i];
        const lotAt = at(0.25 + i * 0.12);
        const ready = lot.ready > 0;
        return (
          <g key={lot.id}>
            {/* lot outline draws */}
            <motion.rect x={p.x} y={p.y} width={LW} height={LH} rx="8" fill="var(--surface)" stroke="var(--line)" strokeWidth="1.75" initial={reduce ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ pathLength: { duration: 0.45, ease: ease.out, delay: lotAt }, opacity: { duration: 0.01, delay: lotAt } }} />
            {/* house footprint, top-down: walls + roof ridge */}
            <motion.g initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, delay: lotAt + 0.25 }}>
              <rect x={p.x + 34} y={p.y + 16} width="60" height="44" fill="none" stroke="var(--pine)" strokeWidth="1.75" />
              <path d={`M${p.x + 34} ${p.y + 16}L${p.x + 64} ${p.y + 38}L${p.x + 94} ${p.y + 16}M${p.x + 64} ${p.y + 38}L${p.x + 64} ${p.y + 60}`} fill="none" stroke="var(--pine)" strokeWidth="1.5" />
              <text x={p.x + 10} y={p.y + LH - 30} fontSize="11" fill="var(--ink-2)">
                {lot.label}
              </text>
            </motion.g>
            {/* brass outline once its families have arrived */}
            {ready && <motion.rect x={p.x - 3} y={p.y - 3} width={LW + 6} height={LH + 6} rx="10" fill="none" stroke="var(--brass)" strokeWidth="2" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: at(2.15) }} />}
            {/* count badge rolls up */}
            <motion.g initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: ease.out, delay: lotAt + 0.35 }}>
              <rect x={p.x + LW - 62} y={p.y + 10} width="54" height="22" rx="11" fill={ready ? 'var(--pine)' : 'var(--surface)'} stroke={ready ? 'var(--pine)' : 'var(--line)'} strokeWidth="1.5" />
              <foreignObject x={p.x + LW - 62} y={p.y + 10} width="54" height="22">
                <div className="tnum flex h-[22px] items-center justify-center text-[11px] font-medium" style={{ color: ready ? '#fff' : 'var(--ink-2)' }}>
                  <RollUp to={lot.ready} at={reduce ? 0 : lotAt + 0.4} format={(n) => t('landing.mapReady', { n: Math.round(n) })} />
                </div>
              </foreignObject>
            </motion.g>
          </g>
        );
      })}
      {/* families drift in from the edge and settle into their lots */}
      {dots.map((d) => (
        <motion.circle
          key={d.k}
          r="5"
          cx="0"
          cy="0"
          fill="var(--pine)"
          initial={reduce ? { x: d.tx, y: d.ty, opacity: 1 } : { x: d.sx, y: d.sy, opacity: 0 }}
          animate={{ x: d.tx, y: d.ty, opacity: 1 }}
          transition={{ type: 'spring', duration: 0.9, bounce: 0, delay: at(1.1 + d.k * 0.05) }}
        />
      ))}
    </svg>
  );
}
