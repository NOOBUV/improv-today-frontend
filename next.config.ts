import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // Only relax CSP in development
  env: isProd ? {} : { DISABLE_CSP: 'true' },
};

export default nextConfig;
