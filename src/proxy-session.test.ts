import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Session refresh in the proxy: the cookies Supabase rotates must reach both
 * the browser (Set-Cookie, httpOnly) and the page or action rendered for this
 * same request (the forwarded Cookie header) — not the token the browser sent.
 */

const AUTH = "sb-test-auth-token";

/** What the stubbed Auth server does on getUser: rotate, clear or keep the cookies. */
const scenario = vi.hoisted(() => ({ mode: "rotate" as "rotate" | "clear" | "keep" }));
const created = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: {
      cookieOptions: Record<string, unknown>;
      cookies: {
        getAll: () => { name: string; value: string }[];
        setAll: (
          cookies: { name: string; value: string; options: Record<string, unknown> }[],
          headers: Record<string, string>,
        ) => void;
      };
    },
  ) => {
    created(options.cookieOptions);
    // Like @supabase/ssr: library defaults, then the app's cookieOptions.
    const cookieOptions = { path: "/", maxAge: 400 * 24 * 60 * 60, ...options.cookieOptions };
    return {
      auth: {
        getUser: async () => {
          const sent = options.cookies.getAll().find((cookie) => cookie.name === AUTH)?.value;
          const noStore = { "Cache-Control": "private, no-cache, no-store, must-revalidate" };
          if (scenario.mode === "rotate" && sent) {
            options.cookies.setAll(
              [{ name: AUTH, value: "new-token", options: cookieOptions }],
              noStore,
            );
            return { data: { user: { id: "u1" } } };
          }
          if (scenario.mode === "clear" && sent) {
            options.cookies.setAll(
              [{ name: AUTH, value: "", options: { ...cookieOptions, maxAge: 0 } }],
              noStore,
            );
          }
          return { data: { user: scenario.mode === "keep" && sent ? { id: "u1" } : null } };
        },
      },
    };
  },
}));

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-for-unit-tests-only");

const { proxy } = await import("./proxy");

const request = (path: string, cookie = `${AUTH}=old-token; theme=dark`) =>
  new NextRequest(`https://atlas.example${path}`, { headers: { cookie } });

/** The Cookie header Next hands to the page / action of this request. */
const forwardedCookie = (response: Response) =>
  response.headers.get("x-middleware-request-cookie") ?? "";

describe("proxy: session cookies", () => {
  beforeEach(() => {
    scenario.mode = "rotate";
    created.mockReset();
  });

  it("forwards the refreshed token to the page, not the one the browser sent", async () => {
    for (const path of ["/admin", "/login"]) {
      const response = await proxy(request(path));
      expect(response.status).toBe(200);
      expect(forwardedCookie(response)).toContain(`${AUTH}=new-token`);
      expect(forwardedCookie(response)).not.toContain("old-token");
      // Other cookies of the request stay.
      expect(forwardedCookie(response)).toContain("theme=dark");
    }
  });

  it("sends the refreshed cookie to the browser as httpOnly, with no-store", async () => {
    const response = await proxy(request("/admin"));
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${AUTH}=new-token`);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=lax/i);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(created).toHaveBeenCalledWith(expect.objectContaining({ httpOnly: true }));
  });

  it("leaves the forwarded cookies alone when nothing was refreshed", async () => {
    scenario.mode = "keep";
    const response = await proxy(request("/admin"));
    expect(response.status).toBe(200);
    expect(forwardedCookie(response)).toBe(`${AUTH}=old-token; theme=dark`);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("a dead session is cleared on the redirect to sign-in and never forwarded", async () => {
    scenario.mode = "clear";
    const response = await proxy(request("/admin/entries"));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/login");
    expect(response.headers.get("set-cookie")).toMatch(new RegExp(`${AUTH}=;.*Max-Age=0`, "i"));
  });

  it("a dead session on a page that doesn't require sign-in is dropped from the request", async () => {
    scenario.mode = "clear";
    const response = await proxy(request("/login"));
    expect(response.status).toBe(200);
    expect(forwardedCookie(response)).toBe("theme=dark");
  });

  it("public pages never touch the session", async () => {
    const response = await proxy(request("/news"));
    expect(created).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
