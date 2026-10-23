import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const serverEnv = vi.hoisted(() => ({
  MAILCHIMP_API_KEY: "key-us21",
  MAILCHIMP_LIST_ID: "list1",
  TURNSTILE_SECRET_KEY: undefined as string | undefined,
}));
const allowRequest = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));
vi.mock("@/lib/env.server", () => ({ serverEnv }));
vi.mock("@/lib/env", () => ({ publicEnv: { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key-123" } }));
vi.mock("@/lib/security/rate-limit", () => ({ allowRequest }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn() }));

const { subscribe } = await import("./actions");

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const fetchMock = vi.fn<typeof fetch>();
const calledUrls = () => fetchMock.mock.calls.map(([url]) => String(url));

function form(answer?: string) {
  const data = new FormData();
  data.set("email", "ana@example.org");
  data.set("consent", "on");
  if (answer !== undefined) data.set("cf-turnstile-response", answer);
  return subscribe({ ok: false }, data);
}

/** Cloudflare answers `siteverify`, Mailchimp accepts the subscriber. */
function services(turnstile: { success: boolean; "error-codes"?: string[] }) {
  fetchMock.mockImplementation(async (url) =>
    String(url) === SITEVERIFY
      ? new Response(JSON.stringify(turnstile))
      : new Response(JSON.stringify({ status: "pending" })),
  );
}

describe("subscribe (newsletter) with Turnstile", () => {
  beforeEach(() => {
    serverEnv.TURNSTILE_SECRET_KEY = undefined;
    allowRequest.mockReset().mockResolvedValue(true);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("without the secret subscribes as before, with no token and no Cloudflare call", async () => {
    services({ success: false });
    expect(await form()).toEqual({ ok: true, message: "confirm" });
    expect(calledUrls()).toEqual(["https://us21.api.mailchimp.com/3.0/lists/list1/members"]);
  });

  it("with the secret subscribes once Cloudflare confirms the token", async () => {
    serverEnv.TURNSTILE_SECRET_KEY = "secret";
    services({ success: true });
    expect(await form("token")).toEqual({ ok: true, message: "confirm" });
    expect(calledUrls()).toEqual([
      SITEVERIFY,
      "https://us21.api.mailchimp.com/3.0/lists/list1/members",
    ]);
  });

  it("with the secret refuses a rejected token and never reaches Mailchimp", async () => {
    serverEnv.TURNSTILE_SECRET_KEY = "secret";
    services({ success: false, "error-codes": ["invalid-input-response"] });
    expect(await form("forged")).toEqual({ ok: false, error: "captcha" });
    expect(calledUrls()).toEqual([SITEVERIFY]);
  });

  it("with the secret refuses a form without a token", async () => {
    serverEnv.TURNSTILE_SECRET_KEY = "secret";
    expect(await form()).toEqual({ ok: false, error: "captcha" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates before the check, so a typo doesn't use up the token", async () => {
    serverEnv.TURNSTILE_SECRET_KEY = "secret";
    const data = new FormData();
    data.set("email", "not-an-address");
    data.set("cf-turnstile-response", "token");
    expect(await subscribe({ ok: false }, data)).toMatchObject({ ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
