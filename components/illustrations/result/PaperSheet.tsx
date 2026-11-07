'use client';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export const RULE = 24; // px: every line of text on the sheet sits on this grid
export const PAD_TOP = 20;
export const PAD_BOTTOM = 16;
const LINE_SECONDS = 0.08; // how long the pen takes to cross one line

/**
 * A sheet of paper that slides up out of its slot, then gets written line by line: a surface-coloured
 * cover over the current line slides off to the right behind a thin pine pen mark, one line at a time,
 * while everything below stays blank paper. Children must keep every line on the 24px grid.
 * `streaming` holds back the last (possibly partial) line until the text is complete.
 */
export function PaperSheet({
  children,
  streaming = false,
  write = true,
  minLines = 8,
  lineCount,
  onWritten,
  className = '',
  testId,
}: {
  children: ReactNode;
  streaming?: boolean;
  /** false: show the content as is (e.g. reopened), no writing */
  write?: boolean;
  minLines?: number;
  /** lines of actual text when the content is taller than its text (a text area with a minimum height) */
  lineCount?: number;
  onWritten?: () => void;
  className?: string;
  testId?: string;
}) {
  const reduce = useReducedMotion();
  const pid = `rule${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const content = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(0);
  const [landed, setLanded] = useState(false);
  const [revealed, setRevealed] = useState(0);
  const [writing, setWriting] = useState(write);
  const doneRef = useRef(onWritten);
  doneRef.current = onWritten;

  useLayoutEffect(() => {
    const el = content.current;
    if (!el) return;
    const measure = () => setMeasured(Math.max(0, Math.round((el.offsetHeight - PAD_TOP - PAD_BOTTOM) / RULE)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const lines = lineCount ?? measured;
  const animated = writing && !reduce;
  const available = streaming ? Math.max(0, lines - 1) : lines;
  const penOn = animated && landed && revealed < available;
  useEffect(() => {
    if (!writing || streaming || lines === 0) return;
    if (reduce || revealed >= lines) {
      setWriting(false);
      doneRef.current?.();
    }
  }, [writing, streaming, lines, revealed, reduce]);

  const coverTop = PAD_TOP + (revealed + (penOn ? 1 : 0)) * RULE;
  return (
    <div className={`-m-1 overflow-hidden p-1 ${className}`}>
      <motion.div
        className="relative overflow-hidden rounded-[8px] border border-line bg-surface focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-pine"
        style={{ minHeight: PAD_TOP + minLines * RULE + PAD_BOTTOM }}
        initial={reduce ? { opacity: 0 } : { y: '55%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ y: { duration: 0.45, ease: [0.32, 0.72, 0, 1] }, opacity: { duration: 0.15 } }}
        onAnimationComplete={() => setLanded(true)}
        data-testid={testId}
      >
        <div ref={content}>{children}</div>
        {animated && (
          <>
            {/* blank paper below the line being written */}
            <div aria-hidden className="pointer-events-auto absolute inset-x-0 top-0 h-full bg-surface" style={{ transform: `translateY(${coverTop}px)` }} />
            {penOn && (
              <motion.div
                key={revealed}
                aria-hidden
                className="absolute inset-x-0 bg-surface"
                style={{ top: PAD_TOP + revealed * RULE, height: RULE }}
                initial={{ x: '0%' }}
                animate={{ x: '101%' }}
                transition={{ duration: LINE_SECONDS, ease: 'linear' }}
                onAnimationComplete={() => setRevealed((r) => r + 1)}
              >
                <span className="absolute left-0 top-[4px] h-[16px] w-[1.5px] bg-pine" />
              </motion.div>
            )}
          </>
        )}
        {/* ruled lines sit above the covers, so the paper reads as one sheet the whole time */}
        <svg aria-hidden className="pointer-events-none absolute left-5 top-0 h-full w-[calc(100%-40px)]">
          <defs>
            <pattern id={pid} width="8" height={RULE} patternUnits="userSpaceOnUse" y={PAD_TOP}>
              <line x1="0" x2="8" y1={RULE - 0.5} y2={RULE - 0.5} stroke="var(--line)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect x="0" y={PAD_TOP} width="100%" height="100%" fill={`url(#${pid})`} />
        </svg>
      </motion.div>
    </div>
  );
}
