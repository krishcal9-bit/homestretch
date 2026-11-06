'use client';
import type { ReactNode } from 'react';

export function Field({ id, label, help, error, children }: { id: string; label: string; help?: string; error?: string | null; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="mb-2 text-[15px] font-medium leading-[20px] text-ink">
        {label}
      </label>
      {children}
      {help && (
        <p id={`${id}-help`} className="t-helper mt-2 text-ink-2">
          {help}
        </p>
      )}
      {/* Reserved space so an error never shifts layout */}
      <p id={`${id}-error`} role={error ? 'alert' : undefined} className="t-helper mt-1 min-h-[15px] text-signal-red">
        {error ?? ''}
      </p>
    </div>
  );
}
