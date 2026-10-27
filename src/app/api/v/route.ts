import type { NextRequest } from "next/server";
import { VITALS_BODY_MAX_BYTES, VitalsInput } from "@/features/web-vitals/schema";
import { beaconAnswer as answer, readBeacon } from "@/lib/beacon";
import { serverEnv } from "@/lib/env.server";
import { allowRequest } from "@/lib/security/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * How many beacons one address may send (shared Postgres limiter, hashed key).
 * A page view sends one (more only after many in-app navigations without
 * leaving the tab); a shared address of a school or office sends many.
 */
const VITALS_LIMIT = { limit: 120, windowSeconds: 600 };

/**
 * Cookie-less Core Web Vitals (features/web-vitals, ADR-033): the browser's
 * `navigator.sendBeacon` posts `{ d, m: [{ n, v, p, t }] }` here when a page
 * is hidden. Same-origin only, a small body, the Zod allowlist and value
 * bounds, a per-IP limit — then record_web_vitals() with the service key (the
 * RPC is not public, so nothing bypasses the limit). Nothing about the visitor
 * is passed on: no IP, user agent or session.
 *
 * 204 recorded (or quietly dropped when measuring is off or the DB fails —
 * nobody waits for this answer), 400 invalid, 403 cross-site, 413 too large,
 * 429 over the limit.
 */
export async function POST(request: NextRequest) {
  const read = await readBeacon(request, VITALS_BODY_MAX_BYTES);
  if ("status" in read) return answer(read.status);
  const parsed = VitalsInput.safeParse(read.body);
  if (!parsed.success) return answer(400);

  // Without the service key (local development) nothing is stored.
  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) return answer(204);
  if (!(await allowRequest("vitals", request.headers, VITALS_LIMIT))) return answer(429);

  const { error } = await createServiceClient().rpc("record_web_vitals", {
    p_device: parsed.data.d,
    p_metrics: parsed.data.m,
  });
  if (error) console.error("[vitals]", error.message);
  return answer(204);
}
