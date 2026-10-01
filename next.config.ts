import type { NextConfig } from "next";

// The admin moved to English URLs; old Czech bookmarks redirect.
// More specific paths must come before general ones (first match wins).
const LEGACY_ADMIN_PATHS: readonly (readonly [string, string])[] = [
  ["/admin/obsah/novy", "/admin/content/new"],
  ["/admin/autori/novy", "/admin/authors/new"],
  ["/admin/oblasti/nova", "/admin/areas/new"],
  ["/admin/data/novy", "/admin/data/new"],
  ["/admin/global-issues/novy", "/admin/global-issues/new"],
  ["/admin/ucty/pozvanky", "/admin/accounts/invitations"],
  ["/admin/regiony/zeme/:slug", "/admin/regions/countries/:slug"],
  ["/admin/obsah/:path*", "/admin/content/:path*"],
  ["/admin/autori/:path*", "/admin/authors/:path*"],
  ["/admin/schvalovani", "/admin/approvals"],
  ["/admin/presmerovani", "/admin/redirects"],
  ["/admin/regiony/:path*", "/admin/regions/:path*"],
  ["/admin/preklady/:path*", "/admin/translations/:path*"],
  ["/admin/oblasti/:path*", "/admin/areas/:path*"],
  ["/admin/vzhled", "/admin/appearance"],
  ["/admin/ucty/:path*", "/admin/accounts/:path*"],
  ["/admin/role/:path*", "/admin/roles/:path*"],
  ["/admin/clenove", "/admin/members"],
];

const LEGACY_ADMIN_REDIRECTS = LEGACY_ADMIN_PATHS.map(([source, destination]) => ({
  source,
  destination,
  permanent: true,
}));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The production build can write to a different folder than a running `next dev`.
  // Without this the build overwrites .next under the dev server, which crashes.
  // Usage: NEXT_DIST_DIR=.next-build npx next build
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Custom units were renamed to Global Issues. The old URLs are out there
  // (in the shared demo and in links), so they must redirect, not vanish.
  async redirects() {
    return [
      {
        source: "/special/:slug",
        destination: "/global-issue/:slug",
        permanent: true,
      },
      // The support page is called Atlas Patrons, as the site and the brief know it.
      { source: "/support", destination: "/patrons", permanent: true },
      // There is only one region portrait; the former "full" version points to it.
      {
        source: "/region/:slug/full",
        destination: "/region/:slug",
        permanent: true,
      },
      ...LEGACY_ADMIN_REDIRECTS,
    ];
  },
  // MapLibre from public/maplibre/<version>/ (ADR-017): the version is in the path,
  // so the file never changes — the browser may cache it forever.
  async headers() {
    return [
      {
        source: "/maplibre/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
  // next/image is not used; the optimizer is off so /_next/image isn't
  // an open proxy for any host.
  images: { unoptimized: true },
};

export default nextConfig;
