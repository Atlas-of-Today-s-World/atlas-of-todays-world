/**
 * Editorial photos through Next's image optimizer (`/_next/image`): resized to
 * the width a tile or hero needs and served as AVIF / WebP, cached on the CDN.
 * Originals (uploads, the old site's photos) can weigh several megabytes.
 *
 * Only these origins are optimized — next.config builds its `remotePatterns`
 * from the same list, so `/_next/image` is no open proxy — plus our own photos
 * under /images/ (the old site's photos now live in public/images/webflow,
 * scripts/webflow/mirror-images.mjs), whether written as a path or as an
 * absolute URL of this site. Anything else is returned unchanged.
 */

// Relative imports: next.config loads this module too, without path aliases.
import { SITE_URL } from "./site";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

/** Our own photos (public/images), optimized as local files (next.config `localPatterns`). */
export const LOCAL_PHOTOS = "/images/";

/** Hosts and path prefixes of photos worth resizing. */
export const PHOTO_ORIGINS: readonly { hostname: string; pathname: string }[] = [
  // The original atlasoftodaysworld.org's own folder on the Webflow CDN (its photos
  // now live in public/images/webflow; this is for any link left behind). Only that
  // folder: the CDN is shared by every Webflow site, and /_next/image must not
  // resize (and spend the image quota on) anybody else's pictures.
  { hostname: "cdn.prod.website-files.com", pathname: "/635faa1d6c0ae075b5716e40/" },
  // Uploads from the admin (public Storage buckets) of this deployment's project.
  ...(SUPABASE_URL
    ? [{ hostname: new URL(SUPABASE_URL).hostname, pathname: "/storage/v1/object/public/" }]
    : []),
];

/**
 * Widths requested from the optimizer. Each must be one of Next's default
 * `deviceSizes` / `imageSizes`, otherwise /_next/image refuses the request.
 */
export const PHOTO_WIDTH = {
  /** Author portraits. */
  avatar: 256,
  /** Small tiles: home "Latest subtopics", resource thumbnails. */
  thumb: 384,
  /** Subtopic and topic tiles. */
  tile: 640,
  /** Topic cards on /topics, region and country heroes in the side panel. */
  card: 828,
  /** Full-width topic hero. */
  hero: 1920,
} as const;

/** Next 16 accepts only the configured qualities; 75 is its default. */
const QUALITY = 75;

function isPhotoOrigin(url: URL): boolean {
  return (
    url.protocol === "https:" &&
    PHOTO_ORIGINS.some(
      (origin) => url.hostname === origin.hostname && url.pathname.startsWith(origin.pathname),
    )
  );
}

const optimized = (source: string, width: number) =>
  `/_next/image?url=${encodeURIComponent(source)}&w=${width}&q=${QUALITY}`;

/** The optimizer's address for `src` at `width`, or `src` itself when it isn't ours to resize. */
export function photoUrl(src: string, width: number): string {
  if (src.startsWith(LOCAL_PHOTOS)) return optimized(src, width);
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src;
  }
  // Our own photo by its absolute address (the database stores https URLs).
  if (url.origin === new URL(SITE_URL).origin && url.pathname.startsWith(LOCAL_PHOTOS)) {
    return optimized(url.pathname, width);
  }
  if (!isPhotoOrigin(url)) return src;
  return optimized(url.href, width);
}

/** `srcset` for a responsive <img> (hero photos). */
export function photoSrcSet(src: string, widths: readonly number[]): string | undefined {
  const sets = widths.map((width) => `${photoUrl(src, width)} ${width}w`);
  return photoUrl(src, widths[0] ?? PHOTO_WIDTH.hero) === src ? undefined : sets.join(", ");
}
