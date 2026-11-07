import { P, PN, PX, alpha, mix, perTheme, themedBg, type PaletteKey } from '@/lib/illustrationPalette';

/**
 * The desk a document rests on (letters, the counselor packet): warm wood with a faint grain, soft window
 * light falling from the top-left, a small plant behind the page and a pen lying beside it. Kept soft and
 * low in contrast (out of focus), so the paper and its text stay the clearest thing on screen.
 * At night (dark theme) the same desk sits under a warm lamp: darker wood, a pool of honey light instead of
 * the window panes.
 *
 * Everything here is static and drawn once: the wood is a tiled background image, the light, the plant and
 * the pen are SVG images (their blur is part of the image), so nothing is re-blurred while the paper moves.
 * Data-URI images can't read CSS variables, so each is built twice from hex (perTheme) and the theme picks.
 */
type Hex = Readonly<Record<PaletteKey, string>>;
const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
const svgSrc = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;
const NS = "xmlns='http://www.w3.org/2000/svg'";

const WOOD = P.wood;

/** A 360 × 120 tile of wood: long, gently waving grain lines, a few knots' rings, one plank seam. */
const WOOD_TILE = perTheme((P: Hex) => {
  const GRAIN = mix(P.timberShade, P.bark, 0.25);
  let seed = 5;
  const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  let d = '';
  // irregular spacing and strength, so the grain never reads as ruled lines
  for (let y = 3 + r() * 4; y < 118; y += 5 + r() * 11) {
    const a = 0.8 + r() * 2.6;
    const ph = r() * 360;
    const x0 = r() * 120;
    d += `M${x0.toFixed(1)} ${y.toFixed(1)}`;
    for (let x = x0 + 30; x <= Math.min(360, x0 + 200 + r() * 200); x += 30) d += `L${x.toFixed(1)} ${(y + Math.sin(((x + ph) / 360) * Math.PI * 4) * a).toFixed(1)}`;
  }
  const svg =
    `<svg ${NS} width='360' height='120'>` +
    `<filter id='n' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.012 0.4' numOctaves='2' seed='8' stitchTiles='stitch'/>` +
    `<feColorMatrix values='0 0 0 0 0.48 0 0 0 0 0.4 0 0 0 0 0.31 0 0 0 0.16 0'/></filter>` +
    `<rect width='360' height='120' filter='url(#n)'/>` +
    `<path d='${d}' fill='none' stroke='${GRAIN}' stroke-width='0.8' stroke-linecap='round' opacity='0.2'/>` +
    `<ellipse cx='250' cy='58' rx='16' ry='3.2' fill='none' stroke='${GRAIN}' stroke-width='0.8' opacity='0.22'/>` +
    `<ellipse cx='250' cy='58' rx='8' ry='1.6' fill='none' stroke='${GRAIN}' stroke-width='0.8' opacity='0.22'/>` +
    `<rect y='119' width='360' height='1' fill='${P.bark}' opacity='0.18'/></svg>`;
  return svgUrl(svg);
});

/** Window light: two soft panes falling across the desk from the top-left, blurred into the wood. */
const WINDOW_LIGHT = svgSrc(
  `<svg ${NS} viewBox='0 0 420 280' width='420' height='280'>` +
    `<filter id='b' x='-30%' y='-30%' width='160%' height='160%'><feGaussianBlur stdDeviation='14'/></filter>` +
    `<g filter='url(#b)' fill='${PX.glow}' opacity='0.55'>` +
    `<path d='M-30 -30H90L190 250H40Z'/><path d='M104 -30H214L304 250H206Z'/></g></svg>`,
);
/** Lamp light (night): a warm pool from a lamp off the top-left corner, brightest near it. */
const LAMP_LIGHT = (() => {
  const { glow, honey } = PN;
  return svgSrc(
    `<svg ${NS} viewBox='0 0 420 280' width='420' height='280'>` +
      `<defs><radialGradient id='l' cx='0.08' cy='0.02' r='0.95'><stop offset='0' stop-color='${glow}' stop-opacity='0.5'/><stop offset='0.35' stop-color='${honey}' stop-opacity='0.2'/><stop offset='1' stop-color='${honey}' stop-opacity='0'/></radialGradient></defs>` +
      `<rect width='420' height='280' fill='url(#l)'/></svg>`,
  );
})();

