import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingExcludes: {
    "/*": ["data/*.private.json"],
  },
  serverExternalPackages: ["ali-oss"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.aliyuncs.com" },
      { protocol: "http", hostname: "**.aliyuncs.com" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
};

export default nextConfig;
