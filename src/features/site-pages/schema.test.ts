import { describe, expect, it } from "vitest";
import { SitePageInput } from "./schema";

const valid = {
  slug: "privacy",
  title: " Privacy policy ",
  description: "What we process.",
  lead: "",
  body_html: "<h2>Accounts</h2><p>Text and {{contact}}.</p>",
  last_reviewed: "2026-10-13",
  published: "on",
};

describe("SitePageInput", () => {
  it("accepts a page and trims its texts", () => {
    expect(SitePageInput.parse(valid)).toEqual({
      slug: "privacy",
      title: "Privacy policy",
      description: "What we process.",
      lead: "",
      body_html: "<h2>Accounts</h2><p>Text and {{contact}}.</p>",
      last_reviewed: "2026-10-13",
      published: true,
    });
  });

  it("strips XSS payloads from the body on save", () => {
    const parsed = SitePageInput.parse({
      ...valid,
      body_html:
        '<p onclick="steal()">Hi</p><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a><iframe src="https://evil.example"></iframe>',
    });
    expect(parsed.body_html).toBe('<p>Hi</p><a rel="noopener noreferrer">x</a>');
  });

  it("checks the body length after sanitizing", () => {
    const junk = `<script>${"x".repeat(150_000)}</script><p>ok</p>`;
    expect(SitePageInput.parse({ ...valid, body_html: junk }).body_html).toBe("<p>ok</p>");
    const long = `<p>${"x".repeat(100_000)}</p>`;
    expect(SitePageInput.safeParse({ ...valid, body_html: long }).success).toBe(false);
    expect(SitePageInput.safeParse({ ...valid, body_html: "x".repeat(400_001) }).success).toBe(
      false,
    );
  });

  it("an empty date hides the line; nonsense dates are refused", () => {
    expect(SitePageInput.parse({ ...valid, last_reviewed: "" }).last_reviewed).toBeUndefined();
    for (const date of ["2026-02-30", "13.10.2026", "1999-12-31", "2101-01-01"]) {
      expect(SitePageInput.safeParse({ ...valid, last_reviewed: date }).success).toBe(false);
    }
  });

  it("only the known pages, a title and a description", () => {
    expect(SitePageInput.safeParse({ ...valid, slug: "imprint" }).success).toBe(false);
    expect(SitePageInput.safeParse({ ...valid, title: "   " }).success).toBe(false);
    expect(SitePageInput.safeParse({ ...valid, description: "" }).success).toBe(false);
    expect(SitePageInput.safeParse({ ...valid, description: "x".repeat(301) }).success).toBe(false);
    expect(SitePageInput.parse({ ...valid, published: undefined }).published).toBe(false);
  });
});
