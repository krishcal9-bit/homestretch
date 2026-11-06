'use client';
import { animate, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { ease } from '@/lib/motion';
import { IsoHouse } from '@/components/illustrations/IsoHouse';

/**
 * Scene 2: the journey. A winding road narrows toward the horizon; signposts stand along it.
 * A family (three dots) travels the road; each signpost flips up as they pass; they arrive at the
 * isometric house, whose window lights brass. Transform-only motion (position from the path each frame).
 */
const CENTER = 'M150 430 C190 350 390 340 340 262 S200 180 268 140 S342 108 312 96';
const LEFT = 'M40 430 C108 336 338 336 296 262 S172 182 252 136 S330 106 306 96';
const RIGHT = 'M262 430 C276 362 444 344 384 262 S228 178 284 144 S354 110 318 96';
const SIGNS: { at: number; key: 'collections' | 'savings' | 'orientation'; side: 1 | -1 }[] = [
  { at: 0.18, key: 'collections', side: 1 },
  { at: 0.46, key: 'savings', side: -1 },
  { at: 0.72, key: 'orientation', side: 1 },
];

export function JourneyRoad({ reduce }: { reduce: boolean }) {
  const { t } = useLang();
  const path = useRef<SVGPathElement>(null);
  const family = useRef<SVGGElement>(null);
  const [signs, setSigns] = useState<{ x: number; y: number; s: number }[]>([]);
  const [passed, setPassed] = useState(reduce ? 3 : 0);
  const [home, setHome] = useState(reduce);

  useEffect(() => {
    const p = path.current;
    if (!p) return;
    const len = p.getTotalLength();
    setSigns(SIGNS.map((sg) => {
      const pt = p.getPointAtLength(sg.at * len);
      return { x: pt.x + sg.side * (44 - sg.at * 26), y: pt.y, s: 1 - sg.at * 0.45 };
    }));
    const place = (v: number) => {
      const pt = p.getPointAtLength(v * len);
      const sc = 1 - v * 0.55; // smaller as it heads to the horizon
      family.current?.setAttribute('transform', `translate(${pt.x} ${pt.y}) scale(${sc})`);
    };
    if (reduce) {
      place(1);
      return;
    }
    place(0);
    const ctl = animate(0, 1, {
      duration: 2.0,
      ease: ease.inOut,
      delay: 0.7,
      onUpdate: (v) => {
        place(v);
        const n = SIGNS.filter((sg) => v >= sg.at).length;
        setPassed((cur) => (n !== cur ? n : cur));
      },
      onComplete: () => setHome(true),
    });
    return () => ctl.stop();
  }, [reduce]);

  const edge = (d: string, delay: number) => (
    <motion.path d={d} fill="none" stroke="var(--ink-2)" strokeWidth="1.75" strokeLinecap="round" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, ease: ease.out, delay }} />
  );
  return (
    <svg viewBox="0 0 480 440" className="mx-auto block w-full max-w-[640px] overflow-visible" aria-hidden data-testid="journey-road">
      {/* horizon */}
      <motion.line x1="40" x2="460" y1="96" y2="96" stroke="var(--line)" strokeWidth="1.5" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} />
      {edge(LEFT, 0)}
      {edge(RIGHT, 0.05)}
      <motion.path ref={path} d={CENTER} fill="none" stroke="var(--brass)" strokeWidth="2" strokeDasharray="10 12" strokeLinecap="round" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 0.8 }} transition={{ duration: 0.3, delay: 0.5 }} />
      {/* signposts flip up as the family passes */}
      {signs.map((sg, i) => {
        const up = i < passed;
        const label = t(`road.labels.${SIGNS[i].key}`);
        return (
          <g key={SIGNS[i].key} transform={`translate(${sg.x} ${sg.y}) scale(${sg.s})`}>
            <motion.g style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }} initial={false} animate={{ scaleY: up ? 1 : 0.08, opacity: up ? 1 : 0.35 }} transition={{ type: 'spring', duration: 0.4, bounce: 0.1 }}>
              <line x1="0" x2="0" y1="0" y2="-34" stroke="var(--ink-2)" strokeWidth="2.25" />
              <rect x={-label.length * 4.4 - 10} y="-64" width={label.length * 8.8 + 20} height="30" rx="5" fill="var(--surface)" stroke="var(--pine)" strokeWidth="1.75" />
              <text x="0" y="-44" textAnchor="middle" fontSize="15" fontWeight="500" fill="var(--ink)">
                {label}
              </text>
            </motion.g>
          </g>
        );
      })}
      {/* the house at the end of the road */}
      <g transform="translate(278 30)">
        <IsoHouse size={72} build={reduce ? 'none' : 'quick'} delay={0.3} lit={home} />
      </g>
      {/* the family travelling */}
      <g ref={family}>
        <circle cx="-7" cy="-9" r="5" fill="var(--pine)" />
        <circle cx="5" cy="-10" r="5.5" fill="var(--pine)" />
        <circle cx="0" cy="-2" r="3.6" fill="var(--brass)" />
      </g>
    </svg>
  );
}
