import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const serverEnv = vi.hoisted(() => ({
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-0123456789",
  TURNSTILE_SECRET_KEY: undefined as string | undefined,
}));
const allowRequest = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/env.server", () => ({ serverEnv }));
vi.mock("@/lib/env", () => ({ publicEnv: { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key-123" } }));
vi.mock("@/lib/security/rate-limit", () => ({ allowRequest }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ rpc }) }));

const { applyAsVolunteer } = await import("./actions");

const fetchMock = vi.fn<typeof fetch>();
const cloudflare = (body: { success: boolean; "error-codes"?: string[] }) =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body)));

function apply(answer?: string) {
  const data = new FormData();
  data.set("name", "Ana");
  data.set("email", "ana@example.org");
  data.set("consent", "on");
  if (answer !== undefined) data.set("cf-turnstile-response", answer);
  return applyAsVolunteer({ ok: false }, data);
}

describe("applyAsVolunteer with Turnstile", () => {
  beforeEach(() => {
    serverEnv.TURNSTILE_SECRET_KEY = undefined;
    allowRequest.mockReset().mockResolvedValue(true);
    rpc.mockReset().mockResolvedValue({ error: null });
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("without the secret saves the application as before, with no token", async () => {
    expect(await apply()).toEqual({ ok: true, message: "thanks" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("submit_volunteer_application", expect.any(Object));
  });

  it("with the secret saves the application once Cloudflare confirms the token", async () => {
    serverEnv.TURNSTILE_SECRET_KEY = "secret";
    cloudflare({ success: true });
    expect(await apply("token")).toEqual({ ok: true, message: "thanks" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("with the secret refuses a rejected or missing token and saves nothing", async () => {
    serverEnv.TURNSTILE_SECRET_KEY = "secret";
    cloudflare({ success: false, "error-codes": ["timeout-or-duplicate"] });
    expect(await apply("reused")).toEqual({ ok: false, error: "captcha" });
    expect(await apply()).toEqual({ ok: false, error: "captcha" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("with the secret still accepts when Cloudflare is unreachable", async () => {
    serverEnv.TURNSTILE_SECRET_KEY = "secret";
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await apply("token")).toEqual({ ok: true, message: "thanks" });
    expect(rpc).toHaveBeenCalledOnce();
    log.mockRestore();
  });
});
