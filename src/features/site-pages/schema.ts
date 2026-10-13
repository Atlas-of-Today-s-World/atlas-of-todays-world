import { z } from "zod";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { blankToUndefined, checkbox, requiredText, text } from "@/lib/validation/common";
import { SITE_PAGE_LIMITS, SITE_PAGE_SLUGS } from "./pages";

/** Raw HTML from the editor before sanitizing — a guard against huge posts. */
const RAW_BODY_MAX = 400_000;

/**
 * A site page as the admin saves it — limits matching the CHECKs on
 * site_pages. The body is sanitized here (the single allowlist) and its
 * length checked after sanitizing, so the DB never sees unsanitized HTML from
 * the admin.
 */
export const SitePageInput = z.object({
  slug: z.enum(SITE_PAGE_SLUGS),
  title: requiredText(SITE_PAGE_LIMITS.title),
  description: requiredText(SITE_PAGE_LIMITS.description),
  lead: text(SITE_PAGE_LIMITS.lead),
  body_html: z
    .string()
    .max(RAW_BODY_MAX, "The text is too long.")
    .transform(sanitizeRichHtml)
    .pipe(
      z
        .string()
        .max(
          SITE_PAGE_LIMITS.body,
          `The text is too long (at most ${SITE_PAGE_LIMITS.body.toLocaleString("en")} characters of HTML).`,
        ),
    ),
  last_reviewed: z.preprocess(
    blankToUndefined,
    z.iso
      .date("A date, e.g. 2026-10-13.")
      .refine((value) => value >= "2000-01-01" && value <= "2100-12-31", "A date after 2000.")
      .optional(),
  ),
  published: checkbox,
});
export type SitePageInput = z.infer<typeof SitePageInput>;

/** Revision id from the history list. */
export const RevisionId = z.number().int().positive();
