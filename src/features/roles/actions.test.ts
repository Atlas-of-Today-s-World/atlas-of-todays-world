import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Role actions: a role saved under RLS that touched no row is reported (not
 * "Role saved."), a new role goes to the end of the order, and moving goes
 * through the move_role RPC.
 */

const session = vi.hoisted(() => ({
  user: vi.fn(),
  result: vi.fn(),
  rpc: vi.fn(),
  writes: [] as { table: string; op: string; values?: unknown }[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: session.user() } }) },
    rpc: (...args: unknown[]) => session.rpc(...args),
    from: (table: string) => {
      const query = {
        update: (values: unknown) => (session.writes.push({ table, op: "update", values }), query),
        insert: (values: unknown) => (session.writes.push({ table, op: "insert", values }), query),
        select: () => query,
        eq: () => query,
        neq: () => query,
        order: () => query,
        limit: () => query,
        maybeSingle: async () => ({ data: { position: 60 }, error: null }),
        then: (resolve: (value: unknown) => unknown) => resolve(session.result()),
      };
      return query;
    },
  }),
}));

const { moveRole, saveRole } = await import("./actions");

function roleForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  const values: Record<string, string> = {
    id: "lecturer",
    is_new: "false",
    name: "Lecturer",
    note: "",
    news_scope: "own",
    approval_scope: "none",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

describe("role actions", () => {
  beforeEach(() => {
    session.user.mockReset().mockReturnValue({ id: "u1" });
    session.result.mockReset().mockReturnValue({ data: [{ id: "lecturer" }], error: null });
    session.rpc.mockReset().mockResolvedValue({ error: null });
    session.writes.length = 0;
  });

  it("saves a role; no row returned (no right) is an error, not 'saved'", async () => {
    expect(await saveRole({ ok: false }, roleForm())).toEqual({ ok: true, message: "Role saved." });
    session.result.mockReturnValue({ data: [], error: null });
    expect(await saveRole({ ok: false }, roleForm())).toEqual({
      ok: false,
      error: "You can't edit this role.",
    });
  });

  it("a new role goes after the last one", async () => {
    session.result.mockReturnValue({ error: null });
    const state = await saveRole({ ok: false }, roleForm({ is_new: "true" }));
    expect(state).toEqual({ ok: true, message: "Role created." });
    expect(session.writes).toEqual([
      expect.objectContaining({ op: "insert", values: expect.objectContaining({ position: 70 }) }),
    ]);
  });

  it("invalid input writes nothing", async () => {
    expect((await saveRole({ ok: false }, roleForm({ id: "Not A Slug" }))).ok).toBe(false);
    expect(session.writes).toEqual([]);
  });

  it("moving calls move_role; a refusal is shown; a bad id never reaches the DB", async () => {
    expect((await moveRole("lecturer", true)).ok).toBe(true);
    expect(session.rpc).toHaveBeenCalledWith("move_role", { p_id: "lecturer", p_up: true });
    session.rpc.mockResolvedValue({
      error: { code: "42501", message: "You can't reorder roles." },
    });
    expect(await moveRole("lecturer", false)).toEqual({
      ok: false,
      error: "You can't reorder roles.",
    });
    session.rpc.mockClear();
    expect((await moveRole("Bad Id", true)).ok).toBe(false);
    expect(session.rpc).not.toHaveBeenCalled();
  });
});
