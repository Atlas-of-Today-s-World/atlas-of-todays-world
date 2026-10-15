import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Invitation actions: approver authors go into the invitation, extending is a
 * write under RLS (no row = refused), and a resend sends e-mail only after that
 * write went through — the service key never acts for someone without the right.
 */

const session = vi.hoisted(() => ({
  user: vi.fn(),
  result: vi.fn(),
  invite: vi.fn(),
  writes: [] as { table: string; op: string; values?: unknown }[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/flags/queries", () => ({ getFlags: async () => ({ emailAuth: true }) }));
vi.mock("@/lib/env.server", () => ({ serverEnv: { SUPABASE_SERVICE_ROLE_KEY: "test" } }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ auth: { admin: { inviteUserByEmail: session.invite } } }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: session.user() } }) },
    from: (table: string) => {
      const query = {
        update: (values: unknown) => (session.writes.push({ table, op: "update", values }), query),
        insert: (values: unknown) => {
          session.writes.push({ table, op: "insert", values });
          return Promise.resolve({ error: null });
        },
        select: () => query,
        eq: () => query,
        is: () => query,
        then: (resolve: (value: unknown) => unknown) => resolve(session.result()),
      };
      return query;
    },
  }),
}));

const { createInvitation, extendInvitation, resendInvitation } = await import("./actions");

const ID = "00000000-0000-4000-8000-000000000001";
const AUTHOR = "00000000-0000-4000-8000-000000000002";

describe("invitation actions", () => {
  beforeEach(() => {
    session.user.mockReset().mockReturnValue({ id: "u1" });
    session.result.mockReset().mockReturnValue({ data: [{ email: "a@b.org" }], error: null });
    session.invite.mockReset().mockResolvedValue({ error: null });
    session.writes.length = 0;
  });

  it("a new invitation carries the approver authors", async () => {
    const form = new FormData();
    form.set("email", "new@atlasoftodaysworld.org");
    form.set("roleId", "content-approver");
    form.append("authors", AUTHOR);
    expect((await createInvitation({ ok: false }, form)).ok).toBe(true);
    expect(session.writes[0]).toMatchObject({
      table: "invitations",
      op: "insert",
      values: { approver_authors: [AUTHOR], approver_countries: [] },
    });

    form.set("authors", "not-a-uuid");
    session.writes.length = 0;
    expect((await createInvitation({ ok: false }, form)).fieldErrors?.authors).toBeTruthy();
    expect(session.writes).toEqual([]);
  });

  it("extending sets a new expiry at most five days ahead", async () => {
    const before = Date.now();
    expect((await extendInvitation(ID)).ok).toBe(true);
    const { expires_at } = session.writes[0]?.values as { expires_at: string };
    const ahead = new Date(expires_at).getTime() - before;
    expect(ahead).toBeGreaterThan(5 * 86_400_000 - 60_000);
    expect(ahead).toBeLessThanOrEqual(5 * 86_400_000 + 60_000);
    expect(session.invite).not.toHaveBeenCalled();
  });

  it("resending extends first, then e-mails the invitee", async () => {
    const state = await resendInvitation(ID);
    expect(state.ok).toBe(true);
    expect(state.message).toMatch(/received an email/);
    expect(session.invite).toHaveBeenCalledWith("a@b.org", expect.anything());
  });

  it("no row from the write (no right, accepted or revoked): refused, nothing sent", async () => {
    session.result.mockReturnValue({ data: [], error: null });
    expect(await resendInvitation(ID)).toEqual({
      ok: false,
      error: "This invitation can't be extended (accepted or revoked).",
    });
    expect((await extendInvitation(ID)).ok).toBe(false);
    expect(session.invite).not.toHaveBeenCalled();
  });

  it("a DB refusal (admin-only invitation) is shown; a bad id never reaches the DB", async () => {
    session.result.mockReturnValue({
      data: null,
      error: { code: "42501", message: "Only an admin can extend this invitation." },
    });
    expect(await resendInvitation(ID)).toEqual({
      ok: false,
      error: "Only an admin can extend this invitation.",
    });
    expect(session.invite).not.toHaveBeenCalled();
    session.writes.length = 0;
    expect(await extendInvitation("nope")).toEqual({ ok: false, error: "Invalid invitation." });
    expect(session.writes).toEqual([]);
  });
});
