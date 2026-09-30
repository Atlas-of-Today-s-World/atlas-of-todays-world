import { z } from "zod";
import { checkbox, iso3, slug, text } from "@/lib/validation/common";

/** Vstup formuláře pozvánky — limity shodné s DB (invitations). */
export const InvitationInput = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    // Stejný tvar jako CHECK v DB; bez vnořených kvantifikátorů (žádný ReDoS).
    .regex(/^[^@\s]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/, "Zadejte platný e-mail."),
  roleId: slug(40),
  note: text(300).default(""),
  approvalGlobal: checkbox,
  countries: z.array(iso3).max(300),
});

export const InvitationId = z.string().uuid();
