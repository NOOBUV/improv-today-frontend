import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable CSP for development to avoid speech synthesis issues
  env: {
    DISABLE_CSP: 'true'
  }
};

export default nextConfig;
