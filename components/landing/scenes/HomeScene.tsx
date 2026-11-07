'use client';
import { memo, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useLang } from '@/lib/i18n';
import { P, SKIN, mix } from '@/lib/illustrationPalette';
import { Figure } from '@/components/illustrations/Figure';
import { Layer, SceneRoot, useSceneMount } from './Scene';
import { demoFamily } from '@/lib/seedHomeowners';
import { forecast } from '@/lib/forecast';

/** The spike on the wall is the demo family's real March rise (the same number the Keep app shows). */
const DEMO_SHOCK = forecast(demoFamily().profile).first?.delta ?? 69;
import { TableLamp } from './parts';

/**
 * Section 2, "See the shock before it hits": inside the family's home, in the evening. The family's monthly
 * housing cost is drawn right across the kitchen wall, like the growth chart by a door: the line runs
 * month by month toward the right; at March a spike drops in with a small bounce, labelled with what it
 * is (the insurance renewal). Shaded down the wall under the line, the family's breathing room. At the table a parent and a child
 * drop coins into a savings jar, and with every coin the spike sinks (a spring) and the breathing room turns
 * from amber to green: the shock, absorbed before it arrives.
 *
 * The room around it is softly out of focus: a shelf and a framed photo on the wall, the table lamp, a mug
 * (steam rising), the mail with an amber-banded insurance renewal on top, leaves in the near corner. The
 * scene's sky is the wall's own warm tone (and its night). Layers: wall and chart 0.6 · table, family, jar 1
 * · near leaves 1.25. The chart and the jar replay on each activation (empty wall and an empty jar until
 * then). Night (dark theme): the table lamp comes on (flicker, then steady). Phones: text first, the chart
 * across the wall below it, the jar on the table; no figures.
 */
export const HomeScene = memo(function HomeScene({ play, reduce, night = false }: { play: number; reduce: boolean; night?: boolean }) {
  const mounted = useSceneMount(1);
  const [coins, setCoins] = useState(reduce ? 3 : 0);
  const [spike, setSpike] = useState(reduce);
  useEffect(() => {
    if (reduce) return;
    setCoins(0);
    setSpike(false);
    if (play === 0) return;
    const timers = [setTimeout(() => setSpike(true), 1450), ...[2700, 3500, 4300].map((ms, i) => setTimeout(() => setCoins(i + 1), ms))];
    return () => timers.forEach(clearTimeout);
  }, [play, reduce]);
  const drawn = play > 0 || reduce;
  return (
    <SceneRoot index={1} night={night} testId="home-scene" className="[container-type:size]">
      {mounted && (
        <>
          <Layer speed={0.6}>
            <Shelf />
            <Photo />
            <ShockChart key={play} drawn={drawn} spike={spike} coins={coins} reduce={reduce} />
          </Layer>
          <Layer speed={1}>
            <Family />
            <Table />
            <Jar key={play} coins={coins} reduce={reduce} />
          </Layer>
          <Layer speed={1.25}>
            <Leaves />
          </Layer>
        </>
      )}
    </SceneRoot>
  );
});

/** how much of the March spike is left after each coin */
const SPIKE_K = [1, 0.64, 0.34, 0.1];

/**
 * The cost line on the wall (600×300 units): month ticks along a pencilled axis, the line in pine with the
 * spike in amber, the breathing-room band under it, and the two labels. The line draws in on activation.
 */
