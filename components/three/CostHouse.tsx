'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import type { MotionValue } from 'motion/react';
import * as THREE from 'three';
import { House, Lights, makeHouseController, type HouseHandle, type HouseState } from './houseModel';
import { FOV, fitDistance, placeCamera } from './HouseScene';
import { PX } from '@/lib/illustrationPalette';

/**
 * The landing's "cost of keeping a home" house: the featured home taken apart into what a family pays for, on a
 * clock (`t`, seconds since the sequence started; COST_END = finished). It turns to a three-quarter view, then the
 * layers separate one at a time on a no-bounce spring, 600ms apart: foundation (mortgage), walls (property tax),
 * roof (insurance), the utility box (utilities), the toolbox (repairs). The roof glows amber with one pulse. Once
 * finished it holds, exploded, every layer floating a few pixels, slowly and out of phase (the one ambient motion).
 * Every frame it projects each part's anchor to the screen and places its label and leader line (DOM refs).
 */
export type CostPart = 'mortgage' | 'tax' | 'insurance' | 'utilities' | 'repairs';
/** in the order the layers separate */
export const COST_PARTS: CostPart[] = ['mortgage', 'tax', 'insurance', 'utilities', 'repairs'];
/** label columns: the lower layers on the left, the upper ones on the right */
export const COST_SIDE: Record<CostPart, -1 | 1> = { mortgage: -1, repairs: -1, insurance: 1, tax: 1, utilities: 1 };
/** when each layer starts to lift (s) */
export const COST_AT: Record<CostPart, number> = { mortgage: 0.6, tax: 1.2, insurance: 1.8, utilities: 2.4, repairs: 3.0 };
export const COST_GLOW = 3.8;
export const COST_END = 4.6;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** a critically damped spring from 0 to 1 (no bounce), `s` seconds after its start */
const lift = (s: number) => (s <= 0 ? 0 : 1 - (1 + 9 * s) * Math.exp(-9 * s));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
/** The sequence at time t: shared with the DOM overlay (labels, caption). */
export function costAt(t: number) {
  const L = (k: CostPart) => lift(t - COST_AT[k]);
  const pulse = Math.exp(-Math.pow((t - 4.25) / 0.14, 2));
  return {
    turn: easeOut(t / 0.6),
    foundation: L('mortgage'),
    walls: L('tax'),
    roof: L('insurance'),
    utilities: L('utilities'),
    repairs: L('repairs'),
    /** a label's arrival (slide in + number) and its leader line's draw, 0…1 */
    label: (k: CostPart) => clamp01((t - COST_AT[k] - 0.12) / 0.35),
    line: (k: CostPart) => clamp01((t - COST_AT[k] - 0.05) / 0.45),
    glow: Math.min(1, 0.55 * easeOut((t - COST_GLOW) / 0.3) + 0.45 * pulse),
    caption: easeOut((t - COST_GLOW) / 0.6),
  };
}

// house dimensions (houseModel.tsx): width 4.2, depth 3.2, wall top 2.88, ridge 4.04; plinth 8.4 × 7.8
const HW = 2.1;
const HD = 1.6;
const RIDGE = 4.04;
/** fully apart: how far each layer travels (world units) */
const APART = { foundation: -0.5, walls: 0.55, roof: 1.95 };

export type CostRefs = {
  labels: MutableRefObject<(HTMLDivElement | null)[]>;
  slides: MutableRefObject<(HTMLDivElement | null)[]>;
  lines: MutableRefObject<(SVGLineElement | null)[]>;
  dots: MutableRefObject<(SVGCircleElement | null)[]>;
};
/** the reading layout the overlay reserves: px kept free above and below the house, and each label column's width */
export type CostFrame = { top: number; bottom: number; col: number; margin: number; list: boolean };

