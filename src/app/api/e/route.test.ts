import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const serverEnv = vi.hoisted(() => ({
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-0123456789" as string | undefined,
}));
const allowRequest = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env.server", () => ({ serverEnv }));
vi.mock("@/lib/security/rate-limit", () => ({ allowRequest }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ rpc }) }));

const { POST } = await import("./route");

const ORIGIN = "https://atlas.example";
function send(body: unknown, headers: Record<string, string> = { origin: ORIGIN }) {
  return POST(
    new NextRequest(`${ORIGIN}/api/e`, {
      method: "POST",
      headers: { "content-type": "text/plain;charset=UTF-8", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

describe("POST /api/e", () => {
  beforeEach(() => {
    serverEnv.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-0123456789";
    allowRequest.mockReset().mockResolvedValue(true);
    rpc.mockReset().mockResolvedValue({ error: null });
  });

  it("records a valid event through the RPC and answers 204, never cached", async () => {
    const response = await send({ e: "donate_click", p: "/membership" });
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(allowRequest).toHaveBeenCalledWith("event", expect.any(Headers), {
      limit: 60,
      windowSeconds: 600,
    });
    expect(rpc).toHaveBeenCalledWith("record_event", {
      event: "donate_click",
      path: "/membership",
      ref: "none",
    });
  });

  it("passes only the event, the path and the assistant — nothing about the visitor", async () => {
    await send(
      { e: "ai_referral", p: "/", r: "chatgpt" },
      { origin: ORIGIN, "x-forwarded-for": "203.0.113.7", "user-agent": "Test/1.0" },
    );
    expect(rpc).toHaveBeenCalledWith("record_event", {
      event: "ai_referral",
      path: "/",
      ref: "chatgpt",
    });
  });

  it.each([
    ["not JSON", "e=donate_click"],
    ["an unknown event", { e: "page_view", p: "/" }],
    ["an extra field", { e: "donate_click", p: "/", ip: "203.0.113.7" }],
    ["a path without a slash", { e: "donate_click", p: "membership" }],
  ])("answers 400 to %s and records nothing", async (_label, body) => {
    expect((await send(body)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
    expect(allowRequest).not.toHaveBeenCalled();
  });

  it("refuses another site's page (403) and an oversized body (413)", async () => {
    expect(
      (await send({ e: "share_click", p: "/" }, { origin: "https://evil.example" })).status,
    ).toBe(403);
    expect((await send({ e: "share_click", p: `/${"a".repeat(2000)}` })).status).toBe(413);
    expect(
      (await send({ e: "share_click", p: "/" }, { origin: ORIGIN, "content-length": "5000" }))
        .status,
    ).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("answers 429 over the per-IP limit without recording", async () => {
    allowRequest.mockResolvedValue(false);
    expect((await send({ e: "share_click", p: "/" })).status).toBe(429);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("drops events quietly without the service key or when the database fails", async () => {
    serverEnv.SUPABASE_SERVICE_ROLE_KEY = undefined;
    expect((await send({ e: "share_click", p: "/" })).status).toBe(204);
    expect(rpc).not.toHaveBeenCalled();

    serverEnv.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-0123456789";
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ error: { message: "boom" } });
    expect((await send({ e: "share_click", p: "/" })).status).toBe(204);
    expect(error).toHaveBeenCalledWith("[event]", "boom");
    error.mockRestore();
  });
});
