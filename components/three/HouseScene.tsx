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
export const SLOT_POSE: Pose = { az: 36, el: 22, dist: 0, target: [0.1, 1.55, 0.7] };
/** Scene extent (units) the slot framing must fit, at the slot's aspect. */
const EXTENT = { w: 12.4, h: 9.6 };
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

/** Slot camera: the product-shot pose, with a slight tilt toward the cursor (≤4°) on fine pointers. */
function SlotRig({ tilt, active }: { tilt: boolean; active: boolean }) {
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
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = FOV;
    cam.updateProjectionMatrix();
    placeCamera(cam, { ...SLOT_POSE, az: SLOT_POSE.az + cur.current.x * 4, el: SLOT_POSE.el - cur.current.y * 2, dist: fitDistance(size.width / size.height) });
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
  tilt?: boolean;
  /** false pauses rendering (off screen) */
  active?: boolean;
  onFirstFrame?: () => void;
  onBuilt?: () => void;
  className?: string;
};

export default function HouseScene({ build = 'full', lit = 0, porch = false, doorOpen = false, sun = 0, smoke = false, tilt = false, active = true, onFirstFrame, onBuilt, className = '' }: HouseSceneProps) {
  const state = useMemo<HouseState>(() => ({ lit, porch, doorOpen, sun, smoke }), [lit, porch, doorOpen, sun, smoke]);
  const ctl = useMemo(() => makeHouseController(build, state), [build]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Canvas
      className={className}
      frameloop={active ? 'demand' : 'never'}
      dpr={[1, 2]}
      shadows
      flat
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: FOV, near: 1, far: 200, position: [20, 10, 20] }}
      aria-hidden
    >
      <Sync ctl={ctl} state={state} active={active} />
      <SlotRig tilt={tilt} active={active} />
      <Lights ctl={ctl} />
      <House ctl={ctl} onBuilt={onBuilt} />
      <FirstFrame onFirstFrame={onFirstFrame} />
    </Canvas>
  );
}
