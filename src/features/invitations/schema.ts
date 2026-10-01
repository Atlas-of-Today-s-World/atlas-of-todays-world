import { z } from "zod";
import { checkbox, emailAddress, iso3, slug, text } from "@/lib/validation/common";

/** Invitation form input — limits matching the DB (invitations). */
export const InvitationInput = z.object({
  email: emailAddress,
  roleId: slug(40),
  note: text(300).default(""),
  approvalGlobal: checkbox,
  countries: z.array(iso3).max(300),
});

export const InvitationId = z.string().uuid();
