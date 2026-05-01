import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: ['@omni-ad/shared', '@omni-ad/ui'],
  async rewrites() {
    return [
      { source: '/api/engine/:path*', destination: 'http://localhost:8081/api/:path*' },
    ];
  },
};

export default nextConfig;
