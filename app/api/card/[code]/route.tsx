import { ImageResponse } from 'next/og';
import fs from 'fs';
import path from 'path';
import { loadPlanRecord } from '@/lib/planRecord';
import { translate } from '@/lib/i18n-core';
import { monthName } from '@/lib/format';
import { MAX_MONTHS } from '@/lib/engine';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';

const font = (w: number) => fs.readFileSync(path.join(process.cwd(), `node_modules/@fontsource/public-sans/files/public-sans-latin-${w}-normal.woff`));

/** D8: 1080×1920 share card. Date and road only; no personal financial numbers. */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const url = new URL(req.url);
  const langParam = url.searchParams.get('lang');
  const rec = await loadPlanRecord(code, langParam === 'es' ? 'es' : langParam === 'en' ? 'en' : undefined);
  if (!rec) return apiError('not_found', "We couldn't find that plan.", 404);
  const { result, lang } = rec;
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
  const keys = result.milestones.find((m) => m.key === 'keys')?.month ?? 9;
  const months = keys;
  const headline = months >= MAX_MONTHS ? t('share.keysNow') : months === 1 ? t('share.oneMonth') : t('share.months', { n: months });
  const ready = result.monthsToReady >= MAX_MONTHS ? '' : t('share.readyBy', { month: monthName(result.readyDate, lang) });
  const max = Math.max(12, keys);
  const W = 880;
  const ms = result.milestones.filter((m) => m.key !== 'orientation' && m.key !== 'application');
  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1920, background: '#F6F7F5', display: 'flex', flexDirection: 'column', padding: 100, fontFamily: 'Public Sans', color: '#182420' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 40, fontWeight: 600 }}>
          <svg width="48" height="48" viewBox="0 0 20 20">
            <path d="M3 9.5 10 3l7 6.5V17H3z" fill="none" stroke="#1E5C47" strokeWidth="1.75" strokeLinejoin="round" />
            <path d="M3 14h14" stroke="#1E5C47" strokeWidth="1.75" />
          </svg>
          Keystone
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 360 }}>
          <div style={{ fontSize: 96, fontWeight: 600, lineHeight: 1.08, letterSpacing: -1, color: '#182420' }}>{headline}</div>
          {ready ? <div style={{ fontSize: 52, fontWeight: 600, marginTop: 40, color: '#B8862B' }}>{ready}</div> : null}
        </div>
        <div style={{ display: 'flex', position: 'relative', width: W, height: 120, marginTop: 140 }}>
          <div style={{ position: 'absolute', left: 0, top: 58, width: W, height: 6, borderRadius: 3, background: '#DDE3DF' }} />
          {ms.map((m) => {
            const x = Math.min(W - 36, (m.month / max) * W);
            const isKeys = m.key === 'keys';
            return (
              <div
                key={m.key}
                style={{
                  position: 'absolute',
                  left: x - (isKeys ? 30 : 16),
                  top: isKeys ? 31 : 45,
                  width: isKeys ? 60 : 32,
                  height: isKeys ? 60 : 32,
                  borderRadius: 999,
                  background: isKeys ? '#B8862B' : '#FFFFFF',
                  border: isKeys ? 'none' : '5px solid #1E5C47',
                  display: 'flex',
                }}
              />
            );
          })}
          <div style={{ position: 'absolute', left: -12, top: 49, width: 24, height: 24, borderRadius: 999, background: '#B8862B', display: 'flex' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: W, fontSize: 34, color: '#4A5753', marginTop: 8 }}>
          <span>{t('result.today')}</span>
          <span>{t('road.labels.keys')}</span>
        </div>
        <div style={{ display: 'flex', marginTop: 'auto', fontSize: 34, lineHeight: 1.4, color: '#4A5753', maxWidth: 820 }}>{t('share.with')}</div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts: [
        { name: 'Public Sans', data: font(400), weight: 400, style: 'normal' },
        { name: 'Public Sans', data: font(600), weight: 600, style: 'normal' },
      ],
      headers: { 'content-disposition': `inline; filename="keystone-${rec.code}-${lang}.png"`, 'cache-control': 'no-store' },
    },
  );
}
