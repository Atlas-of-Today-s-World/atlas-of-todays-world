import { describe, expect, it } from "vitest";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { hasSlots, splitSlots } from "./html-slots";

const split = (html: string) => splitSlots(sanitizeRichHtml(html), ["email"]);

describe("splitSlots", () => {
  it("rebuilds the paragraph around the placeholder", () => {
    expect(split("<p>Write to {email} today.</p>")).toEqual([
      {
        kind: "parent",
        tag: "p",
        children: [
          { kind: "text", text: "Write to " },
          { kind: "slot", name: "email" },
          { kind: "text", text: " today." },
        ],
      },
    ]);
  });

  it("keeps blocks without a placeholder as their sanitized HTML", () => {
    expect(split("<p>First <strong>one</strong></p><p>Mail {email}</p>")).toEqual([
      { kind: "element", tag: "p", inner: "First <strong>one</strong>" },
      {
        kind: "parent",
        tag: "p",
        children: [
          { kind: "text", text: "Mail " },
          { kind: "slot", name: "email" },
        ],
      },
    ]);
  });

  it("goes into nested attribute-less elements and lists", () => {
    expect(split("<ul><li>a</li><li><strong>at {email}</strong></li></ul>")).toEqual([
      {
        kind: "parent",
        tag: "ul",
        children: [
          { kind: "element", tag: "li", inner: "a" },
          {
            kind: "parent",
            tag: "li",
            children: [
              {
                kind: "parent",
                tag: "strong",
                children: [
                  { kind: "text", text: "at " },
                  { kind: "slot", name: "email" },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("keeps links whole: a placeholder in an attribute or a link text stays text", () => {
    const html = sanitizeRichHtml('<p><a href="mailto:{email}">{email}</a> or {email}<br>bye</p>');
    expect(splitSlots(html, ["email"])).toEqual([
      {
        kind: "parent",
        tag: "p",
        children: [
          {
            kind: "inline",
            html: '<a href="mailto:{email}" rel="noopener noreferrer">{email}</a>',
          },
          { kind: "text", text: " or " },
          { kind: "slot", name: "email" },
          { kind: "element", tag: "br", inner: "" },
          { kind: "text", text: "bye" },
        ],
      },
    ]);
  });

  it("decodes entities only into text, so markup in text can't become a tag", () => {
    expect(split("<p>&lt;script&gt;alert(1)&lt;/script&gt; {email} &amp; more</p>")).toEqual([
      {
        kind: "parent",
        tag: "p",
        children: [
          { kind: "text", text: "<script>alert(1)</script> " },
          { kind: "slot", name: "email" },
          { kind: "text", text: " & more" },
        ],
      },
    ]);
  });

  it("ignores placeholders that weren't asked for", () => {
    expect(split("<p>{name} and {email}</p>")).toEqual([
      {
        kind: "parent",
        tag: "p",
        children: [
          { kind: "text", text: "{name} and " },
          { kind: "slot", name: "email" },
        ],
      },
    ]);
  });
});

describe("hasSlots", () => {
  it("finds a placeholder in text only", () => {
    expect(hasSlots(sanitizeRichHtml("<p>Mail {email}</p>"), ["email"])).toBe(true);
    expect(hasSlots(sanitizeRichHtml("<p>No placeholder</p>"), ["email"])).toBe(false);
    expect(
      hasSlots(sanitizeRichHtml('<p><a href="https://x.org/{email}">x</a></p>'), ["email"]),
    ).toBe(false);
    expect(hasSlots("<p>{email}</p>", [])).toBe(false);
  });
});
