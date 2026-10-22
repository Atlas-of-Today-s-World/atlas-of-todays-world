import { z } from "zod";
import {
  blankToUndefined,
  optionalHttpsUrl,
  requiredText,
  slug,
  text,
  uuid,
} from "@/lib/validation/common";

/** Longest selected works HTML (DB `authors_works_html_length`). */
export const AUTHOR_WORKS_MAX = 20_000;

/**
 * Entry author (P9) — limits matching the `authors` table. `slug` is the
 * public URL (/authors/<slug>): empty on a new profile = generated from the
 * name; changing it on a saved one redirects the old URL (DB trigger).
 */
export const AuthorInput = z.object({
  id: z.preprocess(blankToUndefined, uuid.optional()),
  name: requiredText(120),
  slug: z.preprocess(blankToUndefined, slug(120).optional()),
  photo_url: optionalHttpsUrl,
  bio: text(2000),
  positionality: text(2000),
  /** Selected works: rich text (a list with links), sanitized when saved. */
  works_html: z
    .string()
    .max(AUTHOR_WORKS_MAX, `At most ${AUTHOR_WORKS_MAX} characters.`)
    .default(""),
});
export type AuthorInput = z.infer<typeof AuthorInput>;

/** Linking an author profile to a team account; empty account = unlink. */
export const AuthorAccountInput = z.object({
  id: uuid,
  profile_id: z.preprocess(blankToUndefined, uuid.optional()),
});
