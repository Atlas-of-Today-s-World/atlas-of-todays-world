import { beforeEach, describe, expect, it, vi } from "vitest";
import { NEWS_CATEGORIES } from "@/lib/content-types";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { BODY_HTML_MAX, CHAPTER_HTML_MAX } from "@/features/entries/schema";
import { PROFILE_HTML_MAX } from "@/features/portraits/schema";

/**
 * sanitizeRichHtml adds `rel="noopener noreferrer"` to every link, so rich text
 * that passes the Zod limit can outgrow the DB CHECK once sanitized. The
 * actions check the sanitized HTML and answer with a field error instead of
 * sending a write the database refuses.
 */

const signedIn = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ updateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/seo/indexnow", () => ({ notifyIndexNow: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn() }));
vi.mock("@/lib/actions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/actions")>()),
  signedIn,
}));

const LINK = '<a href="https://example.org/">x</a>';

/** As many links as fit in `max` characters: fine for Zod, too long once sanitized. */
function linksUpTo(max: number) {
  const html = LINK.repeat(Math.floor(max / LINK.length));
  expect(html.length).toBeLessThanOrEqual(max);
  expect(sanitizeRichHtml(html).length).toBeGreaterThan(max);
  return html;
}

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
};

const entryId = "00000000-0000-4000-8000-000000000123";

describe("rich text is measured after sanitizing", { timeout: 30_000 }, () => {
  beforeEach(() => {
    signedIn.mockReset();
  });

  it("saveEntry: a body that grows past the limit is a field error, nothing is written", async () => {
    const { saveEntry } = await import("@/features/entries/actions");
    const result = await saveEntry(
      { ok: false },
      form({
        id: entryId,
        slug: "a",
        title: "A",
        summary: "",
        category: NEWS_CATEGORIES[0] ?? "",
        cover_credit: "",
        author_name: "",
        body_html: linksUpTo(BODY_HTML_MAX),
      }),
    );
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { body_html: ["The text is too long."] },
    });
    expect(signedIn).not.toHaveBeenCalled();
  });

  it("saveChapters: names the subtopic whose text grows past the limit", async () => {
    const { saveChapters } = await import("@/features/entries/parts-actions");
    const data = form({ entry_id: entryId });
    for (const body of ["<p>Short.</p>", linksUpTo(CHAPTER_HTML_MAX)]) {
      data.append("title", "Chapter");
      data.append("summary_points", "");
      data.append("body_html", body);
    }
    const result = await saveChapters({ ok: false }, data);
    expect(result).toEqual({
      ok: false,
      error: "Subtopic 2, text: The chapter text is too long.",
    });
    expect(signedIn).not.toHaveBeenCalled();
  });

  it("saveCountry: a profile that grows past the limit is a field error", async () => {
    const { saveCountry } = await import("@/features/portraits/actions");
    const result = await saveCountry(
      { ok: false },
      form({
        iso3: "UKR",
        name: "Ukraine",
        blurb: "",
        tagline: "",
        profile_html: linksUpTo(PROFILE_HTML_MAX),
      }),
    );
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { profile_html: ["The text is too long."] },
    });
    expect(signedIn).not.toHaveBeenCalled();
  });
});
