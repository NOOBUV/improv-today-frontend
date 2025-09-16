import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // Only relax CSP in development
  env: isProd ? {} : { DISABLE_CSP: 'true' },
  // Temporarily disable ESLint during build to check core functionality
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    // Proxy API traffic to backend, but exclude Auth0 routes
    const backendUrl = process.env.API_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/backend/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/api/conversation/:path*',
        destination: `${backendUrl}/api/conversation/:path*`,
      },
      {
        source: '/api/session/:path*',
        destination: `${backendUrl}/api/session/:path*`,
      },
      {
        source: '/api/ws',
        destination: `${backendUrl}/api/ws`,
      },
    ];
  },
};

export default nextConfig;
