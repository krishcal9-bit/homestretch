'use client';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ease, spring } from '@/lib/motion';

/**
 * The landing's display type and its two signature controls. Headlines are Fraunces 600 (the wordmark's instance)
 * with tight leading; each line rises out of its own mask. Body copy is Public Sans 18–20px.
 */

/** Splits `text` into the lines it wraps to at the current width (re-measured on resize and when the font loads). */
function useLines(text: string) {
  const ref = useRef<HTMLElement>(null);
  const [lines, setLines] = useState<string[] | null>(null);
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const spans = Array.from(el.querySelectorAll<HTMLSpanElement>('[data-w]'));
    if (!spans.length) return;
    const out: string[][] = [];
    let top = -1e9;
    for (const s of spans) {
      if (Math.abs(s.offsetTop - top) > 4) {
        out.push([]);
        top = s.offsetTop;
      }
      out[out.length - 1].push(s.textContent ?? '');
    }
    const next = out.map((l) => l.join('').trim());
    setLines((prev) => (prev && prev.join('\n') === next.join('\n') ? prev : next));
  }, []);
  useLayoutEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [measure, text]);
  return { ref, lines };
}

/**
 * A headline whose lines rise from their masks, 70ms apart. The words stay laid out (invisibly) underneath to
 * measure the line breaks, so the reveal never reflows. `play` keys the reveal: change it to replay.
 */
