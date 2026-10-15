import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** What the anonymous client answers: `{ data, error }`, or a throw (no env, network). */
const answer = vi.hoisted(() => vi.fn());

// The cache is Next's; here every call reads the "database".
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));
vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({ from: () => ({ select: () => answer() }) }),
}));

const { getUiTextOverrides } = await import("./queries");
const { getMessagesFor } = await import("@/lib/i18n/request");
const en = (await import("@/messages/en.json")).default;

describe("UI text overrides (public read)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    answer.mockReset();
  });

  it("keeps the rows that fit en.json and merges them into the messages", async () => {
    answer.mockResolvedValue({
      data: [
        { key: "home.title", value: "Atlas" },
        { key: "home.gone", value: "x" },
      ],
      error: null,
    });
    expect(await getUiTextOverrides()).toEqual({ "home.title": "Atlas" });
    const messages = await getMessagesFor("en");
    expect(messages.home.title).toBe("Atlas");
    expect(messages.home.intro).toBe(en.home.intro);
  });

  it("a failed read falls back to en.json (and is logged, not cached)", async () => {
    answer.mockResolvedValue({ data: null, error: { message: "timeout" } });
    expect(await getUiTextOverrides()).toEqual({});
    answer.mockRejectedValue(new Error("Supabase is not configured"));
    expect(await getUiTextOverrides()).toEqual({});
    expect((await getMessagesFor("en")).home.title).toBe(en.home.title);
    expect(console.error).toHaveBeenCalled();
  });
});
