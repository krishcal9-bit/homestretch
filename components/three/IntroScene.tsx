'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { House, Lights, makeHouseController } from './houseModel';
import { FOV, SLOT_ASPECT, SLOT_POSE, fitDistance, placeCamera, type Pose } from './HouseScene';
import { INTRO } from '@/components/introTimeline';

/**
 * The intro's full-screen 3D stage. The house builds on the timeline (sped up ×INTRO.speed); the camera
 * starts close and low, orbits 20° and pushes in while the trees grow, pulls back slowly behind the title
 * card, and finally lands exactly on the hero's house slot: the projection is re-framed (view offset) so the
 * house is drawn at the slot's rect and scale, matching the hero canvas underneath pixel for pixel.
 */
const ease = (p: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);
const inOut = (p: number) => {
  const x = Math.min(1, Math.max(0, p));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function IntroRig({ slot, start }: { slot: () => DOMRect | null; start: { t: number | null } }) {
  const { camera, size, invalidate } = useThree();
  const target = useRef<DOMRect | null>(null);
  useFrame(() => {
    const now = performance.now() / 1000;
    if (start.t === null) start.t = now;
    const t = now - start.t;
    const cam = camera as THREE.PerspectiveCamera;
    const W = size.width;
    const H = size.height;
    // full-screen framing: the whole scene at ~62% of the short side
    const dFull = fitDistance(W / H, FOV, { w: 12.4 / 0.86, h: 9.6 / 0.86 });
    let az = 16;
    let el = 18;
    let dist = dFull;
    // orbit 20° + push in while the trees grow and the first window lights
    const o = inOut((t - 1.12) / 0.75);
    az = lerp(16, SLOT_POSE.az, o);
    dist = dFull * lerp(1, 0.86, o);
    // behind the title card: a slow pull back, rising a little
    const pb = ease((t - INTRO.title) / (INTRO.exit - INTRO.title));
    dist *= lerp(1, 1.14, pb);
    el = lerp(18, SLOT_POSE.el, pb);
    // land on the hero slot
    let view = { x: 0, y: 0, w: W, h: H };
    const h = ease((t - INTRO.exit) / (INTRO.total - INTRO.exit));
    if (t >= INTRO.exit - 0.05 && !target.current) target.current = slot();
    const r = target.current;
    if (r && h > 0) {
      const dSlot = fitDistance(SLOT_ASPECT);
      dist = lerp(dist, dSlot, h);
      az = lerp(az, SLOT_POSE.az, h);
      el = lerp(el, SLOT_POSE.el, h);
      view = { x: lerp(0, r.left, h), y: lerp(0, r.top, h), w: lerp(W, r.width, h), h: lerp(H, r.height, h) };
    }
    cam.fov = FOV;
    cam.aspect = view.w / view.h;
    cam.setViewOffset(view.w, view.h, -view.x, -view.y, W, H);
    cam.updateProjectionMatrix();
    const pose: Pose = { az, el, dist, target: SLOT_POSE.target };
    placeCamera(cam, pose);
    if (t < INTRO.total + 0.3) invalidate();
  });
  return null;
}

function FirstFrame({ onFirstFrame }: { onFirstFrame?: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    requestAnimationFrame(() => onFirstFrame?.());
  });
  return null;
}

export default function IntroScene({ slot, paused = false, onFirstFrame }: { slot: () => DOMRect | null; paused?: boolean; onFirstFrame?: () => void }) {
  const ctl = useMemo(() => {
    const c = makeHouseController('intro', { lit: 0, porch: false, doorOpen: false, sun: 0, smoke: true });
    c.speed = INTRO.speed;
    return c;
  }, []);
  const start = useMemo(() => ({ t: null as number | null }), []);
  return (
    <Canvas frameloop={paused ? 'never' : 'demand'} dpr={[1, 2]} shadows="percentage" flat gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} camera={{ fov: FOV, near: 1, far: 300, position: [30, 14, 30] }} aria-hidden>
      <IntroRig slot={slot} start={start} />
      <Lights ctl={ctl} />
      <House ctl={ctl} />
      <FirstFrame onFirstFrame={onFirstFrame} />
    </Canvas>
  );
}
