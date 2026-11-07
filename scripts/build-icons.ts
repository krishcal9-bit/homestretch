// Writes the Keystone favicon (app/icon.svg) and app icon (app/apple-icon.png) from the arch geometry.
// usage: npx tsx scripts/build-icons.ts
import fs from 'fs';
import sharp from 'sharp';
import { archIconSvg } from '../components/brand/arch';

(async () => {
  fs.writeFileSync('app/icon.svg', archIconSvg());
  // the app icon: the arch on paper, padded (iOS rounds the corners itself)
  const svg = archIconSvg({ bg: '#F6F7F5' }).replace('<style>.n{display:none}@media (prefers-color-scheme: dark){.d{display:none}.n{display:inline}}</style>', '<style>.n{display:none}</style>');
  const padded = svg.replace('viewBox="-2 -82 96 96"', 'viewBox="-14 -94 120 120"').replace('<rect x="-2" y="-82" width="96" height="96" rx="20" fill="#F6F7F5"/>', '<rect x="-14" y="-94" width="120" height="120" fill="#F6F7F5"/>');
  await sharp(Buffer.from(padded)).resize(180, 180).png().toFile('app/apple-icon.png');
  console.log('icons written');
})();
