'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { House, Lights, makeHouseController, type HouseBuild, type HouseHandle, type HouseState } from './houseModel';

/** Camera pose around the house: azimuth/elevation in degrees, distance in units, look-at target. */
export type Pose = { az: number; el: number; dist: number; target: [number, number, number] };
export const FOV = 20;
/** The product-shot framing used everywhere the house sits in a slot (hero, result, plan). */
export const SLOT_ASPECT = 5 / 4;
export const SLOT_POSE: Pose = { az: 36, el: 22, dist: 0, target: [-0.016, 1.496, 0.812] };
/**
 * Scene extent (units) the slot framing fits, at the slot's aspect. Calibrated on a 5:4 render: the house,
 * its lawn and trees sit centred with ~9% air at the sides, the chimney ~11% below the top (its smoke rises
 * into that air and fades), the plinth's base ~6% above the bottom. Keep SLOT.house/stage ax/ay in
 * components/result/Road.tsx in step (the path's end projected through this camera).
 */
const EXTENT = { w: 13.3, h: 10.2 };
export function fitDistance(aspect: number, fov = FOV, ext = EXTENT) {
  const t = Math.tan(((fov / 2) * Math.PI) / 180);
  return Math.max(ext.h / (2 * t), ext.w / (2 * t * aspect));
}
export function placeCamera(cam: THREE.PerspectiveCamera, p: Pose) {
  const az = (p.az * Math.PI) / 180;
  const el = (p.el * Math.PI) / 180;
  const [tx, ty, tz] = p.target;
  cam.position.set(tx + p.dist * Math.cos(el) * Math.sin(az), ty + p.dist * Math.sin(el), tz + p.dist * Math.cos(el) * Math.cos(az));
  cam.lookAt(tx, ty, tz);
}

/** A framing: where the camera sits and the scene extent it fits into the slot. */
export type Frame = { pose: Pose; extent: { w: number; h: number } };
/** Result and plan pages: the 3/4 product shot of the house on its plinth. */
export const SLOT_FRAME: Frame = { pose: SLOT_POSE, extent: EXTENT };
/**
 * The landing hero's street: the house without its plinth, seen nearly front-on (a little from the right and
 * above) so its front path runs straight down to the illustrated sidewalk; the neighbours' stills use the
 * same camera. Calibrated like SLOT_FRAME: house, trees and mailbox centred with ~24px of air at 400px.
 */
export const STREET_FRAME: Frame = { pose: { az: 18, el: 15, dist: 0, target: [0.297, 2.161, 0.72] }, extent: { w: 10.39, h: 8.31 } };
export const FRAMES = { slot: SLOT_FRAME, street: STREET_FRAME } as const;
export type FrameName = keyof typeof FRAMES;

/** The product-shot camera for a slot of this size; tilt (−1…1) leans it toward the cursor (≤4° / 2°). */
export function slotCamera(cam: THREE.PerspectiveCamera, width: number, height: number, tx = 0, ty = 0, frame: Frame = SLOT_FRAME) {
  cam.clearViewOffset();
  cam.fov = FOV;
  cam.aspect = width / Math.max(1, height);
  cam.updateProjectionMatrix();
  placeCamera(cam, { ...frame.pose, az: frame.pose.az + tx * 4, el: frame.pose.el - ty * 2, dist: fitDistance(width / Math.max(1, height), FOV, frame.extent) });
}

/** Slot camera: the product-shot pose, with a slight tilt toward the cursor (≤4°) on fine pointers. */
function SlotRig({ tilt, active, frame }: { tilt: boolean; active: boolean; frame: Frame }) {
  const { camera, size, invalidate } = useThree();
  const want = useRef({ x: 0, y: 0 });
  const cur = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (!tilt || !active || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const on = (e: PointerEvent) => {
      want.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 };
      invalidate();
    };
    window.addEventListener('pointermove', on, { passive: true });
    return () => window.removeEventListener('pointermove', on);
  }, [tilt, active, invalidate]);
  useFrame((_, delta) => {
    const k = Math.min(1, delta * 4);
    cur.current.x += (want.current.x - cur.current.x) * k;
    cur.current.y += (want.current.y - cur.current.y) * k;
    slotCamera(camera as THREE.PerspectiveCamera, size.width, size.height, cur.current.x, cur.current.y, frame);
    if (Math.abs(want.current.x - cur.current.x) > 0.001 || Math.abs(want.current.y - cur.current.y) > 0.001) invalidate();
  });
  return null;
}

/** Calls back once the first frame with the house in it has rendered. */
function FirstFrame({ onFirstFrame }: { onFirstFrame?: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    requestAnimationFrame(() => onFirstFrame?.());
  });
  return null;
}

/** Re-renders when the controller's state changes from outside the canvas. */
function Sync({ ctl, state, active }: { ctl: HouseHandle; state: HouseState; active: boolean }) {
  const { invalidate } = useThree();
  useEffect(() => {
    ctl.state = state;
    if (active) invalidate();
  }, [ctl, state, active, invalidate]);
  return null;
}

export type HouseSceneProps = {
  build?: HouseBuild;
  lit?: number;
  porch?: boolean;
  doorOpen?: boolean;
  sun?: number;
  smoke?: boolean;
  /** 0 day … 1 night (dark theme) */
  night?: number;
  /** 1 plinth … 0 standing on the page's ground */
  ground?: number;
  /** HOUSE_VARIANTS index (neighbours) */
  variant?: number;
  frame?: FrameName;
  tilt?: boolean;
  /** false pauses rendering (off screen) */
  active?: boolean;
  onFirstFrame?: () => void;
  onBuilt?: () => void;
  className?: string;
};

export default function HouseScene({ build = 'full', lit = 0, porch = false, doorOpen = false, sun = 0, smoke = false, night = 0, ground = 1, variant = 0, frame = 'slot', tilt = false, active = true, onFirstFrame, onBuilt, className = '' }: HouseSceneProps) {
  const state = useMemo<HouseState>(() => ({ lit, porch, doorOpen, sun, smoke, night, ground }), [lit, porch, doorOpen, sun, smoke, night, ground]);
  const ctl = useMemo(() => {
    const c = makeHouseController(build, state);
    c.variant = variant;
    return c;
  }, [build, variant]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Canvas
      className={className}
      frameloop={active ? 'demand' : 'never'}
      dpr={[1, 2]}
      shadows="percentage"
      flat
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: FOV, near: 1, far: 200, position: [20, 10, 20] }}
      aria-hidden
    >
      <Sync ctl={ctl} state={state} active={active} />
      <SlotRig tilt={tilt} active={active} frame={FRAMES[frame]} />
      <Lights ctl={ctl} />
      <House ctl={ctl} onBuilt={onBuilt} />
      <FirstFrame onFirstFrame={onFirstFrame} />
    </Canvas>
  );
}
