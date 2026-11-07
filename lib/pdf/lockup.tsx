import { G as Group, Path, Svg, Text, View } from '@react-pdf/renderer';
import { LOCKUP_EM_SHARE, LOCKUP_TEXT_SHARE, LOCKUP_VB, lockupShapes } from '../brandLockup';

/** The Keystone lockup for PDFs: the arch and wordmark as vector paths, the tagline beneath as text. */
export function PdfLockup({ height = 26, tagline, family }: { height?: number; tagline?: string; family: string }) {
  const w = (height * LOCKUP_VB.w) / LOCKUP_VB.h;
  const em = height * LOCKUP_EM_SHARE;
  return (
    <View>
      <Svg width={w} height={height} viewBox={`${LOCKUP_VB.x} ${LOCKUP_VB.y} ${LOCKUP_VB.w} ${LOCKUP_VB.h}`}>
        {lockupShapes().map((s, i) =>
          s.dx ? (
            <Group key={i} transform={`translate(${s.dx} 0)`}>
              <Path d={s.d} fill={s.fill} />
            </Group>
          ) : (
            <Path key={i} d={s.d} fill={s.fill} />
          ),
        )}
      </Svg>
      {tagline ? <Text style={{ fontFamily: family, fontSize: Math.max(6.5, em * 0.22), color: '#4A5753', marginLeft: w * LOCKUP_TEXT_SHARE, marginTop: 1 }}>{tagline}</Text> : null}
    </View>
  );
}
