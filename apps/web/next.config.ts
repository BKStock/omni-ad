import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@omni-ad/shared', '@omni-ad/ui'],
};

export default nextConfig;
