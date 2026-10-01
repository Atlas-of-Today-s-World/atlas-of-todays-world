import { z } from "zod";

/**
 * Veřejné proměnné prostředí (ARCHITEKTURA 3.4). Next je do klientského kódu
 * vkládá jen při doslovném zápisu `process.env.NEXT_PUBLIC_…`, proto je každá
 * vyjmenovaná zvlášť. Neplatná hodnota shodí build, ne až běžící stránku.
 * Tajné proměnné jsou v `env.server.ts`.
 */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

const schema = z.object({
  NEXT_PUBLIC_SITE_URL: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.url().default("https://atlas-of-todays-world.vercel.app"),
  ),
  NEXT_PUBLIC_SUPABASE_URL: optional(z.url()),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optional(z.string().min(20)),
  NEXT_PUBLIC_MAPTILER_KEY: optional(z.string().min(8)),
  // Kontakt provozovatele pro zásady ochrany soukromí a přístupnost.
  NEXT_PUBLIC_CONTACT_EMAIL: optional(z.email()),
});

export const publicEnv = schema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_MAPTILER_KEY: process.env.NEXT_PUBLIC_MAPTILER_KEY,
  NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
});
