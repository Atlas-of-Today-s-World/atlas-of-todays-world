import type { NextConfig } from "next";
import { LOCAL_PHOTOS, PHOTO_ORIGINS } from "./src/lib/images";

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
  ["/admin/oblasti/:path*", "/admin/areas/:path*"],
  ["/admin/vzhled", "/admin/appearance"],
  ["/admin/ucty/:path*", "/admin/accounts/:path*"],
  ["/admin/role/:path*", "/admin/roles/:path*"],
  ["/admin/clenove", "/admin/members"],
  // Default learn-more tiles became topic templates (ADR-024).
  ["/admin/learn-more-tiles/:path*", "/admin/topic-templates"],
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
      // Topics moved from /entry/<slug> (2026-10-06); shared links keep working.
      { source: "/entry/:slug.md", destination: "/topics/:slug.md", permanent: true },
      { source: "/entry/:slug", destination: "/topics/:slug", permanent: true },
      {
        source: "/special/:slug",
        destination: "/global-issue/:slug",
        permanent: true,
      },
      // The site is English only (2026-10-05); the former Czech version /cs/…
      // points to the same page in English.
      { source: "/cs/:old(support|patrons)", destination: "/membership", permanent: true },
      { source: "/cs", destination: "/", permanent: true },
      { source: "/cs/:path*", destination: "/:path*", permanent: true },
      // Atlas Patrons live at /membership, the address of the original site.
      { source: "/:old(support|patrons)", destination: "/membership", permanent: true },
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
  // Editorial photos are resized by /_next/image (lib/images.ts photoUrl) —
  // only from the listed origins, so it's no open proxy for any host.
  images: {
    remotePatterns: PHOTO_ORIGINS.map(({ hostname, pathname }) => ({
      protocol: "https" as const,
      hostname,
      pathname: `${pathname}**`,
    })),
    // Local files only from public/images (no query strings): our own photos.
    localPatterns: [{ pathname: `${LOCAL_PHOTOS}**`, search: "" }],
    formats: ["image/avif", "image/webp"],
    // Photos don't change under their address: a month on the CDN.
    minimumCacheTTL: 2_678_400,
    // The largest photos of the old site are a few MB; anything bigger is refused.
    maximumResponseBody: 15_000_000,
  },
};

export default nextConfig;
