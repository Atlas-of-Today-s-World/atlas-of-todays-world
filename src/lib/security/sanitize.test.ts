import { afterAll, describe, expect, it, vi } from "vitest";
import { SITE_URL } from "@/lib/site";
import { sanitizeRichHtml } from "./sanitize";

// lib/images reads the project URL as it loads, so it is set before the imports run.
const STORAGE = vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdefghijklmnop.supabase.co");
  return "https://abcdefghijklmnop.supabase.co/storage/v1/object/public/entry-images";
});
const WEBFLOW = "https://cdn.prod.website-files.com/635faa1d6c0ae075b5716e40";

afterAll(() => {
  vi.unstubAllEnvs();
});

// A selection from the OWASP XSS Filter Evasion Cheat Sheet — none of it may stay executable.
const XSS_PAYLOADS = [
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  '<img src="javascript:alert(1)">',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="JaVaScRiPt:alert(1)">x</a>',
  '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
  "<svg onload=alert(1)>",
  '<iframe src="https://evil.example"></iframe>',
  '<div style="background:url(javascript:alert(1))">x</div>',
  '<p onclick="alert(1)">x</p>',
  "<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>",
  '<a href="//evil.example">x</a>',
];

function isInert(html: string) {
  return (
    !/<script|<iframe|<svg|<style|<math/i.test(html) &&
    !/\son\w+=/i.test(html) &&
    !/javascript:|data:text/i.test(html) &&
    !/style=/i.test(html)
  );
}

describe("sanitizeRichHtml", () => {
  it.each(XSS_PAYLOADS)("neutralizes %s", (payload) => {
    expect(isInert(sanitizeRichHtml(payload))).toBe(true);
  });

  it("keeps regular entry content", () => {
    const html =
      '<h2>Nadpis</h2><p>Text <strong>tučně</strong> a <a href="https://example.org">odkaz</a>.</p>';
    expect(sanitizeRichHtml(html)).toBe(
      '<h2>Nadpis</h2><p>Text <strong>tučně</strong> a <a href="https://example.org" rel="noopener noreferrer">odkaz</a>.</p>',
    );
  });

  it("keeps images from our photos and the trusted photo origins, lazily loaded", () => {
    for (const src of [
      `${STORAGE}/a1b2.webp`,
      `${WEBFLOW}/65e9_big%20picture.jpg`,
      "/images/webflow/abc.webp",
      `${SITE_URL}/images/webflow/abc.webp`,
    ]) {
      expect(sanitizeRichHtml(`<img src="${src}" alt="a">`)).toBe(
        `<img src="${src}" alt="a" loading="lazy" />`,
      );
    }
  });

  it("drops the whole image from any other host or scheme (no tracking pixels)", () => {
    for (const src of [
      "https://x.org/a.png",
      "https://tracker.example/pixel.gif?id=1",
      "//evil.example/p.gif",
      "http://cdn.prod.website-files.com/635faa1d6c0ae075b5716e40/a.jpg",
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
      // Lookalike hosts, and the trusted hosts outside their trusted folders.
      "https://abcdefghijklmnop.supabase.co.evil.example/storage/v1/object/public/a.png",
      "https://abcdefghijklmnop.supabase.co/storage/v1/object/sign/entry-images/a.png",
      "https://otherproject0000000.supabase.co/storage/v1/object/public/entry-images/a.png",
      "https://cdn.prod.website-files.com/5f00aa11bb22cc33dd44ee55/a.jpg",
      `${WEBFLOW}/../5f00aa11bb22cc33dd44ee55/a.jpg`,
      "https://evil.example/images/a.png",
      `${SITE_URL}/brand/logo.svg`,
      "images/a.png",
    ]) {
      expect(sanitizeRichHtml(`<p>a</p><img src="${src}" alt="a"><p>b</p>`)).toBe(
        "<p>a</p><p>b</p>",
      );
    }
    expect(
      sanitizeRichHtml('<figure><img alt="no source"><figcaption>c</figcaption></figure>'),
    ).toBe("<figure><figcaption>c</figcaption></figure>");
  });

  it("never keeps srcset, so it can't bring in another host", () => {
    expect(
      sanitizeRichHtml(
        `<img src="${STORAGE}/a.webp" srcset="https://tracker.example/p.gif 1x, ${STORAGE}/a.webp 2x">`,
      ),
    ).toBe(`<img src="${STORAGE}/a.webp" loading="lazy" />`);
    expect(sanitizeRichHtml('<img srcset="https://tracker.example/p.gif 1x">')).toBe("");
  });

  it("a mailto link passes", () => {
    expect(sanitizeRichHtml('<a href="mailto:a@b.cz">a</a>')).toContain('href="mailto:a@b.cz"');
  });
});
