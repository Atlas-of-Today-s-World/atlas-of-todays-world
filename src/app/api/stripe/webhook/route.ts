import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { handleStripeEvent } from "@/features/membership/stripe";
import { stripe, stripeEnabled, stripeWebhookSecret } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/** Stripe events are a few kB; anything far larger isn't one. */
const BODY_MAX_BYTES = 512 * 1024;

const NO_STORE = { "Cache-Control": "no-store" } as const;
const answer = (status: number) => new NextResponse(null, { status, headers: NO_STORE });

/**
 * Stripe webhook (ADR G6). Memberships change only here, from events whose
 * signature checks out with STRIPE_WEBHOOK_SECRET — never from the success
 * redirect. The raw body is verified as received; each event id is stored
 * (stripe_event_seen) so a redelivery is skipped; the subscription itself is
 * re-read from Stripe before anything is written (features/membership/stripe.ts).
 *
 * 200 handled or skipped, 400 bad signature, 404 payments off, 413 too large,
 * 500 failed — Stripe retries, and the event id is forgotten so the retry runs.
 */
export async function POST(request: NextRequest) {
  if (!stripeEnabled()) return answer(404);
  const signature = request.headers.get("stripe-signature");
  if (!signature) return answer(400);
  if (Number(request.headers.get("content-length") ?? 0) > BODY_MAX_BYTES) return answer(413);
  const body = await request.text();
  if (body.length > BODY_MAX_BYTES) return answer(413);

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(body, signature, stripeWebhookSecret());
  } catch {
    return answer(400);
  }

  const db = createServiceClient();
  const seen = await db.rpc("stripe_event_seen", { p_id: event.id, p_type: event.type });
  if (seen.error) {
    console.error("[stripe]", seen.error.message);
    return answer(500);
  }
  if (seen.data) return answer(200);

  try {
    await handleStripeEvent(event);
    return answer(200);
  } catch (error) {
    console.error("[stripe]", event.type, error instanceof Error ? error.message : "failed");
    await db.rpc("stripe_event_forget", { p_id: event.id });
    return answer(500);
  }
}