function ShockChart({ drawn, spike, coins, reduce }: { drawn: boolean; spike: boolean; coins: number; reduce: boolean }) {
  const { t } = useLang();
  const k = spike ? SPIKE_K[Math.min(coins, 3)] : 0.012;
  const draw = (delay: number, duration: number) => (reduce ? { initial: false as const } : { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 }, transition: { pathLength: { duration, delay, ease: [0.65, 0, 0.35, 1] as [number, number, number, number] }, opacity: { duration: 0.01, delay } } });
  const green = Math.min(coins, 3) / 3;
  return (
    <div className="absolute left-[5cqw] top-[44cqh] aspect-[2/1] w-[90cqw] lg:left-[45cqw] lg:top-[9cqh] lg:w-[min(50cqw,76cqh)]">
      <svg viewBox="0 0 600 300" className="absolute inset-0 h-full w-full overflow-visible">
        {/* the pencilled axis and a tick for every month */}
        <path d="M24 262H584" stroke={P.wallDeep} strokeWidth={2} strokeLinecap="round" />
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d={`M${48 + i * 46} 256v12`} stroke={P.wallDeep} strokeWidth={2} strokeLinecap="round" />
        ))}
        {drawn && (
          <>
            {/* breathing room: amber while the spike would squeeze it, green as the savings absorb it */}
            <defs>
              <linearGradient id="sc-sh-amber" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={P.amber} stopOpacity="0.32" />
                <stop offset="1" stopColor={P.amber} stopOpacity="0" />
              </linearGradient>
              <linearGradient id="sc-sh-green" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={P.pineLight} stopOpacity="0.34" />
                <stop offset="1" stopColor={P.pineLight} stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* the room under the line, shaded down the wall: amber, turning green as the savings absorb the spike */}
            <motion.g initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: reduce ? 0 : 0.9 }}>
              <rect x={30} y={154} width={540} height={96} fill="url(#sc-sh-amber)" />
              <motion.rect x={30} y={154} width={540} height={96} fill="url(#sc-sh-green)" initial={false} animate={{ opacity: green }} transition={{ duration: 0.6 }} />
            </motion.g>
            <motion.path d="M30 150H160" fill="none" stroke={P.pine} strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" {...draw(0.3, 0.45)} />
            <motion.g style={{ originY: 1, originX: 0.5 }} initial={false} animate={{ scaleY: k }} transition={reduce ? { duration: 0 } : { type: 'spring', duration: 0.6, bounce: spike && coins === 0 ? 0.42 : 0.12 }}>
              <motion.path d="M160 150C196 150 200 52 222 52C244 52 250 150 290 150" fill="none" stroke={P.amber} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" {...draw(0.75, 0.25)} />
            </motion.g>
            <motion.path d="M290 150H570" fill="none" stroke={P.pine} strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" {...draw(1.0, 0.45)} />
            <motion.circle cx={570} cy={150} r={7} fill={P.pine} initial={reduce ? false : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25, delay: reduce ? 0 : 1.45 }} />
          </>
        )}
      </svg>
      {drawn && (
        <>
          {/* the spike's label rides down with it (a full-height wrapper, so its % travel is the chart's) */}
          <motion.div className="absolute inset-0" initial={false} animate={{ y: `${((98 * (1 - k)) / 300) * 100}%` }} transition={reduce ? { duration: 0 } : { type: 'spring', duration: 0.6, bounce: 0.12 }}>
            <motion.p
              className="tnum absolute left-[24%] top-[4%] whitespace-nowrap border-l-2 border-signal-amber pl-2 text-[12px] font-medium leading-[18px] lg:left-[36%] text-signal-amber lg:text-[15px] lg:leading-[20px]"
              initial={reduce ? false : { opacity: 0, y: -6 }}
              animate={spike ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            >
              {t('landing.shockSpike', { n: DEMO_SHOCK })}
            </motion.p>
          </motion.div>
          <motion.p className="absolute left-[8%] top-[62%] text-[12px] font-medium text-ink-2 lg:text-[14px]" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: reduce ? 0 : 1.1 }}>
            {t('landing.shockRoom')}
          </motion.p>
        </>
      )}
    </div>
  );
}

/** A parent and a child standing at the table (their legs hidden by it), the parent reaching for the jar. */
function Family() {
  return (
    <svg viewBox="0 0 240 200" className="absolute bottom-[19cqh] left-[67cqw] hidden w-[24cqw] overflow-visible lg:block">
      <Figure kind="child" skin={2} hair={1} hairStyle="bun" top="honey" bottom="sky" transform="translate(70 196) scale(1.6)" shadow={false} />
      <Figure kind="adult" skin={2} hair={0} hairStyle="long" top="pine" bottom="slate" transform="translate(150 200) scale(1.62)" shadow={false} />
    </svg>
  );
}

