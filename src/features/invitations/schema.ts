import { z } from "zod";

/** Vstup formuláře pozvánky — limity shodné s DB (invitations). */
export const InvitationInput = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .regex(/^[^@\s]+@[a-z0-9.-]+\.[a-z]{2,}$/, "Zadejte platný e-mail."),
  roleId: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(40),
  note: z.string().trim().max(300).default(""),
});

export const InvitationId = z.string().uuid();
