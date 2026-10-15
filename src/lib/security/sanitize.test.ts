import { afterAll, describe, expect, it, vi } from "vitest";
import { SITE_URL } from "@/lib/site";
import { sanitizePopupHtml, sanitizeRichHtml } from "./sanitize";

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

  it("keeps a heading anchor in the safe shape and drops any other id", () => {
    expect(sanitizeRichHtml('<h2 id="editorial-standards">a</h2>')).toBe(
      '<h2 id="editorial-standards">a</h2>',
    );
    expect(sanitizeRichHtml('<h3 id="cite">b</h3><h4 id="x1">c</h4>')).toBe(
      '<h3 id="cite">b</h3><h4 id="x1">c</h4>',
    );
    for (const id of ["__next", "Main", "1st", "a b", 'a"onclick="x', "x".repeat(64)]) {
      expect(sanitizeRichHtml(`<h2 id='${id}'>t</h2>`)).toBe("<h2>t</h2>");
    }
    expect(sanitizeRichHtml("<h2>plain</h2>")).toBe("<h2>plain</h2>");
    // Other tags never keep an id.
    expect(sanitizeRichHtml('<p id="data">p</p>')).toBe("<p>p</p>");
  });

  it("a mailto link passes", () => {
    expect(sanitizeRichHtml('<a href="mailto:a@b.cz">a</a>')).toContain('href="mailto:a@b.cz"');
  });

  it("never keeps a span or its classes in article text", () => {
    expect(sanitizeRichHtml('<p><span class="rt-color-red">x</span></p>')).toBe("<p>x</p>");
  });
});

describe("sanitizePopupHtml", () => {
  const STYLE_PAYLOADS = [
    '<span style="color:red">x</span>',
    '<span style="background:url(javascript:alert(1))">x</span>',
    '<span style="font-size:999px;position:fixed;inset:0">x</span>',
    '<p style="color:#ff0000">x</p>',
    '<span class="rt-color-red" style="color:expression(alert(1))">x</span>',
    "<style>body{display:none}</style>",
  ];

  it.each([...XSS_PAYLOADS, ...STYLE_PAYLOADS])("neutralizes %s", (payload) => {
    expect(isInert(sanitizePopupHtml(payload))).toBe(true);
  });

  it("keeps the popup formatting and opens links in a new tab without opener", () => {
    expect(
      sanitizePopupHtml(
        '<p><strong>Gaza</strong> <em>2.1 m</em> <a href="https://unrwa.org">UNRWA</a></p><ul><li>a</li></ul><ol><li>b<br>c</li></ol>',
      ),
    ).toBe(
      '<p><strong>Gaza</strong> <em>2.1 m</em> <a href="https://unrwa.org" rel="noopener noreferrer" target="_blank">UNRWA</a></p><ul><li>a</li></ul><ol><li>b<br />c</li></ol>',
    );
  });

  it("drops the empty paragraphs the editor leaves behind", () => {
    expect(sanitizePopupHtml("<ul><li><p>a</p></li></ul><p></p><p> </p>")).toBe(
      "<ul><li><p>a</p></li></ul>",
    );
  });

  it("keeps only the fixed colour and size classes on a span", () => {
    expect(sanitizePopupHtml('<span class="rt-color-red rt-size-large">x</span>')).toBe(
      '<span class="rt-color-red rt-size-large">x</span>',
    );
    expect(sanitizePopupHtml('<span class="rt-color-red evil rt-color-pink">x</span>')).toBe(
      '<span class="rt-color-red">x</span>',
    );
    expect(sanitizePopupHtml('<span class="fixed inset-0 bg-black">x</span>')).toBe("<span>x</span>");
    // Classes only on spans: a paragraph never keeps one.
    expect(sanitizePopupHtml('<p class="rt-color-red">x</p>')).toBe("<p>x</p>");
  });

  it("drops what an article may have but a popup may not", () => {
    expect(
      sanitizePopupHtml(
        `<h2>t</h2><blockquote>q</blockquote><img src="${STORAGE}/a.webp" alt="a"><table><tr><td>c</td></tr></table>`,
      ),
    ).toBe("tqc");
    expect(sanitizePopupHtml('<a href="http://plain.example">x</a>')).toBe(
      '<a rel="noopener noreferrer" target="_blank">x</a>',
    );
    expect(sanitizePopupHtml('<a href="mailto:a@b.cz" target="_top">m</a>')).toBe(
      '<a href="mailto:a@b.cz" target="_blank" rel="noopener noreferrer">m</a>',
    );
  });
});
