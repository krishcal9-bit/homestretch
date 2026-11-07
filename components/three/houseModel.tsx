'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { P } from '@/lib/illustrationPalette';

/**
 * The Homestretch house: a stylized two-story craftsman with a front porch gable, built from primitives.
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
};

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
const W = 4.2;
const D = 3.2;
const H = 2.7;
const SLAB = 0.18;
const WALL = 0.14;
const TOP = SLAB + H; // 2.88
const PITCH = Math.atan(1.16 / (D / 2));
const RIDGE = TOP + 1.16;
const ROOF_L = Math.hypot(D / 2, 1.16) + 0.36;
const PORCH_X = 0.95;
const PLINTH = { w: 8.4, d: 7.8, z: 0.7, lawn: 0.14, base: 0.42 };

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

type Mats = ReturnType<typeof useMaterials>;
function useMaterials() {
  return useMemo(() => {
    const std = (color: string, roughness = 0.9, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
    const glass = () => std(P.glass, 0.35, { emissive: new THREE.Color(P.honey), emissiveIntensity: 0 });
    return {
      lawn: std(P.sage, 0.95),
      soil: std(P.soil, 1),
      slab: std(P.stoneShade, 0.95),
      wall: std(P.wall, 0.88),
      wallSide: std(P.wall, 0.92),
      trim: std(P.trim, 0.7),
      roof: std(P.slate, 0.78),
      roofEdge: std(P.slateDark, 0.8),
      chimney: std(P.stoneShade, 0.95),
      door: std(P.brass, 0.55, { metalness: 0.15 }),
      doorInset: std(P.brassDark, 0.6, { metalness: 0.1 }),
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
      glass: [glass(), glass(), glass(), glass(), glass()],
    };
  }, []);
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
};

/** Mutable controller shared between the scene and its React wrapper (no re-renders). */
export function makeHouseController(build: HouseBuild, state: HouseState): HouseHandle {
  return { start: null, build, state, key: build === 'intro' };
}

