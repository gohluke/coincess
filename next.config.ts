import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "why-is-node-running": false,
      "pino-pretty": false,
      tap: false,
    };
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : config.externals ? [config.externals] : []),
        "pino",
        "pino-pretty",
        "thread-stream",
      ];
    }
    return config;
  },
  serverExternalPackages: ["pino", "pino-pretty", "thread-stream", "@reown/appkit"],
};

export default nextConfig;
