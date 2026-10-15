import { describe, expect, it } from "vitest";
import { toRichNodes, type DomLike } from "./popup-html";

// A tiny DOM double: the converter reads only these fields.
const text = (value: string): DomLike => ({
  nodeType: 3,
  nodeName: "#text",
  textContent: value,
  childNodes: [],
});
const el = (name: string, attrs: Record<string, string>, ...children: DomLike[]): DomLike => ({
  nodeType: 1,
  nodeName: name.toUpperCase(),
  textContent: null,
  childNodes: children,
  getAttribute: (attr) => attrs[attr] ?? null,
});
const comment: DomLike = { nodeType: 8, nodeName: "#comment", textContent: "x", childNodes: [] };

describe("toRichNodes", () => {
  it("keeps the popup's formatting", () => {
    expect(
      toRichNodes([
        el("p", {}, el("strong", {}, text("Gaza")), text(" "), el("em", {}, text("2.1 m"))),
        el("ul", {}, el("li", {}, text("a"), el("br", {}))),
        el("ol", {}, el("li", {}, el("b", {}, text("b")), el("i", {}, text("i")))),
      ]),
    ).toEqual([
      {
        kind: "element",
        tag: "p",
        children: [
          { kind: "element", tag: "strong", children: [{ kind: "text", text: "Gaza" }] },
          { kind: "text", text: " " },
          { kind: "element", tag: "em", children: [{ kind: "text", text: "2.1 m" }] },
        ],
      },
      {
        kind: "element",
        tag: "ul",
        children: [
          { kind: "element", tag: "li", children: [{ kind: "text", text: "a" }, { kind: "br" }] },
        ],
      },
      {
        kind: "element",
        tag: "ol",
        children: [
          {
            kind: "element",
            tag: "li",
            children: [
              { kind: "element", tag: "strong", children: [{ kind: "text", text: "b" }] },
              { kind: "element", tag: "em", children: [{ kind: "text", text: "i" }] },
            ],
          },
        ],
      },
    ]);
  });

  it("keeps safe links and unwraps the rest to their text", () => {
    expect(toRichNodes([el("a", { href: "https://unrwa.org" }, text("UNRWA"))])).toEqual([
      { kind: "link", href: "https://unrwa.org/", children: [{ kind: "text", text: "UNRWA" }] },
    ]);
    expect(toRichNodes([el("a", { href: "mailto:a@b.cz" }, text("m"))])[0]).toMatchObject({
      kind: "link",
      href: "mailto:a@b.cz",
    });
    for (const href of [
      "javascript:alert(1)",
      "data:text/html,x",
      "//evil.example",
      "http://x.org",
    ]) {
      expect(toRichNodes([el("a", { href }, text("x"))])).toEqual([{ kind: "text", text: "x" }]);
    }
    expect(toRichNodes([el("a", {}, text("x"))])).toEqual([{ kind: "text", text: "x" }]);
  });

  it("turns span classes into fixed styles and drops other spans", () => {
    expect(toRichNodes([el("span", { class: "rt-color-red rt-size-large" }, text("red"))])).toEqual(
      [
        {
          kind: "element",
          tag: "span",
          style: { color: "#b91c1c", fontSize: "1.2em" },
          children: [{ kind: "text", text: "red" }],
        },
      ],
    );
    expect(
      toRichNodes([el("span", { class: "fixed inset-0", style: "color:red" }, text("x"))]),
    ).toEqual([{ kind: "text", text: "x" }]);
  });

  it("drops scripts and styles with their content; unwraps unknown tags; skips comments", () => {
    expect(
      toRichNodes([
        el("script", {}, text("alert(1)")),
        el("style", {}, text("body{}")),
        el("iframe", { src: "https://evil.example" }, text("f")),
        el("svg", {}, el("script", {}, text("x"))),
        el("div", { onclick: "alert(1)" }, el("h2", {}, text("Title"))),
        el("img", { src: "x", onerror: "alert(1)" }),
        comment,
        text(""),
      ]),
    ).toEqual([{ kind: "text", text: "Title" }]);
  });
});
