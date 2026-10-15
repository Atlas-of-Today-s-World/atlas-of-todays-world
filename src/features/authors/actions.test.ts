import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Author actions: Zod before any write, a changed slug refreshes the redirects
 * (the DB trigger leaves one behind), a taken slug is a field error, RLS
 * silence is "no permission", and the account link goes through the RPC.
 */

const updateTag = vi.hoisted(() => vi.fn());
const session = vi.hoisted(() => ({
  user: vi.fn(),
  /** Rows the RLS let through on the write, or an error. */
  result: vi.fn(),
  /** The author before the save. */
  before: vi.fn(),
  rpc: vi.fn(),
  writes: [] as { table: string; op: string; values?: unknown }[],
}));

vi.mock("next/cache", () => ({ updateTag, revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: session.user() } }) },
    rpc: (...args: unknown[]) => session.rpc(...args),
    from: (table: string) => {
      const query = {
        update: (values: unknown) => (session.writes.push({ table, op: "update", values }), query),
        insert: (values: unknown) => (session.writes.push({ table, op: "insert", values }), query),
        delete: () => (session.writes.push({ table, op: "delete" }), query),
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: session.before(), error: null }),
        then: (resolve: (value: unknown) => unknown) => resolve(session.result()),
      };
      return query;
    },
  }),
}));

const { saveAuthor, saveAuthorAccount } = await import("./actions");

const ID = "00000000-0000-4000-8000-000000000001";
const ACCOUNT = "00000000-0000-4000-8000-000000000002";

function authorForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  const values: Record<string, string> = {
    id: ID,
    name: "Ada Ames",
    slug: "ada-ames",
    photo_url: "",
    bio: "Writes about water.",
    positionality: "",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

describe("author actions", () => {
  beforeEach(() => {
    updateTag.mockReset();
    session.user.mockReset().mockReturnValue({ id: "u1" });
    session.result.mockReset().mockReturnValue({ data: [{ id: ID }], error: null });
    session.before.mockReset().mockReturnValue({ slug: "ada-ames" });
    session.rpc.mockReset().mockResolvedValue({ error: null });
    session.writes.length = 0;
  });

  it("an unchanged slug saves without touching the redirects", async () => {
    const state = await saveAuthor({ ok: false }, authorForm());
    expect(state).toEqual({ ok: true, message: "Saved." });
    expect(session.writes).toEqual([
      expect.objectContaining({
        table: "authors",
        op: "update",
        values: expect.objectContaining({ slug: "ada-ames", photo_url: null }),
      }),
    ]);
    expect(updateTag).toHaveBeenCalledWith("entries");
    expect(updateTag).not.toHaveBeenCalledWith("redirects");
  });

  it("a new slug refreshes the redirects and names both URLs", async () => {
    const state = await saveAuthor({ ok: false }, authorForm({ slug: "Ada-K" }));
    expect(state.ok).toBe(true);
    expect(state.message).toBe("Saved. /authors/ada-ames now redirects to /authors/ada-k.");
    expect(updateTag).toHaveBeenCalledWith("redirects");
  });

  it("an invalid slug is a field error and writes nothing", async () => {
    const state = await saveAuthor({ ok: false }, authorForm({ slug: "ada ames!" }));
    expect(state.ok).toBe(false);
    expect(state.fieldErrors?.slug).toBeTruthy();
    expect(session.writes).toEqual([]);
  });

  it("a slug another author has is shown under the field", async () => {
    session.result.mockReturnValue({ data: null, error: { code: "23505", message: "dup" } });
    const state = await saveAuthor({ ok: false }, authorForm({ slug: "taken" }));
    expect(state.fieldErrors?.slug).toEqual(["Another author profile already has this URL."]);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("without the right (no row returned) it says so", async () => {
    session.result.mockReturnValue({ data: [], error: null });
    expect(await saveAuthor({ ok: false }, authorForm())).toEqual({
      ok: false,
      error: "You can't edit this author (no permission).",
    });
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("links and unlinks an account through set_author_account", async () => {
    const link = new FormData();
    link.set("id", ID);
    link.set("profile_id", ACCOUNT);
    expect((await saveAuthorAccount({ ok: false }, link)).ok).toBe(true);
    expect(session.rpc).toHaveBeenCalledWith("set_author_account", {
      p_author: ID,
      p_profile: ACCOUNT,
    });

    link.set("profile_id", "");
    expect((await saveAuthorAccount({ ok: false }, link)).message).toMatch(/No longer linked/);
    expect(session.rpc).toHaveBeenLastCalledWith("set_author_account", {
      p_author: ID,
      p_profile: null,
    });

    session.rpc.mockResolvedValue({
      error: { code: "42501", message: "Only account managers can link an author to an account." },
    });
    expect(await saveAuthorAccount({ ok: false }, link)).toEqual({
      ok: false,
      error: "Only account managers can link an author to an account.",
    });

    link.set("profile_id", "nope");
    session.rpc.mockClear();
    expect((await saveAuthorAccount({ ok: false }, link)).fieldErrors?.profile_id).toBeTruthy();
    expect(session.rpc).not.toHaveBeenCalled();
  });
});
