import { z } from "zod";
import {
  blankToUndefined,
  optionalHttpsUrl,
  requiredText,
  text,
  uuid,
} from "@/lib/validation/common";

/** Entry author (P9) — limits matching the `authors` table. */
export const AuthorInput = z.object({
  id: z.preprocess(blankToUndefined, uuid.optional()),
  name: requiredText(120),
  photo_url: optionalHttpsUrl,
  bio: text(2000),
  positionality: text(2000),
});
export type AuthorInput = z.infer<typeof AuthorInput>;