function Rig({ t, ctl, refs, frame, floating }: { t: MotionValue<number>; ctl: HouseHandle; refs: CostRefs; frame: MutableRefObject<CostFrame>; floating: boolean }) {
  const { invalidate } = useThree();
  const util = useRef<THREE.Group>(null);
  const tool = useRef<THREE.Group>(null);
  const v = useMemo(() => new THREE.Vector3(), []);
  const t0 = useRef(performance.now());
  useEffect(() => t.on('change', () => invalidate()), [t, invalidate]);
  useFrame((st) => {
    const cam = st.camera as THREE.PerspectiveCamera;
    const { width: W, height: H } = st.size;
    const s = costAt(t.get());
    // the one ambient motion once finished: each layer floats 2–3px, slowly, a little out of phase
    const ft = (performance.now() - t0.current) / 1000;
    const fl = (ph: number) => (floating ? 0.028 * Math.sin((ft / 3.6) * Math.PI * 2 + ph) : 0);
    const fy = APART.foundation * s.foundation + fl(0);
    const wy = APART.walls * s.walls + fl(1.3);
    const ry = APART.roof * s.roof + fl(2.6);
    ctl.parts = { foundation: [0, fy, 0], walls: [0, wy, 0], roof: [0, ry, 0] };
    ctl.roofGlow = s.glow;
    const u = s.utilities;
    const ux = HW + 0.09 + 1.35 * u;
    const uy = 1.05 + wy + 0.35 * u + fl(3.9);
    if (util.current) util.current.position.set(ux, uy, 0.35);
    const r = s.repairs;
    const tx = -2.55 - 1.0 * r;
    const ty = 0.02 + 0.5 * r + fl(5.2);
    const tz = 2.5 + 0.7 * r;
    if (tool.current) {
      tool.current.position.set(tx, ty, tz);
      tool.current.rotation.y = 0.35 - 0.25 * r;
    }

    // the camera: a three-quarter view, the house centred in the band the copy leaves free
    const f = frame.current;
    const aspect = W / H;
    const bandH = Math.max(120, H - f.top - f.bottom);
    const free = f.list ? W : Math.max(200, W - 2 * (f.col + f.margin + 24));
    const ext = { w: 10.4 * (W / free), h: 10.4 * (H / bandH) };
    cam.fov = FOV;
    cam.aspect = aspect;
    const shiftY = (f.top - f.bottom) / 2; // band centre below the canvas centre
    cam.setViewOffset(W, H, 0, -shiftY, W, H);
    cam.updateProjectionMatrix();
    placeCamera(cam, { az: 12 + 20 * s.turn, el: 18, dist: fitDistance(aspect, FOV, ext), target: [0, 2.3, 0.6] });

    // labels (desktop): project each anchor, place its label in its column at that height, keep the columns
    // apart, draw the leader line toward the anchor as the label arrives
    if (f.list) return;
    const anchors: Record<CostPart, [number, number, number]> = {
      insurance: [1.15, RIDGE - 0.45 + ry, 0.35],
      tax: [HW, 1.55 + wy, 0.9],
      utilities: [ux + 0.1, uy + 0.1, 0.35],
      mortgage: [-HW - 0.7, -0.1 + fy, HD + 1.2],
      repairs: [tx - 0.35, ty + 0.35, tz],
    };
    const lo = f.top + 8;
    const hi = H - f.bottom - 8;
    const items = COST_PARTS.map((k, i) => {
      v.set(...anchors[k]).project(cam);
      const el = refs.labels.current[i];
      const lw = el?.offsetWidth ?? 0;
      const lh = el?.offsetHeight ?? 0;
      const ax = ((v.x + 1) / 2) * W;
      const ay = ((1 - v.y) / 2) * H;
      return { k, i, el, lw, lh, ax, ay, side: COST_SIDE[k], ly: Math.max(lo, Math.min(hi - lh, ay - lh / 2)) };
    });
    for (const side of [-1, 1] as const) {
      const col = items.filter((it) => it.side === side).sort((a, b) => a.ly - b.ly);
      for (let j = 1; j < col.length; j++) col[j].ly = Math.max(col[j].ly, col[j - 1].ly + col[j - 1].lh + 14);
      const last = col[col.length - 1];
      if (last && last.ly + last.lh > hi) {
        const over = last.ly + last.lh - hi;
        col.forEach((it) => (it.ly = Math.max(lo, it.ly - over)));
      }
    }
    for (const it of items) {
      const { el, k, lw, lh, ax, ay, side, ly, i } = it;
      if (!el) continue;
      const a = s.label(k);
      const lx = side < 0 ? f.margin : W - f.margin - lw;
      el.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
      el.style.opacity = a.toFixed(3);
      const slide = refs.slides.current[i];
      if (slide) slide.style.transform = `translate3d(${(side * 14 * (1 - a)).toFixed(1)}px, 0, 0)`;
      const line = refs.lines.current[i];
      const dot = refs.dots.current[i];
      const d = s.line(k);
      const ex = side < 0 ? lx + lw + 10 : lx - 10;
      const ey = ly + lh / 2;
      if (line) {
        // the line draws from the anchor out to its label
        line.setAttribute('x1', ax.toFixed(1));
        line.setAttribute('y1', ay.toFixed(1));
        line.setAttribute('x2', (ax + (ex - ax) * d).toFixed(1));
        line.setAttribute('y2', (ay + (ey - ay) * d).toFixed(1));
        line.style.opacity = d > 0 ? '1' : '0';
      }
      if (dot) {
        dot.setAttribute('cx', ax.toFixed(1));
        dot.setAttribute('cy', ay.toFixed(1));
        dot.style.opacity = d > 0 ? '1' : '0';
      }
    }
  });
  // keep drawing while floating
  useFrame(() => {
    if (floating) invalidate();
  });
  return (
    <>
      {/* the utility box on the right wall: meter housing, the meter's dial, the door seam */}
      <group ref={util}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.16, 0.72, 0.5]} />
          <meshStandardMaterial color={PX.stoneShade} roughness={0.6} />
        </mesh>
        <mesh position={[0.085, 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 0.02, 20]} />
          <meshStandardMaterial color={PX.glass} roughness={0.3} />
        </mesh>
        <mesh position={[0.084, -0.2, 0]}>
          <boxGeometry args={[0.01, 0.2, 0.36]} />
          <meshStandardMaterial color={PX.slate} roughness={0.7} />
        </mesh>
      </group>
      {/* the toolbox on the front lawn: body, lid, a brass handle */}
      <group ref={tool}>
        <mesh position={[0, 0.17, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.78, 0.32, 0.36]} />
          <meshStandardMaterial color={PX.pine} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.36, 0]} castShadow>
          <boxGeometry args={[0.8, 0.08, 0.38]} />
          <meshStandardMaterial color={PX.pineLight} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.47, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <torusGeometry args={[0.09, 0.022, 8, 16, Math.PI]} />
          <meshStandardMaterial color={PX.brass} roughness={0.35} metalness={0.5} />
        </mesh>
      </group>
    </>
  );
}

