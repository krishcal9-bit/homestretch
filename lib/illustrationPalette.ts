/**
 * The illustration palette (round 5; day and night in round 6). UI chrome keeps the BUILD_SPEC tokens in
 * app/globals.css; everything drawn — the 3D house, the shaded SVG illustrations — uses only these. Light
 * comes from the top-left everywhere: top and front faces take the `light`/base tone, faces turned right take
 * the `shade`, the underside or deepest face takes the `deep` tone. Gradients are allowed only inside
 * illustrations, to model light (sky, window glow, falloff on a wall), never as washes on UI.
 *
 * Two times of day, one source:
 *   DAY   — the round-5 colours (light theme)
 *   NIGHT — the same world at night, not inverted (dark theme): a navy-to-ink sky; walls, roofs and lawns
 *           moonlit (darker, cooler, a little desaturated); glass glowing warm because the lamps are on;
 *           brass, honey and glow stay warm and get brighter; documents turn to dark paper with light ink2.
 * `P` holds CSS variable references (`P.wall === 'var(--il-wall)'`), so every SVG/CSS consumer follows
 * <html data-theme> with no re-render. The variables come from PALETTE_CSS, inlined once in the root
 * layout's <head>. Non-CSS consumers (three.js, canvas, data-URI images) take hex: PX (day) or PN (night).
 * `mix` and `alpha` work on both: hex in → hex/rgba out, var in → color-mix().
 */
const DAY = {
  // greens
  pine: '#1E5C47',
  pineLight: '#2F7A5E',
  pineLighter: '#4E9478',
  pineDark: '#164536',
  pineSoft: '#E4EFEA',
  // brass / honey: the warm light ("a family got closer")
  brass: '#B8862B',
  brassDark: '#8F671F',
  honey: '#E3B866',
  honeyLight: '#F1D49A',
  glow: '#FFE7B0',
  // walls
  wall: '#F2EEE6',
  wallShade: '#E2DACD',
  wallDeep: '#CFC5B5',
  wallWarm: '#EFE7DA',
  wallCool: '#E9EEEA',
  trim: '#FFFFFF',
  trimShade: '#E9E6DF',
  // roof
  slate: '#3C4A52',
  slateLight: '#4F5F69',
  slateDark: '#2D383F',
  // glass (unlit by day; lamplit at night)
  glass: '#5E707B',
  glassLight: '#8597A1',
  // sky
  skyTop: '#DCE8EE',
  skyBottom: '#F6F7F5',
  duskTop: '#26414D',
  duskBottom: '#3E5F5A',
  cloud: '#FFFFFF',
  cloudLight: '#FFFFFF',
  cloudShade: '#CBD8DE',
  moon: '#F4F1E4',
  star: '#FFFFFF',
  // ground
  sage: '#A9C3A0',
  sageLight: '#BED3B6',
  sageDark: '#8DAA84',
  soil: '#B9A88F',
  stone: '#E2DCD0',
  stoneShade: '#CEC6B7',
  asphalt: '#5A666C',
  asphaltLight: '#6E7A80',
  // golden hour (late in the landing page; result sky warming)
  goldTop: '#F4E3C8',
  goldBottom: '#F8EBDA',
  // jacaranda blooms (OC street trees), muted to sit with the palette
  jacaranda: '#A493BE',
  jacarandaLight: '#BDAED3',
  jacarandaDark: '#857AA0',
  // solar panels
  solar: '#34465A',
  // trees
  tree: '#2E5E45',
  treeLight: '#3F7658',
  treeDark: '#234A36',
  bark: '#7A6650',
  // timber (framing stage)
  timber: '#D9B98A',
  timberShade: '#BF9D6C',
  /** the desk under documents (pale wood by day; dark walnut under a lamp at night) */
  wood: '#E3CCAA',
  // paper (documents)
  paper: '#FBFAF6',
  paperShade: '#EEEAE0',
  /** the lit corner of a sheet (white by day; a lamp-warmed paper at night) */
  paperLight: '#FFFFFF',
  /** light falling across a surface from the top-left (window by day, lamp at night) */
  sheen: '#FFFFFF',
  /** the darkest tone: tyres, phone bodies, the deep end of a shade (stays dark at night) */
  ink: '#182420',
  /** printed lines and small type on paper (turns light at night, with the paper) */
  ink2: '#4A5753',
  /** strong print and handwriting on paper (ink by day; light on the night paper) */
  print: '#182420',
  /** letters on the split-flap board's slate tiles */
  boardInk: '#FBFAF6',
  // amber signal inside illustrations (overcrowded, over 30%)
  amber: '#C9822B',
  amberSoft: '#F3DFC2',
  // clothing: a sky-blue fabric
  clothSky: '#9DB7C4',
  clothSkyDark: '#7E9AA8',
  // people
  skin0: '#F3D3B8',
  skin1: '#E6B994',
  skin2: '#C9926A',
  skin3: '#9C6747',
  skin4: '#6E4630',
  hair0: '#2B2420',
  hair1: '#4A3424',
  hair2: '#7A5536',
  hair3: '#B88E5C',
  hair4: '#3B3B3B',
  // shadow
  shadow: 'rgba(24,36,32,0.18)',
  shadowSoft: 'rgba(24,36,32,0.10)',
};

export type PaletteKey = keyof typeof DAY;

