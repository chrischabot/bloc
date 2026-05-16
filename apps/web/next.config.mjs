/** @type {import('next').NextConfig} */
const API_TARGET = process.env.API_INTERNAL_URL || 'http://localhost:3001';

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@notion/sdk', '@notion/shared', '@notion/ui'],
  experimental: {
    typedRoutes: false,
  },
  async rewrites() {
    return [
      { source: '/v1/:path*', destination: `${API_TARGET}/v1/:path*` },
      { source: '/api/v3/:path*', destination: `${API_TARGET}/api/v3/:path*` },
      { source: '/health', destination: `${API_TARGET}/health` },
      { source: '/metrics', destination: `${API_TARGET}/metrics` },
    ];
  },
};

export default nextConfig;