/**
 * The savings jar on the table: glass with a lit left edge, coins stacking inside, a new coin dropping in on
 * each step (the spike on the wall sinks as it lands).
 */
function Jar({ coins, reduce }: { coins: number; reduce: boolean }) {
  const stack = Math.min(coins, 3);
  return (
    <div className="absolute bottom-[9cqh] left-[58cqw] w-[20cqw] lg:bottom-[19cqh] lg:left-[61cqw] lg:w-[min(6.4cqw,11cqh)]">
      <svg viewBox="0 0 100 120" className="relative block w-full overflow-visible">
        <ellipse cx={58} cy={116} rx={56} ry={7} fill={P.ink} opacity={0.12} />
        {/* coins already saved, then one more per step */}
        {Array.from({ length: 3 + stack * 2 }, (_, i) => (
          <g key={i}>
            <ellipse cx={50 + ((i * 7) % 9) - 4} cy={104 - i * 6} rx={24} ry={6} fill={P.brass} />
            <ellipse cx={50 + ((i * 7) % 9) - 4} cy={102 - i * 6} rx={24} ry={6} fill={P.honey} />
          </g>
        ))}
        {/* glass: body, lit left edge, rim */}
        <path d="M18 24Q14 30 14 40V104Q14 114 26 114H74Q86 114 86 104V40Q86 30 82 24Z" fill={mix(P.glassLight, P.trim, 0.55)} opacity={0.35} />
        <path d="M18 24Q14 30 14 40V104Q14 114 26 114H74Q86 114 86 104V40Q86 30 82 24" fill="none" stroke={mix(P.glassLight, P.trim, 0.3)} strokeWidth={2.5} />
        <path d="M22 40V100" stroke={P.trim} strokeWidth={4} strokeLinecap="round" opacity={0.7} />
        <rect x={16} y={16} width={68} height={10} rx={4} fill={mix(P.glassLight, P.trim, 0.3)} opacity={0.8} />
      </svg>
      {/* the coin that drops in on this step */}
      {!reduce && stack > 0 && (
        <motion.div
          key={stack}
          className="absolute left-[26%] top-[-30%] w-[48%]"
          initial={{ y: '-120%', opacity: 0, rotate: -20 }}
          animate={{ y: '170%', opacity: [0, 1, 1, 0], rotate: 0 }}
          transition={{ duration: 0.55, ease: [0.55, 0, 0.9, 0.5], opacity: { times: [0, 0.15, 0.85, 1], duration: 0.55 } }}
        >
          <svg viewBox="0 0 48 48" className="block w-full">
            <circle cx={24} cy={24} r={22} fill={P.brass} />
            <circle cx={22} cy={22} r={20} fill={P.honey} />
            <circle cx={22} cy={22} r={13} fill="none" stroke={P.brass} strokeWidth={2.5} />
          </svg>
        </motion.div>
      )}
    </div>
  );
}

function Shelf() {
  return (
    <svg viewBox="0 0 220 110" className="absolute left-[5cqw] top-[12cqh] hidden w-[clamp(150px,15cqw,250px)] overflow-visible lg:block" style={{ filter: 'blur(3.4px)' }}>
      <rect x={0} y={92} width={220} height={8} fill={mix(P.timber, P.trim, 0.2)} />
      <rect x={0} y={100} width={220} height={4} fill={P.timberShade} />
      <rect x={4} y={104} width={210} height={6} fill={P.ink} opacity={0.05} />
      {[
        [18, 18, 70, P.pine],
        [38, 14, 62, P.honey],
        [54, 16, 74, P.slateLight],
        [72, 12, 58, P.sageDark],
      ].map(([x, w, h, c]) => (
        <g key={x as number}>
          <rect x={x as number} y={92 - (h as number)} width={w as number} height={h as number} fill={c as string} />
          <rect x={(x as number) + (w as number) * 0.62} y={92 - (h as number)} width={(w as number) * 0.38} height={h as number} fill={P.ink} opacity={0.12} />
        </g>
      ))}
      <path d="M108 92V60h28v32Z" fill={mix(P.glassLight, P.trim, 0.4)} opacity={0.8} />
      <rect x={108} y={54} width={28} height={7} rx={2} fill={P.bark} />
      <path d="M168 92l-6 -26h36l-6 26Z" fill={P.wallShade} />
      <circle cx={170} cy={60} r={12} fill={P.treeLight} />
      <circle cx={186} cy={58} r={10} fill={P.tree} />
      <path d="M190 66C200 80 196 100 206 118M176 68C178 90 170 104 174 124" fill="none" stroke={P.treeLight} strokeWidth={5} strokeLinecap="round" />
    </svg>
  );
}

