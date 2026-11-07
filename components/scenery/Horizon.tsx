'use client';
import { motion, type MotionValue } from 'motion/react';
import { memo } from 'react';
import { P, alpha, mix } from '@/lib/illustrationPalette';
import { Bush, Jacaranda, Mailbox, MiniHouse, Palm, PicketFence, RoundTree, StreetLamp, type HouseStyle } from './parts';
import { Figure } from '@/components/illustrations/Figure';

/**
 * The neighborhood horizon: an Orange County street seen across, in four aligned layers (one viewBox,
 * anchored to the bottom, cropped to the screen's width):
 *   far   — a Saddleback-style ridgeline and rolling hills, pale with distance
 *   mid   — rows of shaded houses (some with solar), palms and jacarandas, richest at the edges
 *   street— sidewalk, curb, asphalt and a dashed centre line across the whole width
 *   front — edge details: a picket fence, mailbox, bushes, a street lamp
 * The centre stays low and quiet so content above it reads first. Phones see only the centre.
 * At night (dark theme) the palette turns it moonlit and the lights come on in a quick stagger, edges first:
 * most windows and porch lamps, the corner street lamp and three lamps along the far sidewalk with pools
 * of light on the street.
 */
export const HZ = { w: 1600, h: 300, street: 246 };
const VB = `0 0 ${HZ.w} ${HZ.h}`;

type Layers = { far?: { x: MotionValue<number>; y: MotionValue<number> }; mid?: { x: MotionValue<number>; y: MotionValue<number> }; front?: { x: MotionValue<number>; y: MotionValue<number> } };

const styles: HouseStyle[] = [
  { roof: 'gable' },
  { roof: 'hip', solar: true },
  { roof: 'gable', wall: P.wallWarm },
  { roof: 'hip' },
  { roof: 'gable', solar: true, wall: P.wallCool },
];

function Far() {
  return (
    <svg viewBox={VB} preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
      {/* Saddleback-style ridge (two summits), pale with distance */}
      <path d="M0 196C120 182 230 176 330 170C430 164 520 160 610 150C700 140 760 128 830 118L880 108L930 122L985 104L1040 98L1095 112C1180 126 1260 138 1360 150C1450 160 1530 168 1600 172V300H0Z" fill={mix(P.skyTop, P.slateLight, 0.22)} opacity={0.55} />
      <path d="M985 104L1040 98L1095 112C1120 116 1060 120 1040 116C1020 112 1000 114 985 104Z" fill={P.cloudLight} opacity={0.35} />
      {/* rolling hills */}
      <path d="M0 214C140 196 260 192 380 200C520 210 620 196 760 192C900 188 1020 204 1160 200C1300 196 1440 184 1600 190V300H0Z" fill={mix(P.sageLight, P.skyBottom, 0.45)} />
      <path d="M0 228C180 214 320 220 470 226C640 232 780 214 960 218C1140 222 1300 230 1600 214V300H0Z" fill={mix(P.sage, P.skyBottom, 0.35)} />
    </svg>
  );
}

const Mid = memo(function Mid({ lit }: { lit: boolean }) {
  const base = HZ.street - 4;
  const rowL: [number, number, number, number][] = [
    [-20, 70, 46, 0],
    [70, 58, 40, 1],
    [150, 74, 50, 2],
    [262, 60, 42, 3],
    [356, 66, 44, 4],
  ];
  const rowR: [number, number, number, number][] = [
    [1180, 64, 44, 1],
    [1270, 72, 48, 0],
    [1378, 58, 40, 4],
    [1458, 70, 46, 2],
    [1548, 62, 42, 3],
  ];
  return (
    <svg viewBox={VB} preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
      {/* far lawns along the street */}
      <path d={`M0 ${base - 6}H1600V${base + 6}H0Z`} fill={mix(P.sage, P.skyBottom, 0.15)} />
      {/* a few distant roofs across the middle, small and pale */}
      {[520, 610, 700, 900, 990, 1080].map((x, i) => (
        <MiniHouse key={x} x={x} base={base - 2} w={30 + (i % 3) * 4} h={18} style={styles[i % styles.length]} fade={0.55} light={i % 3 === 1 ? undefined : 10 + i} />
      ))}
      {[565, 760, 950, 1045].map((x, i) => (i % 2 ? <RoundTree key={x} x={x} base={base} r={9} fade={0.5} /> : <Jacaranda key={x} x={x} base={base} r={10} fade={0.45} />))}
      {/* the edges: full streets of shaded homes, palms and jacarandas */}
      {rowL.map(([x, w, h, s], i) => (
        <MiniHouse key={`l${x}`} x={x} base={base} w={w} h={h} style={styles[s]} fade={0.26} chimney={i === 2} lit={lit && i === 3} porch={lit && i === 1} light={i === 2 ? undefined : i} />
      ))}
      {rowR.map(([x, w, h, s], i) => (
        <MiniHouse key={`r${x}`} x={x} base={base} w={w} h={h} style={styles[s]} fade={0.26} lit={lit && i === 2} porch={lit && i === 0} light={i === 3 ? undefined : 4 - i} />
      ))}
      <Palm x={140} base={base + 2} h={150} fade={0.22} />
      <Palm x={455} base={base + 2} h={128} fade={0.3} lean={-5} />
      <Palm x={1260} base={base + 2} h={140} fade={0.26} lean={-4} />
      <Palm x={1540} base={base + 2} h={160} fade={0.2} />
      <Jacaranda x={238} base={base + 2} r={24} fade={0.22} />
      <Jacaranda x={1366} base={base + 2} r={26} fade={0.22} />
      <RoundTree x={52} base={base + 2} r={20} fade={0.24} />
      <RoundTree x={1452} base={base + 2} r={19} fade={0.24} />
    </svg>
  );
});

