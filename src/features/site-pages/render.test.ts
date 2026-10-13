import { describe, expect, it } from "vitest";
import { PAGE_TOKENS } from "./pages";
import { fillInline, linkHtml, replaceInText, splitAtBlock } from "./render";

const CONTACT = linkHtml("mailto:hello@example.org", "hello@example.org");

describe("replaceInText", () => {
  it("replaces in text, never inside a tag or attribute", () => {
    const html =
      '<p>Write to {{contact}}.</p><p><a href="https://x.org/{{contact}}">{{contact}}</a></p>';
    expect(replaceInText(html, "{{contact}}", "<b>")).toBe(
      '<p>Write to <b>.</p><p><a href="https://x.org/{{contact}}"><b></a></p>',
    );
  });
});

describe("linkHtml", () => {
  it("escapes the values it is given", () => {
    expect(linkHtml('mailto:a"b@x.org', "<a&b>")).toBe(
      '<a href="mailto:a&quot;b@x.org">&lt;a&amp;b&gt;</a>',
    );
  });
});

describe("fillInline", () => {
  it("fills the contact link and the e-mail", () => {
    expect(
      fillInline("<p>Questions: {{contact}}. Mail {{email}}.</p>", {
        [PAGE_TOKENS.contact]: CONTACT,
        [PAGE_TOKENS.email]: "a&amp;b@x.org",
      }),
    ).toBe(
      '<p>Questions: <a href="mailto:hello@example.org">hello@example.org</a>. Mail a&amp;b@x.org.</p>',
    );
  });

  it("sanitizes first, so an XSS payload in the body never survives", () => {
    const out = fillInline(
      '<p onclick="x()">Hi {{contact}}<script>alert(1)</script><img src=x onerror=alert(1)></p>',
      { [PAGE_TOKENS.contact]: CONTACT },
    );
    expect(out).toBe(`<p>Hi ${CONTACT}</p>`);
  });

  it("a token typed into a link address stays inert text in the attribute", () => {
    const out = fillInline('<p><a href="https://x.org/{{contact}}">a</a></p>', {
      [PAGE_TOKENS.contact]: CONTACT,
    });
    expect(out).toBe('<p><a href="https://x.org/{{contact}}" rel="noopener noreferrer">a</a></p>');
  });
});

describe("splitAtBlock", () => {
  const token = PAGE_TOKENS.dataSources;

  it("splits at a top-level paragraph holding only the token", () => {
    expect(splitAtBlock(`<h2>Data</h2><p>Sources:</p><p>${token}</p><h2>Next</h2>`, token)).toEqual(
      {
        before: "<h2>Data</h2><p>Sources:</p>",
        after: "<h2>Next</h2>",
      },
    );
  });

  it("without the paragraph the component goes below, and stray tokens are removed", () => {
    expect(splitAtBlock(`<p>See ${token} here</p>`, token)).toEqual({
      before: "<p>See  here</p>",
      after: null,
    });
    expect(splitAtBlock("<p>No token.</p>", token)).toEqual({
      before: "<p>No token.</p>",
      after: null,
    });
  });

  it("ignores the paragraph when it is nested (it would break the markup)", () => {
    expect(splitAtBlock(`<blockquote><p>${token}</p></blockquote><hr /><p>x</p>`, token)).toEqual({
      before: "<blockquote><p></p></blockquote><hr /><p>x</p>",
      after: null,
    });
  });

  it("counts void elements as closed", () => {
    expect(splitAtBlock(`<p>a<br />b</p><hr /><p>${token}</p><p>${token}</p>`, token)).toEqual({
      before: "<p>a<br />b</p><hr />",
      after: "<p></p>",
    });
  });
});
