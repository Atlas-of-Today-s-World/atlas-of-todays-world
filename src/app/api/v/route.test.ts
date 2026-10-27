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
    new NextRequest(`${ORIGIN}/api/v`, {
      method: "POST",
      headers: { "content-type": "text/plain;charset=UTF-8", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

const LCP = { n: "LCP", v: 2400, p: "/topics", t: "navigate" };

describe("POST /api/v", () => {
  beforeEach(() => {
    serverEnv.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-0123456789";
    allowRequest.mockReset().mockResolvedValue(true);
    rpc.mockReset().mockResolvedValue({ error: null });
  });

  it("records a valid beacon through the RPC and answers 204, never cached", async () => {
    const metrics = [LCP, { n: "CLS", v: 40, p: "/topics", t: "navigate" }];
    const response = await send({ d: "mobile", m: metrics });
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(allowRequest).toHaveBeenCalledWith("vitals", expect.any(Headers), {
      limit: 120,
      windowSeconds: 600,
    });
    expect(rpc).toHaveBeenCalledWith("record_web_vitals", {
      p_device: "mobile",
      p_metrics: metrics,
    });
  });

  it("passes only the device and the metrics — nothing about the visitor", async () => {
    await send(
      { d: "desktop", m: [LCP] },
      { origin: ORIGIN, "x-forwarded-for": "203.0.113.7", "user-agent": "Test/1.0" },
    );
    expect(rpc).toHaveBeenCalledWith("record_web_vitals", {
      p_device: "desktop",
      p_metrics: [LCP],
    });
  });

  it.each([
    ["not JSON", "d=mobile"],
    ["an unknown device", { d: "tablet", m: [LCP] }],
    ["no metrics", { d: "mobile", m: [] }],
    ["an unknown metric", { d: "mobile", m: [{ ...LCP, n: "FID" }] }],
    ["a value out of range", { d: "mobile", m: [{ ...LCP, v: 60001 }] }],
    ["a CLS out of range", { d: "mobile", m: [{ ...LCP, n: "CLS", v: 10001 }] }],
    ["a full path", { d: "mobile", m: [{ ...LCP, p: "/topics/water" }] }],
    ["an extra field", { d: "mobile", m: [LCP], ua: "Test/1.0" }],
  ])("answers 400 to %s and records nothing", async (_label, body) => {
    expect((await send(body)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
    expect(allowRequest).not.toHaveBeenCalled();
  });

  it("refuses another site's page (403) and an oversized body (413)", async () => {
    expect((await send({ d: "mobile", m: [LCP] }, { origin: "https://evil.example" })).status).toBe(
      403,
    );
    expect((await send({ d: "mobile", m: [LCP], x: "a".repeat(3000) })).status).toBe(413);
    expect(
      (await send({ d: "mobile", m: [LCP] }, { origin: ORIGIN, "content-length": "5000" })).status,
    ).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("answers 429 over the per-IP limit without recording", async () => {
    allowRequest.mockResolvedValue(false);
    expect((await send({ d: "mobile", m: [LCP] })).status).toBe(429);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("drops beacons quietly without the service key or when the database fails", async () => {
    serverEnv.SUPABASE_SERVICE_ROLE_KEY = undefined;
    expect((await send({ d: "mobile", m: [LCP] })).status).toBe(204);
    expect(rpc).not.toHaveBeenCalled();

    serverEnv.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-0123456789";
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ error: { message: "boom" } });
    expect((await send({ d: "mobile", m: [LCP] })).status).toBe(204);
    expect(error).toHaveBeenCalledWith("[vitals]", "boom");
    error.mockRestore();
  });
});
