'use client';
import { useLang } from '@/lib/i18n';
import { setTheme, useTheme } from '@/lib/theme';

/**
 * The light/dark switch: a small sun whose rays retract into a crescent moon (250ms, transform and opacity
 * only). The icon's state is pure CSS on <html data-theme> (r6:theme in globals.css), so it is right on the
 * first frame, before hydration. 44×44 hit area; the label says what a press does.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { t } = useLang();
  const theme = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={t(next === 'dark' ? 'app.themeToDark' : 'app.themeToLight')}
      title={t(next === 'dark' ? 'app.themeToDark' : 'app.themeToLight')}
      className={`theme-toggle press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] text-ink-2 transition-colors duration-[120ms] hover:bg-pine-soft hover:text-ink ${className}`}
      data-testid="theme-toggle"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
        <defs>
          <mask id="tt-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
            <rect width="24" height="24" fill="#fff" />
            <circle className="tt-bite" cx="15" cy="9" r="7" fill="#000" />
          </mask>
        </defs>
        <g mask="url(#tt-mask)">
          <circle className="tt-core" cx="12" cy="12" r="4.6" fill="currentColor" />
        </g>
        <g className="tt-rays" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const r = (a * Math.PI) / 180;
            const c = Math.cos(r);
            const s = Math.sin(r);
            const at = (d: number) => Math.round(d * 100) / 100;
            return <line key={a} x1={at(12 + c * 7.4)} y1={at(12 + s * 7.4)} x2={at(12 + c * 9.6)} y2={at(12 + s * 9.6)} />;
          })}
        </g>
      </svg>
    </button>
  );
}
