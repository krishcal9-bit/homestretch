'use client';
import { AnimatePresence, motion } from 'motion/react';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { spring } from '@/lib/motion';

const ToastCtx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ id: number; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMsg({ id: Date.now(), text });
    timer.current = setTimeout(() => setMsg(null), 2400);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-5" aria-live="polite" role="status">
        <AnimatePresence>
          {msg && (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={spring.snappy}
              className="rounded-[8px] bg-ink px-4 py-3 text-[15px] text-white"
            >
              {msg.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
