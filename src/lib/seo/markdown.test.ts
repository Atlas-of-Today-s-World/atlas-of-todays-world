import { describe, expect, it } from "vitest";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { htmlToMarkdown } from "./markdown";

const md = (html: string) => htmlToMarkdown(sanitizeRichHtml(html));

describe("htmlToMarkdown", () => {
  it("headings, paragraphs, emphasis and links", () => {
    expect(
      md(
        '<h2>Why it matters</h2><p>The <strong>Sahel</strong> is <em>vast</em>; see <a href="https://acleddata.com/x">ACLED</a>.</p><p>Second &amp; last.</p>',
      ),
    ).toBe(
      "## Why it matters\n\nThe **Sahel** is _vast_; see [ACLED](https://acleddata.com/x).\n\nSecond & last.",
    );
  });

  it("lists, quotes, rules, images and line breaks", () => {
    expect(
      md(
        '<ul><li>One</li><li>Two <a href="https://a.org">link</a></li></ul><ol><li>First</li><li>Second</li></ol><blockquote><p>Quoted</p></blockquote><hr><p>Line<br>break</p><figure><img src="https://x.org/i.jpg" alt="Map"><figcaption>Credit</figcaption></figure>',
      ),
    ).toBe(
      "- One\n- Two [link](https://a.org)\n\n1. First\n2. Second\n\n> Quoted\n\n---\n\nLine  \nbreak\n\n![Map](https://x.org/i.jpg)\n\n_Credit_",
    );
  });

  it("tables as pipe tables, code blocks kept literally", () => {
    expect(
      md(
        "<table><thead><tr><th>Country</th><th>HDI</th></tr></thead><tbody><tr><td>Chad</td><td>0.394 | low</td></tr></tbody></table><pre><code>a &lt; b</code></pre>",
      ),
    ).toBe("| Country | HDI |\n| --- | --- |\n| Chad | 0.394 \\| low |\n\n```\na < b\n```");
  });

  it("never leaves a tag, even from broken markup; escapes backslashes in tables", () => {
    expect(htmlToMarkdown("<p>a <scr<script>ipt>alert(1)</p>")).not.toMatch(/<|>/);
    expect(htmlToMarkdown("<pre><code><scr<b>ipt></code></pre>")).not.toMatch(/<[a-z]/i);
    expect(htmlToMarkdown("<table><tr><th>A</th></tr><tr><td>x\\|y</td></tr></table>")).toContain(
      "| x\\\\\\|y |",
    );
  });

  it("empty input gives empty output", () => {
    expect(htmlToMarkdown("")).toBe("");
  });
});
