'use client';
import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';
import { LanguageProvider } from '@/lib/i18n';
import { ToastProvider } from '@/components/Toast';
import type { Lang } from '@/lib/types';

export function Providers({ lang, children }: { lang: Lang; children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LanguageProvider initial={lang}>
        <ToastProvider>{children}</ToastProvider>
      </LanguageProvider>
    </MotionConfig>
  );
}
