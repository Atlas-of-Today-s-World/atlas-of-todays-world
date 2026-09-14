import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Produkční build si umí sáhnout do jiné složky než běžící `next dev`.
  // Bez toho build přepíše .next pod rukama vývojovému serveru a ten spadne.
  // Použití: NEXT_DIST_DIR=.next-build npx next build
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
