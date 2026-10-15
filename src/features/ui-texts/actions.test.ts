import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Server Actions of UI texts: validation before any write (unknown key,
 * markup, placeholders), the write as the signed-in user (RLS decides — no
 * returned row means "not allowed"), and the `ui-texts` tag after a real change.
 */

const updateTag = vi.hoisted(() => vi.fn());
const session = vi.hoisted(() => ({
  user: vi.fn(),
  /** The saved override of the key (null = the text is the default). */
  current: vi.fn(),
  /** What the "database" answers to a write. */
  result: vi.fn(),
  writes: [] as { table: string; op: string; values?: unknown }[],
}));

vi.mock("next/cache", () => ({ updateTag, revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: session.user() } }) },
    from: (table: string) => {
      const query = {
        update: (values: unknown) => (session.writes.push({ table, op: "update", values }), query),
        insert: (values: unknown) => (session.writes.push({ table, op: "insert", values }), query),
        delete: () => (session.writes.push({ table, op: "delete" }), query),
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: session.current(), error: null }),
        then: (resolve: (value: unknown) => unknown) => resolve(session.result()),
      };
      return query;
    },
  }),
}));

const { resetUiText, saveUiText } = await import("./actions");
const en = (await import("@/messages/en.json")).default;

const form = (key: string, value: string) => {
  const data = new FormData();
  data.set("key", key);
  data.set("value", value);
  return data;
};

describe("UI text actions", () => {
  beforeEach(() => {
    updateTag.mockReset();
    session.user.mockReset().mockReturnValue({ id: "u1" });
    session.current.mockReset().mockReturnValue(null);
    session.result.mockReset().mockReturnValue({ data: [{ key: "x" }], error: null });
    session.writes.length = 0;
  });

  it("a first change is inserted and refreshes the site", async () => {
    const state = await saveUiText({ ok: false }, form("home.title", "The world today"));
    expect(state.ok).toBe(true);
    expect(session.writes).toEqual([
      {
        table: "ui_text_overrides",
        op: "insert",
        values: { key: "home.title", value: "The world today" },
      },
    ]);
    expect(updateTag).toHaveBeenCalledWith("ui-texts");
  });

  it("a changed text is updated; without the right (no row back) nothing refreshes", async () => {
    session.current.mockReturnValue({ value: "Old" });
    expect((await saveUiText({ ok: false }, form("home.title", "New"))).ok).toBe(true);
    expect(session.writes.at(-1)).toMatchObject({ op: "update", values: { value: "New" } });

    updateTag.mockReset();
    session.result.mockReturnValue({ data: [], error: null });
    expect(await saveUiText({ ok: false }, form("home.title", "Newer"))).toEqual({
      ok: false,
      error: "You can't change this text.",
    });
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("saving the default text resets the change", async () => {
    session.current.mockReturnValue({ value: "Old" });
    expect((await saveUiText({ ok: false }, form("home.title", en.home.title))).ok).toBe(true);
    expect(session.writes).toEqual([{ table: "ui_text_overrides", op: "delete" }]);
  });

  it("invalid input writes nothing: unknown key, locked key, HTML, placeholders", async () => {
    for (const [key, value] of [
      ["home.unknown", "x"],
      ["auth.title", "Log in"],
      ["home.title", "<b>Atlas</b>"],
      ["ui.newsOne", "one news item"],
    ] as const) {
      const state = await saveUiText({ ok: false }, form(key, value));
      expect(state.ok, key).toBe(false);
    }
    expect(session.writes).toEqual([]);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("reset deletes the change; an unknown key or a signed-out user writes nothing", async () => {
    expect((await resetUiText("home.title")).ok).toBe(true);
    expect(session.writes).toEqual([{ table: "ui_text_overrides", op: "delete" }]);
    expect(updateTag).toHaveBeenCalledWith("ui-texts");

    session.writes.length = 0;
    expect(await resetUiText("__proto__")).toEqual({ ok: false, error: "Unknown text." });
    session.user.mockReturnValue(null);
    expect((await resetUiText("home.title")).error).toMatch(/sign in/);
    expect(session.writes).toEqual([]);
  });
});
