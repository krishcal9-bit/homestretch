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

let webgl: boolean | null = null;
export function hasWebGL() {
  if (webgl !== null) return webgl;
  try {
    const c = document.createElement('canvas');
    webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
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
  ...scene
}: HouseSceneProps & { eager?: boolean; priority?: boolean; label?: string; onReady?: () => void; /** render one frame (compile now), then wait */ hold?: boolean }) {
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
  const showStill = !live || (!ready && !building);
  return (
    <div ref={ref} className={`relative aspect-[5/4] w-full ${className}`} role={label ? 'img' : undefined} aria-label={label}>
      <Image
        src={HOUSE_STILL}
        alt=""
        fill
        sizes="(min-width: 1024px) 560px, 90vw"
        priority={priority}
        className="pointer-events-none select-none object-contain transition-opacity duration-300"
        style={{ opacity: showStill ? 1 : 0 }}
        aria-hidden
      />
      {live && (
        <div className="absolute inset-0 transition-opacity duration-300" style={{ opacity: ready || building ? 1 : 0 }}>
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
