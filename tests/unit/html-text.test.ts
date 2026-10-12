import { describe, expect, it } from "vitest";
import * as app from "@/lib/text/html";
import { decodeEntities, htmlToText } from "../../scripts/lib/html.mjs";
import { plain } from "../../scripts/webflow/core.mjs";

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
    expect(htmlToText("<p>a</p><p>b</p>", { blockEnd: "\n" })).toBe(" a\n b\n");
    expect(htmlToText("<p>a</p><p>b</p>")).toBe(" a  b ");
  });
});

describe("Webflow plain text", () => {
  it("keeps a quote on one line with the next paragraph, as the import always did", () => {
    expect(plain("<blockquote>Quote.</blockquote><p>Next.</p><p>Last<br>line</p>")).toBe(
      "Quote. Next.\nLast\nline",
    );
  });
});

// scripts/lib/html.mjs mirrors src/lib/text/html.ts (plain Node can't import TypeScript).
describe("scripts/lib/html.mjs agrees with src/lib/text/html.ts", () => {
  const samples = [
    "",
    "plain text",
    "<p>Rock &amp; <strong>ro</strong>ll<br>next&nbsp;line&#8217;s &lt;b&gt; &rsquo;&ldquo;&#x1F30D;</p>",
    "<h2>T</h2><blockquote><p>q</p>r</blockquote><figure><figcaption>Cap</figcaption></figure><div>d</div>",
    "<ul><li>one</li><li>two</li></ul><table><tr><td>a</td></tr></table>",
    "a < b > c <<b>i> &amp;lt; &#x110000; &#0; &bogus;",
    '<scr<script>ipt>alert(1)</script> <STYLE>p{}</style ><!-- c --><p class="x">y</p >',
  ];
  const options = [
    undefined,
    { blockEnd: "\n" },
    { blockEnd: " ", tagGap: "", collapse: true },
    { blockEnd: "\n", lineBreak: "", tagGap: "" },
  ];

  it("decodeEntities", () => {
    for (const sample of samples) expect(decodeEntities(sample)).toBe(app.decodeEntities(sample));
  });

  it.each(options.map((option) => [JSON.stringify(option ?? {}), option]))(
    "htmlToText %s",
    (_name, option) => {
      for (const sample of samples)
        expect(htmlToText(sample, option)).toBe(app.htmlToText(sample, option));
    },
  );
});
