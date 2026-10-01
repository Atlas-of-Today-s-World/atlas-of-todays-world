import { describe, expect, it } from "vitest";
import { decodeEntities, htmlToText } from "../../scripts/lib/html.mjs";

describe("decodeEntities", () => {
  it("decodes in a single pass — &amp;lt; stays &lt;", () => {
    expect(decodeEntities("&amp;lt;script&amp;gt;")).toBe("&lt;script&gt;");
    expect(decodeEntities("A &amp; B &quot;C&quot; &#39;d&#x27; &#x2F;")).toBe(`A & B "C" 'd' /`);
  });

  it("leaves unknown or nonsensical entities alone", () => {
    expect(decodeEntities("&bogus; &#0; &#x110000;")).toBe("&bogus; &#0; &#x110000;");
  });
});

describe("htmlToText", () => {
  it("strips scripts and styles in any spelling, including nested leftovers", () => {
    const html =
      '<p>Hi</p><SCRIPT type="x">alert(1)</script ><style>p{}</STYLE><scr<script>x</script>ipt>bad()</script>';
    const out = htmlToText(html);
    // The leftover of a nested script ("bad()") is just text, not a tag.
    expect(out).not.toMatch(/alert|p\{\}|<|>/);
    expect(out).toContain("Hi");
  });

  it("does not assemble a tag from entities after stripping tags", () => {
    expect(htmlToText("&lt;img src=x onerror=1&gt;")).toBe("<img src=x onerror=1>");
    expect(htmlToText("<<b>b>text")).not.toMatch(/<b>/);
  });

  it("block ends as newlines only on request", () => {
    expect(htmlToText("<p>a</p><p>b</p>", { lineBreaks: true })).toBe(" a\n b\n");
    expect(htmlToText("<p>a</p><p>b</p>")).toBe(" a  b ");
  });
});
