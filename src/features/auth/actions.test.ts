import { beforeEach, describe, expect, it, vi } from "vitest";

const mfaGate = vi.hoisted(() => vi.fn());
const deleteUser = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("./mfa", () => ({ mfaGate }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "u1", email: "Ana@Example.org" } } }),
      signOut,
    },
  }),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ auth: { admin: { deleteUser } } }),
}));

const { deleteAccount } = await import("./actions");

const confirmWith = (email: string) => {
  const form = new FormData();
  form.set("confirm", email);
  return deleteAccount({ ok: false }, form);
};

describe("deleteAccount", () => {
  beforeEach(() => {
    mfaGate.mockReset().mockResolvedValue(null);
    deleteUser.mockReset().mockResolvedValue({ error: null });
  });

  it("deletes the account after the email is confirmed", async () => {
    await confirmWith("ana@example.org");
    expect(deleteUser).toHaveBeenCalledWith("u1");
  });

  it("a role that requires 2FA can't delete the account without the second factor", async () => {
    mfaGate.mockResolvedValue({ hasFactor: true });
    expect(await confirmWith("ana@example.org")).toEqual({ ok: false, error: "mfa" });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("a wrong confirmation deletes nothing", async () => {
    expect(await confirmWith("someone@else.org")).toEqual({ ok: false, error: "confirm" });
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
