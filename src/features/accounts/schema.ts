import { z } from "zod";
import { blankToUndefined, checkbox, iso3, slug, text, uuid } from "@/lib/validation/common";

/** Úprava účtu správcem — limity podle tabulky `profiles`. */
export const AccountInput = z
  .object({
    id: uuid,
    role_id: slug(40),
    status: z.enum(["active", "blocked"]),
    blocked_note: z.preprocess(blankToUndefined, text(500).optional()),
    approval_global: checkbox,
    countries: z.array(iso3).max(300),
    authors: z.array(uuid).max(200),
  })
  .refine((value) => value.status !== "blocked" || Boolean(value.blocked_note?.trim()), {
    path: ["blocked_note"],
    message: "Enter a reason for blocking (other admins will see it).",
  });
