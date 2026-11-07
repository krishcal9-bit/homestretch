import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer', '@libsql/client', '@prisma/adapter-libsql'],
  // Fonts read from disk by the PDF and share-card routes must ship with the serverless functions.
  outputFileTracingIncludes: {
    '/api/card/[code]': ['./node_modules/@fontsource/public-sans/files/*.woff'],
    '/api/pdf/plan/[code]': ['./node_modules/@fontsource/public-sans/files/*.woff'],
    '/api/pdf/letter': ['./node_modules/@fontsource/public-sans/files/*.woff'],
    '/api/referral': ['./node_modules/@fontsource/public-sans/files/*.woff'],
    '/api/referral/[code]': ['./node_modules/@fontsource/public-sans/files/*.woff'],
  },
  experimental: { serverActions: { bodySizeLimit: '15mb' } },
  webpack(config) {
    // R3F's THREE.Clock (deprecated in three) → a THREE.Timer-backed clock; scripts/loaders/r3f-clock.cjs
    config.module.rules.push({ test: /@react-three[\\/]fiber[\\/]dist[\\/].*\.js$/, use: [{ loader: path.join(process.cwd(), 'scripts/loaders/r3f-clock.cjs') }] });
    return config;
  },
};

export default nextConfig;
