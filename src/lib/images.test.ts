import { describe, expect, it } from "vitest";
import { SITE_URL } from "@/lib/site";
import { photoSrcSet, photoUrl } from "./images";

const WEBFLOW = "https://cdn.prod.website-files.com/635f/65e9_big%20picture.jpg";

describe("photo URLs", () => {
  it("resizes photos from the old site's CDN through the optimizer", () => {
    expect(photoUrl(WEBFLOW, 640)).toBe(
      `/_next/image?url=${encodeURIComponent(WEBFLOW)}&w=640&q=75`,
    );
  });

  it("resizes our own photos, as a path or as an absolute URL of this site", () => {
    const local = "/images/webflow/abc.webp";
    const expected = `/_next/image?url=${encodeURIComponent(local)}&w=828&q=75`;
    expect(photoUrl(local, 828)).toBe(expected);
    expect(photoUrl(`${SITE_URL}${local}`, 828)).toBe(expected);
    // Elsewhere on our site (logos, data) stays as it is.
    expect(photoUrl(`${SITE_URL}/brand/logo.svg`, 828)).toBe(`${SITE_URL}/brand/logo.svg`);
  });

  it("leaves other hosts, relative and invalid URLs alone (no open proxy)", () => {
    for (const src of [
      "https://example.com/a.jpg",
      // Resource previews (og:image, video thumbnails) load straight from their source.
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      "https://cdn.prod.website-files.com.example.org/a.jpg",
      "http://cdn.prod.website-files.com/a.jpg",
      "/brand/world-map.svg",
      "not a url",
    ]) {
      expect(photoUrl(src, 640)).toBe(src);
    }
  });

  it("builds a srcset only for photos it can resize", () => {
    expect(photoSrcSet(WEBFLOW, [828, 1200])).toBe(
      `${photoUrl(WEBFLOW, 828)} 828w, ${photoUrl(WEBFLOW, 1200)} 1200w`,
    );
    expect(photoSrcSet("https://example.com/a.jpg", [828])).toBeUndefined();
  });
});
