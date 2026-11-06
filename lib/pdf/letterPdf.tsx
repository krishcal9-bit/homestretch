import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { registerFonts } from './fonts';

export async function renderLetterPdf(text: string): Promise<Buffer> {
  const family = registerFonts();
  const s = StyleSheet.create({
    page: { padding: 64, fontFamily: family, fontSize: 11.5, lineHeight: 1.55, color: '#182420' },
    p: { marginBottom: 0 },
  });
  return renderToBuffer(
    <Document title="Letter of explanation">
      <Page size="LETTER" style={s.page}>
        <View>
          {text.split('\n').map((line, i) => (
            <Text key={i} style={s.p}>
              {line.length ? line : ' '}
            </Text>
          ))}
        </View>
      </Page>
    </Document>,
  );
}
