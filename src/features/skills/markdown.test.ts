import { describe, expect, it } from "vitest";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { markdownToHtml } from "./markdown";

const md = (text: string) => markdownToHtml(text);

describe("markdownToHtml", () => {
  it("renders headings one level down with ids the sanitizer keeps", () => {
    expect(md("# Atlas — architektura\n## Kontext v kostce ##\n#### Deep\n###### Deeper")).toBe(
      '<h2 id="atlas-architektura">Atlas — architektura</h2>' +
        '<h3 id="kontext-v-kostce">Kontext v kostce</h3>' +
        '<h4 id="deep">Deep</h4><h4 id="deeper">Deeper</h4>',
    );
    const html = md("## 15. Rules\n## 15. Rules");
    expect(html).toContain('id="h-15-rules"');
    expect(html).toContain('id="h-15-rules-2"');
    expect(sanitizeRichHtml(html)).toBe(html);
  });

  it("shares heading ids across documents of one page", () => {
    const ids = new Set(["file-a-md"]);
    expect(markdownToHtml("# File a md", { ids })).toBe('<h2 id="file-a-md-2">File a md</h2>');
  });

  it("renders paragraphs with inline formatting", () => {
    expect(md("Some **bold**, *em*, _em_ and `a <b> & c` text\nnext line.\n\nSecond.")).toBe(
      "<p>Some <strong>bold</strong>, <em>em</em>, <em>em</em> and " +
        "<code>a &lt;b&gt; &amp; c</code> text\nnext line.</p><p>Second.</p>",
    );
    expect(md("snake_case_name and 2 * 3 * 4 and \\*not em\\*")).toBe(
      "<p>snake_case_name and 2 * 3 * 4 and *not em*</p>",
    );
    expect(md("line one  \nline two")).toBe("<p>line one<br>line two</p>");
    expect(md("``code with ` tick``")).toBe("<p><code>code with ` tick</code></p>");
  });

  it("escapes HTML in the text", () => {
    expect(md('<script>alert("x")</script>')).toBe(
      "<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>",
    );
  });

  it("renders links and rewrites their targets", () => {
    const link = (href: string) => (href.startsWith("http") ? href : `#${href}`);
    expect(
      markdownToHtml("[the **docs**](https://example.org/a?b=1&c=2) and [ref](ref.md)", {
        link,
      }),
    ).toBe(
      '<p><a href="https://example.org/a?b=1&amp;c=2">the <strong>docs</strong></a> and ' +
        '<a href="#ref.md">ref</a></p>',
    );
    expect(md("<https://claude.ai>")).toBe(
      '<p><a href="https://claude.ai">https://claude.ai</a></p>',
    );
    // A javascript: link survives the renderer as text-safe markup; the sanitizer drops the href.
    expect(sanitizeRichHtml(md("[x](javascript:alert(1))"))).not.toContain("javascript");
  });

  it("renders tight, loose, ordered and nested lists with continuation lines", () => {
    expect(md("- one\n- two\n  continued\n  - nested\n- three")).toBe(
      "<ul><li>one</li><li>two\ncontinued\n<ul><li>nested</li></ul></li><li>three</li></ul>",
    );
    expect(md("1. first\n\n2. second")).toBe(
      "<ol><li><p>first</p></li><li><p>second</p></li></ol>",
    );
    expect(md("- a\n1. b")).toBe("<ul><li>a</li></ul><ol><li>b</li></ol>");
    expect(md("Text\n- item")).toBe("<p>Text</p><ul><li>item</li></ul>");
  });

  it("renders fenced code verbatim", () => {
    expect(md("```tsx\nconst a = <div>**x**</div>;\n\n  indented\n```\nafter")).toBe(
      "<pre><code>const a = &lt;div&gt;**x**&lt;/div&gt;;\n\n  indented</code></pre><p>after</p>",
    );
    expect(md("~~~\nunclosed")).toBe("<pre><code>unclosed</code></pre>");
  });

  it("renders tables, quotes and rules", () => {
    expect(md("| Command | When |\n|---|:-:|\n| `a \\| b` | **always** |\n| x |")).toBe(
      "<table><thead><tr><th>Command</th><th>When</th></tr></thead>" +
        "<tbody><tr><td><code>a | b</code></td><td><strong>always</strong></td></tr>" +
        "<tr><td>x</td><td></td></tr></tbody></table>",
    );
    expect(md("> quoted\n> **text**")).toBe(
      "<blockquote><p>quoted\n<strong>text</strong></p></blockquote>",
    );
    expect(md("a\n\n---\n\n* * *")).toBe("<p>a</p><hr><hr>");
  });

  it("produces markup the sanitizer keeps as it is", () => {
    const html = md(
      "# T\n\nText with [link](https://example.org) and `code`.\n\n- a\n- b\n\n| x | y |\n|---|---|\n| 1 | 2 |\n\n```\ncode\n```\n\n> q\n\n---",
    );
    // The sanitizer only adds rel to links and writes void tags as <hr />.
    expect(sanitizeRichHtml(html).replace("<hr />", "<hr>")).toBe(
      html.replace(
        '<a href="https://example.org">',
        '<a href="https://example.org" rel="noopener noreferrer">',
      ),
    );
  });
});
