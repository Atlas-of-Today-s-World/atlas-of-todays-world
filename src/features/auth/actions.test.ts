import { beforeEach, describe, expect, it, vi } from "vitest";

const mfaGate = vi.hoisted(() => vi.fn());
const deleteUser = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());
const sessionRpc = vi.hoisted(() => vi.fn());
const removeUnusedUploads = vi.hoisted(() => vi.fn());
const steps = vi.hoisted(() => [] as string[]);

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("./mfa", () => ({ mfaGate }));
vi.mock("./account-uploads", () => ({ removeUnusedUploads }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "u1", email: "Ana@Example.org" } } }),
      signOut,
    },
    rpc: sessionRpc,
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
    steps.length = 0;
    mfaGate.mockReset().mockResolvedValue(null);
    sessionRpc.mockReset().mockImplementation(async (name: string) => {
      steps.push(name);
      return { data: { invitations: 1, volunteerApplications: 1 }, error: null };
    });
    deleteUser.mockReset().mockImplementation(async () => {
      steps.push("deleteUser");
      return { error: null };
    });
    removeUnusedUploads.mockReset().mockImplementation(async () => {
      steps.push("uploads");
      return 2;
    });
  });

  it("removes personal data, then the account, then unused uploads", async () => {
    await confirmWith("ana@example.org");
    expect(steps).toEqual(["delete_my_personal_data", "deleteUser", "uploads"]);
    expect(deleteUser).toHaveBeenCalledWith("u1");
    expect(removeUnusedUploads).toHaveBeenCalledWith(expect.anything(), "u1");
  });

  it("keeps the account when the personal data can't be removed (e.g. the last admin)", async () => {
    sessionRpc.mockResolvedValue({ data: null, error: { message: "At least one admin" } });
    expect(await confirmWith("ana@example.org")).toEqual({ ok: false, error: "failed" });
    expect(deleteUser).not.toHaveBeenCalled();
    expect(removeUnusedUploads).not.toHaveBeenCalled();
  });

  it("removes no files when the account itself can't be deleted", async () => {
    deleteUser.mockResolvedValue({ error: { message: "nope" } });
    expect(await confirmWith("ana@example.org")).toEqual({ ok: false, error: "failed" });
    expect(removeUnusedUploads).not.toHaveBeenCalled();
  });

  it("a failed file cleanup doesn't undo or block the deletion", async () => {
    removeUnusedUploads.mockRejectedValue(new Error("storage down"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await confirmWith("ana@example.org");
    expect(deleteUser).toHaveBeenCalledWith("u1");
    expect(signOut).toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith("[account] uploads not removed", "storage down");
    error.mockRestore();
  });

  it("a role that requires 2FA can't delete the account without the second factor", async () => {
    mfaGate.mockResolvedValue({ hasFactor: true });
    expect(await confirmWith("ana@example.org")).toEqual({ ok: false, error: "mfa" });
    expect(sessionRpc).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("a wrong confirmation deletes nothing", async () => {
    expect(await confirmWith("someone@else.org")).toEqual({ ok: false, error: "confirm" });
    expect(sessionRpc).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
