'use client';
import { memo, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useLang } from '@/lib/i18n';
import { ease } from '@/lib/motion';
import { P, SKIN, alpha, mix } from '@/lib/illustrationPalette';
import { Figure } from '@/components/illustrations/Figure';
import { Bush, ContactShadow, Hills, Kit, Tree } from '@/components/illustrations/kit';
import { Layer, SceneRoot, useSceneMount } from './Scene';
import { demoFamily } from '@/lib/seedHomeowners';
import { forecast } from '@/lib/forecast';
import { TableLamp } from './parts';

/** The spike on the wall is the demo family's real March rise (the same number the Keep app shows). */
const DEMO_SHOCK = forecast(demoFamily().profile).first?.delta ?? 69;

/**
 * Section 2, "See the shock before it hits": inside the family's home, in the evening. The family's monthly
 * housing cost is drawn right across the kitchen wall, like the growth chart by a door: the line runs
 * month by month toward the right; at March a spike, labelled with what it is (the insurance renewal).
 * Shaded down the wall under the line, the family's breathing room. At the table a parent and a child
 * drop coins into a savings jar, and with every coin the spike sinks (a spring) and the breathing room turns
 * from amber to green: the shock, absorbed before it arrives.
 *
 * Resting state (play 0): the whole chart with the spike already flattened by the set-aside, the jar full.
 * On each activation it replays: the spike drops in with a small bounce, then sinks coin by coin. The wall,
 * the line and the jar never leave the screen.
 *
 * The room is drawn in the shared illustration language (components/illustrations/kit.tsx): soft light
 * from the top-left across the wall, a shelf and a framed photo (a little landscape in the kit's hills),
 * the table lamp, a mug (steam rising: the scene's one ambient motion), the mail with an amber-banded
 * insurance renewal on top, a potted plant in the near corner; every object casts a soft contact shadow.
 * The scene's sky is the wall's own warm tone (and its night). Layers: wall and chart 0.6 · table, family,
 * jar 1 · near plant 1.25. Night (dark theme): the table lamp comes on (flicker, then steady). Phones: text
 * first, the chart across the wall below it, the jar on the table; no figures.
 */
export const HomeScene = memo(function HomeScene({ play, reduce, night = false }: { play: number; reduce: boolean; night?: boolean }) {
  const mounted = useSceneMount(1);
  // rest: the set-aside has already absorbed the spike (3 coins). A replay starts just before the shock.
  const [coins, setCoins] = useState(3);
  const [spike, setSpike] = useState(true);
  useEffect(() => {
    if (reduce || play === 0) {
      setCoins(3);
      setSpike(true);
      return;
    }
    setCoins(0);
    setSpike(false);
    const timers = [setTimeout(() => setSpike(true), 450), ...[1700, 2500, 3300].map((ms, i) => setTimeout(() => setCoins(i + 1), ms))];
    return () => timers.forEach(clearTimeout);
  }, [play, reduce]);
  return (
    <SceneRoot index={1} night={night} testId="home-scene" className="[container-type:size]">
      {mounted && (
        <>
          <Layer speed={0.6}>
            <WallLight />
            <Shelf />
            <Photo />
            <ShockChart spike={spike} coins={coins} reduce={reduce} />
          </Layer>
          <Layer speed={1}>
            <Family />
            <Table />
            <Jar key={play} coins={coins} reduce={reduce} />
          </Layer>
          <Layer speed={1.25}>
            <Plant />
          </Layer>
        </>
      )}
    </SceneRoot>
  );
});

/** Light on the wall: brighter toward the top-left (the window by day, the lamp at night), falling off right. */
function WallLight() {
  return (
    <div
      className="absolute inset-0"
      style={{ background: `radial-gradient(ellipse 70% 80% at 12% 6%, ${alpha(P.sheen, 0.34)}, transparent 70%), linear-gradient(90deg, transparent 55%, ${alpha(P.ink, 0.05)}), linear-gradient(180deg, ${alpha(P.ink, 0.06)}, transparent 14%)` }}
    />
  );
}

