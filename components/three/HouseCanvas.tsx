'use client';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { HouseSceneProps } from './HouseScene';

/**
 * The 3D house in a fixed 5:4 slot. three.js loads only when the slot is near the viewport (its own chunk,
 * never on staff pages); until the first frame renders — and always without WebGL or with reduced motion —
 * a still render of the same scene (public/house/house.png, captured by scripts/render-house.ts) holds the
 * space, so it is never a blank box and never shifts layout. Rendering pauses while the slot is off screen.
 */
const Scene = dynamic(() => import('./HouseScene'), { ssr: false });
export const HOUSE_STILL = '/house/house.png';
/** One `sizes` for every still of the house, so the intro and the hero share one (preloaded) file. */
export const HOUSE_SIZES = '(min-width: 1024px) 560px, 90vw';

let webgl: boolean | null = null;
/**
 * True only for hardware-accelerated WebGL. Software rendering (SwiftShader, blocklisted GPUs) makes a live
 * 3D scene stutter and blocks the main thread, so those browsers get the still render instead
 * (failIfMajorPerformanceCaveat). `?force3d` / sessionStorage hs.force3d forces 3D (recording in headless).
 */
export function hasWebGL() {
  if (webgl !== null) return webgl;
  try {
    const force = new URLSearchParams(location.search).has('force3d') || !!sessionStorage.getItem('hs.force3d');
    const opts = force ? undefined : { failIfMajorPerformanceCaveat: true };
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2', opts) || c.getContext('webgl', opts)) as WebGLRenderingContext | null;
    webgl = !!gl;
    if (gl && !force) {
      // Chrome hands out SwiftShader without the caveat; detect software renderers by name.
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(name)) webgl = false;
    }
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl = false;
  }
  return webgl;
}

/** Start fetching the three.js chunk early (e.g. on the landing page, before the intro needs it). */
export const preloadHouse = () => import('./HouseScene');

export function HouseCanvas({
  className = '',
  eager = false,
  priority = false,
  label,
  onReady,
  hold = false,
  hideLive = false,
  ...scene
}: HouseSceneProps & {
  eager?: boolean;
  priority?: boolean;
  label?: string;
  onReady?: () => void;
  /** render one frame (compile now), then wait */
  hold?: boolean;
  /** keep the live canvas invisible (the still stays as it is) */
  hideLive?: boolean;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { margin: '400px 0px' });
  const visible = useInView(ref);
  const [gl, setGl] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(eager);
  const [ready, setReady] = useState(false);
  useEffect(() => setGl(hasWebGL()), []);
  useEffect(() => {
    if (near) setMounted(true);
  }, [near]);
  const live = !!gl && !reduce && mounted;
  // A building house starts from nothing: no still behind it once the canvas is live.
  const building = scene.build !== undefined && scene.build !== 'none';
  const showStill = !live || (!ready && !building) || hideLive;
  return (
    <div ref={ref} className={`relative aspect-[5/4] w-full ${className}`} role={label ? 'img' : undefined} aria-label={label}>
      <Image
        src={HOUSE_STILL}
        alt=""
        fill
        sizes={HOUSE_SIZES}
        priority={priority}
        className="pointer-events-none select-none object-contain transition-opacity duration-300"
        style={{ opacity: showStill ? 1 : 0 }}
        aria-hidden
      />
      {live && (
        <div className="absolute inset-0 transition-opacity duration-300" style={{ opacity: !hideLive && (ready || building) ? 1 : 0, transitionDuration: hideLive ? '0ms' : undefined }}>
          <Scene
            {...scene}
            active={visible && !(hold && ready)}
            onFirstFrame={() => {
              setReady(true);
              onReady?.();
            }}
          />
        </div>
      )}
    </div>
  );
}
