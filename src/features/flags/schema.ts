import { z } from "zod";
import { MAINTENANCE_LIMITS } from "./maintenance";

/**
 * Switches (feature_flags) and the maintenance message (site_notices) —
 * shapes matching the CHECKs in the DB.
 */

/**
 * Flag key as the DB CHECK spells it: lowercase words joined by single "_". The
 * nested quantifier can't backtrack ("_" never matches `[a-z0-9]`), so it's linear.
 */
export const FlagKey = z
  .string()
  // eslint-disable-next-line security/detect-unsafe-regex -- star-height heuristic false positive; linear, see above
  .regex(/^[a-z0-9]+(_[a-z0-9]+)*$/)
  .max(40);

/** Turning a switch on/off: a Server Action's arguments come from the client, so both are checked. */
export const FlagToggleInput = z.object({ key: FlagKey, enabled: z.boolean() });

/** Note next to a switch (feature_flags.note, ≤ 300). */
export const FlagNoteInput = z.object({
  key: FlagKey,
  note: z.string().trim().max(300, "At most 300 characters."),
});

/** Maintenance title and text; empty = the site's built-in wording. */
export const MaintenanceMessageInput = z.object({
  maintenance_title: z
    .string()
    .trim()
    .max(MAINTENANCE_LIMITS.title, `At most ${MAINTENANCE_LIMITS.title} characters.`),
  maintenance_text: z
    .string()
    .trim()
    .max(MAINTENANCE_LIMITS.text, `At most ${MAINTENANCE_LIMITS.text} characters.`),
});
