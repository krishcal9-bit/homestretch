'use client';
import { Canvas, useFrame, useThree, type RootState } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { House, Lights, makeHouseController, type HouseState } from './houseModel';
import { FOV, FRAMES, SLOT_POSE, fitDistance, placeCamera, slotCamera, type FrameName } from './HouseScene';
import { INTRO } from '@/components/introTimeline';

/**
 * The landing's one 3D house, for the intro AND the hero. Born on the intro's stage (full screen), it plays the
 * film: the house builds (×INTRO.speed), the camera starts close and low, orbits 20° and pushes in while the
 * trees grow, pulls back slowly behind the title card, then lands on the hero's slot — the projection is
 * re-framed (view offset) so the house is drawn at the slot's exact rect with the slot's own camera. Then
 * `dock()` moves the canvas into the slot: resize + the same camera without the offset + render, in one task,
 * so the next paint is pixel for pixel the frame before it. From then on it is the hero's house (slot camera,
 * cursor tilt ≤4°, the slider's light). Born in the slot (no intro), it is the hero's house from the start.
 */
export type StageApi = { dock: () => void; leaveIntro: () => void };
type Mode = 'intro' | 'slot';

const ease = (p: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);
const inOut = (p: number) => {
  const x = Math.min(1, Math.max(0, p));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function Rig({ mode, slot, tilt, active, start, frame, ctl, ground }: { mode: MutableRefObject<Mode>; slot: () => DOMRect | null; tilt: boolean; active: boolean; start: { t: number | null }; frame: FrameName; ctl: ReturnType<typeof makeHouseController>; ground: number }) {
  const F = FRAMES[frame];
  // camera and size are read from the live state inside the frame (a synchronous dock resizes mid-task)
  const invalidate = useThree((s) => s.invalidate);
  const want = useRef({ x: 0, y: 0 });
  const cur = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (!tilt || !active || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const on = (e: PointerEvent) => {
      if (mode.current !== 'slot') return;
      want.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 };
      invalidate();
    };
    window.addEventListener('pointermove', on, { passive: true });
    return () => window.removeEventListener('pointermove', on);
  }, [tilt, active, invalidate, mode]);

  useFrame((st, delta) => {
    const cam = st.camera as THREE.PerspectiveCamera;
    const size = st.size;
    if (mode.current === 'slot') {
      const k = Math.min(1, delta * 4);
      cur.current.x += (want.current.x - cur.current.x) * k;
      cur.current.y += (want.current.y - cur.current.y) * k;
      slotCamera(cam, size.width, size.height, cur.current.x, cur.current.y, F);
      if (Math.abs(want.current.x - cur.current.x) > 0.001 || Math.abs(want.current.y - cur.current.y) > 0.001) invalidate();
      return;
    }
    // ---- the film (wall-clock: R3F's clock restarts when the frameloop pauses) ----
    const now = performance.now() / 1000;
    if (start.t === null) start.t = now;
    const t = now - start.t;
    const W = size.width;
    const H = size.height;
    // full-screen framing: the whole scene at ~62% of the short side
    const dFull = fitDistance(W / H, FOV, { w: 12.4 / 0.86, h: 9.6 / 0.86 });
    // orbit 20° + push in while the trees grow and the first window lights
    const o = inOut((t - 1.12) / 0.75);
    let az = lerp(16, SLOT_POSE.az, o);
    let dist = dFull * lerp(1, 0.86, o);
    // behind the title card: a slow pull back, rising a little
    const pb = ease((t - INTRO.title) / (INTRO.exit - INTRO.title));
    dist *= lerp(1, 1.14, pb);
    let el = lerp(18, SLOT_POSE.el, pb);
    // land on the hero slot (measured every frame: the hero lays out underneath), with the slot's own framing;
    // the plinth retracts as the house reaches the street
    let view = { x: 0, y: 0, w: W, h: H };
    const h = ease((t - INTRO.exit) / (INTRO.total - INTRO.exit));
    const r = h > 0 ? slot() : null;
    let target = SLOT_POSE.target;
    if (r && r.width > 0) {
      dist = lerp(dist, fitDistance(r.width / r.height, FOV, F.extent), h);
      az = lerp(az, F.pose.az, h);
      el = lerp(el, F.pose.el, h);
      target = SLOT_POSE.target.map((v, i) => lerp(v, F.pose.target[i], h)) as [number, number, number];
      view = { x: lerp(0, r.left, h), y: lerp(0, r.top, h), w: lerp(W, r.width, h), h: lerp(H, r.height, h) };
    }
    ctl.groundOverride = 1 + (ground - 1) * h;
    cam.fov = FOV;
    cam.aspect = view.w / view.h;
    cam.setViewOffset(view.w, view.h, -view.x, -view.y, W, H);
    cam.updateProjectionMatrix();
    placeCamera(cam, { az, el, dist, target });
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

/** Keeps the house's state in step with React props (no re-render of the meshes). */
function Sync({ ctl, state, active }: { ctl: ReturnType<typeof makeHouseController>; state: HouseState; active: boolean }) {
  const { invalidate } = useThree();
  useEffect(() => {
    ctl.state = state;
    if (active) invalidate();
  }, [ctl, state, active, invalidate]);
  return null;
}

/** Hands the root's state out (setSize / advance for the synchronous dock). */
function Root({ root }: { root: MutableRefObject<RootState | null> }) {
  const get = useThree((s) => s.get);
  useEffect(() => {
    root.current = get();
  }, [get, root]);
  return null;
}

export default function StageScene({
  intro,
  state,
  tilt = false,
  active = true,
  slot,
  api,
  onFirstFrame,
  frame = 'slot',
}: {
  /** born on the intro's stage */
  intro: boolean;
  state: HouseState;
  tilt?: boolean;
  active?: boolean;
  /** the hero slot's rect (viewport coordinates) */
  slot: () => DOMRect | null;
  api: MutableRefObject<StageApi | null>;
  onFirstFrame?: () => void;
  /** the slot's framing (the landing hero: 'street') */
  frame?: FrameName;
}) {
  const ctl = useMemo(() => {
    const c = makeHouseController(intro ? 'intro' : 'none', state);
    if (intro) c.speed = INTRO.speed;
    return c;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const mode = useRef<Mode>(intro ? 'intro' : 'slot');
  const start = useMemo(() => ({ t: null as number | null }), []);
  const root = useRef<RootState | null>(null);
  useEffect(() => {
    api.current = {
      dock() {
        const s = root.current;
        const r = slot();
        mode.current = 'slot';
        ctl.groundOverride = undefined;
        if (!s || !r) return;
        // the canvas now sits in the slot: give it the slot's size and draw the slot's frame right now
        s.setSize(r.width, r.height, r.top, r.left);
        s.advance(performance.now());
      },
      leaveIntro() {
        // the intro fell back to its still: this canvas is simply the hero's house, finished
        mode.current = 'slot';
        ctl.build = 'none';
        ctl.key = false;
        ctl.groundOverride = undefined;
        root.current?.invalidate();
      },
    };
    return () => {
      api.current = null;
    };
  }, [api, slot, ctl]);
  return (
    <Canvas
      frameloop={active ? 'demand' : 'never'}
      dpr={[1, 2]}
      shadows="percentage"
      flat
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: FOV, near: 1, far: 300, position: [30, 14, 30] }}
      aria-hidden
    >
      <Root root={root} />
      <Sync ctl={ctl} state={state} active={active} />
      <Rig mode={mode} slot={slot} tilt={tilt} active={active} start={start} frame={frame} ctl={ctl} ground={state.ground ?? 1} />
      <Lights ctl={ctl} />
      <House ctl={ctl} />
      <FirstFrame onFirstFrame={onFirstFrame} />
    </Canvas>
  );
}
