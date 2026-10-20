import { describe, expect, it } from "vitest";
import {
  VISUAL_HTML_HEIGHT,
  VISUAL_HTML_HEIGHT_MESSAGE,
  visualHtmlCsp,
  visualHtmlDocument,
  visualHtmlHeaderEntries,
  visualHtmlHeight,
  visualHtmlSrc,
} from "./visual-html";

const directives = (policy: string) => policy.split("; ");

describe("visualHtmlCsp", () => {
  const policy = visualHtmlCsp({
    dev: false,
    origins: ["https://atlas.example", "https://www.atlas.example", "https://atlas.example"],
  });

  it("sandboxes the document into an opaque origin, without forms or top navigation", () => {
    const sandbox = directives(policy).find((part) => part.startsWith("sandbox "));
    expect(sandbox).toBe("sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox");
    expect(policy).not.toContain("allow-same-origin");
    expect(policy).not.toContain("allow-top-navigation");
    expect(policy).not.toContain("allow-forms");
  });

  it("is framed only by our pages and posts no forms", () => {
    // The site's origin by name: 'self' would be the sandbox's opaque origin.
    expect(directives(policy)).toContain(
      "frame-ancestors https://atlas.example https://www.atlas.example",
    );
    expect(directives(policy)).toContain("form-action 'none'");
    expect(directives(policy)).toContain("default-src 'none'");
  });

  it("has no X-Frame-Options (it would refuse the sandboxed frame) and stays out of search", () => {
    const headers = new Map(
      visualHtmlHeaderEntries({ dev: false, origins: ["https://atlas.example"] }),
    );
    expect(headers.has("X-Frame-Options")).toBe(false);
    expect(headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(
      new Map(visualHtmlHeaderEntries({ dev: true, origins: ["http://localhost:3000"] })).has(
        "Strict-Transport-Security",
      ),
    ).toBe(false);
  });
});

describe("visualHtmlDocument", () => {
  it("wraps a fragment in a page whose links open in a new tab, the height script last", () => {
    const html = visualHtmlDocument(
      '<div id="irs-root"><script>draw()</script></div>',
      "A <b>map</b>",
    );
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>A &lt;b&gt;map&lt;/b&gt;</title>");
    expect(html).toContain('<base target="_blank">');
    expect(html).toContain('<div id="irs-root"><script>draw()</script></div>');
    expect(html.indexOf(VISUAL_HTML_HEIGHT_MESSAGE)).toBeGreaterThan(html.indexOf("draw()"));
    expect(html.trimEnd().endsWith("</html>")).toBe(true);
  });

  it("keeps a whole document as it is and adds the height script before its last </body>", () => {
    const page = "<!DOCTYPE html><html><head></head><body><p>'</body>' in text</p></BODY></html>";
    const html = visualHtmlDocument(page, "Map");
    expect(html.startsWith(page.slice(0, 40))).toBe(true);
    expect(html.endsWith("</script></body></html>")).toBe(true);
    expect(html.lastIndexOf(VISUAL_HTML_HEIGHT_MESSAGE)).toBeGreaterThan(html.indexOf("in text"));
    expect(html).toContain("<p>'</body>' in text</p>");
    expect(visualHtmlDocument("<html><p>x</p></html>", "Map")).toContain(`</html><script>`);
  });
});

describe("visualHtmlHeight", () => {
  const message = (height: unknown) => ({ type: VISUAL_HTML_HEIGHT_MESSAGE, height });

  it("takes the height from a sandboxed frame's message, within bounds", () => {
    expect(visualHtmlHeight("null", message(812.4))).toBe(812);
    expect(visualHtmlHeight("null", message(5))).toBe(VISUAL_HTML_HEIGHT.min);
    expect(visualHtmlHeight("null", message(1e9))).toBe(VISUAL_HTML_HEIGHT.max);
  });

  it("ignores anything else", () => {
    expect(visualHtmlHeight("https://atlas.example", message(500))).toBeNull();
    expect(visualHtmlHeight("null", { type: "datawrapper-height", height: 500 })).toBeNull();
    expect(visualHtmlHeight("null", message("500"))).toBeNull();
    expect(visualHtmlHeight("null", message(Number.NaN))).toBeNull();
    expect(visualHtmlHeight("null", "500")).toBeNull();
    expect(visualHtmlHeight("null", null)).toBeNull();
  });
});

it("visualHtmlSrc: one path per visual", () => {
  expect(visualHtmlSrc("00000000-0000-4000-8000-000000000001")).toBe(
    "/api/visual-html/00000000-0000-4000-8000-000000000001",
  );
});
