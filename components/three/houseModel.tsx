'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { PX, mix } from '@/lib/illustrationPalette';

const P = PX;

/**
 * The Keystone house: a stylized two-story craftsman with a front porch gable, built from primitives.
 * Every part is its own group so it can build in with overlap (plinth rises, walls extrude one by one,
 * roof panels drop and settle, chimney pops, windows and door slot in, trees grow and sway).
 * Units: about half a metre. The lawn top is y = 0; the front of the house faces +z.
 *
 * All motion is computed in one useFrame from a clock and a few targets held in a ref, so prop changes
 * never re-render the meshes; the canvas only renders while something is moving (frameloop "demand").
 */

export type HouseBuild = 'intro' | 'full' | 'short' | 'quick' | 'none';
export type HouseState = {
  /** windows lit, 0–5 (index order: front-left down, front-left up, front-right up, side down, side up) */
  lit: number;
  porch: boolean;
  doorOpen: boolean;
  /** 0 = afternoon, 1 = golden hour */
  sun: number;
  smoke: boolean;
  /** 0 = day, 1 = night (dark theme): moonlight, every window and the porch lamp glowing warm; tweens ~600ms */
  night?: number;
  /**
   * 1 = the diorama plinth (lawn slab on a soil base); 0 = no plinth: the house, trees and path stand on the
   * page's own illustrated ground (the landing street), casting their shadows onto it. Tweens.
   */
  ground?: number;
};

/**
 * The house's form. Units are the model's (about half a metre); x runs along the street, z toward it (the
 * front faces +z), y up from the lawn. Every field has the family house's value in FAMILY_FORM, so a variant
 * only names what it changes.
 */
export type RoofKind = 'gable' | 'hip' | 'gambrel';
export type PorchKind = 'gable' | 'shed' | 'stoop' | 'none';
/** A window: on the front (x along the wall), or a side wall (z along it); y = its centre above the slab. */
export type WindowSpec = { face?: 'front' | 'left' | 'right'; x?: number; z?: number; y: number; w?: number; h?: number; /** stays dark at night (nobody's in that room) */ dark?: boolean };
export type HouseForm = {
  /** body width (along the street), depth, wall height (one storey ≈ 1.6, two ≈ 2.7) */
  w: number;
  d: number;
  h: number;
  roof: RoofKind;
  /** gable and gambrel: the ridge runs along the street ('side', gables at the ends) or toward it ('front', the gable faces the street); a hip roof ignores it */
  ridge: 'side' | 'front';
  /** roof height above the wall top (the pitch follows from it and the span) */
  rise: number;
  porch: PorchKind;
  /** porch width and depth ('gable' keeps the family's own porch, 2.3 × 1.2) */
  porchW: number;
  porchD: number;
  /** front doors, x of each (the first is the main one: the family's brass door, the one that opens) */
  doors: number[];
  /** windows in lit order (`HouseState.lit` lights the first n) */
  windows: WindowSpec[];
  /** chimney position [x, z] on the roof, or none */
  chimney: [number, number] | null;
  /** an attached single-storey garage on one side (its door faces the street, a driveway runs to the sidewalk) */
  garage: { side: 1 | -1; w: number; d: number; h: number; rise: number } | null;
  /** two attached units (a townhome pair): the right half takes `wallB`, a pilaster and a roof divide mark the party wall */
  split: boolean;
  /** garden trees [x, z, scale] */
  trees: [number, number, number][];
  bush: boolean;
  mailbox: boolean;
  /** false: no house, only the garden (the landing street's tree stills) */
  house: boolean;
};

/** The family's house: a two-storey craftsman with a front porch gable (the intro, the hero, result and plan). */
export const FAMILY_FORM: HouseForm = {
  w: 4.2,
  d: 3.2,
  h: 2.7,
  roof: 'gable',
  ridge: 'side',
  rise: 1.16,
  porch: 'gable',
  porchW: 2.3,
  porchD: 1.2,
  doors: [0.95],
  windows: [
    { x: -1.15, y: 0.95 },
    { x: -1.15, y: 2.15, h: 0.78 },
    { x: 1.2, y: 2.15, h: 0.78 },
    { face: 'right', z: 0.15, y: 0.95 },
    { face: 'right', z: 0.15, y: 2.15, h: 0.78 },
  ],
  chimney: [-1.35, -0.75],
  garage: null,
  split: false,
  trees: [
    [-3.15, 0.35, 1],
    [3.05, -2.25, 0.78],
  ],
  bush: true,
  mailbox: true,
  house: true,
};

/** A house on the street: colours (palette hex) and the form changes from FAMILY_FORM. Never the brass door. */
export type HouseVariant = { name: string; wall?: string; wallB?: string; roof?: string; door?: string; mirror?: boolean; form?: Partial<HouseForm> };

/**
 * The family's house (0) and the landing street's neighbours, rendered to stills by scripts/render-street.ts
 * (keep its list in step). Index 0 must stay the family's house exactly: the intro film, the hero slot and
 * the result and plan pages use it.
 */
export const HOUSE_VARIANTS: readonly HouseVariant[] = [
  { name: 'family' },
  // a single-storey ranch: long and low, a shallow hip roof, an attached garage, a porch tucked under a shed roof
  {
    name: 'ranch',
    wall: PX.goldTop,
    roof: PX.bark,
    door: PX.pine,
    form: {
      w: 5.6,
      d: 3.4,
      h: 1.62,
      roof: 'hip',
      rise: 0.95,
      porch: 'shed',
      porchW: 2.4,
      porchD: 1.0,
      doors: [0.55],
      windows: [
        { x: -1.75, y: 0.86, w: 1.25, h: 0.72 },
        { x: 1.85, y: 0.86, w: 0.9, h: 0.72, dark: true },
        { face: 'left', z: 0.2, y: 0.86, w: 0.9, h: 0.72 },
      ],
      chimney: null,
      garage: { side: 1, w: 2.5, d: 3.0, h: 1.5, rise: 0.75 },
      trees: [[-3.55, -0.9, 0.82]],
    },
  },
  // a townhome pair: two attached units, two doors under their own hoods, the right one painted differently
  {
    name: 'townhomes',
    wall: PX.wallCool,
    wallB: PX.amberSoft,
    roof: PX.slateDark,
    door: PX.slate,
    form: {
      w: 6.2,
      d: 3.3,
      h: 2.7,
      roof: 'gable',
      rise: 1.0,
      porch: 'stoop',
      doors: [-0.75, 0.75],
      windows: [
        { x: -2.05, y: 0.95, w: 0.95 },
        { x: 2.05, y: 0.95, w: 0.95 },
        { x: -2.05, y: 2.15, h: 0.78, dark: true },
        { x: -0.75, y: 2.15, h: 0.78 },
        { x: 0.75, y: 2.15, h: 0.78, dark: true },
        { x: 2.05, y: 2.15, h: 0.78 },
        { face: 'right', z: 0.1, y: 2.15, h: 0.78 },
      ],
      chimney: null,
      split: true,
      trees: [],
      bush: true,
    },
  },
  // a Dutch colonial: a gambrel roof over the upper storey, its curb-roof ends on the sides, a hooded door
  {
    name: 'colonial',
    wall: PX.sageLight,
    roof: PX.slate,
    door: PX.pineDark,
    mirror: true,
    form: {
      w: 4.4,
      d: 3.6,
      h: 1.75,
      roof: 'gambrel',
      rise: 1.85,
      porch: 'stoop',
      doors: [0.15],
      windows: [
        { x: -1.35, y: 0.88, w: 0.8, h: 0.8 },
        { x: 1.4, y: 0.88, w: 0.8, h: 0.8, dark: true },
        { face: 'right', z: 0.0, y: 2.25, w: 0.66, h: 0.7 },
        { face: 'right', z: 0.0, y: 0.88, h: 0.8, dark: true },
      ],
      chimney: [1.55, -0.5],
      trees: [[3.35, -1.2, 0.9]],
    },
  },
  // a front-gable cottage: narrow and deep, its gable to the street over a full-width porch
  {
    name: 'cottage',
    wall: PX.clothSky,
    roof: PX.slateDark,
    door: PX.amber,
    form: {
      w: 3.5,
      d: 4.2,
      h: 2.0,
      roof: 'gable',
      ridge: 'front',
      rise: 1.55,
      porch: 'shed',
      porchW: 3.5,
      porchD: 1.05,
      doors: [-0.7],
      windows: [
        { x: 0.85, y: 0.95, w: 0.8, h: 0.84 },
        { x: 0, y: 2.55, w: 0.62, h: 0.62 },
        { face: 'right', z: 0.9, y: 0.95, h: 0.84, dark: true },
        { face: 'right', z: -0.9, y: 0.95, h: 0.84 },
      ],
      chimney: [-0.95, -1.2],
      trees: [[-2.75, -1.0, 0.86]],
      bush: false,
    },
  },
  // a foursquare: tall and square, a hip roof with deep eaves, a porch across the front
  {
    name: 'foursquare',
    wall: PX.wallDeep,
    roof: PX.treeDark,
    door: PX.clothSkyDark,
    form: {
      w: 4.3,
      d: 3.9,
      h: 2.85,
      roof: 'hip',
      rise: 1.25,
      porch: 'shed',
      porchW: 4.3,
      porchD: 1.1,
      doors: [-0.95],
      windows: [
        { x: 0.95, y: 0.95 },
        { x: -0.95, y: 2.25, h: 0.78 },
        { x: 0.95, y: 2.25, h: 0.78, dark: true },
        { face: 'right', z: 0.4, y: 0.95, dark: true },
        { face: 'right', z: 0.4, y: 2.25, h: 0.78 },
      ],
      chimney: [-1.2, -0.6],
      trees: [[2.95, -1.6, 0.74]],
    },
  },
  // the street's trees between the houses (no house): one broad tree, then a pair
  { name: 'tree', form: { house: false, trees: [[0, 0, 1.3]], bush: false, mailbox: false } },
  {
    name: 'trees',
    form: {
      house: false,
      trees: [
        [-0.8, -0.4, 1.05],
        [0.95, 0.5, 0.78],
      ],
      bush: false,
      mailbox: false,
    },
  },
];