/** how much of the March spike is left after each coin */
const SPIKE_K = [1, 0.64, 0.34, 0.1];

/**
 * The cost line on the wall (600×300 units): month ticks along a pencilled axis, the line in pine with the
 * spike in amber, the breathing-room band under it, and the two labels. Always drawn; the spike's height
 * and the band's colour follow the coins.
 */
function ShockChart({ spike, coins, reduce }: { spike: boolean; coins: number; reduce: boolean }) {
  const { t } = useLang();
  const k = spike ? SPIKE_K[Math.min(coins, 3)] : 0.012;
  const green = Math.min(coins, 3) / 3;
  const settle = reduce ? { duration: 0 } : { type: 'spring' as const, duration: 0.6, bounce: spike && coins === 0 ? 0.42 : 0.12 };
  return (
    <div className="absolute left-[5cqw] top-[44cqh] aspect-[2/1] w-[90cqw] lg:left-[45cqw] lg:top-[9cqh] lg:w-[min(50cqw,76cqh)]">
      <svg viewBox="0 0 600 300" className="absolute inset-0 h-full w-full overflow-visible">
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
        {/* the pencilled axis and a tick for every month */}
        <path d="M24 262H584" stroke={P.wallDeep} strokeWidth={2} strokeLinecap="round" />
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d={`M${48 + i * 46} 256v12`} stroke={P.wallDeep} strokeWidth={2} strokeLinecap="round" />
        ))}
        {/* the room under the line, shaded down the wall: amber, turning green as the savings absorb the spike */}
        <rect x={30} y={154} width={540} height={96} fill="url(#sc-sh-amber)" />
        <motion.rect x={30} y={154} width={540} height={96} fill="url(#sc-sh-green)" initial={false} animate={{ opacity: green }} transition={{ duration: reduce ? 0 : 0.6 }} />
        <path d="M30 150H160" fill="none" stroke={P.pine} strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <motion.g style={{ originY: 1, originX: 0.5 }} initial={false} animate={{ scaleY: k }} transition={settle}>
          <path d="M160 150C196 150 200 52 222 52C244 52 250 150 290 150" fill="none" stroke={P.amber} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </motion.g>
        <path d="M290 150H570" fill="none" stroke={P.pine} strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={570} cy={150} r={7} fill={P.pine} />
      </svg>
      {/* the spike's label rides down with it (a full-height wrapper, so its % travel is the chart's) */}
      <motion.div className="absolute inset-0" initial={false} animate={{ y: `${((98 * (1 - k)) / 300) * 100}%` }} transition={reduce ? { duration: 0 } : { type: 'spring', duration: 0.6, bounce: 0.12 }}>
        <motion.p
          className="tnum absolute left-[24%] top-[4%] whitespace-nowrap border-l-2 border-signal-amber pl-2 text-[12px] font-medium leading-[18px] text-signal-amber lg:left-[36%] lg:text-[15px] lg:leading-[20px]"
          initial={false}
          animate={spike ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: reduce ? 0 : 0.3, ease: ease.out }}
        >
          {t('landing.shockSpike', { n: DEMO_SHOCK })}
        </motion.p>
      </motion.div>
      <p className="absolute left-[8%] top-[62%] text-[12px] font-medium text-ink-2 lg:text-[14px]">{t('landing.shockRoom')}</p>
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
        <ContactShadow cx={58} cy={115} rx={58} ry={8} strength={1.2} />
        {/* coins already saved, then one more per step */}
        {Array.from({ length: 3 + stack * 2 }, (_, i) => (
          <g key={i}>
            <ellipse cx={50 + ((i * 7) % 9) - 4} cy={104 - i * 6} rx={24} ry={6} fill={P.brass} />
            <ellipse cx={50 + ((i * 7) % 9) - 4} cy={102 - i * 6} rx={24} ry={6} fill={P.honey} />
            <ellipse cx={44 + ((i * 7) % 9) - 4} cy={101 - i * 6} rx={10} ry={2.4} fill={P.honeyLight} opacity={0.7} />
          </g>
        ))}
        {/* glass: body, the shaded right side, lit left edge, rim */}
        <path d="M18 24Q14 30 14 40V104Q14 114 26 114H74Q86 114 86 104V40Q86 30 82 24Z" fill={mix(P.glassLight, P.trim, 0.55)} opacity={0.3} />
        <path d="M66 26Q80 28 82 40V104Q82 112 70 113Z" fill={P.glass} opacity={0.12} />
        <path d="M18 24Q14 30 14 40V104Q14 114 26 114H74Q86 114 86 104V40Q86 30 82 24" fill="none" stroke={mix(P.glassLight, P.trim, 0.3)} strokeWidth={2.5} />
        <path d="M22 40V100" stroke={P.trim} strokeWidth={4} strokeLinecap="round" opacity={0.75} />
        <path d="M30 34V52" stroke={P.trim} strokeWidth={2} strokeLinecap="round" opacity={0.5} />
        <rect x={16} y={16} width={68} height={10} rx={4} fill={mix(P.glassLight, P.trim, 0.3)} opacity={0.85} />
        <rect x={16} y={16} width={68} height={3} rx={1.5} fill={P.trim} opacity={0.7} />
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

