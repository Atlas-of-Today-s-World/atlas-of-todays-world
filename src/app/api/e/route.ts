import type { NextRequest } from "next/server";
import { EVENT_BODY_MAX_BYTES, EventInput } from "@/features/conversions/schema";
import { beaconAnswer as answer, readBeacon } from "@/lib/beacon";
import { serverEnv } from "@/lib/env.server";
import { allowRequest } from "@/lib/security/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/** How many events one address may send (shared Postgres limiter, hashed key). */
const EVENT_LIMIT = { limit: 60, windowSeconds: 600 };

/**
 * Cookie-less conversion counter (features/conversions): the browser's
 * `navigator.sendBeacon` posts `{ e, p, r? }` here. Same-origin only, a
 * small body, the Zod allowlist, a per-IP limit — then record_event() with the
 * service key (the RPC is not public, so nothing bypasses the limit). Nothing
 * about the visitor is passed on: no IP, user agent or session.
 *
 * 204 recorded (or quietly dropped when counting is off or the DB fails —
 * nobody waits for this answer), 400 invalid, 403 cross-site, 413 too large,
 * 429 over the limit.
 */
export async function POST(request: NextRequest) {
  const read = await readBeacon(request, EVENT_BODY_MAX_BYTES);
  if ("status" in read) return answer(read.status);
  const parsed = EventInput.safeParse(read.body);
  if (!parsed.success) return answer(400);

  // Without the service key (local development) nothing is counted.
  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) return answer(204);
  if (!(await allowRequest("event", request.headers, EVENT_LIMIT))) return answer(429);

  const { e: event, p: path, r: ref } = parsed.data;
  const { error } = await createServiceClient().rpc("record_event", {
    event,
    path,
    ref: ref ?? "none",
  });
  if (error) console.error("[event]", error.message);
  return answer(204);
}