/** A small potted plant behind the page: a glazed pot lit from the left, leaves fanning up. Out of focus. */
const PLANT = perTheme((P: Hex) => {
  const leaves = [
    [-58, 30, 6.5, P.tree],
    [-34, 40, 7, P.treeLight],
    [-12, 44, 7.5, P.tree],
    [8, 42, 7, P.pineLighter],
    [28, 38, 7, P.treeLight],
    [50, 30, 6.5, P.tree],
  ] as const;
  const bx = 40;
  const by = 54;
  let paths = '';
  for (const [deg, len, w, c] of leaves) {
    const a = (deg * Math.PI) / 180;
    const tx = bx + Math.sin(a) * len;
    const ty = by - Math.cos(a) * len;
    const mx = (bx + tx) / 2;
    const my = (by + ty) / 2;
    const px = Math.cos(a) * w;
    const py = Math.sin(a) * w;
    paths += `<path d='M${bx} ${by}Q${(mx + px).toFixed(1)} ${(my + py).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}Q${(mx - px).toFixed(1)} ${(my - py).toFixed(1)} ${bx} ${by}Z' fill='${c}'/>`;
    paths += `<path d='M${bx} ${by}L${tx.toFixed(1)} ${ty.toFixed(1)}' stroke='${P.treeDark}' stroke-width='0.7' opacity='0.45'/>`;
  }
  return svgSrc(
    `<svg ${NS} viewBox='0 0 90 92' width='90' height='92'>` +
      `<defs><linearGradient id='p' x1='0' x2='1'><stop offset='0' stop-color='${P.trim}'/><stop offset='0.55' stop-color='${P.wall}'/><stop offset='1' stop-color='${P.wallDeep}'/></linearGradient>` +
      `<filter id='s' x='-40%' y='-40%' width='180%' height='180%'><feGaussianBlur stdDeviation='3'/></filter>` +
      `<filter id='f' x='-10%' y='-10%' width='120%' height='120%'><feGaussianBlur stdDeviation='0.75'/></filter></defs>` +
      `<ellipse cx='52' cy='84' rx='26' ry='5' fill='${P.shadow}' filter='url(#s)'/>` +
      `<g filter='url(#f)'>${paths}` +
      `<path d='M24 56L28 81Q40 85 52 81L56 56Z' fill='url(#p)'/>` +
      `<ellipse cx='40' cy='56' rx='16' ry='4.4' fill='${P.trimShade}'/>` +
      `<ellipse cx='40' cy='56.4' rx='13.4' ry='3.3' fill='${mix(P.soil, P.bark, 0.5)}'/></g></svg>`,
  );
});

/** The pen, lying on the desk (the same pen that signs: pine barrel, brass band, clip and nib). */
const DESK_PEN = perTheme((P: Hex) => svgSrc(
  `<svg ${NS} viewBox='-4 -12 52 22' width='104' height='44'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${P.pineLighter}'/><stop offset='0.4' stop-color='${P.pineLight}'/><stop offset='1' stop-color='${P.pineDark}'/></linearGradient>` +
    `<linearGradient id='n' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${P.honeyLight}'/><stop offset='1' stop-color='${P.brass}'/></linearGradient>` +
    `<filter id='s' x='-20%' y='-60%' width='140%' height='220%'><feGaussianBlur stdDeviation='1.4'/></filter>` +
    `<filter id='f'><feGaussianBlur stdDeviation='0.35'/></filter></defs>` +
    `<path d='M3 3.6L12 1.2H43a4.2 4.2 0 0 1 0 8.4H12Z' fill='${P.shadow}' filter='url(#s)'/>` +
    `<g filter='url(#f)'><path d='M0 0L9.5 -3.1V3.1Z' fill='url(#n)'/><path d='M1.2 0H7.4' stroke='${P.brassDark}' stroke-width='0.55'/>` +
    `<rect x='9.2' y='-3.7' width='5.4' height='7.4' rx='1.2' fill='${P.slate}'/>` +
    `<path d='M14.2 -4.3H40.6a4.3 4.3 0 0 1 0 8.6H14.2Z' fill='url(#g)'/>` +
    `<path d='M15.5 -2.9H40' stroke='${P.trim}' stroke-width='0.9' opacity='0.45'/>` +
    `<rect x='14.2' y='-4.3' width='1.7' height='8.6' fill='${P.brass}'/>` +
    `<path d='M24 -4.3V-5.6H39.4' fill='none' stroke='${P.brass}' stroke-width='1.3'/></g></svg>`,
));

// light falls off from the window (top-left) toward the far corner; at night the lamp does the same, warmer
const FALLOFF = `linear-gradient(150deg, ${alpha(P.sheen, 0.32)} 0%, ${alpha(P.sheen, 0)} 45%, ${alpha(P.bark, 0.14)} 100%)`;

/** The desk's surface. Give its element the DESK_CLASS too (the wood tile follows the theme). */
export const DESK_CLASS = 'themed-bg';
export const DESK_STYLE = {
  backgroundColor: WOOD,
  ...themedBg(`${FALLOFF}, ${WOOD_TILE.day}`, `${FALLOFF}, ${WOOD_TILE.night}`),
} as React.CSSProperties;

/** One data-URI image per theme: both are in the page, CSS shows the current one (no re-render on a switch). */
function Themed({ day, night, className, style, boxRef }: { day: string; night: string; className: string; style?: React.CSSProperties; boxRef?: React.Ref<HTMLSpanElement> }) {
  return (
    <span ref={boxRef} aria-hidden className={`block ${className}`} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={day} className="theme-day-only block h-auto w-full select-none" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={night} className="theme-night-only block h-auto w-full select-none" />
    </span>
  );
}

/** The light, the plant and (unless it's in use) the pen. Render inside a relatively positioned desk. */
export function DeskDecor({ penAway = false, penRef }: { penAway?: boolean; penRef?: React.Ref<HTMLSpanElement> }) {
  return (
    <>
      <Themed day={WINDOW_LIGHT} night={LAMP_LIGHT} className="pointer-events-none absolute -left-6 -top-6 w-[80%] max-w-[460px] select-none" />
      <Themed day={PLANT.day} night={PLANT.night} className="pointer-events-none absolute left-[8px] top-[-12px] w-[68px] select-none" />
      <Themed
        boxRef={penRef}
        day={DESK_PEN.day}
        night={DESK_PEN.night}
        className="pointer-events-none absolute bottom-[2px] right-[5%] w-[104px] select-none transition-opacity duration-150"
        style={{ transform: 'rotate(-14deg)', opacity: penAway ? 0 : 1 }}
      />
    </>
  );
}
