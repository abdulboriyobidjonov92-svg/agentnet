import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@agentnet/shared-types"],
  serverExternalPackages: [],
};

export default nextConfig;