/** The form of a HOUSE_VARIANTS entry (the family's house for an unknown index). */
export function houseForm(variant = 0): HouseForm {
  return { ...FAMILY_FORM, ...(HOUSE_VARIANTS[variant]?.form ?? {}) };
}

// ---- timeline (seconds, intro scale) ----
const TL = {
  grid: 0,
  lines: 0.1,
  blueprintOut: 0.95,
  plinth: 0.5,
  slab: 0.62,
  deck: 0.68,
  walls: [0.72, 0.78, 0.84, 0.9],
  gables: 0.96,
  posts: 1.0,
  roof: [1.08, 1.16],
  porchRoof: 1.22,
  path: 1.2,
  openings: 1.26,
  chimney: 1.32,
  trees: [1.58, 1.68],
  bush: 1.74,
  firstLight: 1.95,
  smoke: 2.05,
  key: 2.2,
  keyTurn: 2.47,
  door: 2.58,
  end: 3.0,
};
/** The build section of the timeline (plinth → bush) that the shorter variants replay. */
const BUILD_FROM = 0.5;
const BUILD_TO = 2.2;
const SCALE: Record<Exclude<HouseBuild, 'intro' | 'none'>, number> = { full: 1, short: 1.2 / (BUILD_TO - BUILD_FROM), quick: 0.6 / (BUILD_TO - BUILD_FROM) };

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const prog = (t: number, at: number, dur: number) => clamp01((t - at) / dur);
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
/** Damped spring from 0 to 1 over p∈[0,1]; zeta < 1 overshoots and settles (zeta 0.55 ≈ bounce 0.15). */
function spring(p: number, zeta = 1) {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const w = 9;
  const t = p;
  if (zeta >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
}

// ---- dimensions ----
const SLAB = 0.18;
const WALL = 0.14;
const PLINTH = { w: 8.4, d: 7.8, z: 0.7, lawn: 0.14, base: 0.42 };
/** Where every front path meets the sidewalk (z): the family's last paver's front edge, shared by all forms. */
const PATH_END = FAMILY_FORM.d / 2 + 1.75 + 2 * 0.62 + 0.24;
/** Mailboxes stand on one line along the street. */
const MAILBOX_Z = FAMILY_FORM.d / 2 + 2.9;

/** A form's derived measures (for the family's house: TOP 2.88, RIDGE 4.04, the porch at x 0.95). */
function measures(f: HouseForm) {
  const TOP = SLAB + f.h;
  const RIDGE = TOP + f.rise;
  // the roof's span is across the ridge: the depth for a side ridge (and every hip), the width for a front one
  const front = f.roof !== 'hip' && f.ridge === 'front';
  const span = front ? f.w : f.d;
  const len = front ? f.d : f.w;
  const doorX = f.doors[0] ?? 0;
  // the porch floor's front edge, then the step: where the path starts
  const deckD = f.porch === 'gable' ? 1.2 : f.porch === 'shed' ? f.porchD : f.porch === 'stoop' ? 0.62 : 0;
  const stepFront = f.d / 2 + deckD + 0.36;
  return { W: f.w, D: f.d, H: f.h, TOP, RIDGE, front, span, len, doorX, deckD, stepFront };
}

/** Path pavers (z of each centre) from the step to the sidewalk line, ~0.62 apart (the family's: 3.35, 3.97, 4.59). */
function paverZs(stepFront: number) {
  const first = stepFront + 0.19;
  const last = PATH_END - 0.24;
  if (last <= first) return [first];
  const n = Math.round((last - first) / 0.62) + 1;
  return Array.from({ length: n }, (_, i) => first + ((last - first) * i) / Math.max(1, n - 1));
}

/** A box spanning p0 → p1 in the (z, y) plane (extended past each end), as a position and an x rotation. */
function slope(p0: [number, number], p1: [number, number], ext0 = 0, ext1 = 0) {
  const dz = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const l = Math.hypot(dz, dy);
  const ux = dz / l;
  const uy = dy / l;
  const a: [number, number] = [p0[0] - ux * ext0, p0[1] - uy * ext0];
  const b: [number, number] = [p1[0] + ux * ext1, p1[1] + uy * ext1];
  return { pos: [0, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2] as [number, number, number], rotX: -Math.atan2(dy, dz), len: l + ext0 + ext1, a, b };
}

/** A gable end's outline (base `span`, height `rise`): a triangle, or the gambrel's five-sided curb shape. */
function gableShape(kind: RoofKind, span: number, rise: number) {
  const s = new THREE.Shape();
  s.moveTo(-span / 2, 0);
  s.lineTo(span / 2, 0);
  if (kind === 'gambrel') {
    const k = gambrelKnee(span, rise);
    s.lineTo(k.z, k.y);
    s.lineTo(0, rise);
    s.lineTo(-k.z, k.y);
  } else s.lineTo(0, rise);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: WALL, bevelEnabled: false });
  g.translate(0, 0, -WALL / 2);
  return g;
}
/** The gambrel's knee (where the steep lower slope meets the shallow upper one), from the ridge's centre line. */
function gambrelKnee(span: number, rise: number) {
  return { z: span / 2 - span * 0.15, y: rise * 0.66 };
}

/**
 * A hip roof as a shell (four planes meeting at a short ridge along x), `len` × `span` at the wall top,
 * eaves `o` out, apex `rise` above the wall top; y is relative to the roof group's pivot (ridge + 0.06).
 */
function hipGeometry(len: number, span: number, rise: number, o: number) {
  const hs = span / 2;
  const hl = len / 2;
  const r = Math.max(0, hl - hs);
  const k = rise / hs;
  const y0 = -rise - 0.02; // the wall top, from the pivot (the shell sits just on the walls)
  const ye = y0 - o * k;
  const top = y0 + rise;
  const A = [-r, top, 0];
  const B = [r, top, 0];
  const FL = [-hl - o, ye, hs + o];
  const FR = [hl + o, ye, hs + o];
  const BR = [hl + o, ye, -hs - o];
  const BL = [-hl - o, ye, -hs - o];
  const tris = [FL, FR, B, FL, B, A, FR, BR, B, BR, BL, A, BR, A, B, BL, FL, A];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return { geo: g, eaveY: ye, x: hl + o, z: hs + o };
}

