import "server-only";
import { revalidateTag } from "next/cache";
import type Stripe from "stripe";
import { tags } from "@/lib/cache/tags";
import { localePath, type Locale } from "@/lib/i18n/config";
import { absoluteUrl } from "@/lib/seo";
import { serverEnv } from "@/lib/env.server";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { routes } from "@/config/routes";
import { thankYouHref, type Donation } from "./links";
import {
  accountId,
  ATLAS_PATRON,
  isPatronSubscription,
  membershipStatus,
  monthlyCents,
  periodEnd,
  productIds,
  refId,
  startedAt,
} from "./subscription";

/**
 * Stripe Checkout and the webhook's side of memberships (ADR G6). Card data
 * stays on Stripe's page; Atlas keeps only what the membership needs.
 */

/**
 * A hosted Checkout page for one validated donation. Monthly = a subscription
 * (becomes a membership through the webhook), one-time = a single payment.
 * `account` is the signed-in reader, if any: Checkout then knows their e-mail
 * and the webhook links the subscription to that account.
 */
export async function createCheckoutUrl(
  donation: Donation,
  locale: Locale,
  account: { id: string; email?: string } | null,
): Promise<string> {
  const monthly = donation.period === "monthly";
  const metadata = { ...ATLAS_PATRON, period: donation.period };
  const session = await stripe().checkout.sessions.create({
    mode: monthly ? "subscription" : "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: donation.amount * 100,
          product_data: {
            name: monthly ? "Atlas Patron — monthly donation" : "Donation to the Atlas",
          },
          ...(monthly ? { recurring: { interval: "month" as const } } : {}),
        },
      },
    ],
    ...(monthly
      ? {
          subscription_data: {
            metadata: { ...metadata, ...(account ? { user_id: account.id } : {}) },
          },
        }
      : { submit_type: "donate" as const, payment_intent_data: { metadata } }),
    metadata,
    ...(account ? { client_reference_id: account.id } : {}),
    ...(account?.email ? { customer_email: account.email } : {}),
    locale: "auto",
    success_url: absoluteUrl(localePath(locale, thankYouHref(donation))),
    cancel_url: absoluteUrl(localePath(locale, routes.membership)),
  });
  if (!session.url) throw new Error("Stripe returned no Checkout URL.");
  return session.url;
}

type Outcome = "member" | "pending" | "removed" | "ignored";

/**
 * Re-reads the subscription from Stripe (events may arrive out of order, so
 * the event's own copy is never trusted for state) and stores its current
 * state through apply_stripe_subscription().
 */
async function syncSubscription(id: string, emailHint?: string | null): Promise<Outcome> {
  const subscription = await stripe().subscriptions.retrieve(id, { expand: ["customer"] });
  const legacyProducts = productIds(serverEnv.STRIPE_LEGACY_PRODUCT_IDS);
  if (!isPatronSubscription(subscription, legacyProducts)) return "ignored";
  const customer = subscription.customer;
  const email =
    (typeof customer === "object" && !customer.deleted ? customer.email : null) ?? emailHint ?? "";

  const { data, error } = await createServiceClient().rpc("apply_stripe_subscription", {
    p_subscription: subscription.id,
    p_customer: refId(customer) ?? "",
    p_email: email,
    p_user: accountId(subscription) ?? undefined,
    p_status: membershipStatus(subscription.status),
    p_monthly_cents: monthlyCents(subscription) ?? undefined,
    p_started_at: startedAt(subscription) ?? undefined,
    p_period_end: periodEnd(subscription) ?? undefined,
  });
  if (error) throw new Error(`apply_stripe_subscription: ${error.message}`);
  // The public goal counts patrons.
  revalidateTag(tags.patrons, "max");
  return data as Outcome;
}

/** One verified webhook event. Throws when it should be retried. */
export async function handleStripeEvent(event: Stripe.Event): Promise<Outcome> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      const subscription = refId(session.subscription);
      if (session.mode !== "subscription" || !subscription) return "ignored";
      return syncSubscription(subscription, session.customer_details?.email);
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return syncSubscription(event.data.object.id);
    default:
      return "ignored";
  }
}
