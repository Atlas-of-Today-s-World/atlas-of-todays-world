import { beforeEach, describe, expect, it, vi } from "vitest";

const requestHeaders = vi.hoisted(() => ({ current: new Headers() }));
const signInWithOAuth = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
);

vi.mock("next/headers", () => ({ headers: async () => requestHeaders.current }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({ auth: { signInWithOAuth } }),
}));

const { startGoogleSignIn } = await import("./oauth-actions");

const GOOGLE = "https://accounts.google.com/o/oauth2/v2/auth?code_challenge=abc";

const start = (next?: string) => {
  const form = new FormData();
  if (next !== undefined) form.set("next", next);
  return startGoogleSignIn({ ok: false }, form);
};

/** The redirectTo the action asked Supabase for. */
const returnAddress = () => new URL(signInWithOAuth.mock.calls[0]?.[0].options.redirectTo);

describe("startGoogleSignIn", () => {
  beforeEach(() => {
    requestHeaders.current = new Headers({ origin: "https://preview.atlas.example" });
    signInWithOAuth.mockReset().mockResolvedValue({
      data: { provider: "google", url: GOOGLE },
      error: null,
    });
    redirect.mockClear();
  });

  it("starts PKCE on the server and sends the browser to Google", async () => {
    await expect(start("/admin")).rejects.toThrow("NEXT_REDIRECT");
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: expect.any(String), skipBrowserRedirect: true },
    });
    expect(redirect).toHaveBeenCalledWith(GOOGLE);
  });

  it("returns to /auth/callback on the site the request came from, with the next page", async () => {
    await expect(start("/admin/entries?x=1")).rejects.toThrow();
    const target = returnAddress();
    expect(target.origin).toBe("https://preview.atlas.example");
    expect(target.pathname).toBe("/auth/callback");
    expect(target.searchParams.get("next")).toBe("/admin/entries?x=1");
  });

  it.each([["//evil.example"], ["https://evil.example"], ["/\\evil.example"], ["x".repeat(501)]])(
    "never carries an off-site next (%s)",
    async (next) => {
      await expect(start(next)).rejects.toThrow();
      expect(returnAddress().searchParams.get("next")).toBe("/ucet");
    },
  );

  it("without a usable Origin header it falls back to the site URL", async () => {
    for (const origin of [null, "not a url", "javascript:alert(1)"]) {
      signInWithOAuth.mockClear();
      requestHeaders.current = new Headers(origin ? { origin } : {});
      await expect(start()).rejects.toThrow();
      expect(["http:", "https:"]).toContain(returnAddress().protocol);
      expect(returnAddress().host).not.toBe("alert(1)");
      expect(returnAddress().pathname).toBe("/auth/callback");
    }
  });

  it("when Supabase can't start the flow the form shows an error and nothing redirects", async () => {
    signInWithOAuth.mockResolvedValue({ data: { url: null }, error: { message: "down" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await start("/ucet")).toEqual({ ok: false, error: "unreachable" });
    expect(redirect).not.toHaveBeenCalled();
  });
});
