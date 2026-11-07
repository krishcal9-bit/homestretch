'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import type { MotionValue } from 'motion/react';
import * as THREE from 'three';
import { House, Lights, makeHouseController, type HouseHandle, type HouseState } from './houseModel';
import { FOV, fitDistance, placeCamera } from './HouseScene';
import { PX } from '@/lib/illustrationPalette';

/**
 * The landing's "cost of keeping a home" house: the featured home pulled apart into what a family pays for, driven
 * by a scroll progress (0 assembled → exploded → the roof glows → reassembled at 1). Foundation (mortgage) drops,
 * the roof (insurance) lifts, the walls (property tax) stay; the utility box (utilities) and the toolbox
 * (repairs) slide out. Every frame it projects each part's anchor to the screen and moves its label and leader
 * line there (DOM refs, no React state). Demand frameloop: it only draws when the progress or the light moves.
 */
export type CostPart = 'mortgage' | 'tax' | 'insurance' | 'utilities' | 'repairs';
export const COST_PARTS: CostPart[] = ['insurance', 'tax', 'mortgage', 'utilities', 'repairs'];
/** which side of the screen each label sits on */
export const COST_SIDE: Record<CostPart, -1 | 1> = { insurance: -1, tax: -1, mortgage: -1, utilities: 1, repairs: 1 };

const sm = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** The film, as functions of progress p (shared with the DOM overlay). */
export const costStages = (p: number) => {
  const back = 1 - sm(0.84, 0.98, p);
  return {
    explode: sm(0.06, 0.38, p) * back,
    tools: sm(0.3, 0.52, p) * back,
    glow: sm(0.58, 0.7, p) * (1 - sm(0.82, 0.92, p)),
    turn: sm(0.02, 0.45, p) * back,
  };
};

// house dimensions (houseModel.tsx): width 4.2, depth 3.2, wall top 2.88, ridge 4.04
const HW = 2.1;
const HD = 1.6;
const RIDGE = 4.04;

export type CostRefs = { labels: MutableRefObject<(HTMLDivElement | null)[]>; lines: MutableRefObject<(SVGLineElement | null)[]>; dots: MutableRefObject<(SVGCircleElement | null)[]> };

