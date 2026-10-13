import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Server Actions of Site menus: validation before any write, the write as the
 * signed-in user (RLS decides — an empty result means "not allowed"), and the
 * `site` cache tag after a successful one.
 */

const updateTag = vi.hoisted(() => vi.fn());
const session = vi.hoisted(() => ({
  user: vi.fn(),
  /** What the "database" answers to the write: rows the RLS let through, or an error. */
  result: vi.fn(),
  last: vi.fn(),
  rpc: vi.fn(),
  calls: [] as { table: string; op: string; values?: unknown; filters: unknown[][] }[],
}));

vi.mock("next/cache", () => ({ updateTag, revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: session.user() } }) },
    rpc: (...args: unknown[]) => session.rpc(...args),
    from: (table: string) => {
      const call = {
        table,
        op: "select",
        values: undefined as unknown,
        filters: [] as unknown[][],
      };
      session.calls.push(call);
      const query = {
        update: (values: unknown) => ((call.op = "update"), (call.values = values), query),
        insert: (values: unknown) => ((call.op = "insert"), (call.values = values), query),
        delete: () => ((call.op = "delete"), query),
        select: () => query,
        eq: (...args: unknown[]) => (call.filters.push(args), query),
        order: () => query,
        limit: () => query,
        maybeSingle: async () => session.last(),
        then: (resolve: (value: unknown) => unknown) => resolve(session.result()),
      };
      return query;
    },
  }),
}));

const { addNavItem, deleteNavItem, moveNavItem, setNavItemVisible, updateNavItem } =
  await import("./actions");

const ID = "00000000-0000-4000-8000-000000000001";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const writes = () => session.calls.filter((call) => call.op !== "select");

describe("site menu actions", () => {
  beforeEach(() => {
    session.calls.length = 0;
    updateTag.mockReset();
    session.user.mockReturnValue({ id: "u1" });
    session.result.mockReturnValue({ data: [{ id: ID }], error: null });
    session.last.mockResolvedValue({ data: { position: 4 }, error: null });
    session.rpc.mockResolvedValue({ error: null });
  });

  it("adds an item at the end of its menu", async () => {
    const state = await addNavItem(
      { ok: false },
      form({ menu: "legal", label: "Cookies", href: "/privacy#cookies", visible: "on" }),
    );
    expect(state).toEqual({ ok: true, message: "Added: Cookies" });
    expect(session.calls[0]?.filters).toEqual([["menu", "legal"]]);
    expect(writes()).toEqual([
      {
        table: "nav_items",
        op: "insert",
        values: {
          menu: "legal",
          label: "Cookies",
          href: "/privacy#cookies",
          visible: true,
          is_primary: false,
          compact_hidden: false,
          requires_flag: null,
          position: 5,
        },
        filters: [],
      },
    ]);
    expect(updateTag).toHaveBeenCalledWith("site");
  });

  it("starts an empty menu at position 0", async () => {
    session.last.mockResolvedValue({ data: null, error: null });
    await addNavItem({ ok: false }, form({ menu: "main", label: "About", href: "/about" }));
    expect(writes()[0]?.values).toMatchObject({ position: 0 });
  });

  it("refuses an unsafe or unknown address before touching the database", async () => {
    for (const href of ["//evil.example", "javascript:alert(1)", "/no-such-page"]) {
      const state = await addNavItem({ ok: false }, form({ menu: "main", label: "X", href }));
      expect(state.ok).toBe(false);
      expect(state.fieldErrors?.href).toBeDefined();
    }
    expect(session.calls).toEqual([]);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("requires a signed-in user", async () => {
    session.user.mockReturnValue(null);
    const state = await addNavItem({ ok: false }, form({ menu: "main", label: "A", href: "/" }));
    expect(state).toEqual({ ok: false, error: "Please sign in again." });
    expect(session.calls).toEqual([]);
  });

  it("updates an item without changing its menu", async () => {
    const state = await updateNavItem(
      { ok: false },
      form({ id: ID, menu: "main", label: "Our team", href: "/about", requires_flag: "" }),
    );
    expect(state).toEqual({ ok: true, message: "Saved." });
    expect(writes()).toEqual([
      {
        table: "nav_items",
        op: "update",
        values: {
          label: "Our team",
          href: "/about",
          visible: false,
          is_primary: false,
          compact_hidden: false,
          requires_flag: null,
        },
        filters: [["id", ID]],
      },
    ]);
  });

  it("an update RLS filtered out tells the user, without refreshing the site", async () => {
    session.result.mockReturnValue({ data: [], error: null });
    const state = await updateNavItem(
      { ok: false },
      form({ id: ID, menu: "main", label: "X", href: "/about" }),
    );
    expect(state).toEqual({ ok: false, error: "The menu item can't be changed (no permission)." });
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("shows and hides an item", async () => {
    expect(await setNavItemVisible(ID, false)).toEqual({
      ok: true,
      message: "Hidden from the site.",
    });
    expect(writes()[0]).toMatchObject({ op: "update", values: { visible: false } });
    expect((await setNavItemVisible(ID, true)).message).toBe("Shown on the site.");
    expect(await setNavItemVisible(ID, "yes" as unknown as boolean)).toEqual({
      ok: false,
      error: "Invalid menu item.",
    });
  });

  it("deletes and moves by a valid id only", async () => {
    expect(await deleteNavItem(ID)).toEqual({ ok: true, message: "Deleted." });
    expect(await moveNavItem(ID, true)).toEqual({ ok: true, message: "Moved." });
    expect(session.rpc).toHaveBeenCalledWith("move_nav_item", { p_id: ID, p_up: true });
    expect(await deleteNavItem("1")).toEqual({ ok: false, error: "Invalid menu item." });
    expect(await moveNavItem(ID, "up" as unknown as boolean)).toEqual({
      ok: false,
      error: "Invalid menu item.",
    });
  });

  it("a refused move shows the database's message", async () => {
    session.rpc.mockResolvedValue({
      error: { code: "42501", message: "You can't reorder menu items." },
    });
    const state = await moveNavItem(ID, false);
    expect(state.ok).toBe(false);
    expect(updateTag).not.toHaveBeenCalled();
  });
});
