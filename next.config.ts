import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "why-is-node-running": false,
      "pino-pretty": false,
      tap: false,
    };
    return config;
  },
  serverExternalPackages: ["pino", "pino-pretty", "thread-stream"],
};

export default nextConfig;
