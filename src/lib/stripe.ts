import "server-only";
import Stripe from "stripe";
import { serverEnv } from "@/lib/env.server";

/**
 * Stripe (ADR G6). Payments are on only with both the secret key and the
 * webhook signing secret: a checkout without the webhook would take money
 * that never becomes a membership. Off = the demo checkout.
 */
export function stripeEnabled(): boolean {
  return Boolean(serverEnv.STRIPE_SECRET_KEY && serverEnv.STRIPE_WEBHOOK_SECRET);
}

let client: Stripe | undefined;

/** The Stripe client (API version pinned by the SDK). Throws when payments are off. */
export function stripe(): Stripe {
  const key = serverEnv.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  client ??= new Stripe(key, { maxNetworkRetries: 2, timeout: 10_000 });
  return client;
}

/** The webhook signing secret (`whsec_…`). Throws when payments are off. */
export function stripeWebhookSecret(): string {
  const secret = serverEnv.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  return secret;
}
