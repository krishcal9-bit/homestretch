import type { NextConfig } from 'next';

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
};

export default nextConfig;
