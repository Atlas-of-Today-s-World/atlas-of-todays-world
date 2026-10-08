import { z } from "zod";
import { HEX_COLOR } from "@/lib/validation/hex-color";

/**
 * Building blocks of the admin Zod schemas — same shapes as the CHECKs in the DB,
 * so the error shows at the field, not only once it comes from the database.
 */

/** Empty string from a form → undefined (optional field). */
export const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const slug = (max = 120) =>
  z
    .string()
    .trim()
    .toLowerCase()
    .max(max)
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      "Lowercase letters without accents, digits and hyphens only.",
    );

export const text = (max: number) => z.string().trim().max(max, `At most ${max} characters.`);

export const requiredText = (max: number) => text(max).min(1, "Please fill this in.");

export const httpsUrl = z
  .string()
  .trim()
  .max(1000)
  .regex(/^https:\/\/\S+$/, "The URL must start with https://.");

export const optionalHttpsUrl = z.preprocess(blankToUndefined, httpsUrl.optional());

export const hexColor = z
  .string()
  .trim()
  .regex(HEX_COLOR, "Color in the format #rrggbb.")
  .transform((value) => value.toLowerCase());

export const iso3 = z.string().regex(/^[A-Z]{3}$/);

/** Email in the same shape as the DB CHECK (invitations); no nested quantifiers (no ReDoS). */
const EMAIL = /^[^@\s]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

/**
 * Email field with its own error text (public forms answer with message codes).
 * The length check aborts: Zod would otherwise still run the pattern on a
 * megabyte-long string after `max` failed.
 */
export const emailAddressWith = (message: string) =>
  z.string().trim().toLowerCase().max(254, { message, abort: true }).regex(EMAIL, message);

export const emailAddress = emailAddressWith("Enter a valid email address.");

export const uuid = z.string().uuid();

/** Number from a form (empty = undefined). */
export const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    (value) => (blankToUndefined(value) === undefined ? undefined : Number(value)),
    schema.optional(),
  );

export const checkbox = z.preprocess((value) => value === "on" || value === "true", z.boolean());

/** Creates a slug from text (name → URL). */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