function roundedSlab(w: number, d: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2, curveSegments: 6 });
  g.rotateX(-Math.PI / 2); // extrude upward
  return g;
}
function triangle(base: number, height: number, depth: number) {
  const s = new THREE.Shape();
  s.moveTo(-base / 2, 0);
  s.lineTo(base / 2, 0);
  s.lineTo(0, height);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
}
function gridTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const x = c.getContext('2d')!;
  x.clearRect(0, 0, 1024, 1024);
  x.strokeStyle = 'rgba(30,92,71,0.55)';
  x.lineWidth = 2;
  for (let i = 0; i <= 1024; i += 64) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i, 1024);
    x.stroke();
    x.beginPath();
    x.moveTo(0, i);
    x.lineTo(1024, i);
    x.stroke();
  }
  // fade the grid toward its edges (a radial mask)
  const g = x.createRadialGradient(512, 512, 120, 512, 512, 512);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.globalCompositeOperation = 'destination-in';
  x.fillStyle = g;
  x.fillRect(0, 0, 1024, 1024);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function softShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(128, 128, 30, 128, 128, 128);
  g.addColorStop(0, 'rgba(24,36,32,0.55)');
  g.addColorStop(0.6, 'rgba(24,36,32,0.22)');
  g.addColorStop(1, 'rgba(24,36,32,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/** The roof's warm glow (HouseHandle.roofGlow): an amber emissive on the roof panels. */
const ROOF_GLOW = '#E3A33A';

type Mats = ReturnType<typeof useMaterials>;
function useMaterials(variant = 0, windows = 5) {
  return useMemo(() => {
    const v: HouseVariant = HOUSE_VARIANTS[variant] ?? HOUSE_VARIANTS[0];
    const std = (color: string, roughness = 0.9, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
    const glass = () => std(P.glass, 0.35, { emissive: new THREE.Color(P.honey), emissiveIntensity: 0 });
    // (materials are made in a fixed order: three draws coplanar faces by material id, so the family's house
    // keeps its exact look; the forms' extra materials come after)
    const base = {
      lawn: std(P.sage, 0.95),
      catcher: new THREE.ShadowMaterial({ opacity: 0, color: '#1C2A24', depthWrite: false }),
      soil: std(P.soil, 1),
      slab: std(P.stoneShade, 0.95),
      wall: std(v.wall ?? P.wall, 0.88),
      wallSide: std(v.wall ?? P.wall, 0.92),
      trim: std(P.trim, 0.7),
      // the roof can glow amber (emissive starts at 0, so it renders exactly as before until roofGlow is set)
      roof: std(v.roof ?? P.slate, 0.78, { emissive: new THREE.Color(ROOF_GLOW), emissiveIntensity: 0 }),
      roofEdge: std(v.roof ? mix(v.roof, P.ink, 0.3) : P.slateDark, 0.8),
      chimney: std(P.stoneShade, 0.95),
      door: std(v.door ?? P.brass, 0.55, { metalness: v.door ? 0 : 0.15 }),
      doorInset: std(v.door ? mix(v.door, P.ink, 0.22) : P.brassDark, 0.6, { metalness: v.door ? 0 : 0.1 }),
      knob: std(P.honey, 0.3, { metalness: 0.6 }),
      stone: std(P.stone, 0.95),
      bark: std(P.bark, 0.95),
      tree: std(P.tree, 0.85),
      treeLight: std(P.treeLight, 0.85),
      bush: std(P.treeLight, 0.9),
      mailbox: std(P.slate, 0.6),
      flag: std(P.honey, 0.6),
      porchLamp: std(P.honeyLight, 0.4, { emissive: new THREE.Color(P.honey), emissiveIntensity: 0 }),
      key: std(P.brass, 0.32, { metalness: 0.7 }),
      glow: new THREE.MeshBasicMaterial({ color: P.glow, transparent: true, opacity: 0 }),
      spill: new THREE.MeshBasicMaterial({ color: P.honey, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
      line: new THREE.MeshBasicMaterial({ color: P.pine, transparent: true, opacity: 0.9, depthWrite: false }),
      grid: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      shadow: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false }),
      smoke: new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 1, transparent: true, opacity: 0, depthWrite: false }),
      glass: Array.from({ length: Math.max(5, windows) }, glass),
    };
    // a hip roof is a thin shell: both sides render and cast shadows
    const roofShell = base.roof.clone();
    roofShell.side = THREE.DoubleSide;
    return {
      ...base,
      roofShell,
      wallB: std(v.wallB ?? v.wall ?? P.wall, 0.88),
      wallBSide: std(v.wallB ?? v.wall ?? P.wall, 0.92),
      garageDoor: std(P.trim, 0.75),
      groove: std(P.trimShade, 0.8),
    };
  }, [variant, windows]);
}

