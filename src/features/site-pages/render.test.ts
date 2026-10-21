import { describe, expect, it } from "vitest";
import { PAGE_TOKENS } from "./pages";
import { fillInline, linkHtml, replaceInText, splitAtBlock, splitTimeline } from "./render";

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

describe("splitTimeline", () => {
  const story =
    '<h2 id="intro">Intro</h2><p>a</p><h2 id="our-story">Our story</h2><p>Lead.</p>' +
    "<h3>2015–2019: Refugee <em>crisis</em></h3><p>One.</p><p>Two.</p>" +
    "<h3>Next: regular content</h3><p>Three.</p>" +
    '<h2 id="team">Team</h2><h3>Not a milestone</h3>';

  it("splits the section into its intro, milestones and the rest", () => {
    expect(splitTimeline(story, "our-story")).toEqual({
      before: '<h2 id="intro">Intro</h2><p>a</p><h2 id="our-story">Our story</h2><p>Lead.</p>',
      milestones: [
        { date: "2015–2019", title: "Refugee crisis", html: "<p>One.</p><p>Two.</p>" },
        { date: "Next", title: "Regular content", html: "<p>Three.</p>" },
      ],
      after: '<h2 id="team">Team</h2><h3>Not a milestone</h3>',
    });
  });

  it("keeps a heading without a colon as the title, and runs to the end without a next section", () => {
    expect(splitTimeline('<h2 id="our-story">S</h2><h3>Founded</h3><p>x</p>', "our-story")).toEqual(
      {
        before: '<h2 id="our-story">S</h2>',
        milestones: [{ date: "", title: "Founded", html: "<p>x</p>" }],
        after: "",
      },
    );
  });

  it("is null without the section or without milestones in it", () => {
    expect(splitTimeline("<h2>Other</h2><h3>a</h3>", "our-story")).toBeNull();
    expect(
      splitTimeline('<h2 id="our-story">S</h2><p>x</p><h2>Next</h2><h3>a</h3>', "our-story"),
    ).toBeNull();
  });
});