/** A framed family photo on the wall (desktop only). */
function Photo() {
  return (
    <svg viewBox="0 0 100 120" className="absolute left-[30cqw] top-[9cqh] hidden w-[clamp(70px,6.4cqw,110px)] lg:block" style={{ filter: 'blur(3.4px)' }}>
      <rect x={4} y={6} width={96} height={114} fill={P.ink} opacity={0.06} />
      <rect x={0} y={0} width={92} height={112} fill={mix(P.bark, P.wall, 0.15)} />
      <rect x={8} y={8} width={76} height={96} fill={mix(P.skyTop, P.trim, 0.3)} />
      <circle cx={34} cy={52} r={11} fill={mix(SKIN[2], P.wall, 0.15)} />
      <circle cx={60} cy={56} r={9} fill={mix(SKIN[1], P.wall, 0.15)} />
      <path d="M16 104c4 -26 34 -30 38 -8c6 -22 30 -20 34 8Z" fill={mix(P.pineLight, P.wall, 0.2)} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Table and near corner                                               */
/* ------------------------------------------------------------------ */

/** The table top, seen from a chair: back edge, grain, light falling off toward us; a mug and the mail. */
function Table() {
  return (
    <>
      <svg viewBox="0 0 1600 400" preserveAspectRatio="none" className="absolute inset-x-0 bottom-[-12cqh] h-[32cqh] w-full lg:h-[40cqh]" style={{ filter: 'blur(1.6px)' }}>
        <defs>
          <linearGradient id="sc-in-table" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={mix(P.timber, P.trim, 0.28)} />
            <stop offset="0.35" stopColor={P.timber} />
            <stop offset="1" stopColor={mix(P.timberShade, P.bark, 0.2)} />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={1600} height={400} fill="url(#sc-in-table)" />
        <rect x={0} y={0} width={1600} height={5} fill={mix(P.timber, P.trim, 0.5)} />
        {[46, 104, 176, 262, 360].map((y, i) => (
          <path key={y} d={`M0 ${y}C400 ${y - 4} 1200 ${y + 4} 1600 ${y}`} stroke={P.timberShade} strokeWidth={2 + i * 0.6} fill="none" opacity={0.45} />
        ))}
      </svg>
      <Lamp />
      <Mug />
      <Mail />
    </>
  );
}

/** The table lamp at the back of the table, between the text and the phone (desktop). On at night. */
function Lamp() {
  return (
    <svg viewBox="-60 -125 120 130" className="absolute bottom-[27.6cqh] left-[calc(43cqw_-_50px)] hidden w-[100px] overflow-visible lg:block" style={{ filter: 'blur(1.8px)' }}>
      <TableLamp x={0} base={0} h={120} i={0} />
    </svg>
  );
}

function Mug() {
  return (
    <div className="absolute bottom-[8cqh] left-[5cqw] w-[clamp(48px,13cqw,64px)] lg:bottom-[18cqh] lg:left-[31cqw] lg:w-[clamp(56px,5.4cqw,96px)]">
      {/* steam (its own layer: the blur is painted once, the rise is a transform) */}
      <div className="absolute bottom-[96%] left-[14%] h-[90%] w-[56%]">
        {[0, 1.4, 2.8].map((d, i) => (
          <div key={i} className="sc-amb sc-steam absolute bottom-0 h-full w-[40%]" style={{ left: `${i * 26}%`, animationDelay: `${d}s` }}>
            <svg viewBox="0 0 20 60" className="h-full w-full" style={{ filter: 'blur(2.4px)' }}>
              <path d="M10 58C4 46 16 36 10 24S6 6 12 0" stroke={P.trim} strokeWidth={5} fill="none" strokeLinecap="round" />
            </svg>
          </div>
        ))}
      </div>
      <svg viewBox="0 0 100 92" className="relative block w-full overflow-visible" style={{ filter: 'blur(1.4px)' }}>
        <ellipse cx={58} cy={88} rx={60} ry={8} fill={P.ink} opacity={0.12} />
        <path d="M84 30q22 0 22 20t-22 20v-9q12 0 12 -11t-12 -11Z" fill={P.pine} />
        <path d="M10 14v62q0 12 37 12t37 -12V14Z" fill={P.pineLight} />
        <path d="M10 14v62q0 12 18 12V14Z" fill={P.pineLighter} opacity={0.6} />
        <path d="M58 14v74q26 -2 26 -12V14Z" fill={P.pine} opacity={0.7} />
        <ellipse cx={47} cy={14} rx={37} ry={9} fill={P.pineLight} />
        <ellipse cx={47} cy={15} rx={31} ry={6} fill={mix(P.bark, P.ink, 0.25)} />
      </svg>
    </div>
  );
}

function Mail() {
  return (
    <svg viewBox="0 0 220 90" className="absolute bottom-[16cqh] right-[3cqw] hidden w-[clamp(120px,12cqw,210px)] overflow-visible lg:block" style={{ filter: 'blur(2px)' }}>
      <ellipse cx={112} cy={80} rx={110} ry={10} fill={P.ink} opacity={0.1} />
      <g transform="rotate(-4 110 60)">
        <rect x={20} y={46} width={180} height={34} rx={3} fill={P.paperShade} />
      </g>
      <g transform="rotate(3 110 50)">
        <rect x={26} y={30} width={170} height={40} rx={3} fill={P.paper} />
        <path d="M26 30l85 22 85 -22" fill="none" stroke={P.paperShade} strokeWidth={3} />
        <rect x={166} y={36} width={20} height={15} rx={1} fill={P.pineLight} />
      </g>
      <g transform="rotate(-2 110 36)">
        <rect x={34} y={16} width={160} height={40} rx={3} fill={P.trim} />
        <rect x={50} y={28} width={70} height={5} rx={2.5} fill={P.ink2} opacity={0.5} />
        <rect x={50} y={38} width={46} height={5} rx={2.5} fill={P.ink2} opacity={0.4} />
        <rect x={160} y={22} width={24} height={17} rx={1} fill={P.honey} />
        {/* the insurance renewal: an amber band across the envelope */}
        <rect x={34} y={44} width={160} height={8} fill={P.amber} />
      </g>
    </svg>
  );
}

/** Out-of-focus leaves of a big houseplant in the near corner (the most blurred thing in the room). */
function Leaves() {
  return (
    <svg viewBox="0 0 300 260" className="absolute bottom-[-8cqh] left-[-6cqw] w-[clamp(150px,44cqw,200px)] overflow-visible lg:w-[clamp(180px,17cqw,320px)]" style={{ filter: 'blur(9px)' }}>
      <path d="M40 260C30 200 60 140 120 110C100 170 90 220 96 260Z" fill={P.tree} />
      <path d="M90 260C110 190 160 150 240 140C200 190 170 230 150 260Z" fill={P.treeLight} />
      <path d="M20 250C-10 210 -10 160 20 120C40 170 50 210 52 250Z" fill={P.treeDark} />
      <path d="M150 260C170 230 220 214 290 220C250 240 220 252 200 262Z" fill={P.tree} />
    </svg>
  );
}
