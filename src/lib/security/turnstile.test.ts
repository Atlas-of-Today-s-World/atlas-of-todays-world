import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const serverEnv = vi.hoisted(() => ({ TURNSTILE_SECRET_KEY: "secret" as string | undefined }));
const publicEnv = vi.hoisted(() => ({
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key-123" as string | undefined,
}));

vi.mock("@/lib/env.server", () => ({ serverEnv }));
vi.mock("@/lib/env", () => ({ publicEnv }));

const { captchaEnabled, passesCaptcha, verifyTurnstile } = await import("./turnstile");

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const fetchMock = vi.fn<typeof fetch>();
const answer = (body: unknown, status = 200) =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
const sentBody = () => fetchMock.mock.calls[0]?.[1]?.body as URLSearchParams;

describe("verifyTurnstile", () => {
  let log: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    serverEnv.TURNSTILE_SECRET_KEY = "secret";
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    log = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    log.mockRestore();
  });

  it("accepts a token Cloudflare confirms, sending the secret, token and address", async () => {
    answer({ success: true });
    expect(await verifyTurnstile("token", "203.0.113.7")).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      SITEVERIFY,
      expect.objectContaining({ method: "POST", signal: expect.any(AbortSignal) }),
    );
    expect(Object.fromEntries(sentBody())).toEqual({
      secret: "secret",
      response: "token",
      remoteip: "203.0.113.7",
    });
  });

  it("leaves the address out when there is none", async () => {
    answer({ success: true });
    await verifyTurnstile("token", undefined);
    expect(sentBody().has("remoteip")).toBe(false);
  });

  it("rejects a token Cloudflare rejects (invalid, expired or reused)", async () => {
    answer({ success: false, "error-codes": ["invalid-input-response"] });
    expect(await verifyTurnstile("forged", "203.0.113.7")).toBe(false);
    answer({ success: false, "error-codes": ["timeout-or-duplicate"] });
    expect(await verifyTurnstile("reused", "203.0.113.7")).toBe(false);
    answer({ success: false });
    expect(await verifyTurnstile("token", "203.0.113.7")).toBe(false);
    expect(log).not.toHaveBeenCalled();
  });

  it("rejects a missing or oversized token without asking Cloudflare", async () => {
    expect(await verifyTurnstile("", "203.0.113.7")).toBe(false);
    expect(await verifyTurnstile("x".repeat(2049), "203.0.113.7")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets the request through when Cloudflare times out (availability first)", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));
    expect(await verifyTurnstile("token", "203.0.113.7")).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("TimeoutError"));
  });

  it("lets the request through on a network error or a non-Error throw", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await verifyTurnstile("token", undefined)).toBe(true);
    fetchMock.mockRejectedValue("boom");
    expect(await verifyTurnstile("token", undefined)).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("unknown error"));
  });

  it("lets the request through on an HTTP error or an unreadable answer", async () => {
    answer({}, 503);
    expect(await verifyTurnstile("token", undefined)).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("HTTP 503"));
    fetchMock.mockResolvedValue(new Response("<html>", { status: 200 }));
    expect(await verifyTurnstile("token", undefined)).toBe(true);
  });

  it("lets the request through when Cloudflare says our secret is wrong, and reports it", async () => {
    answer({ success: false, "error-codes": ["invalid-input-secret"] });
    expect(await verifyTurnstile("token", undefined)).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("invalid-input-secret"));
  });

  it("without a secret checks nothing", async () => {
    serverEnv.TURNSTILE_SECRET_KEY = undefined;
    expect(await verifyTurnstile("", undefined)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("captchaEnabled / passesCaptcha", () => {
  beforeEach(() => {
    serverEnv.TURNSTILE_SECRET_KEY = "secret";
    publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key-123";
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const form = (value?: string) => {
    const data = new FormData();
    if (value !== undefined) data.set("cf-turnstile-response", value);
    return data;
  };
  const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });

  it("is on only with both the site key and the secret", () => {
    expect(captchaEnabled()).toBe(true);
    serverEnv.TURNSTILE_SECRET_KEY = undefined;
    expect(captchaEnabled()).toBe(false);
    serverEnv.TURNSTILE_SECRET_KEY = "secret";
    publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY = undefined;
    expect(captchaEnabled()).toBe(false);
  });

  it("when off, any form passes without a call to Cloudflare", async () => {
    serverEnv.TURNSTILE_SECRET_KEY = undefined;
    expect(await passesCaptcha(form(), headers)).toBe(true);
    publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY = undefined;
    serverEnv.TURNSTILE_SECRET_KEY = "secret";
    expect(await passesCaptcha(form(), headers)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("when on, checks the widget's field with the client address", async () => {
    answer({ success: true });
    expect(await passesCaptcha(form("token"), headers)).toBe(true);
    expect(Object.fromEntries(sentBody())).toMatchObject({
      response: "token",
      remoteip: "203.0.113.7",
    });
  });

  it("when on, a form without the widget's field fails", async () => {
    expect(await passesCaptcha(form(), headers)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