function Box({ size, pos, mat, rot }: { size: [number, number, number]; pos: [number, number, number]; mat: THREE.Material; rot?: [number, number, number] }) {
  return (
    <mesh position={pos} rotation={rot} material={mat} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

function Window({ m, glass, pos, rotY = 0, w = 0.72, h = 0.86, refCb }: { m: Mats; glass: THREE.Material; pos: [number, number, number]; rotY?: number; w?: number; h?: number; refCb: (g: THREE.Group | null) => void }) {
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <group ref={refCb}>
        <Box size={[w + 0.14, h + 0.14, 0.06]} pos={[0, 0, 0.0]} mat={m.trim} />
        <Box size={[w, h, 0.05]} pos={[0, 0, 0.03]} mat={glass} />
        <Box size={[0.045, h, 0.05]} pos={[0, 0, 0.06]} mat={m.trim} />
        <Box size={[w, 0.045, 0.05]} pos={[0, 0.06, 0.06]} mat={m.trim} />
        <Box size={[w + 0.26, 0.07, 0.16]} pos={[0, -h / 2 - 0.08, 0.06]} mat={m.trim} />
      </group>
    </group>
  );
}

function Tree({ m, pos, s = 1, refCb }: { m: Mats; pos: [number, number, number]; s?: number; refCb: (g: THREE.Group | null) => void }) {
  return (
    <group position={pos}>
      <group ref={refCb} scale={s}>
        <mesh position={[0, 0.55, 0]} material={m.bark} castShadow>
          <cylinderGeometry args={[0.1, 0.14, 1.1, 8]} />
        </mesh>
        <mesh position={[0, 1.75, 0]} material={m.tree} castShadow receiveShadow>
          <sphereGeometry args={[0.92, 20, 16]} />
        </mesh>
        <mesh position={[0.42, 2.25, 0.18]} material={m.treeLight} castShadow receiveShadow>
          <sphereGeometry args={[0.66, 18, 14]} />
        </mesh>
        <mesh position={[-0.38, 2.2, 0.28]} material={m.treeLight} castShadow receiveShadow>
          <sphereGeometry args={[0.56, 18, 14]} />
        </mesh>
      </group>
    </group>
  );
}

export type HouseHandle = {
  /** seconds since the build started (null before it starts) */
  start: number | null;
  build: HouseBuild;
  state: HouseState;
  /** the key's flight (intro only) */
  key: boolean;
  /** timeline speed for the intro (1 = as authored) */
  speed?: number;
  /** set by the intro's camera while it lands: the plinth retracts exactly as the house reaches the street */
  groundOverride?: number;
  /** set by the intro film (components/three/introFilm.tsx): where the sun points (it follows the action) and how much dusk is left */
  film?: { focus: THREE.Vector3; dusk: number };
  /** the intro film hides the house until its beat */
  hidden?: boolean;
  /** HOUSE_VARIANTS index (0 = the family's house) */
  variant?: number;
  /**
   * Pull the house apart (an exploded view): world-unit offsets applied every frame after the build.
   * foundation: the slab, porch deck, path pavers, driveway (and the plinth when it shows);
   * walls: the four walls, gables, porch posts, windows and doors (and a garage's walls);
   * roof: the roof panels, the porch roof and the chimney (and a garage's roof).
   * Assigning a new object (or a new roofGlow) re-renders the canvas; undefined changes nothing.
   */
  parts?: { foundation?: [number, number, number]; walls?: [number, number, number]; roof?: [number, number, number] };
  /** 0–1: a warm amber glow on the roof panels (undefined = none). */
  roofGlow?: number;
};

/** Mutable controller shared between the scene and its React wrapper (no re-renders). */
export function makeHouseController(build: HouseBuild, state: HouseState): HouseHandle {
  return { start: null, build, state, key: build === 'intro' };
}

export function House({ ctl, onBuilt }: { ctl: HouseHandle; onBuilt?: () => void }) {
  const vi = ctl.variant ?? 0;
  const variant: HouseVariant = HOUSE_VARIANTS[vi] ?? HOUSE_VARIANTS[0];
  const f = useMemo(() => houseForm(vi), [vi]);
  const M = useMemo(() => measures(f), [f]);
  const { W, D, H, TOP, RIDGE, doorX: PORCH_X } = M;
  const pavers = useMemo(() => (f.house ? paverZs(M.stepFront) : []), [f, M]);
  const m = useMaterials(vi, f.windows.length);
  const { invalidate } = useThree();
  const geo = useMemo(
    () => ({
      plinthLawn: roundedSlab(PLINTH.w, PLINTH.d, PLINTH.lawn, 0.7),
      plinthBase: roundedSlab(PLINTH.w - 0.1, PLINTH.d - 0.1, PLINTH.base, 0.7),
      gable: f.roof === 'hip' ? null : gableShape(f.roof, M.span, f.rise),
      hip: f.roof === 'hip' ? hipGeometry(M.len, M.span, f.rise, 0.42) : null,
      garageGable: f.garage && f.roof !== 'hip' ? gableShape('gable', f.garage.d, f.garage.rise) : null,
      garageHip: f.garage && f.roof === 'hip' ? hipGeometry(f.garage.w + WALL, f.garage.d, f.garage.rise, 0.36) : null,
      grid: gridTexture(),
      shadow: softShadowTexture(),
    }),
    [f, M],
  );
  // the exploded-view hook: assigning parts / roofGlow re-renders (the frame applies them)
  useEffect(() => {
    let parts = ctl.parts;
    let glow = ctl.roofGlow;
    Object.defineProperty(ctl, 'parts', {
      configurable: true,
      enumerable: true,
      get: () => parts,
      set: (v: HouseHandle['parts']) => {
        parts = v;
        invalidate();
      },
    });
    Object.defineProperty(ctl, 'roofGlow', {
      configurable: true,
      enumerable: true,
      get: () => glow,
      set: (v: number | undefined) => {
        glow = v;
        invalidate();
      },
    });
    return () => {
      delete ctl.parts;
      delete ctl.roofGlow;
      ctl.parts = parts;
      ctl.roofGlow = glow;
    };
  }, [ctl, invalidate]);
  const applied = useRef({ key: '', glow: 0 });
  const tmpScale = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    m.grid.map = geo.grid;
    m.shadow.map = geo.shadow;
    m.grid.needsUpdate = true;
    m.shadow.needsUpdate = true;
  }, [m, geo]);

  const r = useRef<Record<string, THREE.Object3D | null>>({});
  const set = (k: string) => (o: THREE.Object3D | null) => {
    r.current[k] = o;
  };
  const glassI = useRef<number[]>([]);
  const porchI = useRef(0);
  const nightI = useRef(ctl.state.night ?? 0);
  const groundI = useRef(ctl.groundOverride ?? ctl.state.ground ?? 1);
  const smokeT = useRef(0);
  const built = useRef(false);

  // make everything visible in its final state when there's no build
  useEffect(() => invalidate(), [invalidate]);

  useFrame((_, delta) => {
    const R = r.current;
    if (R.root) R.root.visible = !ctl.hidden;
    const b = ctl.build;
    let moving = false;
    // wall-clock time (R3F's clock restarts when the canvas pauses off screen, which would replay the build)
    const now = performance.now() / 1000;
    if (ctl.start === null) ctl.start = now;
    const raw = now - ctl.start;
    // map real time to intro-timeline time
    let t: number;
    if (b === 'none') t = 99;
    else if (b === 'intro') t = raw * (ctl.speed ?? 1);
    else t = BUILD_FROM + raw / SCALE[b];
    const intro = b === 'intro';
    if (t < TL.end + 0.6) moving = true;

    // blueprint (intro only)
    const bpIn = intro ? easeOut(prog(t, TL.grid, 0.45)) : 0;
    const bpOut = intro ? 1 - easeOut(prog(t, TL.blueprintOut, 0.5)) : 0;
    m.grid.opacity = 0.75 * bpIn * bpOut;
    m.line.opacity = 0.9 * bpOut;
    const lines = R.lines as THREE.Group | null;
    if (lines) {
      lines.visible = intro && bpOut > 0.01;
      lines.children.forEach((c, i) => {
        c.scale.setComponent(c.userData.axis ?? 0, Math.max(0.0001, easeInOut(prog(t, TL.lines + i * 0.025, 0.32))));
      });
    }
    if (R.grid) R.grid.visible = m.grid.opacity > 0.01;

    // plinth rises from below, its shadow fades in with it
    const pp = spring(prog(t, TL.plinth, 0.45), 0.85);
    if (R.plinth) R.plinth.position.y = -1.4 * (1 - pp);
    m.shadow.opacity = 0.85 * pp;
    // the plinth itself (lawn slab + soil base) retracts and fades when the house stands on the page's ground;
    // a shadow catcher then puts the house's and trees' shadows on that ground
    const gT = ctl.groundOverride ?? ctl.state.ground ?? 1;
    if (ctl.groundOverride !== undefined) groundI.current = gT;
    else {
      groundI.current += (gT - groundI.current) * Math.min(1, delta * 4);
      if (Math.abs(groundI.current - gT) < 0.003) groundI.current = gT;
      else moving = true;
    }
    const g = groundI.current;
    if (R.lot) {
      R.lot.position.y = -0.9 * (1 - g);
      R.lot.visible = g > 0.005;
      for (const mat of [m.lawn, m.soil]) {
        const tr = g < 0.999;
        if (mat.transparent !== tr) {
          mat.transparent = tr;
          mat.needsUpdate = true;
        }
        mat.opacity = g;
      }
    }
    if (R.plinthShadow) R.plinthShadow.visible = g > 0.005;
    m.catcher.opacity = 0.26 * (1 - g) * pp;
    if (R.slab) {
      const s = spring(prog(t, TL.slab, 0.36), 0.9);
      R.slab.position.z = 2.2 * (1 - s);
      R.slab.visible = s > 0.001;
    }
    if (R.deck) {
      const s = spring(prog(t, TL.deck, 0.34), 0.9);
      R.deck.position.z = 1.6 * (1 - s);
      R.deck.visible = s > 0.001;
    }
    // walls extrude upward, one by one
    TL.walls.forEach((at, i) => {
      const o = R[`wall${i}`];
      if (!o) return;
      const s = spring(prog(t, at, 0.38), 0.95);
      o.scale.y = Math.max(0.0001, s);
      o.visible = s > 0.001;
    });
    ['gableL', 'gableR'].forEach((k) => {
      const o = R[k];
      if (!o) return;
      const s = spring(prog(t, TL.gables, 0.34), 0.9);
      o.scale.y = Math.max(0.0001, s);
      o.visible = s > 0.001;
    });
    Array.from({ length: 6 }, (_, i) => `post${i}`).forEach((k, i) => {
      const o = R[k];
      if (!o) return;
      const s = spring(prog(t, TL.posts + i * 0.05, 0.3), 0.9);
      o.scale.y = Math.max(0.0001, s);
      o.visible = s > 0.001;
    });
    // roof panels drop and settle (a little bounce), 80ms apart
    TL.roof.forEach((at, i) => {
      const o = R[`roof${i}`];
      if (!o) return;
      const p = prog(t, at, 0.55);
      o.position.y = RIDGE + 0.06 + 2.2 * (1 - spring(p, 0.55));
      o.visible = p > 0;
    });
    if (R.porchRoof) {
      const p = prog(t, TL.porchRoof, 0.5);
      R.porchRoof.position.y = 2.2 * (1 - spring(p, 0.55));
      R.porchRoof.visible = p > 0;
    }
    if (R.garage) {
      const s = spring(prog(t, TL.walls[3], 0.38), 0.95);
      R.garage.scale.y = Math.max(0.0001, s);
      R.garage.visible = s > 0.001;
    }
    if (R.garageRoof) {
      const p = prog(t, TL.porchRoof, 0.5);
      R.garageRoof.visible = p > 0;
    }
    if (R.chimney) {
      const s = spring(prog(t, TL.chimney, 0.42), 0.5);
      R.chimney.scale.set(Math.max(0.0001, s), Math.max(0.0001, s), Math.max(0.0001, s));
      R.chimney.visible = s > 0.001;
    }
    // windows and the door slot in from the front (40ms apart)
    for (let i = 0; i <= f.windows.length; i++) {
      const o = R[`open${i}`];
      if (!o) continue;
      const s = spring(prog(t, TL.openings + i * 0.04, 0.34), 0.8);
      o.position.z = 0.5 * (1 - s);
      o.scale.setScalar(0.85 + 0.15 * s);
      o.visible = s > 0.001;
    }
    for (let i = 0; i < pavers.length; i++) {
      const o = R[`paver${i}`];
      if (!o) continue;
      const s = spring(prog(t, TL.path + i * 0.05, 0.3), 0.8);
      o.scale.set(Math.max(0.0001, s), 1, Math.max(0.0001, s));
      o.visible = s > 0.001;
    }
    // trees grow with a springy overshoot; leaves sway a beat after they land, then settle
    f.trees.forEach(([, , base], i) => {
      const o = R[`tree${i}`];
      if (!o) return;
      const at = TL.trees[i] ?? TL.trees[1] + 0.1 * (i - 1);
      const p = prog(t, at, 0.6);
      const s = spring(p, 0.45);
      o.scale.setScalar(Math.max(0.0001, base * (0.15 + 0.85 * s)));
      o.visible = p > 0;
      const since = t - at - 0.12;
      o.rotation.z = since > 0 ? 0.045 * Math.exp(-since * 2.2) * Math.sin(since * 7) : 0;
    });
    if (R.bush) {
      const s = spring(prog(t, TL.bush, 0.45), 0.5);
      R.bush.scale.setScalar(Math.max(0.0001, s));
      R.bush.visible = s > 0.001;
    }
    if (R.mailbox) {
      const s = spring(prog(t, TL.bush + 0.06, 0.4), 0.6);
      R.mailbox.scale.set(1, Math.max(0.0001, s), 1);
      R.mailbox.visible = s > 0.001;
    }

    // window lights: the intro lights the first window; afterwards, `state.lit` decides
    const st = ctl.state;
    // night (dark theme): every window comes on, in a quick stagger, the lit ones brighter
    const nightT = st.night ?? 0;
    const nk = Math.min(1, delta * 5);
    nightI.current += (nightT - nightI.current) * nk;
    if (Math.abs(nightI.current - nightT) < 0.003) nightI.current = nightT;
    else moving = true;
    const n = nightI.current;
    const introLit = intro && t >= TL.firstLight ? 1 : 0;
    const want = Math.max(st.lit, introLit);
    for (let i = 0; i < f.windows.length; i++) {
      const ni = clamp01((n - (i % 5) * 0.07) / 0.72) * (f.windows[i].dark ? 0 : 1);
      const target = i < want ? 1.35 + 0.45 * ni : 1.0 * ni * (intro && t < TL.firstLight ? 0 : 1);
      const cur = glassI.current[i] ?? 0;
      const next = cur + (target - cur) * Math.min(1, delta * 7);
      glassI.current[i] = Math.abs(next - target) < 0.004 ? target : next;
      m.glass[i].emissiveIntensity = glassI.current[i];
      if (glassI.current[i] !== target) moving = true;
    }
    const porchTarget = Math.max(st.porch || (intro && t >= TL.door) ? 2.2 : 0, intro && t < TL.door ? 0 : 2.8 * clamp01((n - 0.3) / 0.7));
    porchI.current += (porchTarget - porchI.current) * Math.min(1, delta * 6);
    if (Math.abs(porchI.current - porchTarget) < 0.005) porchI.current = porchTarget;
    else moving = true;
    m.porchLamp.emissiveIntensity = porchI.current;

    // the key: flies in on a curve, pulls back a touch first (anticipation), slows, turns in the lock
    const key = R.key;
    if (key) {
      const kp = prog(t, TL.key, 0.3);
      key.visible = intro && ctl.key && t >= TL.key && t < TL.door + 0.45;
      if (key.visible) {
        const back = kp < 0.15 ? -0.06 * Math.sin((kp / 0.15) * Math.PI) : 0;
        const u = clamp01(easeOut(clamp01((kp - 0.1) / 0.9)) + back);
        const p0 = new THREE.Vector3(-5.5, 2.6, 6.5);
        const p1 = new THREE.Vector3(-2.2, 3.4, 5.2);
        const p2 = new THREE.Vector3(PORCH_X + 0.3, 0.83, D / 2 + 0.42);
        const a = p0.clone().lerp(p1, u);
        const bb = p1.clone().lerp(p2, u);
        key.position.copy(a.lerp(bb, u));
        const turn = easeOut(prog(t, TL.keyTurn, 0.12));
        key.rotation.set(0, 0, (Math.PI / 2) * turn);
        const fade = 1 - prog(t, TL.door + 0.2, 0.25);
        (key as THREE.Group).scale.setScalar(Math.max(0.0001, fade));
      }
    }
    // the door swings past open and settles; warm light spills onto the porch
    const doorTarget = st.doorOpen || (intro && t >= TL.door) ? 1 : 0;
    const door = R.door;
    if (door) {
      const p = intro ? prog(t, TL.door, 0.55) : doorTarget;
      const s = intro ? spring(p, 0.5) : p;
      door.rotation.y = -1.15 * s * doorTarget;
      m.spill.opacity = (0.42 + 0.22 * n) * easeOut(prog(t, TL.door + 0.04, 0.35)) * doorTarget;
      m.glow.opacity = Math.min(1, s * 1.4) * doorTarget;
    }

    // chimney smoke: the one ambient loop (slow, low)
    const sm = R.smoke as THREE.Group | null;
    if (sm) {
      const on = st.smoke && (!intro || t >= TL.smoke);
      sm.visible = on || m.smoke.opacity > 0;
      if (on) {
        smokeT.current += delta;
        moving = true;
      }
      sm.children.forEach((c, i) => {
        const ph = ((smokeT.current / 7 + i / sm.children.length) % 1 + 1) % 1;
        c.position.set(Math.sin(ph * Math.PI * 2 + i * 1.7) * 0.1 + ph * 0.2, ph * 0.55, -ph * 0.06);
        c.scale.setScalar(0.09 + ph * 0.18);
        // at night the smoke is barely there (moonlit grey puffs read as soot)
        ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = (on ? 1 : 0) * 0.32 * (1 - 0.85 * n) * Math.sin(ph * Math.PI) * clamp01((t - TL.smoke) * 2 + (intro ? 0 : 1));
      });
    }

    if (!built.current && t >= (intro ? TL.end : BUILD_TO)) {
      built.current = true;
      onBuilt?.();
    }
    // the exploded view (after the build): each part group moves by its world-unit offset; the roof can glow
    const parts = ctl.parts;
    const root = R.root;
    if (root && (parts || applied.current.key)) {
      root.getWorldScale(tmpScale); // a mirrored neighbour (scale x −1) still moves the way the caller asked
      const key = JSON.stringify(parts ?? null);
      (['foundation', 'walls', 'roof'] as const).forEach((k) => {
        const o = R[`part-${k}`];
        const v = parts?.[k];
        if (o) o.position.set(v ? v[0] / tmpScale.x : 0, v ? v[1] / tmpScale.y : 0, v ? v[2] / tmpScale.z : 0);
      });
      if (key !== applied.current.key) {
        applied.current.key = parts ? key : '';
        moving = true;
      }
    }
    const glow = clamp01(ctl.roofGlow ?? 0);
    if (glow !== applied.current.glow) {
      applied.current.glow = glow;
      m.roof.emissiveIntensity = m.roofShell.emissiveIntensity = 0.55 * glow;
      moving = true;
    }

    if (moving) invalidate();
  });

  const smokeMats = useMemo(() => [0, 1, 2, 3, 4, 5].map(() => m.smoke.clone()), [m]);
  const wallParts: { k: string; size: [number, number, number]; pos: [number, number, number] }[] = [
    { k: 'wall0', size: [W, H, WALL], pos: [0, 0, -D / 2 + WALL / 2] },
    { k: 'wall1', size: [WALL, H, D - 2 * WALL], pos: [-W / 2 + WALL / 2, 0, 0] },
    { k: 'wall2', size: [WALL, H, D - 2 * WALL], pos: [W / 2 - WALL / 2, 0, 0] },
    { k: 'wall3', size: [W, H, WALL], pos: [0, 0, D / 2 - WALL / 2] },
  ];
  // construction lines: [length, position, rotation axis index of the long side]
  const lineDefs: { len: number; pos: [number, number, number]; axis: 0 | 1 | 2 }[] = [
    { len: W + 2.4, pos: [-W / 2 - 1.2, 0.02, D / 2], axis: 0 },
    { len: W + 2.4, pos: [-W / 2 - 1.2, 0.02, -D / 2], axis: 0 },
    { len: D + 2.4, pos: [-W / 2, 0.02, -D / 2 - 1.2], axis: 2 },
    { len: D + 2.4, pos: [W / 2, 0.02, -D / 2 - 1.2], axis: 2 },
    { len: RIDGE + 0.6, pos: [-W / 2, 0, D / 2], axis: 1 },
    { len: RIDGE + 0.6, pos: [W / 2, 0, D / 2], axis: 1 },
    { len: RIDGE + 0.6, pos: [W / 2, 0, -D / 2], axis: 1 },
    { len: W + 1.6, pos: [-W / 2 - 0.8, RIDGE, 0], axis: 0 },
  ];
  const split = f.split;
  const wallMat = (k: string) => (k === 'wall2' ? (split ? m.wallBSide : m.wallSide) : m.wall);
  const roof = roofParts(f.roof, M.len, M.span, f.rise, m, geo.hip, split);
  const g = f.garage;
  // the garage: beside the house, set back a little; its roof meets the house wall
  const gar = g
    ? (() => {
        const gx = g.side * (W / 2 + g.w / 2);
        const front = D / 2 - 0.3;
        const gz = front - g.d / 2;
        return { gx, front, gz, outer: g.side * (W / 2 + g.w) };
      })()
    : null;
  const porch = porchParts(f, M, m);
  // the chimney: the family's stands 1.9 tall from below its back slope; others rise from the wall top
  const chim = f.chimney
    ? (() => {
        const famous = f.roof === 'gable' && !M.front;
        const base = famous ? RIDGE - 0.9 : TOP - 0.1;
        const hgt = famous ? 1.9 : RIDGE + 0.55 - base;
        return { x: f.chimney[0], z: f.chimney[1], base, hgt };
      })()
    : null;
  const rightEdge = W / 2 + (g && g.side === 1 ? g.w : 0);
  return (
    // a mirrored neighbour keeps the light where it is (only the model flips)
    <group ref={set('root')} scale={[variant.mirror ? -1 : 1, 1, 1]}>
      {/* soft shadow the whole model casts on the page */}
      <mesh ref={set('plinthShadow')} position={[0, -PLINTH.base - 0.36, PLINTH.z + 0.25]} rotation={[-Math.PI / 2, 0, 0]} material={m.shadow} renderOrder={-1}>
        <planeGeometry args={[PLINTH.w * 1.45, PLINTH.d * 1.45]} />
      </mesh>

      {/* blueprint: grid on the ground plane + construction lines that draw across it */}
      <mesh ref={set('grid')} position={[0, 0.006, PLINTH.z]} rotation={[-Math.PI / 2, 0, 0]} material={m.grid} renderOrder={2}>
        <planeGeometry args={[13, 13]} />
      </mesh>
      <group ref={set('lines')}>
        {lineDefs.map((l, i) => {
          const size: [number, number, number] = [0.028, 0.028, 0.028];
          size[l.axis] = l.len;
          const off: [number, number, number] = [0, 0, 0];
          off[l.axis] = l.len / 2;
          return (
            <group key={i} position={l.pos} userData={{ axis: l.axis }}>
              <mesh position={off} material={m.line} renderOrder={3}>
                <boxGeometry args={size} />
              </mesh>
            </group>
          );
        })}
      </group>

      <group ref={set('plinth')}>
        {/* the foundation (HouseHandle.parts.foundation): plinth, slab, porch deck, path, driveway */}
        <group ref={set('part-foundation')}>
          {/* lawn plinth: sage top on a soil base (retracts when the house stands on the page's ground) */}
          <group ref={set('lot')}>
            <mesh geometry={geo.plinthBase} material={m.soil} position={[0, -PLINTH.base - 0.26, PLINTH.z]} receiveShadow />
            <mesh geometry={geo.plinthLawn} material={m.lawn} position={[0, -PLINTH.lawn - 0.06, PLINTH.z]} receiveShadow />
          </group>
          {f.house && (
            <>
              {/* path to the porch */}
              {pavers.map((z, i) => (
                <group key={i} ref={set(`paver${i}`)} position={[PORCH_X, 0.02, z]}>
                  <Box size={[0.78, 0.05, 0.48]} pos={[0, 0, 0]} mat={m.stone} />
                </group>
              ))}
              {/* the other units' paths */}
              {f.doors.slice(1).map((x) =>
                pavers.map((z, i) => (
                  <group key={`${x}-${i}`} position={[x, 0.02, z]}>
                    <Box size={[0.78, 0.05, 0.48]} pos={[0, 0, 0]} mat={m.stone} />
                  </group>
                )),
              )}
              <group ref={set('slab')}>
                <Box size={[W + 0.2, SLAB, D + 0.2]} pos={[0, SLAB / 2, 0]} mat={m.slab} />
              </group>
              <group ref={set('deck')}>{porch.deck}</group>
              {g && gar && (
                <>
                  <Box size={[g.w + 0.1, SLAB * 0.6, g.d + 0.1]} pos={[gar.gx, SLAB * 0.3, gar.gz]} mat={m.slab} />
                  <Box size={[g.w - 0.45, 0.04, PATH_END - gar.front]} pos={[gar.gx, 0.02, (gar.front + PATH_END) / 2]} mat={m.stone} />
                </>
              )}
              {/* light spilling onto the porch when the door opens */}
              <mesh position={[PORCH_X + 0.05, SLAB + 0.01, D / 2 + 0.75]} rotation={[-Math.PI / 2, 0, 0]} material={m.spill} renderOrder={4}>
                <planeGeometry args={[0.95, 1.3]} />
              </mesh>
            </>
          )}
        </group>
        {/* without the plinth: an invisible ground that only shows the shadows falling on it */}
        <mesh position={[0, -0.055, PLINTH.z]} rotation={[-Math.PI / 2, 0, 0]} material={m.catcher} receiveShadow renderOrder={0}>
          <planeGeometry args={[16, 14]} />
        </mesh>

        {f.house && (
          <>
            {/* baked contact shadow where the house meets the lawn */}
            <mesh position={[PORCH_X * 0.3 + (g ? (g.side * g.w) / 2 : 0), 0.004, 0.35]} rotation={[-Math.PI / 2, 0, 0]} material={m.shadow} renderOrder={1}>
              <planeGeometry args={[W + 1.6 + (g ? g.w : 0), D + 2.4]} />
            </mesh>

            {/* the walls (HouseHandle.parts.walls): walls, gables, porch posts, windows, doors, the garage */}
            <group ref={set('part-walls')}>
              {/* walls (scale up from the slab) */}
              {wallParts.map((w) => (
                <group key={w.k} ref={set(w.k)} position={[0, SLAB, 0]}>
                  {split && (w.k === 'wall0' || w.k === 'wall3') ? (
                    <>
                      <Box size={[W / 2, H, WALL]} pos={[-W / 4, H / 2, w.pos[2]]} mat={m.wall} />
                      <Box size={[W / 2, H, WALL]} pos={[W / 4, H / 2, w.pos[2]]} mat={m.wallB} />
                      {w.k === 'wall3' && <Box size={[0.16, H, 0.05]} pos={[0, H / 2, D / 2 + 0.02]} mat={m.trim} />}
                    </>
                  ) : (
                    <Box size={w.size} pos={[w.pos[0], H / 2, w.pos[2]]} mat={wallMat(w.k)} />
                  )}
                </group>
              ))}
              {/* gable ends (a hip roof has none) */}
              {geo.gable &&
                (M.front ? (
                  <>
                    <group ref={set('gableL')} position={[0, TOP, -D / 2 + WALL / 2]}>
                      <mesh geometry={geo.gable} material={m.wallSide} castShadow receiveShadow />
                    </group>
                    <group ref={set('gableR')} position={[0, TOP, D / 2 - WALL / 2]}>
                      <mesh geometry={geo.gable} material={m.wall} castShadow receiveShadow />
                    </group>
                  </>
                ) : (
                  <>
                    <group ref={set('gableL')} position={[-W / 2 + WALL / 2, TOP, 0]}>
                      <mesh geometry={geo.gable} material={m.wall} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow />
                    </group>
                    <group ref={set('gableR')} position={[W / 2 - WALL / 2, TOP, 0]}>
                      <mesh geometry={geo.gable} material={split ? m.wallBSide : m.wallSide} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow />
                    </group>
                  </>
                ))}
              {porch.posts.map((p, i) => (
                <group key={i} ref={set(`post${i}`)} position={[p.x, SLAB, p.z]}>
                  <Box size={[0.14, p.h, 0.14]} pos={[0, p.h / 2, 0]} mat={m.trim} />
                </group>
              ))}

              {/* openings: doors + windows (slot in) */}
              <group ref={set('open0')}>
                <Box size={[0.98, 1.36, 0.06]} pos={[PORCH_X, SLAB + 0.68, D / 2 + 0.02]} mat={m.trim} />
                {/* warm doorway behind the door */}
                <mesh position={[PORCH_X, SLAB + 0.6, D / 2 + 0.055]} material={m.glow}>
                  <planeGeometry args={[0.78, 1.18]} />
                </mesh>
                <group ref={set('door')} position={[PORCH_X - 0.39, SLAB, D / 2 + 0.08]}>
                  <Box size={[0.78, 1.18, 0.05]} pos={[0.39, 0.59, 0]} mat={m.door} />
                  <Box size={[0.26, 0.4, 0.02]} pos={[0.39, 0.86, 0.03]} mat={m.doorInset} />
                  <Box size={[0.26, 0.36, 0.02]} pos={[0.39, 0.34, 0.03]} mat={m.doorInset} />
                  <mesh position={[0.66, 0.58, 0.05]} material={m.knob}>
                    <sphereGeometry args={[0.04, 10, 8]} />
                  </mesh>
                </group>
                <mesh position={[PORCH_X - 0.62, SLAB + 1.15, D / 2 + 0.06]} material={m.porchLamp}>
                  <boxGeometry args={[0.12, 0.2, 0.1]} />
                </mesh>
                {/* the other units' doors (shut) */}
                {f.doors.slice(1).map((x) => {
                  const lamp = split && x > 0 ? x + 0.62 : x - 0.62;
                  return (
                    <group key={x}>
                      <Box size={[0.98, 1.36, 0.06]} pos={[x, SLAB + 0.68, D / 2 + 0.02]} mat={m.trim} />
                      <Box size={[0.78, 1.18, 0.05]} pos={[x, SLAB + 0.59, D / 2 + 0.08]} mat={m.door} />
                      <Box size={[0.26, 0.4, 0.02]} pos={[x, SLAB + 0.86, D / 2 + 0.11]} mat={m.doorInset} />
                      <Box size={[0.26, 0.36, 0.02]} pos={[x, SLAB + 0.34, D / 2 + 0.11]} mat={m.doorInset} />
                      <mesh position={[lamp, SLAB + 1.15, D / 2 + 0.06]} material={m.porchLamp}>
                        <boxGeometry args={[0.12, 0.2, 0.1]} />
                      </mesh>
                    </group>
                  );
                })}
              </group>
              {f.windows.map((w, i) => {
                const face = w.face ?? 'front';
                const pos: [number, number, number] = face === 'front' ? [w.x ?? 0, SLAB + w.y, D / 2 + 0.03] : [(face === 'right' ? 1 : -1) * (W / 2 + 0.03), SLAB + w.y, w.z ?? 0];
                return <Window key={i} m={m} glass={m.glass[i]} pos={pos} rotY={face === 'front' ? 0 : face === 'right' ? Math.PI / 2 : -Math.PI / 2} w={w.w} h={w.h} refCb={set(`open${i + 1}`)} />;
              })}

              {/* the garage: walls and a panelled door */}
              {g && gar && (
                <group ref={set('garage')} position={[gar.gx, SLAB * 0.6, gar.gz]}>
                  <Box size={[g.w, g.h, g.d]} pos={[0, g.h / 2, 0]} mat={g.side === 1 ? m.wallSide : m.wall} />
                  <Box size={[g.w - 0.5, g.h * 0.74, 0.05]} pos={[0, g.h * 0.37, g.d / 2 + 0.02]} mat={m.garageDoor} />
                  {[0.2, 0.4, 0.6].map((k) => (
                    <Box key={k} size={[g.w - 0.5, 0.03, 0.02]} pos={[0, g.h * 0.74 * k + 0.04, g.d / 2 + 0.05]} mat={m.groove} />
                  ))}
                  <Box size={[g.w - 0.36, 0.08, 0.08]} pos={[0, g.h * 0.74 + 0.04, g.d / 2 + 0.04]} mat={m.trim} />
                </group>
              )}
            </group>

            {/* the roof (HouseHandle.parts.roof): two panels hinged at the ridge, the porch roof, the chimney */}
            <group ref={set('part-roof')}>
              <group ref={set('roof0')} position={[0, RIDGE + 0.06, 0]}>
                <group rotation={[0, M.front ? Math.PI / 2 : 0, 0]}>{roof.a}</group>
              </group>
              <group ref={set('roof1')} position={[0, RIDGE + 0.06, 0]}>
                <group rotation={[0, M.front ? Math.PI / 2 : 0, 0]}>{roof.b}</group>
              </group>

              {/* chimney */}
              {chim && (
                <group ref={set('chimney')} position={[chim.x, chim.base, chim.z]}>
                  <Box size={[0.5, chim.hgt, 0.5]} pos={[0, chim.hgt / 2, 0]} mat={m.chimney} />
                  <Box size={[0.64, 0.12, 0.64]} pos={[0, chim.hgt + 0.04, 0]} mat={m.roofEdge} />
                  <group ref={set('smoke')} position={[0, chim.hgt + 0.15, 0]}>
                    {smokeMats.map((mat, i) => (
                      <mesh key={i} material={mat}>
                        <sphereGeometry args={[1, 12, 10]} />
                      </mesh>
                    ))}
                  </group>
                </group>
              )}

              {/* porch roof */}
              <group ref={set('porchRoof')}>{porch.roof}</group>

              {/* the garage's roof */}
              {g && gar && (
                <group ref={set('garageRoof')} position={[gar.gx, SLAB * 0.6 + g.h, gar.gz]}>
                  {geo.garageHip ? (
                    <group position={[0, g.rise + 0.06, 0]}>
                      <mesh geometry={geo.garageHip.geo} material={m.roofShell} castShadow receiveShadow />
                      <Box size={[geo.garageHip.x * 2, 0.12, 0.07]} pos={[0, geo.garageHip.eaveY - 0.05, geo.garageHip.z]} mat={m.trim} />
                    </group>
                  ) : (
                    (() => {
                      const pitch = Math.atan(g.rise / (g.d / 2));
                      const L = Math.hypot(g.d / 2, g.rise) + 0.3;
                      const len = g.w + 0.3;
                      return (
                        <>
                          <group position={[g.side * 0.15, g.rise + 0.06, 0]}>
                            <group rotation={[pitch, 0, 0]}>
                              <Box size={[len, 0.1, L]} pos={[0, 0, L / 2]} mat={m.roof} />
                              <Box size={[len, 0.14, 0.07]} pos={[0, -0.02, L]} mat={m.trim} />
                            </group>
                            <group rotation={[-pitch, 0, 0]}>
                              <Box size={[len, 0.1, L]} pos={[0, 0, -L / 2]} mat={m.roof} />
                            </group>
                            <Box size={[len + 0.04, 0.08, 0.14]} pos={[0, 0.04, 0]} mat={m.roofEdge} />
                          </group>
                          {geo.garageGable && <mesh geometry={geo.garageGable} material={g.side === 1 ? m.wallSide : m.wall} position={[g.side * (g.w / 2 - WALL / 2), 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow />}
                        </>
                      );
                    })()
                  )}
                </group>
              )}
            </group>
          </>
        )}

        {/* garden */}
        {f.trees.map(([x, z], i) => (
          <Tree key={i} m={m} pos={[x, 0, z]} refCb={set(`tree${i}`)} />
        ))}
        {f.house && f.bush && (
          <group ref={set('bush')} position={[-W / 2 + 0.55, 0, D / 2 + 0.55]}>
            <mesh position={[0, 0.3, 0]} material={m.bush} castShadow receiveShadow>
              <sphereGeometry args={[0.42, 16, 12]} />
            </mesh>
            <mesh position={[0.48, 0.22, 0.1]} material={m.tree} castShadow receiveShadow>
              <sphereGeometry args={[0.3, 14, 10]} />
            </mesh>
            <mesh position={[-0.45, 0.2, 0.05]} material={m.tree} castShadow receiveShadow>
              <sphereGeometry args={[0.27, 14, 10]} />
            </mesh>
          </group>
        )}
        {f.house && f.mailbox && (
          <group ref={set('mailbox')} position={[rightEdge + 0.25, 0, MAILBOX_Z]}>
            <Box size={[0.08, 0.72, 0.08]} pos={[0, 0.36, 0]} mat={m.bark} />
            <Box size={[0.26, 0.2, 0.42]} pos={[0, 0.8, 0]} mat={m.mailbox} />
            <Box size={[0.03, 0.18, 0.08]} pos={[0.15, 0.92, -0.1]} mat={m.flag} />
          </group>
        )}
      </group>

      {/* the brass key (intro) */}
      <group ref={set('key')} visible={false}>
        <group rotation={[Math.PI / 2, 0, 0]}>
          <mesh material={m.key} position={[0, 0.34, 0]} castShadow>
            <torusGeometry args={[0.13, 0.045, 10, 24]} />
          </mesh>
          <mesh material={m.key} position={[0, 0.06, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 0.42, 10]} />
          </mesh>
          <mesh material={m.key} position={[0.05, -0.08, 0]} castShadow>
            <boxGeometry args={[0.07, 0.04, 0.03]} />
          </mesh>
          <mesh material={m.key} position={[0.05, -0.02, 0]} castShadow>
            <boxGeometry args={[0.05, 0.035, 0.03]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** The main roof's two halves (roof0 drops first, roof1 a beat later), built along x with the slopes facing ±z. */
function roofParts(kind: RoofKind, len: number, span: number, rise: number, m: Mats, hip: ReturnType<typeof hipGeometry> | null, split: boolean): { a: ReactNode; b: ReactNode } {
  if (kind === 'hip' && hip) {
    const r = Math.max(0, len / 2 - span / 2);
    return {
      a: (
        <>
          <mesh geometry={hip.geo} material={m.roofShell} castShadow receiveShadow />
          <Box size={[hip.x * 2, 0.14, 0.08]} pos={[0, hip.eaveY - 0.05, hip.z]} mat={m.trim} />
          <Box size={[0.08, 0.14, hip.z * 2]} pos={[-hip.x, hip.eaveY - 0.05, 0]} mat={m.trim} />
          <Box size={[0.08, 0.14, hip.z * 2]} pos={[hip.x, hip.eaveY - 0.05, 0]} mat={m.trim} />
        </>
      ),
      b: r > 0 ? <Box size={[2 * r + 0.14, 0.08, 0.14]} pos={[0, 0.0, 0]} mat={m.roofEdge} /> : null,
    };
  }
  if (kind === 'gambrel') {
    const k = gambrelKnee(span, rise);
    // the outline from the pivot (ridge + 0.06), each panel lifted by half its thickness onto it
    const lo = slope([span / 2, -rise], [k.z, k.y - rise], 0.3, 0.06);
    const up = slope([k.z, k.y - rise], [0, 0], 0.04, 0.05);
    const side = (s: 1 | -1, fascia: boolean) => (
      <>
        <group position={[0, lo.pos[1], s * lo.pos[2]]} rotation={[s * lo.rotX, 0, 0]}>
          <Box size={[len + 0.5, 0.12, lo.len]} pos={[0, 0, 0]} mat={m.roof} />
        </group>
        <group position={[0, up.pos[1], s * up.pos[2]]} rotation={[s * up.rotX, 0, 0]}>
          <Box size={[len + 0.5, 0.12, up.len]} pos={[0, 0, 0]} mat={m.roof} />
        </group>
        {fascia && <Box size={[len + 0.5, 0.16, 0.08]} pos={[0, lo.a[1] - 0.02, s * lo.a[0]]} mat={m.trim} />}
      </>
    );
    return { a: side(1, true), b: <>{side(-1, false)}<Box size={[len + 0.56, 0.1, 0.16]} pos={[0, 0.05, 0]} mat={m.roofEdge} /></> };
  }
  // gable (the family's: rise 1.16 over a 3.2 span)
  const PITCH = Math.atan(rise / (span / 2));
  const ROOF_L = Math.hypot(span / 2, rise) + 0.36;
  const divide = (s: 1 | -1) => split && <Box size={[0.14, 0.18, ROOF_L - 0.3]} pos={[0, 0.03, (s * (ROOF_L - 0.3)) / 2]} mat={m.roofEdge} />;
  return {
    a: (
      <group rotation={[PITCH, 0, 0]}>
        <Box size={[len + 0.6, 0.12, ROOF_L]} pos={[0, 0, ROOF_L / 2]} mat={m.roof} />
        <Box size={[len + 0.6, 0.16, 0.08]} pos={[0, -0.02, ROOF_L]} mat={m.trim} />
        {divide(1)}
      </group>
    ),
    b: (
      <>
        <group rotation={[-PITCH, 0, 0]}>
          <Box size={[len + 0.6, 0.12, ROOF_L]} pos={[0, 0, -ROOF_L / 2]} mat={m.roof} />
          {divide(-1)}
        </group>
        <Box size={[len + 0.66, 0.1, 0.16]} pos={[0, 0.05, 0]} mat={m.roofEdge} />
      </>
    ),
  };
}

/** The porch: its floor and step (foundation), its posts (walls) and its roof. */
function porchParts(f: HouseForm, M: ReturnType<typeof measures>, m: Mats): { deck: ReactNode; posts: { x: number; z: number; h: number }[]; roof: ReactNode } {
  const { D, H, doorX } = M;
  if (f.porch === 'gable') {
    // the family's porch: posts, beam, and a small front gable roof
    const PORCH_X = doorX;
    return {
      deck: (
        <>
          <Box size={[2.3, SLAB, 1.2]} pos={[PORCH_X, SLAB / 2, D / 2 + 0.6]} mat={m.slab} />
          <Box size={[1.0, 0.09, 0.36]} pos={[PORCH_X, 0.045, D / 2 + 1.38]} mat={m.stone} />
        </>
      ),
      posts: [PORCH_X - 1.0, PORCH_X + 1.0].map((x) => ({ x, z: D / 2 + 1.08, h: 1.3 })),
      roof: (
        <>
          <Box size={[2.3, 0.16, 0.16]} pos={[PORCH_X, SLAB + 1.32, D / 2 + 1.08]} mat={m.trim} />
          <group position={[PORCH_X, SLAB + 1.95, D / 2 + 0.66]}>
            <group rotation={[0, 0, Math.atan(0.55 / 1.25)]}>
              <Box size={[1.55, 0.1, 1.5]} pos={[-0.72, 0, 0]} mat={m.roof} />
            </group>
            <group rotation={[0, 0, -Math.atan(0.55 / 1.25)]}>
              <Box size={[1.55, 0.1, 1.5]} pos={[0.72, 0, 0]} mat={m.roof} />
            </group>
          </group>
          <PorchGable m={m} pos={[PORCH_X, SLAB + 1.4, D / 2 + 1.38]} />
        </>
      ),
    };
  }
  if (f.porch === 'shed') {
    // a lean-to porch roof on posts, from the wall down to a beam
    const pw = Math.min(f.porchW, f.w);
    const pd = f.porchD;
    const cx = pw >= f.w - 0.01 ? 0 : Math.min(Math.max(doorX, -f.w / 2 + pw / 2), f.w / 2 - pw / 2);
    // a single storey with its eave over the porch: the porch roof tucks under the main roof and runs out
    // below the eave at a gentler pitch; otherwise it leans on the wall at first-floor height
    const tuck = H < 2.2 && !M.front;
    const yWall = tuck ? M.TOP - 0.02 : SLAB + Math.min(H - 0.08, 1.95);
    const yBeam = yWall - (tuck ? 0.44 : 0.34);
    const zPost = D / 2 + pd - 0.12;
    const n = Math.max(2, Math.round(pw / 1.5) + 1);
    const posts = Array.from({ length: n }, (_, i) => ({ x: cx - pw / 2 + 0.12 + ((pw - 0.24) * i) / (n - 1), z: zPost, h: yBeam - 0.14 - SLAB }));
    const s = slope([D / 2 - (tuck ? 0.5 : 0.04), yWall], [zPost + 0.3, yBeam - 0.02], 0, 0);
    return {
      deck: (
        <>
          <Box size={[pw, SLAB, pd]} pos={[cx, SLAB / 2, D / 2 + pd / 2]} mat={m.slab} />
          <Box size={[1.0, 0.09, 0.36]} pos={[doorX, 0.045, D / 2 + pd + 0.18]} mat={m.stone} />
        </>
      ),
      posts,
      roof: (
        <>
          <Box size={[pw, 0.14, 0.14]} pos={[cx, yBeam - 0.07, zPost]} mat={m.trim} />
          <group position={[cx, s.pos[1] + 0.05, s.pos[2]]} rotation={[s.rotX, 0, 0]}>
            <Box size={[pw + 0.24, 0.1, s.len]} pos={[0, 0, 0]} mat={m.roof} />
          </group>
          <Box size={[pw + 0.24, 0.14, 0.07]} pos={[cx, s.b[1] + 0.02, s.b[0]]} mat={m.trim} />
        </>
      ),
    };
  }
  if (f.porch === 'stoop') {
    // a stoop and a small hood on brackets over each door
    const hood = slope([D / 2 - 0.04, SLAB + 1.68], [D / 2 + 0.66, SLAB + 1.5], 0, 0);
    return {
      deck: (
        <>
          {f.doors.map((x) => (
            <group key={x}>
              <Box size={[1.3, SLAB, 0.62]} pos={[x, SLAB / 2, D / 2 + 0.31]} mat={m.slab} />
              <Box size={[1.0, 0.09, 0.36]} pos={[x, 0.045, D / 2 + 0.62 + 0.18]} mat={m.stone} />
            </group>
          ))}
        </>
      ),
      posts: [],
      roof: (
        <>
          {f.doors.map((x) => (
            <group key={x}>
              <group position={[x, hood.pos[1] + 0.04, hood.pos[2]]} rotation={[hood.rotX, 0, 0]}>
                <Box size={[1.3, 0.08, hood.len]} pos={[0, 0, 0]} mat={m.roof} />
              </group>
              <Box size={[1.3, 0.1, 0.06]} pos={[x, hood.b[1] + 0.02, hood.b[0]]} mat={m.trim} />
              {[-0.55, 0.55].map((dx) => (
                <Box key={dx} size={[0.07, 0.3, 0.3]} pos={[x + dx, SLAB + 1.46, D / 2 + 0.15]} mat={m.trim} />
              ))}
            </group>
          ))}
        </>
      ),
    };
  }
  return { deck: <Box size={[1.0, 0.09, 0.36]} pos={[doorX, 0.045, D / 2 + 0.18]} mat={m.stone} />, posts: [], roof: null };
}

/** The family porch's gable trim (its geometry made once). */
function PorchGable({ m, pos }: { m: Mats; pos: [number, number, number] }) {
  const g = useMemo(() => triangle(2.5, 0.55, 0.08), []);
  return <mesh geometry={g} material={m.trim} position={pos} castShadow />;
}

/**
 * Sun + sky. `sun` 0 = clear afternoon, 1 = golden hour (lower, warmer, longer shadows). `night` (dark theme)
 * turns the sun into a cool moon from the same top-left direction, drops the sky light to a blue-grey, and
 * lights a warm lamp at the porch so the windows' glow reads on the walls and the path. Both tween (~600ms).
 */
export function Lights({ ctl }: { ctl: HouseHandle }) {
  const dir = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const lamp = useRef<THREE.PointLight>(null);
  // the porch lamp's light, at the main door (the family's: 0.95, 1.58, 3.5)
  const lampAt = useMemo<[number, number, number]>(() => {
    const f = houseForm(ctl.variant ?? 0);
    return [f.doors[0] ?? 0, SLAB + 1.4, f.d / 2 + 1.9];
  }, [ctl.variant]);
  const cur = useRef(ctl.state.sun);
  const curN = useRef(ctl.state.night ?? 0);
  const { invalidate } = useThree();
  const cA = useMemo(() => new THREE.Color('#FFFBF6'), []);
  const cB = useMemo(() => new THREE.Color('#FFD08A'), []);
  const moon = useMemo(() => new THREE.Color('#C6D0E4'), []);
  const skyD = useMemo(() => new THREE.Color('#EEF4F7'), []);
  const skyN = useMemo(() => new THREE.Color('#7F92B4'), []);
  const gndD = useMemo(() => new THREE.Color('#B9C9AE'), []);
  const gndN = useMemo(() => new THREE.Color('#26332B'), []);
  const tmp = useMemo(() => new THREE.Color(), []);
  const dusky = useMemo(() => new THREE.Color('#FFB27A'), []);
  const twilight = useMemo(() => new THREE.Color('#3A4F6B'), []);
  useFrame((_, delta) => {
    const target = ctl.state.sun;
    const v = cur.current + (target - cur.current) * Math.min(1, delta * 2.5);
    cur.current = Math.abs(v - target) < 0.002 ? target : v;
    const nt = ctl.state.night ?? 0;
    const w = curN.current + (nt - curN.current) * Math.min(1, delta * 5);
    curN.current = Math.abs(w - nt) < 0.003 ? nt : w;
    const s = cur.current * (1 - curN.current);
    const n = curN.current;
    // the intro film: the light follows the action (the arch, then the house) and starts at dusk
    const f = ctl.film;
    const dusk = f?.dusk ?? 0;
    if (dir.current) {
      // afternoon: high and from the front-left; golden hour: lower and warmer (longer shadows); night: the moon
      const fx = f?.focus.x ?? 0;
      const fz = f?.focus.z ?? 0;
      dir.current.position.set(fx - 5.5 - 1.5 * s, 11 - 4.5 * s + 1.5 * n, fz + 9 - 1.5 * s);
      if (dir.current.target.position.x !== fx || dir.current.target.position.z !== fz) {
        dir.current.target.position.set(fx, 0, fz);
        dir.current.target.updateMatrixWorld();
      }
      dir.current.color.copy(tmp.copy(cA).lerp(cB, s).lerp(moon, n)).lerp(dusky, 0.55 * dusk * (1 - n));
      dir.current.intensity = ((3.25 - 0.25 * s) * (1 - n) + 1.2 * n) * (1 - 0.5 * dusk);
    }
    if (hemi.current) {
      hemi.current.intensity = ((1.85 - 0.3 * s) * (1 - n) + 0.85 * n) * (1 - 0.55 * dusk);
      hemi.current.color.copy(tmp.copy(skyD).lerp(skyN, n)).lerp(twilight, 0.6 * dusk);
      hemi.current.groundColor.copy(tmp.copy(gndD).lerp(gndN, n));
    }
    if (lamp.current) lamp.current.intensity = 5 * n;
    if (cur.current !== target || curN.current !== nt) invalidate();
  });
  return (
    <>
      <pointLight ref={lamp} color="#FFC56E" intensity={0} distance={6} decay={1.8} position={lampAt} />
      <hemisphereLight ref={hemi} args={['#EEF4F7', '#B9C9AE', 1.85]} />
      <directionalLight
        ref={dir}
        castShadow
        position={[-5.5, 11, 9]}
        intensity={3.25}
        shadow-mapSize={[2048, 2048]}
        shadow-radius={6}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
      />
    </>
  );
}
