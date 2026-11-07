// One-page referral packet PDF (D5). Server only; @react-pdf/renderer is a serverExternalPackage.
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import path from 'path';
import type { ReferralPacket } from './referral';
import { PdfLockup } from './pdf/lockup';

let fontFamily = 'Helvetica';
let fontBold = 'Helvetica-Bold';
try {
  const dir = path.join(process.cwd(), 'node_modules/@fontsource/public-sans/files');
  Font.register({
    family: 'Public Sans',
    fonts: [
      { src: path.join(dir, 'public-sans-latin-400-normal.woff'), fontWeight: 400 },
      { src: path.join(dir, 'public-sans-latin-600-normal.woff'), fontWeight: 600 },
    ],
  });
  Font.registerHyphenationCallback((w) => [w]);
  fontFamily = 'Public Sans';
  fontBold = 'Public Sans';
} catch {
  // Helvetica fallback
}

const INK = '#182420';
const INK2 = '#4A5753';
const LINE = '#DDE3DF';
const PINE = '#1E5C47';
const BRASS = '#B8862B';

const s = StyleSheet.create({
  page: { padding: 40, fontFamily, fontSize: 10, color: INK, lineHeight: 1.4 },
  top: { flexDirection: 'row', justifyContent: 'space-between', borderBottom: `1 solid ${LINE}`, paddingBottom: 10 },
  muted: { color: INK2 },
  h1: { fontSize: 20, fontFamily: fontBold, fontWeight: 600, marginTop: 18 },
  readyRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 6 },
  ready: { fontSize: 16, color: BRASS, fontFamily: fontBold, fontWeight: 600, marginLeft: 6 },
  h2: { fontSize: 11, fontFamily: fontBold, fontWeight: 600, marginTop: 18, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', borderTop: `1 solid ${LINE}` },
  cell: { width: '33.33%', paddingVertical: 6, paddingRight: 8, borderBottom: `1 solid ${LINE}` },
  cellLabel: { fontSize: 8.5, color: INK2 },
  cellValue: { fontSize: 10.5, fontFamily: fontBold, fontWeight: 600, marginTop: 1 },
  li: { flexDirection: 'row', marginBottom: 4 },
  num: { width: 16, color: PINE, fontFamily: fontBold, fontWeight: 600 },
  tlRow: { flexDirection: 'row', paddingVertical: 4, borderBottom: `1 solid ${LINE}` },
  tlDate: { width: 110, fontFamily: fontBold, fontWeight: 600 },
  tlLabel: { width: 120 },
  tlAction: { flex: 1, color: INK2 },
  footer: { position: 'absolute', bottom: 28, left: 40, right: 40, fontSize: 8, color: INK2, borderTop: `1 solid ${LINE}`, paddingTop: 6 },
});

function Packet({ p }: { p: ReferralPacket }) {
  return (
    <Document title={`${p.title} · ${p.familyName}`} author="Keystone" language={p.lang}>
      <Page size="LETTER" style={s.page}>
        <View style={s.top}>
          <View>
            <PdfLockup height={22} family={fontFamily} />
            <Text style={[s.muted, { fontSize: 8.5, marginTop: 3 }]}>Habitat for Humanity of Orange County</Text>
          </View>
          <Text style={s.muted}>
            {p.generated}
            {p.code ? `  ·  ${p.code}` : ''}
          </Text>
        </View>
        <Text style={s.h1}>
          {p.title}: {p.familyName}
        </Text>
        <View style={s.readyRow}>
          <Text style={s.muted}>{p.readyLabel}</Text>
          <Text style={s.ready}>{p.readyDate}</Text>
        </View>

        <Text style={s.h2}>{p.labels.household}</Text>
        <View style={s.grid}>
          {p.household.map((h) => (
            <View key={h.label} style={s.cell}>
              <Text style={s.cellLabel}>{h.label}</Text>
              <Text style={s.cellValue}>{h.value}</Text>
            </View>
          ))}
        </View>

        <Text style={s.h2}>{p.labels.blockers}</Text>
        {p.blockers.map((b, i) => (
          <View key={i} style={s.li}>
            <Text style={s.num}>{i + 1}</Text>
            <Text style={{ flex: 1 }}>{b}</Text>
          </View>
        ))}

        <Text style={s.h2}>{p.labels.timeline}</Text>
        {p.timeline.map((m) => (
          <View key={m.label} style={s.tlRow} wrap={false}>
            <Text style={s.tlDate}>{m.date}</Text>
            <Text style={s.tlLabel}>{m.label}</Text>
            <Text style={s.tlAction}>{m.action}</Text>
          </View>
        ))}

        <Text style={s.h2}>{p.labels.habitat}</Text>
        {p.habitatNeeds.map((n, i) => (
          <View key={i} style={s.li}>
            <Text style={s.num}>{i + 1}</Text>
            <Text style={{ flex: 1 }}>{n}</Text>
          </View>
        ))}

        <Text style={s.footer} fixed>
          {p.labels.footer}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderReferralPdf(p: ReferralPacket): Promise<Buffer> {
  return renderToBuffer(<Packet p={p} />);
}

export function pdfResponse(buf: Buffer, filename: string) {
  return new Response(new Uint8Array(buf), {
    headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="${filename}"`, 'cache-control': 'no-store' },
  });
}
