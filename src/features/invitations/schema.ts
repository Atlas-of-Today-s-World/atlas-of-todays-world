import { z } from "zod";
import { checkbox, emailAddress, iso3, slug, text, uuid } from "@/lib/validation/common";

/** How long an invitation is valid — the DB default and the most an extension may give. */
export const INVITATION_DAYS = 5;

/**
 * Invitation form input — limits matching the DB (invitations). `authors` are
 * the team accounts whose articles the invitee will approve (approver_authors,
 * carried over to the profile on acceptance).
 */
export const InvitationInput = z.object({
  email: emailAddress,
  roleId: slug(40),
  note: text(300).default(""),
  approvalGlobal: checkbox,
  countries: z.array(iso3).max(300),
  authors: z.array(uuid).max(200),
});
