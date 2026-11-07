'use client';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useInView, useReducedMotion } from 'motion/react';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { HOUSE_SIZES, HOUSE_STILL, hasWebGL } from './HouseCanvas';
import { introStage, useIntroStage } from './introStage';
import type { StageApi } from './StageScene';
import type { HouseState } from './houseModel';

const Scene = dynamic(() => import('./StageScene'), { ssr: false });
/** Start fetching the hero house's three.js chunk early (the landing calls this on load). */
export const preloadStage = () => import('./StageScene');

const FILM: HouseState = { lit: 0, porch: false, doorOpen: false, sun: 0, smoke: true };

/**
 * The landing hero's 3D house, standing on the Road's Keys end in the product stage (a 5:4 slot). One canvas
 * for the intro and the hero: when the intro plays, the canvas is born on the intro's stage (portaled into it)
 * and docks into this slot at the end of the film (see components/three/introStage.ts, StageScene.tsx).
 * Until the canvas has drawn, and always without hardware WebGL or with reduced motion, the still render
 * (public/house/house.png, same framing) holds the slot; nothing shifts.
 *
 * intro: null until the landing has decided whether the intro plays (the canvas waits for that answer).
 */
export function HeroHouse({ intro, lit, sun }: { intro: boolean | null; lit: number; sun: number }) {
  const reduce = useReducedMotion();
  const slotRef = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const api = useRef<StageApi | null>(null);
  const st = useIntroStage();
  const [gl, setGl] = useState<boolean | null>(null);
  const [born, setBorn] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [docked, setDocked] = useState(false);
  const visible = useInView(slotRef);

  useEffect(() => setGl(hasWebGL()), []);
  useEffect(() => {
    if (born === null && intro !== null) setBorn(intro);
  }, [intro, born]);
  // the canvas's own element: React renders into it; where it hangs in the page is decided below
  useEffect(() => {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    setHost(el);
    return () => el.remove();
  }, []);

  const live = !!gl && !reduce && born !== null;
  const filming = born === true && !docked && (st.mode === 'pending' || st.mode === '3d');
  const onStage = filming && !!st.stage;

  // on the intro's stage during the film, in the slot otherwise
  useLayoutEffect(() => {
    if (!host) return;
    const parent = onStage ? st.stage : slotRef.current;
    if (parent && host.parentElement !== parent) parent.appendChild(host);
  }, [host, onStage, st.stage]);

  const slot = useCallback(() => slotRef.current?.getBoundingClientRect() ?? null, []);

  // the intro calls this at the end of the film: into the slot, resized, re-drawn — all before the next paint
  useEffect(() => {
    if (born !== true || !live) return;
    introStage.setDocker(() => {
      const el = slotRef.current;
      if (!host || !el) return;
      el.appendChild(host);
      api.current?.dock();
      setDocked(true);
    });
    return () => introStage.setDocker(null);
  }, [born, live, host]);

  // the intro fell back to its still image (no first frame in time): this is just the hero's house now
  const left = born === true && !docked && st.mode === 'still';
  useEffect(() => {
    if (left) api.current?.leaveIntro();
  }, [left]);

  const onFirstFrame = useCallback(() => {
    setReady(true);
    if (introStage.get().mode === 'pending') introStage.set({ firstFrame: true });
  }, []);

  const state = useMemo<HouseState>(() => (filming ? FILM : { lit, porch: true, doorOpen: true, sun, smoke: true }), [filming, lit, sun]);
  // born in the slot: the canvas fades in over the still once it has drawn; born on the stage: the intro owns its fade
  useEffect(() => {
    if (!host) return;
    const fade = born === false || left;
    host.style.opacity = !fade || ready ? '1' : '0';
    host.style.transition = fade ? 'opacity 300ms cubic-bezier(0.23,1,0.32,1)' : '';
  }, [host, born, left, ready]);

  // the still holds the slot until the canvas has drawn here (never under the house flying in from the stage)
  const showStill = !live || (!ready && !onStage);
  return (
    <div ref={slotRef} className="relative h-full w-full" data-testid="hero-house">
      <Image
        src={HOUSE_STILL}
        alt=""
        fill
        sizes={HOUSE_SIZES}
        priority
        className="pointer-events-none select-none object-contain transition-opacity duration-300"
        style={{ opacity: showStill ? 1 : 0, transitionDuration: onStage || docked ? '0ms' : undefined }}
        aria-hidden
      />
      {live && host &&
        createPortal(
          <Scene intro={born === true} state={state} tilt active={onStage || filming || visible} slot={slot} api={api} onFirstFrame={onFirstFrame} />,
          host,
        )}
    </div>
  );
}
