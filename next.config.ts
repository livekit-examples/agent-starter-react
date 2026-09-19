import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: false,
  crossOrigin: 'anonymous',
  allowedDevOrigins: ['*'],
  experimental: {
    //allowDevelopmentBuild: true,
    serverActions: {
      allowedOrigins: ['*.*', '*'],
    },
  },
  productionBrowserSourceMaps: false,
};

export default nextConfig;
