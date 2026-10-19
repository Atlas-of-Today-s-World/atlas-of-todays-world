import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const rpc = vi.hoisted(() => vi.fn());
const retrieve = vi.hoisted(() => vi.fn());
const createSession = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/lib/env.server", () => ({
  serverEnv: { STRIPE_LEGACY_PRODUCT_IDS: "prod_webflow5, not-an-id" },
}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ rpc }) }));
vi.mock("@/lib/stripe", () => ({
  stripe: () => ({
    subscriptions: { retrieve },
    checkout: { sessions: { create: createSession } },
  }),
}));

const { createCheckoutUrl, handleStripeEvent } = await import("./stripe");
const { isPatronSubscription, membershipStatus, monthlyCents, productIds } =
  await import("./subscription");

const USER = "11111111-2222-4333-8444-555555555555";
const PERIOD_END = 1_790_000_000;

function subscription(overrides: Partial<Stripe.Subscription> = {}) {
  return {
    id: "sub_1",
    status: "active",
    start_date: 1_780_000_000,
    metadata: { atlas: "patron", user_id: USER },
    customer: { id: "cus_1", email: "ana@example.org", deleted: undefined },
    items: {
      data: [
        {
          quantity: 1,
          current_period_end: PERIOD_END,
          price: { unit_amount: 1500, recurring: { interval: "month", interval_count: 1 } },
        },
      ],
    },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

const event = (type: string, object: unknown) =>
  ({ id: "evt_1", type, data: { object } }) as unknown as Stripe.Event;

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: "member", error: null });
  retrieve.mockReset().mockResolvedValue(subscription());
  createSession.mockReset().mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_1" });
});

describe("handleStripeEvent", () => {
  it("re-reads the subscription and stores its current state", async () => {
    await expect(
      handleStripeEvent(
        event("customer.subscription.updated", { id: "sub_1", status: "canceled" }),
      ),
    ).resolves.toBe("member");
    expect(retrieve).toHaveBeenCalledWith("sub_1", { expand: ["customer"] });
    expect(rpc).toHaveBeenCalledWith("apply_stripe_subscription", {
      p_subscription: "sub_1",
      p_customer: "cus_1",
      p_email: "ana@example.org",
      p_user: USER,
      p_status: "active",
      p_monthly_cents: 1500,
      p_started_at: new Date(1_780_000_000_000).toISOString(),
      p_period_end: new Date(PERIOD_END * 1000).toISOString(),
    });
  });

  it("follows a completed subscription checkout; ignores one-time payments", async () => {
    await handleStripeEvent(
      event("checkout.session.completed", { mode: "subscription", subscription: "sub_1" }),
    );
    expect(retrieve).toHaveBeenCalledOnce();
    await expect(
      handleStripeEvent(
        event("checkout.session.completed", { mode: "payment", subscription: null }),
      ),
    ).resolves.toBe("ignored");
    expect(retrieve).toHaveBeenCalledOnce();
  });

  it("ignores subscriptions the site didn't create and unrelated events", async () => {
    retrieve.mockResolvedValue(subscription({ metadata: {} }));
    await expect(
      handleStripeEvent(event("customer.subscription.updated", { id: "sub_other" })),
    ).resolves.toBe("ignored");
    await expect(handleStripeEvent(event("invoice.paid", {}))).resolves.toBe("ignored");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("follows an old Webflow donation by its product, without Atlas metadata", async () => {
    const legacy = subscription({
      metadata: {},
      customer: { id: "cus_2", email: "Bo@Example.org" } as Stripe.Customer,
    });
    legacy.items.data[0]!.price.product = "prod_webflow5";
    retrieve.mockResolvedValue(legacy);
    await handleStripeEvent(event("customer.subscription.updated", { id: "sub_1" }));
    expect(rpc).toHaveBeenCalledWith(
      "apply_stripe_subscription",
      expect.objectContaining({
        p_customer: "cus_2",
        p_email: "Bo@Example.org",
        p_user: undefined,
      }),
    );
  });

  it("throws when the database refuses, so the webhook asks Stripe to retry", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(
      handleStripeEvent(event("customer.subscription.deleted", { id: "sub_1" })),
    ).rejects.toThrow(/boom/);
  });
});

describe("createCheckoutUrl", () => {
  it("monthly: a EUR subscription marked as the site's, linked to the signed-in account", async () => {
    const url = await createCheckoutUrl({ period: "monthly", amount: 10 }, "en", {
      id: USER,
      email: "ana@example.org",
    });
    expect(url).toBe("https://checkout.stripe.com/c/pay/cs_1");
    const params = createSession.mock.calls[0]![0];
    expect(params).toMatchObject({
      mode: "subscription",
      client_reference_id: USER,
      customer_email: "ana@example.org",
      subscription_data: { metadata: { atlas: "patron", user_id: USER } },
      line_items: [
        { price_data: { currency: "eur", unit_amount: 1000, recurring: { interval: "month" } } },
      ],
    });
    expect(params.success_url).toMatch(/\/membership\/thank-you\?period=monthly&amount=10$/);
    expect(params.cancel_url).toMatch(/\/membership$/);
  });

  it("one-time: a single donation payment, no account needed", async () => {
    await createCheckoutUrl({ period: "one-time", amount: 50 }, "en", null);
    const params = createSession.mock.calls[0]![0];
    expect(params).toMatchObject({ mode: "payment", submit_type: "donate" });
    expect(params).not.toHaveProperty("client_reference_id");
    expect(params).not.toHaveProperty("subscription_data");
    expect(params.line_items[0].price_data).not.toHaveProperty("recurring");
  });
});

describe("subscription mapping", () => {
  it("never treats an unknown or unpaid status as active", () => {
    expect(membershipStatus("trialing")).toBe("active");
    expect(membershipStatus("unpaid")).toBe("past_due");
    expect(membershipStatus("incomplete_expired")).toBe("canceled");
    expect(membershipStatus("something_new")).toBe("incomplete");
  });

  it("knows a patron by the site's metadata or a legacy donation product", () => {
    const legacy = productIds(" prod_a ,prod_b,price_x,,");
    expect([...legacy]).toEqual(["prod_a", "prod_b"]);
    const on = (product: unknown, metadata = {}) => {
      const sub = subscription({ metadata });
      sub.items.data[0]!.price.product = product as string;
      return isPatronSubscription(sub, legacy);
    };
    expect(on("prod_other", { atlas: "patron" })).toBe(true);
    expect(on("prod_b")).toBe(true);
    expect(on({ id: "prod_a" })).toBe(true);
    expect(on("prod_other")).toBe(false);
    expect(on(undefined)).toBe(false);
    expect(on("prod_other", { atlas: "other" })).toBe(false);
  });

  it("brings yearly prices and quantities to a monthly amount", () => {
    const yearly = subscription({
      items: {
        data: [
          {
            quantity: 2,
            current_period_end: PERIOD_END,
            price: { unit_amount: 12_000, recurring: { interval: "year", interval_count: 1 } },
          },
        ],
      } as unknown as Stripe.Subscription["items"],
    });
    expect(monthlyCents(yearly)).toBe(2000);
  });
});