function Street() {
  const s = HZ.street;
  return (
    <svg viewBox={VB} preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
      {/* night only: lamps along the far sidewalk (by day the street is open) */}
      <g className="il-night">
        {[560, 1040].map((x) => (
          <rect key={x} x={x - 1} y={s - 52} width={2} height={50} fill={P.slateDark} />
        ))}
      </g>
      <rect x={0} y={s - 3} width={HZ.w} height={8} fill={P.stone} />
      <rect x={0} y={s + 5} width={HZ.w} height={2} fill={P.stoneShade} />
      <rect x={0} y={s + 7} width={HZ.w} height={34} fill={mix(P.asphaltLight, P.skyBottom, 0.35)} />
      <rect x={0} y={s + 7} width={HZ.w} height={3} fill={mix(P.asphalt, P.skyBottom, 0.3)} opacity={0.5} />
      {Array.from({ length: 40 }, (_, i) => (
        <rect key={i} x={i * 42 + 6} y={s + 23} width={22} height={2.2} rx={1} fill={P.trim} opacity={0.75} />
      ))}
      <rect x={0} y={s + 41} width={HZ.w} height={3} fill={P.stoneShade} />
      <rect x={0} y={s + 44} width={HZ.w} height={HZ.h - s - 44} fill={P.stone} />
      {/* their light on the street (drawn over the asphalt) */}
      {[560, 1040].map((x, i) => (
        <g key={x} className="il-light" style={{ '--i': 6 + i * 2 } as React.CSSProperties}>
          <ellipse cx={x + 7} cy={s + 16} rx={70} ry={12} fill={alpha(P.honey, 0.12)} />
          <ellipse cx={x + 7} cy={s + 10} rx={34} ry={6} fill={alpha(P.honeyLight, 0.14)} />
          <path d={`M${x - 1} ${s - 53}q0 -4 7 -4`} fill="none" stroke={P.slateDark} strokeWidth={1.6} />
          <circle cx={x + 7} cy={s - 55} r={9} fill={alpha(P.honey, 0.3)} />
          <circle cx={x + 7} cy={s - 55} r={2} fill={P.glow} />
        </g>
      ))}
    </svg>
  );
}

const Front = memo(function Front({ glow }: { glow: number }) {
  const b = HZ.h - 2;
  return (
    <svg viewBox={VB} preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
      {/* left corner: picket fence, mailbox, bushes */}
      <path d={`M0 ${b - 12}C60 ${b - 18} 140 ${b - 16} 230 ${b - 10}V${b + 4}H0Z`} fill={P.sage} />
      <PicketFence x={-4} base={b - 6} w={150} h={20} />
      <Bush x={160} base={b - 6} r={20} />
      <Mailbox x={212} base={b - 8} />
      <Bush x={26} base={b - 4} r={14} />
      {/* right corner: a lawn, bushes and a street lamp */}
      <path d={`M1370 ${b - 10}C1450 ${b - 16} 1530 ${b - 18} 1600 ${b - 14}V${b + 4}H1370Z`} fill={P.sage} />
      <Bush x={1404} base={b - 6} r={17} />
      <StreetLamp x={1470} base={b - 8} h={92} glow={glow} light={3} />
      <Bush x={1560} base={b - 4} r={22} />
    </svg>
  );
});

/** A dog walker on the far sidewalk, crossing slowly now and then (CSS, transform only). */
function DogWalker() {
  return (
    <svg viewBox={VB} preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
      <g className="scenery-walker">
        <Figure transform={`translate(0 ${HZ.street - 1}) scale(0.24)`} kind="adult" skin={2} hair={1} hairStyle="short" top="sky" bottom="slate" shadow={false} />
        <path d={`M5 ${HZ.street - 12}q8 2 12 9`} fill="none" stroke={P.slate} strokeWidth={0.8} />
        <g transform={`translate(18 ${HZ.street - 2})`}>
          <ellipse cx={0} cy={-4} rx={5} ry={3} fill={P.bark} />
          <circle cx={5} cy={-6.5} r={2.4} fill={P.bark} />
          <rect x={-4} y={-2} width={1.4} height={3} fill={P.bark} />
          <rect x={2.5} y={-2} width={1.4} height={3} fill={P.bark} />
        </g>
      </g>
    </svg>
  );
}

export function Horizon({ layers, golden = 0, life = true, className = '' }: { layers?: Layers; golden?: number; life?: boolean; className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden>
      <motion.div className="absolute inset-0" style={{ ...layers?.far, willChange: layers ? 'transform' : undefined }}>
        <Far />
      </motion.div>
      <motion.div className="absolute inset-0" style={{ ...layers?.mid, willChange: layers ? 'transform' : undefined }}>
        <Mid lit={golden > 0.5} />
        {life && <DogWalker />}
      </motion.div>
      <div className="absolute inset-0">
        <Street />
      </div>
      <motion.div className="absolute inset-0" style={{ ...layers?.front, willChange: layers ? 'transform' : undefined }}>
        <Front glow={Math.max(0, (golden - 0.4) / 0.6)} />
      </motion.div>
    </div>
  );
}