function Rig({ p, ctl, refs, reduce }: { p: MotionValue<number>; ctl: HouseHandle; refs: CostRefs; reduce: boolean }) {
  const { invalidate } = useThree();
  const util = useRef<THREE.Group>(null);
  const tool = useRef<THREE.Group>(null);
  const v = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => p.on('change', () => invalidate()), [p, invalidate]);
  useFrame((st) => {
    const cam = st.camera as THREE.PerspectiveCamera;
    const { width: W, height: H } = st.size;
    const s = costStages(reduce ? 0.62 : p.get());
    const e = s.explode;
    // the parts (houseModel's explode hook; offsets in world units)
    const c = ctl as HouseHandle & { parts?: Record<string, [number, number, number]>; roofGlow?: number };
    c.parts = { foundation: [0, -1.05 * e, 0], walls: [0, 0, 0], roof: [0, 1.95 * e, 0] };
    c.roofGlow = s.glow;
    if (util.current) util.current.position.set(HW + 0.09 + 1.5 * s.tools, 1.05, 0.35);
    if (tool.current) {
      tool.current.position.set(2.55 + 0.7 * s.tools, 0.02 + 0.25 * Math.sin(Math.PI * s.tools) * (1 - s.tools), 2.35 + 1.0 * s.tools);
      tool.current.rotation.y = -0.5 + 0.35 * s.tools;
    }
    // the camera: a slight turn as it comes apart; wide enough for the exploded parts; on desktop the house starts
    // right of centre (the headline is on the left) and moves to the centre as it opens
    const aspect = W / H;
    const wide = aspect > 1.1;
    cam.fov = FOV;
    cam.aspect = aspect;
    const off = wide ? (1 - s.turn) * W * 0.14 : 0;
    cam.setViewOffset(W, H, -off, 0, W, H);
    cam.updateProjectionMatrix();
    // phones: pull back so the label columns at the edges clear the house
    const dist = fitDistance(aspect, FOV, aspect < 0.8 ? { w: 15.5, h: 12 } : { w: 10.6, h: 10.8 });
    placeCamera(cam, { az: 34 - 12 * s.turn, el: 21 - 3 * s.turn, dist, target: [0.1, 1.5 + 0.2 * e, 0.4] });
    // labels: project each anchor, place its label in its column at that height, draw the leader line
    const anchors: Record<CostPart, [number, number, number]> = {
      insurance: [-0.9, RIDGE - 0.35 + 1.95 * e, 0.2],
      tax: [-HW, 1.55, HD],
      mortgage: [-HW - 0.2, -0.12 - 1.05 * e, HD + 0.6],
      utilities: [HW + 0.09 + 1.5 * s.tools + 0.25, 1.3, 0.35],
      repairs: [2.55 + 0.7 * s.tools + 0.2, 0.45, 2.35 + 1.0 * s.tools],
    };
    const margin = Math.max(16, Math.min(80, W * 0.055));
    COST_PARTS.forEach((k, i) => {
      v.set(...anchors[k]).project(cam);
      const ax = ((v.x + 1) / 2) * W;
      const ay = ((1 - v.y) / 2) * H;
      const el = refs.labels.current[i];
      const line = refs.lines.current[i];
      const dot = refs.dots.current[i];
      if (!el) return;
      const side = COST_SIDE[k];
      const lw = el.offsetWidth;
      const lh = el.offsetHeight;
      const lx = side < 0 ? margin : W - margin - lw;
      const ly = Math.max(72, Math.min(H - lh - 72, ay - lh / 2));
      el.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
      const ex = side < 0 ? lx + lw + 10 : lx - 10;
      if (line) {
        line.setAttribute('x1', ex.toFixed(1));
        line.setAttribute('y1', (ly + lh / 2).toFixed(1));
        line.setAttribute('x2', ax.toFixed(1));
        line.setAttribute('y2', ay.toFixed(1));
      }
      if (dot) {
        dot.setAttribute('cx', ax.toFixed(1));
        dot.setAttribute('cy', ay.toFixed(1));
      }
    });
  });
  return (
    <>
      {/* the utility box on the right wall: meter housing, door seam, the meter's dial */}
      <group ref={util}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.16, 0.72, 0.5]} />
          <meshStandardMaterial color={PX.stoneShade} roughness={0.6} />
        </mesh>
        <mesh position={[0.085, 0.1, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.02, 20]} />
          <meshStandardMaterial color={PX.glass} roughness={0.3} />
        </mesh>
        <mesh position={[0.084, -0.2, 0]}>
          <boxGeometry args={[0.01, 0.2, 0.36]} />
          <meshStandardMaterial color={PX.slate} roughness={0.7} />
        </mesh>
      </group>
      {/* the toolbox on the lawn: body, lid, a brass handle */}
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
    (ctl as HouseHandle & { lightShift?: [number, number] }).lightShift = [c.x, c.y];
    if (Math.abs(w.x - c.x) > 0.002 || Math.abs(w.y - c.y) > 0.002) invalidate();
  });
  return null;
}

export default function CostHouse({ p, refs, night, active, reduce }: { p: MotionValue<number>; refs: CostRefs; night: number; active: boolean; reduce: boolean }) {
  const state = useMemo<HouseState>(() => ({ lit: 2, porch: true, doorOpen: false, sun: 0.25, smoke: false, night, ground: 1 }), [night]);
  const ctl = useMemo(() => makeHouseController('none', state), []); // eslint-disable-line react-hooks/exhaustive-deps
  const light = useCursorLight(active && !reduce);
  return (
    <Canvas frameloop={active ? 'demand' : 'never'} dpr={[1, 2]} shadows="percentage" flat gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} camera={{ fov: FOV, near: 1, far: 200, position: [20, 10, 20] }} aria-hidden>
      <Sync ctl={ctl} state={state} />
      <CursorLight light={light} ctl={ctl} />
      <Rig p={p} ctl={ctl} refs={refs} reduce={reduce} />
      <Lights ctl={ctl} />
      <House ctl={ctl} />
    </Canvas>
  );
}
