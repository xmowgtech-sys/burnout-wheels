import type { NextConfig } from "next";

const config: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
    ],
    formats: ["image/webp"],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  webpack: (cfg, { dev }) => {
    if (dev) {
      const existing = cfg.watchOptions?.ignored;
      const existingStrings = Array.isArray(existing)
        ? existing.filter((x: unknown): x is string => typeof x === "string" && x.length > 0)
        : typeof existing === "string" && existing.length > 0
          ? [existing]
          : ["**/node_modules/**", "**/.git/**", "**/.next/**"];
      cfg.watchOptions = {
        ...cfg.watchOptions,
        aggregateTimeout: 300,
        ignored: Array.from(
          new Set([
            ...existingStrings,
            "**/data/**",
            "**/.playwright-cli/**",
            "**/tsconfig.tsbuildinfo",
          ])
        ),
      };
    }
    return cfg;
  },
};

export default config;
