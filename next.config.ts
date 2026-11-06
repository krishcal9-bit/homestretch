import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer'],
  experimental: { serverActions: { bodySizeLimit: '15mb' } },
};

export default nextConfig;
