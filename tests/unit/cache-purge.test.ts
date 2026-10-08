import { beforeEach, describe, expect, it, vi } from "vitest";
import { NEWS_CATEGORIES } from "@/lib/content-types";

/**
 * An UPDATE / DELETE that RLS filters to zero rows is no error in PostgREST.
 * Actions must not refresh public caches or ping IndexNow for such a "write" —
 * only rows the database returns prove it happened.
 */

type Result = { data: unknown; error: null | { message: string } };

const updateTag = vi.hoisted(() => vi.fn());
const notifyIndexNow = vi.hoisted(() => vi.fn());
const client = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("next/cache", () => ({ updateTag, revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/seo/indexnow", () => ({ notifyIndexNow }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn() }));
vi.mock("@/lib/actions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/actions")>()),
  signedIn: async () => ({ supabase: client.current, user: { id: "u1" } }),
}));

/** Supabase stand-in: every query of a table answers `answer(operations)`. */
function fakeSupabase(answer: (table: string, ops: string[]) => Result) {
  return {
    from(table: string) {
      const ops: string[] = [];
      const builder: object = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === "then") {
              return (resolve: (value: Result) => unknown) => resolve(answer(table, ops));
            }
            return () => {
              ops.push(String(prop));
              return builder;
            };
          },
        },
      );
      return builder;
    },
    rpc: async () => ({ data: null, error: null }),
  };
}

/** RLS filtered every UPDATE / DELETE away; reads work. */
const nothingWritten = (rows: Record<string, unknown> = {}) =>
  fakeSupabase((table, ops) =>
    ops.includes("update") || ops.includes("delete")
      ? { data: [], error: null }
      : { data: rows[table] ?? [], error: null },
  );

const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const item of [value].flat()) data.append(key, item);
  }
  return data;
};

const colours = { fill: "#336699", stroke: "#224466" };

describe("no cache refresh without a confirmed write", () => {
  beforeEach(() => {
    updateTag.mockReset();
    notifyIndexNow.mockReset();
  });

  it("saveArea", async () => {
    client.current = nothingWritten();
    const { saveArea } = await import("@/features/map/actions");
    const ring = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ];
    const result = await saveArea(
      { ok: false },
      form({
        original_slug: "zone",
        slug: "zone",
        name: "Zone",
        label: "",
        note: "",
        ...colours,
        geometry: JSON.stringify({ type: "Polygon", coordinates: [ring] }),
      }),
    );
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringMatching(/can.t edit|Nothing changed/),
    });
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("saveIssue: no refresh and no IndexNow ping", async () => {
    client.current = nothingWritten();
    const { saveIssue } = await import("@/features/portraits/actions");
    const result = await saveIssue(
      { ok: false },
      form({
        original_slug: "sahel",
        slug: "sahel",
        name: "Sahel",
        subtitle: "",
        summary: "",
        intro: "",
        hero_credit: "",
        ...colours,
        center_lon: "0",
        center_lat: "15",
        zoom: "3",
        timeline_title: "",
        timeline_subtitle: "",
        countries: ["MLI"],
      }),
    );
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringMatching(/can.t edit|Nothing changed/),
    });
    expect(updateTag).not.toHaveBeenCalled();
    expect(notifyIndexNow).not.toHaveBeenCalled();
  });

  it("saveCategories: an empty list that removed nothing", async () => {
    client.current = nothingWritten();
    const { saveCategories } = await import("@/features/indicators/actions");
    const result = await saveCategories(
      { ok: false },
      form({ indicator_id: "regime-type", items: "[]" }),
    );
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringMatching(/can.t edit|Nothing changed/),
    });
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("saveEntry: a published article the user may read but not edit", async () => {
    const id = "00000000-0000-4000-8000-000000000123";
    client.current = fakeSupabase((table, ops) =>
      ops.includes("update")
        ? { data: [], error: null }
        : ops.includes("single")
          ? {
              data: { status: "published", slug: "a", kind: "news", translation_of: null },
              error: null,
            }
          : { data: [], error: null },
    );
    const { saveEntry } = await import("@/features/entries/actions");
    const result = await saveEntry(
      { ok: false },
      form({
        id,
        slug: "a",
        title: "A",
        summary: "",
        category: NEWS_CATEGORIES[0] ?? "",
        cover_credit: "",
        author_name: "",
        body_html: "<p>x</p>",
        hero_background: "#112233",
      }),
    );
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringMatching(/can.t edit|Nothing changed/),
    });
    expect(updateTag).not.toHaveBeenCalled();
    expect(notifyIndexNow).not.toHaveBeenCalled();
  });
});
