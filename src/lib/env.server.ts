import "server-only";
import { z } from "zod";

/** Tajné proměnné prostředí — jen na serveru (ARCHITEKTURA 3.4). */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

const schema = z.object({
  ADMIN_TOKEN: optional(z.string().min(16)),
  MAILCHIMP_API_KEY: optional(z.string().regex(/-us\d+$/, "Mailchimp klíč končí na -usNN")),
  MAILCHIMP_LIST_ID: optional(z.string().min(4)),
  SUPABASE_SERVICE_ROLE_KEY: optional(z.string().min(20)),
});

export const serverEnv = schema.parse(process.env);
