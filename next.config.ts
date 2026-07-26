import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Compressed supply photos land well under 1MB, but leave headroom.
      bodySizeLimit: '4mb',
    },
  },
};

export default nextConfig;
