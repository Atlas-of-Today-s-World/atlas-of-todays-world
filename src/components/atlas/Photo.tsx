import { photoSrcSet, photoUrl } from "@/lib/images";
import { safeUrl } from "@/lib/security/urls";

/**
 * An editorial photo as a real `<img>`: resized (lib/images.ts) with a `srcset`,
 * so a phone downloads the width it shows, not the desktop's.
 *
 * - `priority`: the page's Largest Contentful Paint (a hero at the top): loaded
 *   eagerly at high fetch priority. React announces such an image itself with a
 *   `<link rel="preload" imagesrcset fetchpriority="high">` in the document's
 *   <head>, so the browser asks for it before the scripts — no `preload()` call
 *   needed (a second one would only duplicate it).
 * - otherwise it loads lazily, only as it nears the screen — photos further down
 *   a panel no longer compete with the hero and the page's code.
 * - `shownFrom`: the photo's block is hidden on narrower screens (`max-sm:hidden`).
 *   Below that width a `<picture>` source swaps in an empty image, so phones
 *   fetch nothing — even for a `priority` photo, which React then doesn't
 *   preload either (it doesn't for an image inside `<picture>`).
 *
 * Nothing is rendered for a URL that isn't safe (lib/security/urls.ts).
 */
export function Photo({
  src,
  alt,
  widths,
  sizes,
  width,
  height,
  priority = false,
  shownFrom,
  className,
}: {
  src: string | null | undefined;
  /** "" for a decorative photo. */
  alt: string;
  /** Candidate widths, smallest first (each one /_next/image accepts, lib/images.ts). */
  widths: readonly number[];
  /** How wide it shows, for the browser's pick from `widths`. */
  sizes: string;
  /** Intrinsic size (aspect ratio), so the layout doesn't shift while it loads. */
  width: number;
  height: number;
  priority?: boolean;
  /** Narrowest viewport (px) that shows the photo; narrower ones download nothing. */
  shownFrom?: number;
  className?: string;
}) {
  const safe = safeUrl(src);
  if (!safe) return null;
  const largest = widths[widths.length - 1] ?? width;
  const url = photoUrl(safe, largest);
  const srcSet = photoSrcSet(safe, widths);
  const img = (
    // eslint-disable-next-line @next/next/no-img-element -- resized by lib/images.ts (/_next/image or the photo's own CDN)
    <img
      src={url}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? undefined : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={className}
    />
  );
  if (!shownFrom) return img;
  return (
    <picture>
      <source media={`(max-width: ${shownFrom - 0.02}px)`} srcSet={EMPTY_IMAGE} />
      {img}
    </picture>
  );
}

/** A transparent 1×1 GIF: what a screen that doesn't show the photo "loads". */
const EMPTY_IMAGE = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
