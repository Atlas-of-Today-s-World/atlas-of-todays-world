import { z } from "zod";
import { DEVICES, NAV_TYPES, VALUE_MAX, WEB_VITALS } from "./metrics";
import { VITALS_PER_BEACON } from "./report";

/** Largest body /api/v reads (a full beacon of ten metrics is under 600 bytes). */
export const VITALS_BODY_MAX_BYTES = 2048;

/**
 * One metric as the browser sends it (report.ts). Limits match
 * record_web_vitals(): an allowlisted metric, a whole number within the
 * metric's range, the first path segment, an allowlisted navigation type.
 */
const VitalItem = z
  .strictObject({
    n: z.enum(WEB_VITALS),
    v: z
      .int()
      .min(0)
      .max(Math.max(...Object.values(VALUE_MAX))),
    p: z.string().regex(/^\/[a-z-]{0,32}$/),
    t: z.enum(NAV_TYPES),
  })
  .refine((item) => item.v <= VALUE_MAX[item.n], { path: ["v"] });

/** One beacon: the device class and 1–10 metrics. Anything else — an unknown key too — is refused. */
export const VitalsInput = z.strictObject({
  d: z.enum(DEVICES),
  m: z.array(VitalItem).min(1).max(VITALS_PER_BEACON),
});
