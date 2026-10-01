import { describe, expect, it } from "vitest";
import { decodeEntities, htmlToText } from "../../scripts/lib/html.mjs";

describe("decodeEntities", () => {
  it("dekóduje jedním průchodem — &amp;lt; zůstane &lt;", () => {
    expect(decodeEntities("&amp;lt;script&amp;gt;")).toBe("&lt;script&gt;");
    expect(decodeEntities("A &amp; B &quot;C&quot; &#39;d&#x27; &#x2F;")).toBe(`A & B "C" 'd' /`);
  });

  it("neznámou nebo nesmyslnou entitu nechá být", () => {
    expect(decodeEntities("&bogus; &#0; &#x110000;")).toBe("&bogus; &#0; &#x110000;");
  });
});

describe("htmlToText", () => {
  it("vyhodí skripty a styly v jakémkoli zápisu i vnořené zbytky", () => {
    const html =
      '<p>Hi</p><SCRIPT type="x">alert(1)</script ><style>p{}</STYLE><scr<script>x</script>ipt>bad()</script>';
    const out = htmlToText(html);
    // Zbytek po vnořeném skriptu („bad()") je jen text, ne značka.
    expect(out).not.toMatch(/alert|p\{\}|<|>/);
    expect(out).toContain("Hi");
  });

  it("z entit po odstranění značek žádnou značku nesloží", () => {
    expect(htmlToText("&lt;img src=x onerror=1&gt;")).toBe("<img src=x onerror=1>");
    expect(htmlToText("<<b>b>text")).not.toMatch(/<b>/);
  });

  it("konce bloků jako nové řádky jen na požádání", () => {
    expect(htmlToText("<p>a</p><p>b</p>", { lineBreaks: true })).toBe(" a\n b\n");
    expect(htmlToText("<p>a</p><p>b</p>")).toBe(" a  b ");
  });
});
