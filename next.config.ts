import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Produkční build si umí sáhnout do jiné složky než běžící `next dev`.
  // Bez toho build přepíše .next pod rukama vývojovému serveru a ten spadne.
  // Použití: NEXT_DIST_DIR=.next-build npx next build
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Vlastní celky se přejmenovaly na Global Issues. Staré adresy jsou venku
  // (ve sdílené ukázce i v odkazech), takže musí přesměrovat, ne mizet.
  async redirects() {
    return [
      {
        source: "/special/:slug",
        destination: "/global-issue/:slug",
        permanent: true,
      },
      // Stránka podpory se jmenuje Atlas Patrons, jak ji zná web i zadání.
      { source: "/support", destination: "/patrons", permanent: true },
      // Portrét regionu je jen jeden; dosavadní „full" verze na něj ukazuje.
      {
        source: "/region/:slug/full",
        destination: "/region/:slug",
        permanent: true,
      },
    ];
  },
  // next/image se nepoužívá; optimizer vypnutý, aby /_next/image nebyl
  // otevřený proxy pro libovolný host.
  images: { unoptimized: true },
};

export default nextConfig;
