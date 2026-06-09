import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  // Local monorepo shares node_modules in the parent dir, so trace from there.
  // On Vercel the repo is cloned standalone into /vercel/path0; pointing the
  // tracing root at the parent nests the build output one level too deep
  // (path0/path0/.next) and breaks the deploy, so skip it there.
  ...(process.env.VERCEL
    ? {}
    : { outputFileTracingRoot: resolve(process.cwd(), "..") }),

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
