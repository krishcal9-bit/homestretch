'use client';
import { memo } from 'react';
import { motion } from 'motion/react';
import { P, SKIN, mix } from '@/lib/illustrationPalette';
import { Layer, SceneRoot, useDepthOffset, useSceneMount } from './Scene';
import { House, Jacaranda, Palm, RoundTree, nightStyle } from './parts';

/**
 * Section 2, "Tell us where you are": indoors. The family's kitchen as a camera sees it with the phone in
 * focus: everything behind the phone is softly blurred (depth of field), more the farther it is. A window
 * onto the street (its view sits deeper still: it travels slower than the wall and is the blurriest), a sheer
 * curtain, a pendant lamp, a shelf and a framed photo high on the wall; the table top along the bottom with a
 * mug (steam rising) and a stack of mail; out-of-focus leaves in the near corner. The wall above the text is
 * left plain. The fixed sky behind is the wall's own warm tone.
 *
 * Layers: wall 0.6 (window view 0.4) · table 1 · near leaves 1.25. Ambient (only while settled here): steam,
 * a car passing outside now and then. Night slots: the pendant lamp, the street lamp and windows outside.
 * Desktop: the window stands behind the phone (centre-right). Phones: text first, the phone and window below.
 * Blur is a static filter on each piece, never on anything that moves inside it.
 */
export const IntakeScene = memo(function IntakeScene({ night = false }: { night?: boolean }) {
  const mounted = useSceneMount(1);
  return (
    <SceneRoot index={1} night={night} testId="intake-scene" className="[container-type:size]">
      {mounted && <Room />}
    </SceneRoot>
  );
});

const Room = memo(function Room() {
  return (
    <>
      <Layer speed={0.6}>
        <Shelf />
        <Photo />
        <Window />
        <Pendant />
      </Layer>
      <Layer speed={1}>
        <Table />
      </Layer>
      <Layer speed={1.25}>
        <Leaves />
      </Layer>
    </>
  );
});

/* ------------------------------------------------------------------ */
/* Wall                                                                */
/* ------------------------------------------------------------------ */

/**
 * The window: white frame, mullions, sill with a pot of herbs, a sheer curtain. The street outside is its own
 * blurred plane, clipped by the opening, travelling a little slower than the wall (it is farther away).
 */
function Window() {
  const view = useDepthOffset(0.22);
  return (
    <div className="absolute left-[46cqw] top-[30cqh] aspect-[0.86] w-[58cqw] lg:left-[59cqw] lg:top-[6cqh] lg:w-[min(31cqw,54cqh)]">
      {/* the opening: the street outside */}
      <div className="absolute left-[5.5%] right-[5.5%] top-[4.6%] bottom-[11%] overflow-hidden">
        <motion.div className="absolute inset-x-0 top-[-14%] bottom-[-14%]" style={{ y: view }}>
          <svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" style={{ filter: 'blur(5px)' }}>
            <Outside />
          </svg>
          {/* now and then a car passes on the street */}
          <div className="absolute inset-x-0 top-[66%] h-[9%] overflow-hidden" style={{ filter: 'blur(3px)' }}>
            <svg viewBox="0 0 60 22" className="sc-amb sc-pass absolute left-0 top-0 h-full w-auto" style={{ animationDuration: '13s', animationDelay: '2s' }}>
              <path d="M2 18V11Q2 8 6 7.4L15 6.6L22 1Q24 0 27 0H40Q43 0 45 2L51 7L55 8Q58 9 58 12V18Z" fill={P.pineLight} />
              <path d="M2 14H58V18H2Z" fill={P.pine} />
              <path d="M20 6.4L25.4 2H33V6.4Z" fill={P.glassLight} />
              <circle cx={15} cy={18.5} r={3.6} fill={P.ink} />
              <circle cx={46} cy={18.5} r={3.6} fill={P.ink} />
            </svg>
          </div>
        </motion.div>
      </div>
      {/* frame, mullions and sill */}
      <svg viewBox="0 0 172 200" className="absolute inset-0 h-full w-full overflow-visible" style={{ filter: 'blur(3.2px)' }}>
        <path d="M0 0H172V178H0Z M9.5 9.2V156H162.5V9.2Z" fill={P.trim} fillRule="evenodd" />
        <path d="M162.5 9.2V156H170V2Z" fill={P.trimShade} opacity={0.8} />
        <rect x={83} y={9} width={6} height={147} fill={P.trim} />
        <rect x={9} y={78} width={154} height={6} fill={P.trim} />
        <rect x={-8} y={174} width={188} height={12} rx={3} fill={P.trimShade} />
        <rect x={-8} y={174} width={188} height={4} rx={2} fill={P.trim} />
        <rect x={-8} y={186} width={188} height={6} fill={P.ink} opacity={0.06} />
        {/* a pot of herbs on the sill */}
        <path d="M128 174l3 -20h22l3 20Z" fill={mix(P.amber, P.wall, 0.25)} />
        <path d="M128 174l3 -20h7l-2 20Z" fill={mix(P.amber, P.trim, 0.4)} />
        <circle cx={136} cy={146} r={10} fill={P.treeLight} />
        <circle cx={149} cy={142} r={12} fill={P.tree} />
        <circle cx={141} cy={134} r={8} fill={P.pineLighter} />
      </svg>
      {/* a sheer curtain gathered at the right */}
      <svg viewBox="0 0 40 200" preserveAspectRatio="none" className="absolute right-[-9%] top-[-4%] h-[96%] w-[20%]" style={{ filter: 'blur(4px)' }}>
        <path d="M0 0H40V200H8C14 150 2 100 10 60C14 30 4 14 0 0Z" fill={P.trim} opacity={0.8} />
        <path d="M18 0V200M28 0V200" stroke={P.wallShade} strokeWidth={3} opacity={0.5} />
      </svg>
      {/* night: the room's own reflection warms the glass */}
      <div className="sc-light absolute inset-[5%] bottom-[11%]" style={{ ...nightStyle(0.4), background: `radial-gradient(closest-side, ${P.honeyLight}, transparent)`, opacity: 0.25 }} />
    </div>
  );
}

