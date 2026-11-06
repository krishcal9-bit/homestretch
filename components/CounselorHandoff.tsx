'use client';
import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { useLang } from '@/lib/i18n';
import { ORG_NAME, type ReferralOrg } from '@/lib/referral';
import type { Lang, Profile } from '@/lib/types';

/** D5: "Send my plan to a counselor" panel for the family result screen. */
export function CounselorHandoff({ profile, code, lang }: { profile: Profile; code?: string; lang: Lang }) {
  const { t } = useLang();
  const toast = useToast();
  const [org, setOrg] = useState<ReferralOrg>('sparkpoint');
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = ORG_NAME[org];

  async function send() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/referral/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ org, lang, code, profile }) });
      if (!res.ok) throw new Error();
      toast(t('handoff.sent', { org: name }));
    } catch {
      setError(t('handoff.error'));
    }
    setSending(false);
  }

  async function downloadUnsaved() {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch('/api/referral', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile, org, lang }) });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `referral-${org}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setError(t('handoff.error'));
    }
    setDownloading(false);
  }

  return (
    <section className="panel" aria-labelledby="handoff-title" data-testid="counselor-handoff">
      <h2 id="handoff-title" className="t-section">
        {t('handoff.title')}
      </h2>
      <p className="mt-1 text-[15px] text-ink-2">{t('handoff.sub')}</p>
      <div className="mt-4">
        <Segmented<ReferralOrg>
          label={t('handoff.choose')}
          value={org}
          onChange={setOrg}
          options={[
            { value: 'sparkpoint', label: ORG_NAME.sparkpoint },
            { value: 'hope', label: ORG_NAME.hope },
          ]}
        />
        <p className="mt-2 text-[13px] leading-[18px] text-ink-2">{t(org === 'sparkpoint' ? 'handoff.sparkpoint' : 'handoff.hope')}</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={send} loading={sending}>
          {t('handoff.send', { org: name })}
        </Button>
        {code ? (
          <a
            href={`/api/referral/${encodeURIComponent(code)}?org=${org}&lang=${lang}`}
            className="inline-flex min-h-[44px] items-center rounded-[8px] px-3 text-[15px] font-medium text-pine hover:bg-pine-soft"
            target="_blank"
            rel="noopener"
          >
            {t('handoff.download')}
          </a>
        ) : (
          <Button variant="quiet" onClick={downloadUnsaved} loading={downloading}>
            {t('handoff.download')}
          </Button>
        )}
      </div>
      <p role="alert" className="mt-2 min-h-[18px] text-[13px] leading-[18px] text-signal-red">
        {error}
      </p>
    </section>
  );
}
