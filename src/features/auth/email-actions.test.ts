import { beforeEach, describe, expect, it, vi } from "vitest";

const allowRequest = vi.hoisted(() => vi.fn());
const allowEmail = vi.hoisted(() => vi.fn());
const verifyOtp = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/features/flags/queries", () => ({ getFlags: async () => ({ emailAuth: true }) }));
vi.mock("@/lib/security/rate-limit", () => ({ allowRequest, allowEmail }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({ auth: { verifyOtp } }),
}));
vi.mock("./sign-in", () => ({ signInDestination: async () => "/ucet" }));

const { verifyEmailCode } = await import("./email-actions");

const attempt = (email = "ana@example.org") => {
  const form = new FormData();
  form.set("email", email);
  form.set("code", "123456");
  return verifyEmailCode({ ok: false }, form);
};

describe("verifyEmailCode", () => {
  beforeEach(() => {
    allowRequest.mockReset().mockResolvedValue(true);
    allowEmail.mockReset().mockResolvedValue(true);
    verifyOtp.mockReset().mockResolvedValue({ error: { message: "invalid" } });
  });

  it("counts every attempt against the email address, not only the IP address", async () => {
    expect(await attempt(" Ana@Example.org ")).toMatchObject({ error: "wrong_code" });
    expect(allowEmail).toHaveBeenCalledWith(
      "email-verify-address",
      "ana@example.org",
      expect.objectContaining({ limit: expect.any(Number) }),
    );
  });

  it("over the per-address limit it never asks Supabase to check the code", async () => {
    allowEmail.mockResolvedValue(false);
    expect(await attempt()).toMatchObject({ ok: false, error: "rate_limited" });
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("over the per-IP limit it refuses as before", async () => {
    allowRequest.mockResolvedValue(false);
    expect(await attempt()).toMatchObject({ ok: false, error: "rate_limited" });
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
