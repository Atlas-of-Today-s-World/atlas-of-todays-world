import { describe, expect, it } from "vitest";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { decodeEntities, htmlToText, stripTags, textToHtml, wordCount } from "./html";

/** Editorial HTML as it is stored and rendered: always through the one allowlist. */
const ARTICLE = sanitizeRichHtml(
  [
    "<h2>Why it&nbsp;matters</h2>",
    "<p>Rock &amp; <strong>ro</strong>ll<br>next line&#8217;s &lt;b&gt;</p>",
    "<blockquote><p>Quoted</p></blockquote>",
    "<ul><li>One</li><li>Two</li></ul>",
    '<figure><img src="https://x.org/a.png" alt="a"><figcaption>Caption</figcaption></figure>',
    "<p>Last</p>",
  ].join(""),
);

describe("decodeEntities", () => {
  it("decodes named and numeric entities in a single pass", () => {
    expect(decodeEntities("&amp;lt;script&amp;gt;")).toBe("&lt;script&gt;");
    expect(decodeEntities("A &amp; B &quot;C&quot; &#39;d&#x27; &#x2F;")).toBe(`A & B "C" 'd' /`);
    // &nbsp; becomes a plain space (words split on it); curly quotes are decoded too.
    expect(decodeEntities("a&nbsp;b &rsquo;&ldquo;")).toBe("a b ’“");
  });

  it("leaves unknown names and code points outside Unicode alone", () => {
    expect(decodeEntities("&bogus; &#0; &#x110000;")).toBe("&bogus; &#0; &#x110000;");
  });
});

describe("stripTags", () => {
  it("removes nested leftovers and stray brackets, keeping entities encoded", () => {
    expect(stripTags("<<b>i>a &lt;b&gt;")).toBe("a &lt;b&gt;");
    expect(stripTags("<scr<b>ipt>x</script> a < b > c")).toBe("x a  c");
    expect(stripTags("a < b")).toBe("a  b");
    expect(stripTags("<b>W</b>ord", " ")).toBe(" W ord");
  });
});

describe("htmlToText", () => {
  it("separates tags with a space by default", () => {
    expect(htmlToText("<p>a</p><p>b</p>")).toBe(" a  b ");
  });

  it("turns block ends and <br> into the given separator", () => {
    expect(htmlToText("<p>a</p><p>b<br/>c</p>", { blockEnd: "\n" })).toBe(" a\n b\nc\n");
    // `lineBreak` keeps a <br> inside its paragraph.
    expect(
      htmlToText("<p>a</p><p>b<br/>c</p>", { blockEnd: "\n", lineBreak: "", tagGap: "" }),
    ).toBe("a\nbc\n");
  });

  it("collapses to one trimmed line on request", () => {
    expect(htmlToText(ARTICLE, { blockEnd: " ", tagGap: "", collapse: true })).toBe(
      "Why it matters Rock & roll next line’s <b> Quoted One Two Caption Last",
    );
  });

  it("drops scripts, styles and comments", () => {
    const html =
      '<p>Hi</p><SCRIPT type="x">alert(1)</script ><style>p{}</STYLE><!-- note --><scr<script>x</script>ipt>bad()</script>';
    const out = htmlToText(html, { collapse: true });
    expect(out).not.toMatch(/alert|p\{\}|note|<|>/);
    expect(out).toContain("Hi");
  });

  it("never assembles a tag: entities are decoded after every tag is gone", () => {
    expect(htmlToText("&lt;img src=x onerror=1&gt;")).toBe("<img src=x onerror=1>");
    expect(htmlToText("<<b>b>text")).not.toMatch(/<b>/);
    expect(
      htmlToText("<scr<script>ipt>alert(1)</script> a < b", { tagGap: "", collapse: true }),
    ).toBe("scr a b");
  });
});

describe("wordCount", () => {
  it("counts words, every tag separating them", () => {
    expect(wordCount(ARTICLE)).toBe(15);
    expect(wordCount("<p>one<br>two</p><p>three</p>")).toBe(3);
    expect(wordCount("")).toBe(0);
  });

  it("matches the former strip-and-split count on sanitized HTML", () => {
    // Before: tags → spaces, entities left encoded. In sanitized HTML entities
    // never contain or produce whitespace, so decoding doesn't change the count.
    const former = (html: string) =>
      html
        .replace(/<[^>]+>/g, " ")
        .split(/\s+/)
        .filter(Boolean).length;
    expect(wordCount(ARTICLE)).toBe(former(ARTICLE));
  });
});

describe("textToHtml", () => {
  it("makes a paragraph of each block and a <br> of a single line break", () => {
    expect(textToHtml("First line\nsecond line\n\n  \r\n\r\nNext paragraph  ")).toBe(
      "<p>First line<br>second line</p><p>Next paragraph</p>",
    );
  });

  it("escapes markup, so the text never becomes HTML", () => {
    expect(textToHtml('<script>alert("x")</script> & co')).toBe(
      "<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co</p>",
    );
  });

  it("gives nothing for empty text", () => {
    expect(textToHtml("")).toBe("");
    expect(textToHtml(" \n\n ")).toBe("");
  });

  it("round-trips through the sanitizer and back to the same words", () => {
    const html = textToHtml("A & B\n\nC");
    expect(sanitizeRichHtml(html)).toBe(html);
    expect(htmlToText(html, { blockEnd: "\n", tagGap: "" }).trim()).toBe("A & B\nC");
  });
});
