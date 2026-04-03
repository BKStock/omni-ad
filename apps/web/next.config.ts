import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@omni-ad/shared', '@omni-ad/ui'],
  async rewrites() {
    return [
      { source: '/api/engine/:path*', destination: 'http://localhost:8081/api/:path*' },
    ];
  },
};

export default nextConfig;
