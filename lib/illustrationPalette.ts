/**
 * The illustration palette (round 5). UI chrome keeps the BUILD_SPEC tokens in app/globals.css; everything
 * drawn — the 3D house, the shaded SVG illustrations — uses only these. Light comes from the top-left
 * everywhere: top and front faces take the `light`/base tone, faces turned right take the `shade`, the
 * underside or deepest face takes the `deep` tone. Gradients are allowed only inside illustrations, to model
 * light (sky, window glow, falloff on a wall), never as washes on UI.
 */
export const P = {
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
  trim: '#FFFFFF',
  trimShade: '#E9E6DF',
  // roof
  slate: '#3C4A52',
  slateLight: '#4F5F69',
  slateDark: '#2D383F',
  // glass (unlit)
  glass: '#5E707B',
  glassLight: '#8597A1',
  // sky
  skyTop: '#DCE8EE',
  skyBottom: '#F6F7F5',
  duskTop: '#26414D',
  duskBottom: '#3E5F5A',
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
  // paper (documents)
  paper: '#FBFAF6',
  paperShade: '#EEEAE0',
  ink: '#182420',
  ink2: '#4A5753',
  // amber signal inside illustrations (overcrowded, over 30%)
  amber: '#C9822B',
  amberSoft: '#F3DFC2',
  // shadow
  shadow: 'rgba(24,36,32,0.18)',
  shadowSoft: 'rgba(24,36,32,0.10)',
} as const;

/** Natural skin tones, light to deep. */
export const SKIN = ['#F3D3B8', '#E6B994', '#C9926A', '#9C6747', '#6E4630'] as const;
/** Hair colours. */
export const HAIR = ['#2B2420', '#4A3424', '#7A5536', '#B88E5C', '#3B3B3B'] as const;
/** Clothing: palette colours only. */
export const CLOTH = {
  pine: [P.pineLight, P.pine],
  honey: [P.honey, P.brass],
  slate: [P.slateLight, P.slate],
  sage: [P.sageLight, P.sageDark],
  sky: ['#9DB7C4', '#7E9AA8'],
  wall: [P.wall, P.wallShade],
} as const;
export type ClothKey = keyof typeof CLOTH;

/** Linear blend of two hex colours (t = 0 → a, 1 → b). For light changes inside illustrations. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}
