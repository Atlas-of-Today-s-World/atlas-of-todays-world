import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Photo } from "./Photo";
import { TilePhoto, tileStyle } from "./PhotoTile";

describe("tileStyle", () => {
  it("keeps a hex colour and drops anything else", () => {
    expect(tileStyle("#1f3a5f")).toEqual({ backgroundColor: "#1f3a5f" });
    expect(tileStyle("red;position:fixed")).toBeUndefined();
    expect(tileStyle(null)).toBeUndefined();
  });
});

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

describe("TilePhoto", () => {
  it("is a lazy, decorative <img> at the tile's width", () => {
    const markup = html(createElement(TilePhoto, { image: "/images/a.webp", width: 384 }));
    expect(markup).toContain('loading="lazy"');
    expect(markup).toContain('alt=""');
    expect(markup).toContain(
      `src="/_next/image?url=${encodeURIComponent("/images/a.webp")}&amp;w=384`,
    );
  });

  it("renders nothing for a non-https photo", () => {
    expect(html(createElement(TilePhoto, { image: "javascript:alert(1)" }))).toBe("");
    expect(html(createElement(TilePhoto, { image: null }))).toBe("");
  });
});

describe("Photo", () => {
  const hero = {
    src: "/images/hero.webp",
    alt: "Hero",
    widths: [640, 828, 1200],
    sizes: "100vw",
    width: 1200,
    height: 416,
  };

  it("a priority photo (the LCP) loads eagerly at high priority, with a srcset", () => {
    const markup = html(createElement(Photo, { ...hero, priority: true }));
    expect(markup).not.toContain("loading=");
    expect(markup).toMatch(/fetchPriority="high"/i);
    expect(markup).toContain("640w");
    expect(markup).toContain("1200w");
    expect(markup).toContain('sizes="100vw"');
  });

  it("any other photo loads lazily", () => {
    const markup = html(createElement(Photo, hero));
    expect(markup).toContain('loading="lazy"');
    expect(markup).not.toMatch(/fetchPriority/i);
  });
});
