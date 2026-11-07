'use client';
// "Download my home plan": the one-page Keep PDF (POST /api/pdf/home-plan), built from the family's Keep state.
import { Download } from 'lucide-react';
import { useState } from 'react';
import { useLang } from '@/lib/i18n';
import type { KeepState } from '@/lib/keepStore';
import { Button } from '@/components/ui/Button';

export function HomePlanDownload({ state, full = true }: { state: KeepState; full?: boolean }) {
  const { t, lang } = useLang();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const download = async () => {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch('/api/pdf/home-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile: state.profile, movesDone: state.movesDone, reliefDone: state.reliefDone, lang }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-home-plan-${lang}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <Button variant="secondary" full={full} loading={busy} onClick={download} data-testid="download-home-plan">
        <Download size={18} strokeWidth={1.75} aria-hidden />
        {t('keepPdf.download')}
      </Button>
      <p className="t-helper mt-2 text-ink-2">{t('keepPdf.downloadHelp')}</p>
      {error && (
        <p role="alert" className="t-helper mt-2 text-signal-red">
          {t('keepPdf.error')}
        </p>
      )}
    </div>
  );
}
