import "server-only";
import { z } from "zod";

/** Secret environment variables — server only (ARCHITEKTURA 3.4). */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

const schema = z.object({
  MAILCHIMP_API_KEY: optional(z.string().regex(/-us\d+$/, "Mailchimp klíč končí na -usNN")),
  MAILCHIMP_LIST_ID: optional(z.string().min(4)),
  SUPABASE_SERVICE_ROLE_KEY: optional(z.string().min(20)),
  // IndexNow (ADR-021): public by design (served at /indexnow-key.txt); empty = pings off.
  // Search console ownership tokens (public, rendered as <meta>); empty = verify by DNS instead.
  GOOGLE_SITE_VERIFICATION: optional(z.string().regex(/^[\w-]{10,100}$/)),
  BING_SITE_VERIFICATION: optional(z.string().regex(/^[\w-]{10,100}$/)),
  SEZNAM_SITE_VERIFICATION: optional(z.string().regex(/^[\w-]{10,100}$/)),
  INDEXNOW_KEY: optional(
    z.string().regex(/^[a-zA-Z0-9-]{8,128}$/, "IndexNow klíč: 8–128 znaků a-z, 0-9, -"),
  ),
});

export const serverEnv = schema.parse(process.env);