/** A wall shelf: books, a glass jar and a trailing plant, each with its shade side and a shadow on the wall. */
function Shelf() {
  const books: [number, number, number, string][] = [
    [18, 18, 70, P.pine],
    [38, 14, 62, P.honey],
    [54, 16, 74, P.slateLight],
    [72, 12, 58, P.sageDark],
  ];
  return (
    <svg viewBox="0 0 220 130" className="absolute left-[5cqw] top-[12cqh] hidden w-[clamp(150px,15cqw,250px)] overflow-visible lg:block">
      <defs>
        <linearGradient id="sc-sh-under" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.ink} stopOpacity="0.16" />
          <stop offset="1" stopColor={P.ink} stopOpacity="0" />
        </linearGradient>
      </defs>
      <Kit>
        {/* the plank's shadow on the wall, brackets, then the plank: lit top, front face, dark lip */}
        <rect x={4} y={100} width={216} height={22} fill="url(#sc-sh-under)" />
        <path d="M30 100v14l14 -14Z M186 100v14l14 -14Z" fill={P.brassDark} />
        <rect x={0} y={88} width={220} height={5} fill={mix(P.timber, P.trim, 0.35)} />
        <rect x={0} y={93} width={220} height={7} fill={P.timber} />
        <rect x={0} y={99} width={220} height={1.5} fill={P.timberShade} />
        {books.map(([x, w, h, c]) => (
          <g key={x}>
            <rect x={x + 4} y={88 - h + 4} width={w} height={h - 4} fill={P.ink} opacity={0.08} />
            <rect x={x} y={88 - h} width={w} height={h} fill={c} />
            <rect x={x} y={88 - h} width={w * 0.3} height={h} fill={P.trim} opacity={0.16} />
            <rect x={x + w * 0.68} y={88 - h} width={w * 0.32} height={h} fill={P.ink} opacity={0.14} />
            <rect x={x + 2} y={88 - h + 10} width={w - 4} height={2} fill={P.trim} opacity={0.35} />
          </g>
        ))}
        {/* a glass jar with a wooden lid */}
        <ContactShadow cx={126} cy={88} rx={20} ry={2.6} />
        <path d="M108 88V62h28v26Z" fill={mix(P.glassLight, P.trim, 0.45)} opacity={0.8} />
        <rect x={110} y={64} width={4} height={20} rx={2} fill={P.trim} opacity={0.8} />
        <rect x={127} y={62} width={9} height={26} fill={P.ink} opacity={0.07} />
        <rect x={107} y={55} width={30} height={8} rx={2} fill={P.bark} />
        <rect x={107} y={55} width={30} height={2.5} rx={1.2} fill={mix(P.bark, P.trim, 0.3)} />
        {/* a trailing plant in a stone pot */}
        <ContactShadow cx={182} cy={88} rx={22} ry={3} />
        <path d="M190 72C200 84 196 102 206 120M176 74C178 92 170 104 174 124" fill="none" stroke={P.foliage} strokeWidth={3} strokeLinecap="round" />
        <path d={[[204, 110], [199, 92], [174, 112], [177, 94], [208, 122], [172, 124]].map(([x, y]) => `M${x - 4} ${y}a4 3 0 1 0 8 0a4 3 0 1 0 -8 0Z`).join('')} fill={P.foliageLight} />
        <Bush x={182} base={68} size={46} seed={4} shadow={0} />
        <path d="M168 88l-5 -22h38l-5 22Z" fill={P.stone} />
        <path d="M184 88l3 -22h14l-5 22Z" fill={P.stoneShade} />
        <rect x={161} y={64} width={42} height={4} rx={1.5} fill={mix(P.stone, P.trim, 0.4)} />
      </Kit>
    </svg>
  );
}

