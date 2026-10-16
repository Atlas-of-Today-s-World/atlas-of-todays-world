import { z } from "zod";
import { AI_REFERRERS, CONVERSION_EVENTS } from "./events";

/** Largest body /api/e reads (a real one is under 120 bytes). */
export const EVENT_BODY_MAX_BYTES = 1024;

/**
 * One counted event as the browser sends it (track.ts). Limits match
 * record_event(): an allowlisted event, a path of at most 512 characters
 * starting with "/", an optional allowlisted AI assistant. Anything else —
 * an unknown key too — is refused.
 */
export const EventInput = z
  .strictObject({
    e: z.enum(CONVERSION_EVENTS),
    p: z.string().min(1).max(512).startsWith("/"),
    r: z.enum(AI_REFERRERS).optional(),
  })
  // An AI referral names its assistant (the database refuses it otherwise too).
  .refine((input) => input.e !== "ai_referral" || input.r !== undefined, { path: ["r"] });
