import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";
import { BUILT_IN_REDIRECTS } from "./src/config/redirects";
import { LOCAL_PHOTOS, PHOTO_ORIGINS } from "./src/lib/images";

// MapLibre's version names the folder scripts/copy-maplibre-worker.mjs copies it to
// (public/maplibre/<version>/, ADR-017). Read here and inlined as a string, so the
// browser bundle doesn't carry the whole maplibre-gl/package.json to learn it.
const MAPLIBRE_VERSION: string = JSON.parse(
  readFileSync(join(process.cwd(), "node_modules", "maplibre-gl", "package.json"), "utf8"),
).version;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The production build can write to a different folder than a running `next dev`.
  // Without this the build overwrites .next under the dev server, which crashes.
  // Usage: NEXT_DIST_DIR=.next-build npx next build
  distDir: process.env.NEXT_DIST_DIR || ".next",
  env: { MAPLIBRE_VERSION },
  // The published Claude skills are read from .claude/skills (features/skills/queries.ts).
  // Their pages and files are prerendered, but a page can re-render later (ISR of the
  // shared layout's data) and the admin list renders per request: ship the files with
  // those functions. Keys are route globs (picomatch), hence the escaped brackets.
  outputFileTracingIncludes: Object.fromEntries(
    [
      "/\\[locale\\]/skills",
      "/\\[locale\\]/skills/\\[name\\]",
      "/skills/\\[name\\]",
      "/skills/\\[name\\]/SKILL.md",
      "/admin/skills",
    ].map((route) => [route, ["./.claude/skills/**/*"]]),
  ),
  // Old URL shapes (renamed sections, the former Czech version, old admin
  // bookmarks) — one list in src/config/redirects.ts, also shown read-only in
  // the admin next to the redirects editors manage.
  async redirects() {
    return BUILT_IN_REDIRECTS.map(({ source, destination, permanent }) => ({
      source,
      destination,
      permanent,
    }));
  },
  // MapLibre from public/maplibre/<version>/ (ADR-017): the version is in the path,
  // so the file never changes — the browser may cache it forever.
  async headers() {
    return [
      {
        source: "/maplibre/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      // Country borders and labels change only with `npm run data:geo`: a day in the
      // browser, a week served stale while it revalidates (was: revalidated on every visit).
      {
        source: "/data/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      // Static files the proxy no longer touches (its matcher): no MIME sniffing.
      ...["/maplibre/:path*", "/brand/:path*", "/images/:path*", "/data/:path*"].map((source) => ({
        source,
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      })),
      // Images and logos (SVG among them) opened on their own can't run anything.
      // Not for /maplibre: a worker takes its CSP from its own script's response.
      ...["/brand/:path*", "/images/:path*"].map((source) => ({
        source,
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:",
          },
        ],
      })),
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
