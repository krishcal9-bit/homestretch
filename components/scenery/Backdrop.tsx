'use client';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { memo } from 'react';
import { P, mix } from '@/lib/illustrationPalette';
import { Figure } from '@/components/illustrations/Figure';
import { Horizon, HZ } from './Horizon';
import { MiniHouse, RoundTree } from './parts';

/**
 * The intake's backdrop: the landing page's neighborhood, quieter. Fixed to the bottom third of the screen
 * behind the content panel, at ~35% strength, slightly softened and desaturated, fading into the paper at
 * its top. One gentle ambient motion (a cloud drifting). The centre of the street changes with the question
 * and crossfades (400ms) with the step transition:
 *   household — the family on the sidewalk · income — a workplace in the distance
 *   housing — the family's current crowded apartment building · money — a credit union on the corner
 * At night (dark theme) it is the same street moonlit, with its windows and lamps lit (see Horizon).
 */
export type BackdropScene = 'household' | 'income' | 'housing' | 'money' | 'street';
const VB = `0 0 ${HZ.w} ${HZ.h}`;
const B = HZ.street - 4;

function Household() {
  return (
    <g>
      <MiniHouse x={700} base={B} w={120} h={70} style={{ roof: 'gable' }} porch light={0} />
      <RoundTree x={850} base={B + 2} r={22} />
      {[
        [880, 'adult', 1, 0, 'short', 'pine', 'slate'],
        [905, 'adult', 0, 2, 'long', 'honey', 'sky'],
        [926, 'child', 3, 0, 'curly', 'sage', 'slate'],
        [943, 'toddler', 2, 1, 'bun', 'sky', 'pine'],
      ].map(([x, kind, skin, hair, hs, top, bottom], i) => (
        <Figure
          key={i}
          transform={`translate(${x} ${B + 6}) scale(0.5)`}
          kind={kind as 'adult'}
          skin={skin as number}
          hair={hair as number}
          hairStyle={hs as 'short'}
          top={top as 'pine'}
          bottom={bottom as 'slate'}
        />
      ))}
    </g>
  );
}

function Income() {
  const x = 690;
  return (
    <g>
      {/* a workplace in the distance: a low office block and a warehouse with a loading door */}
      <rect x={x} y={B - 120} width={150} height={120} fill={mix(P.wall, P.skyTop, 0.35)} />
      <path d={`M${x + 150} ${B}l40 -16V${B - 136}l-40 16Z`} fill={mix(P.wallDeep, P.skyTop, 0.35)} />
      {Array.from({ length: 4 }, (_, r) =>
        Array.from({ length: 5 }, (_, c) => <rect key={`${r}${c}`} x={x + 14 + c * 26} y={B - 106 + r * 24} width={16} height={12} fill={mix(P.glass, P.skyTop, 0.3)} />),
      )}
      <rect x={x + 210} y={B - 64} width={170} height={64} fill={mix(P.stone, P.skyTop, 0.3)} />
      <path d={`M${x + 205} ${B - 64}h180l-12 -16h-156Z`} fill={mix(P.slateLight, P.skyTop, 0.35)} />
      <rect x={x + 240} y={B - 44} width={50} height={44} fill={mix(P.slate, P.skyTop, 0.35)} />
      <rect x={x + 300} y={B - 52} width={60} height={14} rx={2} fill={mix(P.pine, P.skyTop, 0.3)} />
    </g>
  );
}

