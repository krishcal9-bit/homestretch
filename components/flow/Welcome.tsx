'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';

export function Welcome({ onStart }: { onStart?: () => void }) {
  const { t } = useLang();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  return (
    <section className="pt-16">
      <p className="t-helper mb-4 text-ink-2">{t('app.partner')}</p>
      <h1 className="t-title max-w-[22ch] text-ink">{t('welcome.title')}</h1>
      <p className="mt-4 text-ink-2">{t('welcome.sub')}</p>
      <div className="mt-10">
        <Button size="lg" full onClick={onStart}>
          {t('welcome.start')}
        </Button>
      </div>
      <div className="mt-8 border-t border-line pt-6 text-[15px] text-ink-2">
        {!showCode ? (
          <p>
            {t('welcome.haveCode')}{' '}
            <button type="button" className="min-h-[44px] font-medium text-pine underline-offset-4 hover:underline" onClick={() => setShowCode(true)}>
              {t('welcome.openWithCode')}
            </button>
          </p>
        ) : (
          <form
            className="flex items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) router.push(`/plan/${code.trim().toUpperCase()}`);
            }}
          >
            <label className="flex-1">
              <span className="mb-2 block text-[15px] font-medium text-ink">{t('welcome.codeLabel')}</span>
              <input
                autoFocus
                className="field uppercase tracking-[0.08em]"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
              />
            </label>
            <Button type="submit" variant="secondary">
              {t('welcome.openPlan')}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
