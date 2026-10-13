import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { DEFAULT_SITE_PAGES, pageOrDefault, type PublishedRow } from "./defaults";
import { SITE_PAGE_LIMITS, SITE_PAGE_SLUGS } from "./pages";

// Vitest runs from the repository root.
const MIGRATION = readFileSync("supabase/migrations/20261013000150_site_pages.sql", "utf8");
const sql = (value: string) => `'${value.replaceAll("'", "''")}'`;

describe("built-in site pages", () => {
  it("are the texts the migration seeds, in the same order", () => {
    const bodies = [...MIGRATION.matchAll(/\$html\$([\s\S]*?)\$html\$/g)].map((match) => match[1]);
    expect(bodies).toEqual(SITE_PAGE_SLUGS.map((slug) => DEFAULT_SITE_PAGES[slug].body_html));
    for (const slug of SITE_PAGE_SLUGS) {
      const page = DEFAULT_SITE_PAGES[slug];
      expect(MIGRATION).toContain(
        `${sql(slug)},\n  ${sql(page.title)},\n  ${sql(page.description)},\n  ${sql(page.lead)},`,
      );
      const date = page.last_reviewed ? `date '${page.last_reviewed}'` : "null";
      expect(MIGRATION).toContain(`${page.body_html}$html$,\n  ${date}\n)`);
    }
  });

  it("are stored already sanitized and within the database limits", () => {
    for (const slug of SITE_PAGE_SLUGS) {
      const page = DEFAULT_SITE_PAGES[slug];
      expect(page.slug).toBe(slug);
      expect(sanitizeRichHtml(page.body_html)).toBe(page.body_html);
      expect(page.title.length).toBeLessThanOrEqual(SITE_PAGE_LIMITS.title);
      expect(page.description.length).toBeLessThanOrEqual(SITE_PAGE_LIMITS.description);
      expect(page.lead.length).toBeLessThanOrEqual(SITE_PAGE_LIMITS.lead);
      expect(page.body_html.length).toBeLessThanOrEqual(SITE_PAGE_LIMITS.body);
    }
  });

  it("keep the About anchors other pages link to", () => {
    const about = DEFAULT_SITE_PAGES.about.body_html;
    for (const anchor of ["mission", "data", "editorial-standards", "cite", "machine-readable"]) {
      expect(about).toContain(`<h2 id="${anchor}">`);
    }
  });
});

describe("pageOrDefault", () => {
  const row: PublishedRow = {
    title: "Privacy (edited)",
    description: "Edited description.",
    lead: "Lead.",
    body_html: "<p>Edited.</p>",
    last_reviewed: "2026-10-13",
    published: true,
  };

  it("shows the published row", () => {
    expect(pageOrDefault("privacy", row)).toEqual({
      slug: "privacy",
      title: "Privacy (edited)",
      description: "Edited description.",
      lead: "Lead.",
      body_html: "<p>Edited.</p>",
      last_reviewed: "2026-10-13",
    });
  });

  it("falls back to the built-in text when the row is missing or the read failed", () => {
    expect(pageOrDefault("terms", null)).toBe(DEFAULT_SITE_PAGES.terms);
  });

  it("falls back to the built-in text when the page is unpublished", () => {
    expect(pageOrDefault("about", { ...row, published: false })).toBe(DEFAULT_SITE_PAGES.about);
  });
});