export function SplitHeading({
  text,
  as = 'h2',
  className = '',
  play = 1,
  delay = 0,
  animate = true,
}: {
  text: string;
  as?: 'h1' | 'h2';
  className?: string;
  play?: number;
  delay?: number;
  /** false: render the lines in place (the resting state before a section has been visited) */
  animate?: boolean;
}) {
  const reduce = !!useReducedMotion();
  const { ref, lines } = useLines(text);
  const Tag = as;
  const words = text.split(' ');
  return (
    <Tag className={`t-display relative ${className}`} aria-label={text}>
      {/* the measuring copy: real layout, invisible */}
      <span ref={ref as React.RefObject<HTMLSpanElement>} className="invisible block" aria-hidden>
        {words.map((w, i) => (
          <span key={i} data-w>
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </span>
      {lines && (
        <span className="absolute inset-x-0 top-0 block" aria-hidden key={play}>
          {lines.map((line, i) => (
            <span key={`${i}-${line}`} className="-mb-[0.1em] block overflow-hidden pb-[0.1em]">
              <motion.span
                className="block whitespace-nowrap"
                initial={!animate ? false : reduce ? { opacity: 0 } : { y: '105%' }}
                animate={{ y: '0%', opacity: 1 }}
                transition={reduce ? { duration: 0.15 } : { duration: 0.62, ease: ease.out, delay: delay + i * 0.07 }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </span>
      )}
    </Tag>
  );
}

/**
 * A door-shaped panel (an arched doorway) with an illustrated door that opens a little on hover (fine pointers),
 * on focus and on press, letting warm light out. Both panels are identical in shape: the same 1px --line border,
 * the same 4/5 arch (≥640px), the same door at the same place, and the same text block (the title reserves two
 * lines, the subtitle two), so wrapping never changes the height and the text sits at the same height in both.
 * Only the fill differs (pine for the primary). Phones: full width, the door beside the text, same height.
 */
export function DoorPanel({
  title,
  sub,
  primary = false,
  href,
  onNavigate,
  testId,
  style,
}: {
  title: string;
  sub: string;
  primary?: boolean;
  href: string;
  onNavigate: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  testId?: string;
  style?: React.CSSProperties;
}) {
  return (
    <motion.a
      href={href}
      onClick={onNavigate}
      whileTap={{ scale: 0.97 }}
      transition={spring.snappy}
      data-testid={testId}
      data-door={primary ? 'primary' : 'secondary'}
      style={style}
      className={`door-panel group relative grid h-full grid-cols-[56px_minmax(0,1fr)] items-center gap-4 overflow-hidden rounded-b-[14px] rounded-t-[36px] border border-line px-4 py-3 text-left sm:flex sm:aspect-[4/5] sm:flex-col sm:items-stretch sm:gap-0 sm:rounded-t-[999px] sm:px-4 sm:pb-4 sm:pt-6 sm:text-center ${
        primary ? 'door-primary bg-pine text-on-pine' : 'door-secondary bg-surface text-ink'
      }`}
    >
      {/* the doorway: the same size and place in both panels */}
      <span className="relative mx-auto block aspect-[3/4] w-[56px] [perspective:420px] sm:w-[44%] sm:max-w-[112px]" aria-hidden>
        {/* the warm light behind the door */}
        <span className={`absolute inset-0 rounded-t-[999px] ${primary ? 'bg-[var(--il-honey-light)]' : 'bg-[var(--il-glow)]'}`} />
        <span className="door-light absolute inset-0 rounded-t-[999px] bg-[radial-gradient(70%_60%_at_30%_70%,var(--il-honey),transparent)] opacity-0" />
        {/* the door leaf: hinged on the left, opens toward the viewer */}
        <span className={`door-leaf absolute inset-0 origin-left rounded-t-[999px] border ${primary ? 'border-[color-mix(in_srgb,var(--on-pine)_35%,transparent)] bg-[var(--pine-hover)]' : 'border-line-strong bg-pine'}`}>
          <span className="absolute inset-x-[16%] top-[22%] h-[30%] rounded-t-[999px] border border-white/25" />
          <span className="absolute inset-x-[16%] bottom-[10%] h-[26%] rounded-[3px] border border-white/25" />
          <span className="absolute right-[13%] top-[58%] h-[7%] w-[7%] rounded-full bg-[var(--il-honey)]" />
        </span>
        {/* threshold */}
        <span className={`absolute -bottom-[3px] -left-[8%] -right-[8%] h-[3px] rounded-full ${primary ? 'bg-white/30' : 'bg-line-strong'}`} />
      </span>
      {/* the text block: pinned to the bottom, fixed heights (two lines each) */}
      <span className="block sm:mt-auto sm:pt-3">
        <span className="line-clamp-2 block h-[44px] text-[17px] font-semibold leading-[22px] xl:h-[50px] xl:text-[19px] xl:leading-[25px]">{title}</span>
        <span className={`mt-1 line-clamp-2 block h-[40px] text-[14px] leading-[20px] xl:h-[44px] xl:text-[15px] xl:leading-[22px] ${primary ? 'opacity-85' : 'text-ink-2'}`}>{sub}</span>
      </span>
    </motion.a>
  );
}

/**
 * The main call to action: pulled toward the pointer within 40px (fine pointers), the label slides up and a copy
 * rises in on hover, it presses to 0.97.
 */
export function MagneticButton({ href, onNavigate, children, className = '' }: { href: string; onNavigate: (e: React.MouseEvent<HTMLAnchorElement>) => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const reduce = !!useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 20, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 260, damping: 20, mass: 0.6 });
  const onMove = (e: React.PointerEvent) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    x.set(Math.max(-1, Math.min(1, dx / (r.width / 2 + 40))) * 10);
    y.set(Math.max(-1, Math.min(1, dy / (r.height / 2 + 40))) * 8);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };
  return (
    // the hit area reaches 40px past the button, so the pull starts before the pointer arrives
    <span className="magnetic -m-10 inline-block p-10" onPointerMove={onMove} onPointerLeave={reset}>
      <motion.a ref={ref} href={href} onClick={onNavigate} whileTap={{ scale: 0.97 }} transition={spring.snappy} style={{ x: sx, y: sy }} className={`group relative inline-flex overflow-hidden ${className}`}>
        <span className="relative block overflow-hidden">
          <span className="mag-label block">{children}</span>
          <span className="mag-label mag-label-in absolute inset-0 block" aria-hidden>
            {children}
          </span>
        </span>
      </motion.a>
    </span>
  );
}