/** The street outside the window: sky, a house across the road, a palm and a jacaranda, the sidewalk. */
const Outside = memo(function Outside() {
  return (
    <>
      <defs>
        <linearGradient id="sc-in-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.skyTop} />
          <stop offset="0.7" stopColor={mix(P.skyBottom, P.goldBottom, 0.4)} />
          <stop offset="1" stopColor={P.goldBottom} />
        </linearGradient>
      </defs>
      <rect x={-20} y={-20} width={240} height={340} fill="url(#sc-in-sky)" />
      <path d="M-20 196C40 186 120 190 220 182V320H-20Z" fill={mix(P.sageLight, P.skyBottom, 0.3)} />
      <Palm x={34} base={214} h={150} lean={5} haze={0.15} sway={false} />
      <House x={70} base={214} w={74} h={44} look={{ roof: 'gable', solar: true, door: 'right' }} haze={0.18} light={0.5} shadow={0.6} />
      <Jacaranda x={168} base={216} r={22} haze={0.12} />
      <RoundTree x={-4} base={216} r={16} haze={0.18} />
      <rect x={-20} y={214} width={240} height={8} fill={P.stone} />
      <rect x={-20} y={222} width={240} height={40} fill={mix(P.asphaltLight, P.skyBottom, 0.25)} />
      <rect x={-20} y={262} width={240} height={60} fill={P.stone} />
    </>
  );
});

/** Pendant lamp hanging over the table (pine shade, brass cap). Night slot: the bulb and its glow. */
function Pendant() {
  return (
    <div className="absolute left-[14cqw] top-0 hidden h-[24cqh] w-[clamp(60px,14cqw,96px)] lg:block lg:left-[47cqw] lg:h-[23cqh] lg:w-[clamp(70px,6.6cqw,118px)]" style={{ filter: 'blur(2.6px)' }}>
      <div className="absolute bottom-[42%] left-1/2 top-0 w-[2px] -translate-x-1/2" style={{ background: P.slateDark }} />
      <svg viewBox="0 0 100 60" className="absolute bottom-0 left-0 w-full overflow-visible">
        <g className="sc-light" style={nightStyle(0)}>
          <ellipse cx={50} cy={58} rx={70} ry={34} fill={P.honey} opacity={0.22} />
          <ellipse cx={50} cy={52} rx={24} ry={8} fill={P.glow} />
        </g>
        <rect x={44} y={0} width={12} height={8} rx={2} fill={P.brass} />
        <path d="M50 6C24 6 8 26 4 50H96C92 26 76 6 50 6Z" fill={P.pine} />
        <path d="M50 6C30 6 16 22 11 42C24 22 38 12 50 6Z" fill={P.pineLighter} opacity={0.6} />
        <path d="M4 50H96V53H4Z" fill={P.pineDark} />
      </svg>
    </div>
  );
}

/** A floating shelf high on the wall: books, a jar, a trailing plant (desktop only). */
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
      <Mug />
      <Mail />
    </>
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
