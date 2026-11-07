import { RISK_LABEL } from '@/lib/earlyWarning';
import type { RiskLevel as Level } from '@/lib/forecast';

const STYLE: Record<Level, string> = {
  act: 'border-signal-red text-signal-red',
  watch: 'border-signal-amber text-signal-amber',
  stable: 'border-pine text-ink-2',
};

/** A risk level as text with a 2px coloured left rule (never a filled badge). */
export function RiskLevel({ level, count, className = '' }: { level: Level; count?: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-1.5 border-l-2 pl-2 font-medium ${STYLE[level]} ${className}`} data-level={level}>
      {count !== undefined && <span className="tnum">{count}</span>}
      {RISK_LABEL[level]}
    </span>
  );
}
