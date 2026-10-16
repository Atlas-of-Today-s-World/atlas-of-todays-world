import type Stripe from "stripe";

/**
 * Stripe subscription → membership row (ADR G6). Pure, so it is unit-tested
 * without Stripe; features/membership/stripe.ts feeds it re-fetched objects.
 */

/** The statuses `memberships` and `pending_memberships` know. */
export type MembershipStatus = "active" | "past_due" | "incomplete" | "canceled";

const STATUS: Record<string, MembershipStatus> = {
  active: "active",
  trialing: "active",
  past_due: "past_due",
  unpaid: "past_due",
  incomplete: "incomplete",
  paused: "incomplete",
  canceled: "canceled",
  incomplete_expired: "canceled",
};

/** Unknown future statuses count as not paying, never as active. */
export const membershipStatus = (status: string): MembershipStatus =>
  STATUS[status] ?? "incomplete";

const MONTHS_PER_INTERVAL: Record<string, number> = { month: 1, year: 12 };

/** What the subscription brings per month, in cents (null when no item is priced). */
export function monthlyCents(subscription: Stripe.Subscription): number | null {
  let total: number | null = null;
  for (const item of subscription.items.data) {
    const recurring = item.price.recurring;
    const months = recurring ? MONTHS_PER_INTERVAL[recurring.interval] : undefined;
    if (!months || item.price.unit_amount === null) continue;
    const perMonth =
      (item.price.unit_amount * (item.quantity ?? 1)) / (months * recurring!.interval_count);
    total = (total ?? 0) + Math.round(perMonth);
  }
  return total;
}

const isoFromUnix = (seconds: number | null | undefined) =>
  typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;

/** End of the paid period: the latest item period end (moved to items in Stripe API 2025-03). */
export function periodEnd(subscription: Stripe.Subscription): string | null {
  const ends = subscription.items.data.map((item) => item.current_period_end);
  return ends.length ? isoFromUnix(Math.max(...ends)) : null;
}

export const startedAt = (subscription: Stripe.Subscription) =>
  isoFromUnix(subscription.start_date);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The account Checkout was opened with (subscription metadata), when it is a uuid. */
export function accountId(subscription: Stripe.Subscription): string | null {
  const value = subscription.metadata?.user_id;
  return value && UUID.test(value) ? value.toLowerCase() : null;
}

/** Id of an expandable Stripe reference (`"cus_…"` or the expanded object). */
export const refId = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : (value?.id ?? null);
