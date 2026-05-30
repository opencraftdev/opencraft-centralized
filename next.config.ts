import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: resolve(process.cwd(), ".."),

  serverExternalPackages: ["sharp", "fabric", "@remotion/renderer"],

  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".ts": [".ts", ".tsx", ".js"],
      ".js": [".js", ".ts", ".tsx"],
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      zod: resolve(process.cwd(), "node_modules/zod"),
    };
    return config;
  },

  async headers() {
    return [
      {
        source: "/api/media/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
