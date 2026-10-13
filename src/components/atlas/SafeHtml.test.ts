import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SafeHtml } from "./SafeHtml";

const mail = createElement("a", { href: "mailto:info@example.org" }, "info@example.org");
const render = (html: string, slots?: Record<string, ReturnType<typeof createElement>>) =>
  renderToStaticMarkup(createElement(SafeHtml, { html, slots }));

describe("SafeHtml slots", () => {
  it("puts the React element where the placeholder stands, keeping the paragraphs", () => {
    expect(
      render("<p>First.</p><p>Write to {email}, and we will <strong>help</strong>.</p>", {
        email: mail,
      }),
    ).toBe(
      '<div><p>First.</p><p>Write to <a href="mailto:info@example.org">info@example.org</a>, and we will <strong>help</strong>.</p></div>',
    );
  });

  it("sanitizes first: no script, no handler, escaped text stays text", () => {
    expect(
      render('<p onclick="x()">&lt;b&gt;hi&lt;/b&gt; {email}<script>alert(1)</script></p>', {
        email: mail,
      }),
    ).toBe(
      '<div><p>&lt;b&gt;hi&lt;/b&gt; <a href="mailto:info@example.org">info@example.org</a></p></div>',
    );
  });

  it("renders as before without slots or without a placeholder", () => {
    expect(render("<p>Plain {email}</p>")).toBe("<div><p>Plain {email}</p></div>");
    expect(render("<p>No placeholder</p>", { email: mail })).toBe(
      "<div><p>No placeholder</p></div>",
    );
  });
});
