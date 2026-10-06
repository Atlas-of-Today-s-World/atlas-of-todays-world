import { describe, expect, it } from "vitest";
import { sanitizeRichHtml } from "./sanitize";

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

  it("images only over https and with lazy loading", () => {
    expect(sanitizeRichHtml('<img src="https://x.org/a.png" alt="a">')).toBe(
      '<img src="https://x.org/a.png" alt="a" loading="lazy" />',
    );
    expect(sanitizeRichHtml('<img src="http://x.org/a.png">')).not.toContain("http://");
  });

  it("a mailto link passes", () => {
    expect(sanitizeRichHtml('<a href="mailto:a@b.cz">a</a>')).toContain('href="mailto:a@b.cz"');
  });
});
