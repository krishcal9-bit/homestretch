import { Document, Page, Text, View, StyleSheet, Svg, Line, Circle, renderToBuffer } from '@react-pdf/renderer';
import { registerFonts } from './fonts';
import { PdfLockup } from './lockup';
import { translate } from '../i18n-core';
import { addMonths, MAX_MONTHS } from '../engine';
import { monthName } from '../format';
import type { Lang, ReadinessResult } from '../types';
import type { PlanOutput } from '../plan';

/** One-page plan summary: date, road, 90-day plan — in the chosen language. */
export async function renderPlanPdf(o: { code: string; result: ReadinessResult; plan: PlanOutput; lang: Lang; checklist: Record<string, boolean>; url: string }): Promise<Buffer> {
  const family = registerFonts();
  const t = (k: string, v?: Record<string, string | number>) => translate(o.lang, k, v);
  const today = new Date();
  const keys = o.result.milestones.find((m) => m.key === 'keys')?.month ?? 9;
  const max = Math.max(12, keys);
  const W = 480;
  const s = StyleSheet.create({
    page: { padding: 48, fontFamily: family, fontSize: 10.5, color: '#182420', lineHeight: 1.45 },
    small: { fontSize: 9, color: '#4A5753' },
    h2: { fontSize: 13, fontWeight: 600, marginTop: 22, marginBottom: 8 },
    date: { fontSize: 32, fontWeight: 600, color: '#B8862B', marginTop: 6, lineHeight: 1.15, marginBottom: 4 },
    item: { flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 0.75, borderBottomColor: '#DDE3DF' },
    box: { width: 11, height: 11, borderWidth: 1, borderColor: '#4A5753', borderRadius: 2, marginRight: 10, marginTop: 2 },
    boxOn: { backgroundColor: '#1E5C47', borderColor: '#1E5C47' },
  });
  const ms = [...o.result.milestones].sort((a, b) => a.month - b.month);
  return renderToBuffer(
    <Document title={t('pdf.title')} language={o.lang}>
      <Page size="LETTER" style={s.page}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <PdfLockup height={26} family={family} tagline={t('brand.tagline')} />
          <Text style={[s.small, { marginTop: 6 }]}>Habitat for Humanity of Orange County</Text>
        </View>
        <Text style={[s.small, { marginTop: 2 }]}>{t('pdf.code', { code: o.code })}</Text>
        <Text style={{ fontSize: 11, marginTop: 24, color: '#4A5753' }}>{t('pdf.ready')}</Text>
        <Text style={s.date}>{o.result.monthsToReady >= MAX_MONTHS ? t('result.tenPlus') : monthName(o.result.readyDate, o.lang)}</Text>
        <Text style={{ marginTop: 4 }}>{t('pdf.keys', { month: monthName(addMonths(today, keys), o.lang) })}</Text>

        <Text style={s.h2}>{t('pdf.road')}</Text>
        <Svg width={W + 20} height={28}>
          <Line x1={10} y1={14} x2={W + 10} y2={14} stroke="#DDE3DF" strokeWidth={2.5} />
          {ms.map((m) => (
            <Circle key={m.key} cx={10 + (Math.min(m.month, max) / max) * W} cy={14} r={m.key === 'keys' ? 6 : 4} fill={m.key === 'keys' ? '#B8862B' : '#FFFFFF'} stroke={m.key === 'keys' ? '#B8862B' : '#1E5C47'} strokeWidth={1.5} />
          ))}
          <Circle cx={10} cy={14} r={3} fill="#B8862B" />
        </Svg>
        <View style={{ marginTop: 6 }}>
          {ms.map((m) => (
            <View key={m.key} style={{ flexDirection: 'row', paddingVertical: 2 }}>
              <Text style={{ width: 120, color: '#4A5753' }}>{monthName(addMonths(today, m.month), o.lang, true)}</Text>
              <Text style={{ fontWeight: m.key === 'keys' ? 600 : 400 }}>{t(`road.labels.${m.key}`)}</Text>
            </View>
          ))}
        </View>

        <Text style={s.h2}>{t('pdf.plan')}</Text>
        {o.plan.actions.map((a, i) => (
          <View key={i} style={s.item} wrap={false}>
            <View style={o.checklist[String(i)] ? [s.box, s.boxOn] : s.box} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: 600 }}>{a.title}</Text>
              <Text style={{ color: '#4A5753' }}>{a.detail}</Text>
              <Text style={s.small}>
                {t(`pdf.owner.${a.owner}`)} · {a.byMonth <= 0 ? t('plan.byNow') : t('plan.byMonth', { month: monthName(addMonths(today, a.byMonth), o.lang) })}
                {a.resource ? ` · ${a.resource.name}` : ''}
              </Text>
            </View>
          </View>
        ))}
        <Text style={[s.small, { position: 'absolute', bottom: 36, left: 48, right: 48 }]}>{t('pdf.footer', { url: o.url })}</Text>
      </Page>
    </Document>,
  );
}
