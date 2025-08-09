import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // Only relax CSP in development
  env: isProd ? {} : { DISABLE_CSP: 'true' },
  async rewrites() {
    // Proxy all API and WS traffic to the backend to avoid exposing its URL to the client
    const backendUrl = process.env.API_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
