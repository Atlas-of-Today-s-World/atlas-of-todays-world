import { z } from "zod";
import {
  blankToUndefined,
  optionalHttpsUrl,
  requiredText,
  slug,
  text,
  uuid,
} from "@/lib/validation/common";

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
});
export type AuthorInput = z.infer<typeof AuthorInput>;

/** Linking an author profile to a team account; empty account = unlink. */
export const AuthorAccountInput = z.object({
  id: uuid,
  profile_id: z.preprocess(blankToUndefined, uuid.optional()),
});
