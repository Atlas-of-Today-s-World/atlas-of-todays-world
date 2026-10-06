import { describe, expect, it } from "vitest";
import { photoSrcSet, photoUrl } from "./images";

const WEBFLOW = "https://cdn.prod.website-files.com/635f/65e9_big%20picture.jpg";

describe("photo URLs", () => {
  it("resizes photos from the old site's CDN through the optimizer", () => {
    expect(photoUrl(WEBFLOW, 640)).toBe(
      `/_next/image?url=${encodeURIComponent(WEBFLOW)}&w=640&q=75`,
    );
  });

  it("leaves other hosts, relative and invalid URLs alone (no open proxy)", () => {
    for (const src of [
      "https://example.com/a.jpg",
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