export function House({ ctl, onBuilt }: { ctl: HouseHandle; onBuilt?: () => void }) {
  const m = useMaterials();
  const { clock, invalidate } = useThree();
  const geo = useMemo(
    () => ({
      plinthLawn: roundedSlab(PLINTH.w, PLINTH.d, PLINTH.lawn, 0.7),
      plinthBase: roundedSlab(PLINTH.w - 0.1, PLINTH.d - 0.1, PLINTH.base, 0.7),
      gable: triangle(D, 1.16, WALL),
      porchGable: triangle(2.5, 0.55, 0.08),
      grid: gridTexture(),
      shadow: softShadowTexture(),
    }),
    [],
  );
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
  const glassI = useRef([0, 0, 0, 0, 0]);
  const porchI = useRef(0);
  const smokeT = useRef(0);
  const built = useRef(false);

  // make everything visible in its final state when there's no build
  useEffect(() => invalidate(), [invalidate]);

  useFrame((_, delta) => {
    const R = r.current;
    const b = ctl.build;
    let moving = false;
    if (ctl.start === null) ctl.start = clock.elapsedTime;
    const raw = clock.elapsedTime - ctl.start;
    // map real time to intro-timeline time
    let t: number;
    if (b === 'none') t = 99;
    else if (b === 'intro') t = raw;
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
    ['post0', 'post1'].forEach((k, i) => {
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
    if (R.chimney) {
      const s = spring(prog(t, TL.chimney, 0.42), 0.5);
      R.chimney.scale.set(Math.max(0.0001, s), Math.max(0.0001, s), Math.max(0.0001, s));
      R.chimney.visible = s > 0.001;
    }
    // windows and the door slot in from the front (40ms apart)
    for (let i = 0; i < 7; i++) {
      const o = R[`open${i}`];
      if (!o) continue;
      const s = spring(prog(t, TL.openings + i * 0.04, 0.34), 0.8);
      o.position.z = 0.5 * (1 - s);
      o.scale.setScalar(0.85 + 0.15 * s);
      o.visible = s > 0.001;
    }
    for (let i = 0; i < 3; i++) {
      const o = R[`paver${i}`];
      if (!o) continue;
      const s = spring(prog(t, TL.path + i * 0.05, 0.3), 0.8);
      o.scale.set(Math.max(0.0001, s), 1, Math.max(0.0001, s));
      o.visible = s > 0.001;
    }
    // trees grow with a springy overshoot; leaves sway a beat after they land, then settle
    TL.trees.forEach((at, i) => {
      const o = R[`tree${i}`];
      if (!o) return;
      const p = prog(t, at, 0.6);
      const s = spring(p, 0.45);
      const base = i === 0 ? 1 : 0.78;
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
    const introLit = intro && t >= TL.firstLight ? 1 : 0;
    const want = Math.max(st.lit, introLit);
    for (let i = 0; i < 5; i++) {
      const target = i < want ? 1.35 : 0;
      const cur = glassI.current[i];
      const next = cur + (target - cur) * Math.min(1, delta * 7);
      glassI.current[i] = Math.abs(next - target) < 0.004 ? target : next;
      m.glass[i].emissiveIntensity = glassI.current[i];
      if (glassI.current[i] !== target) moving = true;
    }
    const porchTarget = st.porch || (intro && t >= TL.door) ? 2.2 : 0;
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
      m.spill.opacity = 0.42 * easeOut(prog(t, TL.door + 0.04, 0.35)) * doorTarget;
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
        c.position.set(Math.sin(ph * Math.PI * 2 + i * 1.7) * 0.12 + ph * 0.3, ph * 1.15, -ph * 0.08);
        c.scale.setScalar(0.1 + ph * 0.26);
        ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = (on ? 1 : 0) * 0.32 * Math.sin(ph * Math.PI) * clamp01((t - TL.smoke) * 2 + (intro ? 0 : 1));
      });
    }

    if (!built.current && t >= (intro ? TL.end : BUILD_TO)) {
      built.current = true;
      onBuilt?.();
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
  return (
    <group>
      {/* soft shadow the whole model casts on the page */}
      <mesh position={[0, -PLINTH.base - 0.36, PLINTH.z + 0.25]} rotation={[-Math.PI / 2, 0, 0]} material={m.shadow} renderOrder={-1}>
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
        {/* lawn plinth: sage top on a soil base */}
        <mesh geometry={geo.plinthBase} material={m.soil} position={[0, -PLINTH.base - 0.26, PLINTH.z]} receiveShadow />
        <mesh geometry={geo.plinthLawn} material={m.lawn} position={[0, -PLINTH.lawn - 0.06, PLINTH.z]} receiveShadow />

        {/* path to the porch */}
        {[0, 1, 2].map((i) => (
          <group key={i} ref={set(`paver${i}`)} position={[PORCH_X, 0.02, D / 2 + 1.75 + i * 0.62]}>
            <Box size={[0.78, 0.05, 0.48]} pos={[0, 0, 0]} mat={m.stone} />
          </group>
        ))}

        {/* baked contact shadow where the house meets the lawn */}
        <mesh position={[PORCH_X * 0.3, 0.004, 0.35]} rotation={[-Math.PI / 2, 0, 0]} material={m.shadow} renderOrder={1}>
          <planeGeometry args={[W + 1.6, D + 2.4]} />
        </mesh>
        <group ref={set('slab')}>
          <Box size={[W + 0.2, SLAB, D + 0.2]} pos={[0, SLAB / 2, 0]} mat={m.slab} />
        </group>
        <group ref={set('deck')}>
          <Box size={[2.3, SLAB, 1.2]} pos={[PORCH_X, SLAB / 2, D / 2 + 0.6]} mat={m.slab} />
          <Box size={[1.0, 0.09, 0.36]} pos={[PORCH_X, 0.045, D / 2 + 1.38]} mat={m.stone} />
        </group>

        {/* walls (scale up from the slab) */}
        {wallParts.map((w) => (
          <group key={w.k} ref={set(w.k)} position={[0, SLAB, 0]}>
            <Box size={w.size} pos={[w.pos[0], H / 2, w.pos[2]]} mat={w.k === 'wall2' ? m.wallSide : m.wall} />
          </group>
        ))}
        {/* gable ends */}
        <group ref={set('gableL')} position={[-W / 2 + WALL / 2, TOP, 0]}>
          <mesh geometry={geo.gable} material={m.wall} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow />
        </group>
        <group ref={set('gableR')} position={[W / 2 - WALL / 2, TOP, 0]}>
          <mesh geometry={geo.gable} material={m.wallSide} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow />
        </group>

        {/* roof: two panels hinged at the ridge */}
        <group ref={set('roof0')} position={[0, RIDGE + 0.06, 0]}>
          <group rotation={[PITCH, 0, 0]}>
            <Box size={[W + 0.6, 0.12, ROOF_L]} pos={[0, 0, ROOF_L / 2]} mat={m.roof} />
            <Box size={[W + 0.6, 0.16, 0.08]} pos={[0, -0.02, ROOF_L]} mat={m.trim} />
          </group>
        </group>
        <group ref={set('roof1')} position={[0, RIDGE + 0.06, 0]}>
          <group rotation={[-PITCH, 0, 0]}>
            <Box size={[W + 0.6, 0.12, ROOF_L]} pos={[0, 0, -ROOF_L / 2]} mat={m.roof} />
          </group>
          <Box size={[W + 0.66, 0.1, 0.16]} pos={[0, 0.05, 0]} mat={m.roofEdge} />
        </group>

        {/* chimney */}
        <group ref={set('chimney')} position={[-1.35, RIDGE - 0.9, -0.75]}>
          <Box size={[0.5, 1.9, 0.5]} pos={[0, 0.95, 0]} mat={m.chimney} />
          <Box size={[0.64, 0.12, 0.64]} pos={[0, 1.94, 0]} mat={m.roofEdge} />
          <group ref={set('smoke')} position={[0, 2.05, 0]}>
            {smokeMats.map((mat, i) => (
              <mesh key={i} material={mat}>
                <sphereGeometry args={[1, 12, 10]} />
              </mesh>
            ))}
          </group>
        </group>

        {/* porch: posts, beam, and a small front gable roof */}
        {[-0.05, 1.95].map((x, i) => (
          <group key={i} ref={set(`post${i}`)} position={[x, SLAB, D / 2 + 1.08]}>
            <Box size={[0.14, 1.3, 0.14]} pos={[0, 0.65, 0]} mat={m.trim} />
          </group>
        ))}
        <group ref={set('porchRoof')}>
          <Box size={[2.3, 0.16, 0.16]} pos={[PORCH_X, SLAB + 1.32, D / 2 + 1.08]} mat={m.trim} />
          <group position={[PORCH_X, SLAB + 1.95, D / 2 + 0.66]}>
            <group rotation={[0, 0, Math.atan(0.55 / 1.25)]}>
              <Box size={[1.55, 0.1, 1.5]} pos={[-0.72, 0, 0]} mat={m.roof} />
            </group>
            <group rotation={[0, 0, -Math.atan(0.55 / 1.25)]}>
              <Box size={[1.55, 0.1, 1.5]} pos={[0.72, 0, 0]} mat={m.roof} />
            </group>
          </group>
          <mesh geometry={geo.porchGable} material={m.trim} position={[PORCH_X, SLAB + 1.4, D / 2 + 1.38]} castShadow />
        </group>

        {/* openings: door + windows (slot in) */}
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
        </group>
        {/* light spilling onto the porch when the door opens */}
        <mesh position={[PORCH_X + 0.05, SLAB + 0.01, D / 2 + 0.75]} rotation={[-Math.PI / 2, 0, 0]} material={m.spill} renderOrder={4}>
          <planeGeometry args={[0.95, 1.3]} />
        </mesh>
        <Window m={m} glass={m.glass[0]} pos={[-1.15, SLAB + 0.95, D / 2 + 0.03]} refCb={set('open1')} />
        <Window m={m} glass={m.glass[1]} pos={[-1.15, SLAB + 2.15, D / 2 + 0.03]} h={0.78} refCb={set('open2')} />
        <Window m={m} glass={m.glass[2]} pos={[1.2, SLAB + 2.15, D / 2 + 0.03]} h={0.78} refCb={set('open3')} />
        <Window m={m} glass={m.glass[3]} pos={[W / 2 + 0.03, SLAB + 0.95, 0.15]} rotY={Math.PI / 2} refCb={set('open4')} />
        <Window m={m} glass={m.glass[4]} pos={[W / 2 + 0.03, SLAB + 2.15, 0.15]} rotY={Math.PI / 2} h={0.78} refCb={set('open5')} />

        {/* garden */}
        <Tree m={m} pos={[-3.15, 0, 0.35]} refCb={set('tree0')} />
        <Tree m={m} pos={[3.05, 0, -2.25]} s={0.78} refCb={set('tree1')} />
        <group ref={set('bush')} position={[-1.55, 0, D / 2 + 0.55]}>
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
        <group ref={set('mailbox')} position={[2.35, 0, D / 2 + 2.9]}>
          <Box size={[0.08, 0.72, 0.08]} pos={[0, 0.36, 0]} mat={m.bark} />
          <Box size={[0.26, 0.2, 0.42]} pos={[0, 0.8, 0]} mat={m.mailbox} />
          <Box size={[0.03, 0.18, 0.08]} pos={[0.15, 0.92, -0.1]} mat={m.flag} />
        </group>
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

/** Sun + sky. `sun` 0 = clear afternoon, 1 = golden hour (lower, warmer, longer shadows). */
export function Lights({ ctl }: { ctl: HouseHandle }) {
  const dir = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const cur = useRef(ctl.state.sun);
  const { invalidate } = useThree();
  const cA = useMemo(() => new THREE.Color('#FFFBF6'), []);
  const cB = useMemo(() => new THREE.Color('#FFD08A'), []);
  const tmp = useMemo(() => new THREE.Color(), []);
  useFrame((_, delta) => {
    const target = ctl.state.sun;
    const v = cur.current + (target - cur.current) * Math.min(1, delta * 2.5);
    cur.current = Math.abs(v - target) < 0.002 ? target : v;
    const s = cur.current;
    if (dir.current) {
      // afternoon: high and from the front-left; golden hour: lower and warmer (longer shadows)
      dir.current.position.set(-5.5 - 1.5 * s, 11 - 4.5 * s, 9 - 1.5 * s);
      dir.current.color.copy(tmp.copy(cA).lerp(cB, s));
      dir.current.intensity = 3.25 - 0.25 * s;
    }
    if (hemi.current) hemi.current.intensity = 1.85 - 0.3 * s;
    if (cur.current !== target) invalidate();
  });
  return (
    <>
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
