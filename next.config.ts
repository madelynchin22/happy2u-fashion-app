import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 15: keep react-pdf out of the server bundle so it uses its own React copy
  serverExternalPackages: ["@react-pdf/renderer"],
  images: {
    domains: ["localhost", "happy2u-app-production.up.railway.app", "cdn.shopify.com"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