/** A framed family photo on the wall: a bevelled frame, a mat, a little landscape in the kit's hills. */
function Photo() {
  return (
    <svg viewBox="0 0 100 120" className="absolute left-[30cqw] top-[9cqh] hidden w-[clamp(70px,6.4cqw,110px)] overflow-visible lg:block">
      <rect x={5} y={7} width={92} height={112} fill={P.ink} opacity={0.07} />
      <rect x={3} y={4} width={92} height={112} fill={P.ink} opacity={0.06} />
      <rect x={0} y={0} width={92} height={112} fill={P.bark} />
      <path d="M0 0H92L86 6H6V106L0 112Z" fill={mix(P.bark, P.trim, 0.28)} />
      <rect x={6} y={6} width={80} height={100} fill={P.paper} />
      <svg x={12} y={12} width={68} height={88} viewBox="0 0 68 88">
        <rect width={68} height={88} fill={mix(P.skyTop, P.trim, 0.25)} />
        <Hills x0={-10} x1={78} bottom={88} layers={[{ y: 50, haze: 0.4, waves: 2, amp: 6, seed: 3 }, { y: 64, waves: 2, amp: 4, seed: 5 }]} />
        <Tree species="palm" x={50} base={72} size={46} lean={-3} shadow={0.6} />
        {/* the family, small, in front of the hills */}
        <circle cx={24} cy={60} r={5} fill={SKIN[2]} />
        <circle cx={35} cy={63} r={4} fill={SKIN[1]} />
        <path d="M14 88c2 -18 18 -22 20 -6c4 -14 16 -12 18 6Z" fill={P.pineLight} />
      </svg>
      <rect x={6} y={6} width={80} height={3} fill={P.ink} opacity={0.08} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Table and near corner                                               */
/* ------------------------------------------------------------------ */

/** The table top, seen from a chair: back edge, grain, light falling off toward us and to the right. */
function Table() {
  return (
    <>
      <svg viewBox="0 0 1600 400" preserveAspectRatio="none" className="absolute inset-x-0 bottom-[-12cqh] h-[32cqh] w-full lg:h-[40cqh]">
        <defs>
          <linearGradient id="sc-in-table" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={mix(P.timber, P.trim, 0.3)} />
            <stop offset="0.35" stopColor={P.timber} />
            <stop offset="1" stopColor={mix(P.timberShade, P.bark, 0.25)} />
          </linearGradient>
          <linearGradient id="sc-in-table-side" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={P.sheen} stopOpacity="0.16" />
            <stop offset="0.5" stopColor={P.sheen} stopOpacity="0" />
            <stop offset="1" stopColor={P.ink} stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="sc-in-table-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={P.ink} stopOpacity="0" />
            <stop offset="1" stopColor={P.ink} stopOpacity="0.07" />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={1600} height={400} fill="url(#sc-in-table)" />
        <rect x={0} y={0} width={1600} height={400} fill="url(#sc-in-table-side)" />
        <rect x={0} y={0} width={1600} height={6} fill={mix(P.timber, P.trim, 0.55)} />
        <rect x={0} y={6} width={1600} height={3} fill={P.timberShade} opacity={0.5} />
        {[46, 104, 176, 262, 360].map((y, i) => (
          <path key={y} d={`M0 ${y}C400 ${y - 4} 1200 ${y + 4} 1600 ${y}`} stroke={P.timberShade} strokeWidth={1.4 + i * 0.5} fill="none" opacity={0.35} />
        ))}
      </svg>
      {/* the room's shade on the wall just above the table */}
      <div className="absolute inset-x-0 bottom-[20cqh] h-[6cqh] lg:bottom-[28cqh]" style={{ background: `linear-gradient(180deg, transparent, ${alpha(P.ink, 0.06)})` }} />
      <Lamp />
      <Mug />
      <Mail />
    </>
  );
}

/** The table lamp at the back of the table, between the text and the phone (desktop). On at night. */
function Lamp() {
  return (
    <svg viewBox="-60 -125 120 130" className="absolute bottom-[27.6cqh] left-[calc(43cqw_-_50px)] hidden w-[100px] overflow-visible lg:block">
      <TableLamp x={0} base={0} h={120} i={0} />
    </svg>
  );
}

function Mug() {
  return (
    <div className="absolute bottom-[8cqh] left-[5cqw] w-[clamp(48px,13cqw,64px)] lg:bottom-[18cqh] lg:left-[31cqw] lg:w-[clamp(56px,5.4cqw,96px)]">
      {/* steam (the scene's one ambient loop; its own small layer: the blur is painted once, the rise is a transform) */}
      <div className="absolute bottom-[96%] left-[14%] h-[90%] w-[56%]">
        {[0, 1.4, 2.8].map((d, i) => (
          <div key={i} className="sc-amb sc-steam absolute bottom-0 h-full w-[40%]" style={{ left: `${i * 26}%`, animationDelay: `${d}s` }}>
            <svg viewBox="0 0 20 60" className="h-full w-full" style={{ filter: 'blur(2.4px)' }}>
              <path d="M10 58C4 46 16 36 10 24S6 6 12 0" stroke={P.trim} strokeWidth={5} fill="none" strokeLinecap="round" />
            </svg>
          </div>
        ))}
      </div>
      <svg viewBox="0 0 100 92" className="relative block w-full overflow-visible">
        <ContactShadow cx={58} cy={88} rx={60} ry={8} strength={1.2} />
        <path d="M84 30q22 0 22 20t-22 20v-9q12 0 12 -11t-12 -11Z" fill={P.pine} />
        <path d="M10 14v62q0 12 37 12t37 -12V14Z" fill={P.pineLight} />
        <path d="M10 14v62q0 12 18 12V14Z" fill={P.pineLighter} opacity={0.6} />
        <path d="M58 14v74q26 -2 26 -12V14Z" fill={P.pine} opacity={0.7} />
        <path d="M18 24V70" stroke={P.trim} strokeWidth={4} strokeLinecap="round" opacity={0.3} />
        <ellipse cx={47} cy={14} rx={37} ry={9} fill={P.pineLight} />
        <ellipse cx={47} cy={15} rx={31} ry={6} fill={mix(P.bark, P.ink, 0.25)} />
        <path d="M18 13Q30 7 47 7" stroke={P.trim} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.45} />
      </svg>
    </div>
  );
}

function Mail() {
  return (
    <svg viewBox="0 0 220 90" className="absolute bottom-[16cqh] right-[3cqw] hidden w-[clamp(120px,12cqw,210px)] overflow-visible lg:block">
      <ContactShadow cx={118} cy={80} rx={112} ry={10} />
      <g transform="rotate(-4 110 60)">
        <rect x={20} y={46} width={180} height={34} rx={3} fill={P.paperShade} />
      </g>
      <g transform="rotate(3 110 50)">
        <rect x={28} y={33} width={170} height={40} rx={3} fill={P.ink} opacity={0.08} />
        <rect x={26} y={30} width={170} height={40} rx={3} fill={P.paper} />
        <path d="M26 30l85 22 85 -22" fill="none" stroke={P.paperShade} strokeWidth={3} />
        <rect x={166} y={36} width={20} height={15} rx={1} fill={P.pineLight} />
      </g>
      <g transform="rotate(-2 110 36)">
        <rect x={36} y={19} width={160} height={40} rx={3} fill={P.ink} opacity={0.08} />
        <rect x={34} y={16} width={160} height={40} rx={3} fill={P.paperLight} />
        <rect x={34} y={16} width={160} height={3} rx={1.5} fill={P.sheen} opacity={0.6} />
        <rect x={50} y={28} width={70} height={5} rx={2.5} fill={P.ink2} opacity={0.5} />
        <rect x={50} y={38} width={46} height={5} rx={2.5} fill={P.ink2} opacity={0.4} />
        <rect x={160} y={22} width={24} height={17} rx={1} fill={P.honey} />
        {/* the insurance renewal: an amber band across the envelope */}
        <rect x={34} y={44} width={160} height={8} fill={P.amber} />
      </g>
    </svg>
  );
}

/** One broad leaf from (0,0) to (0,-len): a lit left half, a shaded right half, a midrib. */
function leaf(len: number, w: number) {
  const l = `M0 0C${-w} ${-len * 0.25} ${-w * 0.9} ${-len * 0.75} 0 ${-len}`;
  return { whole: `${l}C${w * 0.9} ${-len * 0.75} ${w} ${-len * 0.25} 0 0Z`, left: `${l}Q${w * 0.06} ${-len * 0.5} 0 0Z`, rib: `M0 -2Q${w * 0.06} ${-len * 0.5} 0 ${-len * 0.94}` };
}
const LEAVES: [number, number, number, number, 0 | 1 | 2][] = [
  // x, y (stem base), length, angle, depth (0 back … 2 front)
  [120, 250, 150, -52, 0],
  [130, 250, 170, 8, 0],
  [116, 252, 160, -24, 1],
  [140, 250, 140, 34, 1],
  [110, 254, 120, -72, 2],
  [138, 254, 132, 58, 2],
  [126, 256, 110, -6, 2],
];

/** A potted plant in the near corner: broad leaves in three depths of the kit's foliage, a stone pot. */
function Plant() {
  const tone = [
    [P.foliageDeep, P.foliage],
    [P.foliage, P.foliageLight],
    [P.foliageLight, P.foliageSun],
  ];
  return (
    <svg viewBox="0 0 300 300" className="absolute bottom-[-8cqh] left-[-6cqw] w-[clamp(150px,44cqw,200px)] overflow-visible lg:bottom-[-5cqh] lg:left-[-3cqw] lg:w-[clamp(200px,19cqw,340px)]">
      {LEAVES.map(([x, y, len, a, depth], i) => {
        const lf = leaf(len, len * 0.32);
        const [shade, lit] = tone[depth];
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${a})`}>
            <path d={lf.whole} fill={shade} />
            <path d={lf.left} fill={lit} />
            <path d={lf.rib} fill="none" stroke={P.foliageDeep} strokeWidth={2} opacity={0.5} />
          </g>
        );
      })}
      {/* the pot: lit left, shaded right, a rim, its occlusion under the leaves */}
      <path d="M76 246h120l-14 70H90Z" fill={P.stoneShade} />
      <path d="M76 246h66l-6 70H90Z" fill={P.stone} />
      <rect x={70} y={238} width={132} height={14} rx={3} fill={mix(P.stone, P.trim, 0.35)} />
      <rect x={150} y={238} width={52} height={14} rx={3} fill={P.stoneShade} />
      <rect x={76} y={252} width={120} height={8} fill={P.ink} opacity={0.12} />
    </svg>
  );
}