const NIGHT: Record<PaletteKey, string> = {
  pine: '#1F4A3D',
  pineLight: '#2A5E4D',
  pineLighter: '#3D7564',
  pineDark: '#12322A',
  pineSoft: '#1A2F28',
  brass: '#D9A64A',
  brassDark: '#A97B2E',
  honey: '#F2C46E',
  honeyLight: '#F7D898',
  glow: '#FFE6AE',
  wall: '#56606A',
  wallShade: '#424B55',
  wallDeep: '#323A43',
  wallWarm: '#5B5F66',
  wallCool: '#515D66',
  trim: '#8E9BA6',
  trimShade: '#6E7A85',
  slate: '#222C35',
  slateLight: '#2E3A45',
  slateDark: '#182028',
  glass: '#C08A45',
  glassLight: '#E3B266',
  skyTop: '#0B1628',
  skyBottom: '#121B1F',
  duskTop: '#08111E',
  duskBottom: '#14232A',
  cloud: '#2E3C52',
  cloudLight: '#4A5A74',
  cloudShade: '#1C2739',
  moon: '#EDEBDD',
  star: '#DCE3EC',
  sage: '#2B3D35',
  sageLight: '#354A40',
  sageDark: '#22322B',
  soil: '#463E35',
  stone: '#4A5157',
  stoneShade: '#394046',
  asphalt: '#1C2328',
  asphaltLight: '#262E34',
  goldTop: '#1E2340',
  goldBottom: '#3A2D2E',
  jacaranda: '#4C4568',
  jacarandaLight: '#5E567E',
  jacarandaDark: '#3B3554',
  solar: '#1A2533',
  tree: '#1D3B2E',
  treeLight: '#284B3B',
  treeDark: '#142B21',
  bark: '#3F362D',
  timber: '#8A7556',
  timberShade: '#6A5940',
  wood: '#3A3128',
  paper: '#1C2522',
  paperShade: '#16201C',
  paperLight: '#26302B',
  sheen: '#9C7740',
  ink: '#05090A',
  ink2: '#A7B4AE',
  print: '#E8EDEA',
  boardInk: '#E8EDEA',
  amber: '#DE9A48',
  amberSoft: '#3A2B1A',
  clothSky: '#4D6370',
  clothSkyDark: '#3C505C',
  skin0: '#A58F7D',
  skin1: '#9C7E65',
  skin2: '#896348',
  skin3: '#6A4630',
  skin4: '#4B3021',
  hair0: '#1D1816',
  hair1: '#322318',
  hair2: '#533A25',
  hair3: '#7D603E',
  hair4: '#282828',
  shadow: 'rgba(0,0,0,0.42)',
  shadowSoft: 'rgba(0,0,0,0.26)',
};

const cssName = (k: string) => `--il-${k.replace(/[A-Z0-9]/g, (c) => `-${c.toLowerCase()}`)}`;
const KEYS = Object.keys(DAY) as PaletteKey[];

/** Day colours as hex (three.js, canvas, data-URI images, anything that can't read CSS variables). */
export const PX: Readonly<Record<PaletteKey, string>> = DAY;
/** Night colours as hex. */
export const PN: Readonly<Record<PaletteKey, string>> = NIGHT;
/** The palette as CSS variable references: follows the theme with no re-render. */
export const P = Object.fromEntries(KEYS.map((k) => [k, `var(${cssName(k)})`])) as Readonly<Record<PaletteKey, string>>;

/** The variables behind P, for one <style> in the root layout's <head> (before first paint). */
export const PALETTE_CSS =
  `:root{${KEYS.map((k) => `${cssName(k)}:${DAY[k]}`).join(';')}}` +
  `:root[data-theme='dark']{${KEYS.map((k) => `${cssName(k)}:${NIGHT[k]}`).join(';')}}`;

/** Natural skin tones, light to deep. */
export const SKIN = [P.skin0, P.skin1, P.skin2, P.skin3, P.skin4] as const;
/** Hair colours. */
export const HAIR = [P.hair0, P.hair1, P.hair2, P.hair3, P.hair4] as const;
/** Clothing: palette colours only. */
export const CLOTH = {
  pine: [P.pineLight, P.pine],
  honey: [P.honey, P.brass],
  slate: [P.slateLight, P.slate],
  sage: [P.sageLight, P.sageDark],
  sky: [P.clothSky, P.clothSkyDark],
  wall: [P.wall, P.wallShade],
} as const;
export type ClothKey = keyof typeof CLOTH;

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
function hexNum(hex: string): number {
  const h = hex.slice(1);
  return parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
}
const pct = (t: number) => `${Math.round(t * 1000) / 10}%`;

/**
 * Linear blend of two colours (t = 0 → a, 1 → b). For light changes inside illustrations.
 * Two hex colours give hex (safe for three.js and data URIs); anything else (palette variables) gives
 * `color-mix(in srgb, a, b t%)`, which follows the theme.
 */
export function mix(a: string, b: string, t: number): string {
  if (t <= 0) return a;
  if (t >= 1) return b;
  if (HEX.test(a) && HEX.test(b)) {
    const pa = hexNum(a);
    const pb = hexNum(b);
    const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
    return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
  }
  return `color-mix(in srgb, ${a}, ${b} ${pct(t)})`;
}

/** A colour at some opacity (gradients that fade a colour to nothing, halos). Hex → rgba(); else color-mix. */
export function alpha(c: string, a: number): string {
  if (HEX.test(c)) {
    const n = hexNum(c);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  if (a >= 1) return c;
  return `color-mix(in srgb, ${c} ${pct(Math.max(0, a))}, transparent)`;
}

/**
 * For images that can't read CSS variables (data-URI SVGs): build the image once per time of day. Pair it
 * with the `.themed-bg` class (globals.css) via themedBg(), or render two <img>s with .il-day / .il-night.
 */
export function perTheme<T>(build: (p: Readonly<Record<PaletteKey, string>>) => T): { day: T; night: T } {
  return { day: build(PX), night: build(PN) };
}

/** Inline style for an element with class `themed-bg`: its background image follows the theme. */
export function themedBg(day: string, night: string): Record<string, string> {
  return { '--bg-day': day, '--bg-night': night };
}
