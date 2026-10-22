import { z } from "zod";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import {
  blankToUndefined,
  emailAddressWith,
  requiredText,
  slug,
  text,
  uuid,
} from "@/lib/validation/common";
import { MESSAGE_MAX } from "./limits";

/**
 * Careers forms. Limits match the CHECKs in 20261022001000_careers.sql (the
 * shared email shape is stricter than that CHECK, so anything it accepts the
 * DB accepts too).
 */

export const POSITION_STATUSES = ["draft", "open", "closed"] as const;
export type PositionStatus = (typeof POSITION_STATUSES)[number];

export const APPLICATION_STATUSES = ["new", "contacted", "closed"] as const;

/** An application to one position (errors are message codes for the public form). */
export const ApplicationInput = z.object({
  position_id: uuid,
  name: z.string().trim().min(1, "name").max(120, "name"),
  email: emailAddressWith("invalidEmail"),
  // A form sends line breaks as CRLF; stored as plain "\n", as the textarea counts them.
  message: z
    .string()
    .transform((value) => value.replace(/\r\n?/g, "\n").trim())
    .pipe(z.string().min(1, "message").max(MESSAGE_MAX, "tooLong")),
  consent: z.literal("on", { message: "consent" }),
});

/** Longest profile, counted after sanitizing — same as the CHECK on `job_positions.body_html`. */
const BODY_MAX = 30000;

/** One position in the admin (new without `id`). */
export const PositionInput = z.object({
  id: z.preprocess(blankToUndefined, uuid.optional()),
  title: requiredText(120),
  slug: slug(80).min(1, "Please fill this in."),
  location: text(80),
  job_type: text(60),
  summary: text(300),
  body_html: z
    .string()
    .transform((html) => sanitizeRichHtml(html).trim())
    .pipe(
      z
        .string()
        .max(BODY_MAX, `At most ${BODY_MAX.toLocaleString("en")} characters of formatted text.`),
    ),
  status: z.enum(POSITION_STATUSES),
});
