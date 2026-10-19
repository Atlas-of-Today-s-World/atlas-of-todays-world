import { z } from "zod";
import { FEATURED_COUNT } from "./config";

/** Admin forms of the home page (limits = the CHECKs of migration 20261013000220). */

export const HomeSettingsInput = z.object({
  featured_count: z.coerce
    .number()
    .int("Pick a whole number.")
    .min(FEATURED_COUNT.min, `At least ${FEATURED_COUNT.min}.`)
    .max(FEATURED_COUNT.max, `At most ${FEATURED_COUNT.max}.`),
});
