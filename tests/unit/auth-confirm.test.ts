import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyOtp = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({ auth: { verifyOtp }, rpc }),
}));

const { GET, POST } = await import("@/app/auth/confirm/route");

const SITE = "https://atlas.example";
const link = `${SITE}/auth/confirm?token_hash=abc123&type=magiclink&next=/ucet`;

const post = (origin: string | null, fields = { token_hash: "abc123", type: "magiclink" }) => {
  const body = new URLSearchParams(fields);
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
  };
  if (origin) headers.origin = origin;
  return POST(new NextRequest(`${SITE}/auth/confirm`, { method: "POST", body, headers }));
};

describe("/auth/confirm", () => {
  beforeEach(() => {
    verifyOtp.mockReset().mockResolvedValue({ error: null });
    rpc.mockReset().mockResolvedValue({ data: { id: "reader" } });
  });

  it("opening the link signs no one in — it leads to the confirmation page", async () => {
    const response = await GET(new NextRequest(link));
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.status).toBe(303);
    const target = new URL(response.headers.get("location") ?? "");
    expect(target.origin).toBe(SITE);
    expect(target.pathname).toBe("/login/confirm");
    expect(Object.fromEntries(target.searchParams)).toEqual({
      token_hash: "abc123",
      type: "magiclink",
      next: "/ucet",
    });
  });

  it("an incomplete link goes back to the sign-in page", async () => {
    const response = await GET(new NextRequest(`${SITE}/auth/confirm?type=magiclink`));
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/login");
  });

  it("a post from another site or without an origin is refused", async () => {
    expect((await post("https://evil.example")).status).toBe(403);
    expect((await post(null)).status).toBe(403);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("the button on our own page verifies the token and continues with a GET", async () => {
    const response = await post(SITE);
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "abc123", type: "magiclink" });
    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/ucet");
  });

  it("a wrong token or type ends on the sign-in page", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "expired" } });
    expect(new URL((await post(SITE)).headers.get("location") ?? "").pathname).toBe("/login");
    const bad = await post(SITE, { token_hash: "abc123", type: "phone_change" });
    expect(new URL(bad.headers.get("location") ?? "").pathname).toBe("/login");
  });
});
