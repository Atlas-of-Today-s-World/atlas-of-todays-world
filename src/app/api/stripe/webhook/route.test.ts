import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import Stripe from "stripe";

const SECRET = "whsec_test0123456789abcdef";
const serverEnv = vi.hoisted(() => ({
  STRIPE_SECRET_KEY: "sk_test_0123456789abcdef" as string | undefined,
  STRIPE_WEBHOOK_SECRET: "whsec_test0123456789abcdef" as string | undefined,
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-0123456789",
}));
const rpc = vi.hoisted(() => vi.fn());
const handleStripeEvent = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env.server", () => ({ serverEnv }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ rpc }) }));
vi.mock("@/features/membership/stripe", () => ({ handleStripeEvent }));

const { POST } = await import("./route");

const stripe = new Stripe("sk_test_0123456789abcdef");
const EVENT = { id: "evt_123", type: "customer.subscription.updated", data: { object: {} } };

function send(payload: string, signature?: string) {
  return POST(
    new NextRequest("https://atlas.example/api/stripe/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(signature === undefined ? {} : { "stripe-signature": signature }),
      },
      body: payload,
    }),
  );
}

const signed = (payload: string, secret = SECRET) =>
  send(payload, stripe.webhooks.generateTestHeaderString({ payload, secret }));

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    serverEnv.STRIPE_SECRET_KEY = "sk_test_0123456789abcdef";
    serverEnv.STRIPE_WEBHOOK_SECRET = SECRET;
    rpc.mockReset().mockResolvedValue({ data: false, error: null });
    handleStripeEvent.mockReset().mockResolvedValue("member");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("handles a correctly signed event once and answers 200, never cached", async () => {
    const response = await signed(JSON.stringify(EVENT));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(rpc).toHaveBeenCalledWith("stripe_event_seen", {
      p_id: "evt_123",
      p_type: "customer.subscription.updated",
    });
    expect(handleStripeEvent).toHaveBeenCalledWith(expect.objectContaining({ id: "evt_123" }));
  });

  it("refuses a missing, forged or foreign signature without touching the database", async () => {
    const payload = JSON.stringify(EVENT);
    expect((await send(payload)).status).toBe(400);
    expect((await send(payload, "t=1,v1=deadbeef")).status).toBe(400);
    expect((await signed(payload, "whsec_someoneelse0123456789")).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
    expect(handleStripeEvent).not.toHaveBeenCalled();
  });

  it("skips a redelivered event", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect((await signed(JSON.stringify(EVENT))).status).toBe(200);
    expect(handleStripeEvent).not.toHaveBeenCalled();
  });

  it("answers 500 and forgets the event when handling fails, so Stripe's retry runs", async () => {
    handleStripeEvent.mockRejectedValue(new Error("Stripe down"));
    expect((await signed(JSON.stringify(EVENT))).status).toBe(500);
    expect(rpc).toHaveBeenLastCalledWith("stripe_event_forget", { p_id: "evt_123" });
  });

  it("is off (404) until both Stripe secrets are set", async () => {
    serverEnv.STRIPE_WEBHOOK_SECRET = undefined;
    expect((await signed(JSON.stringify(EVENT))).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });
});