function Sync({ ctl, state }: { ctl: HouseHandle; state: HouseState }) {
  const { invalidate } = useThree();
  useEffect(() => {
    ctl.state = state;
    invalidate();
  }, [ctl, state, invalidate]);
  return null;
}

/** The light leans toward the cursor (fine pointers): a few degrees, eased; shadows follow. */
function useCursorLight(active: boolean) {
  const want = useRef({ x: 0, y: 0 });
  const cur = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (!active || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const on = (e: PointerEvent) => {
      want.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 };
    };
    window.addEventListener('pointermove', on, { passive: true });
    return () => window.removeEventListener('pointermove', on);
  }, [active]);
  return { want, cur };
}
function CursorLight({ light, ctl }: { light: ReturnType<typeof useCursorLight>; ctl: HouseHandle }) {
  const { invalidate } = useThree();
  useFrame((_, dt) => {
    const k = Math.min(1, dt * 3);
    const c = light.cur.current;
    const w = light.want.current;
    c.x += (w.x - c.x) * k;
    c.y += (w.y - c.y) * k;
    ctl.lightShift = [c.x, c.y];
    if (Math.abs(w.x - c.x) > 0.002 || Math.abs(w.y - c.y) > 0.002) invalidate();
  });
  return null;
}

export default function CostHouse({ t, refs, frame, night, active, floating, reduce }: { t: MotionValue<number>; refs: CostRefs; frame: MutableRefObject<CostFrame>; night: number; active: boolean; floating: boolean; reduce: boolean }) {
  const state = useMemo<HouseState>(() => ({ lit: 2, porch: true, doorOpen: false, sun: 0.25, smoke: false, night, ground: 1 }), [night]);
  const ctl = useMemo(() => makeHouseController('none', state), []); // eslint-disable-line react-hooks/exhaustive-deps
  const light = useCursorLight(active && !reduce);
  return (
    <Canvas frameloop={active ? 'demand' : 'never'} dpr={[1, 2]} shadows="percentage" flat gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} camera={{ fov: FOV, near: 1, far: 200, position: [20, 10, 20] }} aria-hidden>
      <Sync ctl={ctl} state={state} />
      <CursorLight light={light} ctl={ctl} />
      <Rig t={t} ctl={ctl} refs={refs} frame={frame} floating={floating && !reduce} />
      <Lights ctl={ctl} />
      <House ctl={ctl} />
    </Canvas>
  );
}