function Housing() {
  const x = 700;
  const floors = 4;
  return (
    <g>
      {/* the family's current apartment building: four floors, many windows, balconies, AC units */}
      <rect x={x} y={B - floors * 34 - 8} width={220} height={floors * 34 + 8} fill={P.wallShade} />
      <path d={`M${x + 220} ${B}l40 -18V${B - floors * 34 - 26}l-40 18Z`} fill={P.wallDeep} />
      <rect x={x - 4} y={B - floors * 34 - 14} width={228} height={8} fill={P.slateLight} />
      {Array.from({ length: floors }, (_, r) =>
        Array.from({ length: 6 }, (_, c) => (
          <g key={`${r}${c}`}>
            <rect x={x + 12 + c * 34} y={B - (r + 1) * 34 + 6} width={18} height={16} fill={(r + c) % 4 === 0 ? P.honey : P.glass} />
            {(r * 6 + c) % 3 === 1 && <rect className="il-light" style={{ '--i': (r * 6 + c) % 9 } as React.CSSProperties} x={x + 12 + c * 34} y={B - (r + 1) * 34 + 6} width={18} height={16} fill={P.honey} />}
            {c % 2 === 0 && <rect x={x + 8 + c * 34} y={B - (r + 1) * 34 + 22} width={26} height={3} fill={P.slate} />}
            {c % 3 === 1 && <rect x={x + 22 + c * 34} y={B - (r + 1) * 34 + 22} width={8} height={6} fill={P.stoneShade} />}
          </g>
        )),
      )}
      <rect x={x + 96} y={B - 26} width={28} height={26} fill={P.slate} />
    </g>
  );
}

function Money() {
  const x = 700;
  return (
    <g>
      {/* a credit union on the corner: a one-storey storefront, pine awning, columns, an ATM */}
      <rect x={x} y={B - 76} width={220} height={76} fill={P.wall} />
      <path d={`M${x + 220} ${B}l34 -14V${B - 90}l-34 14Z`} fill={P.wallShade} />
      <rect x={x - 4} y={B - 84} width={228} height={10} fill={P.trimShade} />
      <rect x={x + 30} y={B - 72} width={160} height={14} rx={2} fill={P.pine} />
      <path d={`M${x + 20} ${B - 54}h180l-8 12h-164Z`} fill={P.pineLight} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={x + 26 + i * 54} y={B - 40} width={10} height={40} fill={P.trimShade} />
      ))}
      <rect x={x + 44} y={B - 36} width={32} height={30} fill={P.glass} />
      <rect x={x + 152} y={B - 36} width={32} height={30} fill={P.glass} />
      <rect x={x + 96} y={B - 38} width={32} height={38} fill={P.slateLight} />
      <rect x={x + 232} y={B - 34} width={14} height={24} rx={2} fill={P.slate} />
    </g>
  );
}

const SCENES: Record<BackdropScene, () => React.ReactNode> = { household: Household, income: Income, housing: Housing, money: Money, street: () => null };

const Feature = memo(function Feature({ scene }: { scene: BackdropScene }) {
  const S = SCENES[scene];
  return (
    <svg viewBox={VB} preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
      <S />
    </svg>
  );
});

export function Backdrop({ scene = 'street', strength = 0.35 }: { scene?: BackdropScene; strength?: number }) {
  const reduce = useReducedMotion();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-[34vh] min-h-[180px]"
      style={{ opacity: strength, maskImage: 'linear-gradient(to bottom, transparent 0%, #000 38%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 38%)' }}
      aria-hidden
      data-testid="backdrop"
    >
      {/* the one ambient motion: a cloud drifting (outside the softened layer, so the blur is never redone) */}
      {!reduce && (
        <svg width="190" height="80" viewBox="0 0 200 84" className="scenery-cloud absolute top-[28%]" style={{ animationDuration: '96s', animationDelay: '-40s' }}>
          <path d="M22 64C10 64 8 52 18 47C15 35 30 29 40 34C45 21 63 16 74 26C82 13 108 12 117 27C128 18 150 22 152 38C168 37 182 47 176 58C180 64 172 68 162 66Z" fill={P.cloud} />
        </svg>
      )}
      <div className="absolute inset-0" style={{ filter: 'saturate(0.6) blur(1px)' }}>
        <Horizon life={false} />
        <AnimatePresence initial={false}>
          <motion.div key={scene} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.28 } }} transition={{ duration: reduce ? 0 : 0.4, ease: [0.23, 1, 0.32, 1] }}>
            <Feature scene={scene} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
