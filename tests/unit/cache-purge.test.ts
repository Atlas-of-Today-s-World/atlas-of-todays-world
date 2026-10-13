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

vi.mock("next/cache", () => ({
  updateTag,
  revalidatePath: vi.fn(),
  // Cached public reads some actions modules import (they aren't called here).
  unstable_cache: (fn: unknown) => fn,
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/seo/indexnow", () => ({ notifyIndexNow }));
// The session client is the current stand-in with a signed-in user, so both
// `signedIn()` and the formAction / idAction wrappers (which call it inside
// lib/actions) see the same client.
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    ...(client.current as object),
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
  }),
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

// Each test imports a whole actions module for the first time; under the full
// suite with coverage that alone can pass the default 5 s, so allow more.
describe("no cache refresh without a confirmed write", { timeout: 30_000 }, () => {
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

  it("home page: the tile count and unpinning", async () => {
    client.current = nothingWritten();
    const { saveHomeSettings, removeHomePin } = await import("@/features/home/actions");
    const saved = await saveHomeSettings({ ok: false }, form({ featured_count: "4" }));
    expect(saved).toMatchObject({ ok: false, error: expect.stringMatching(/can.t change/) });
    const removed = await removeHomePin("00000000-0000-4000-8000-000000000123");
    expect(removed).toMatchObject({ ok: false, error: expect.stringMatching(/can.t change/) });
    expect(updateTag).not.toHaveBeenCalled();
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

/** Every query answers with the table's rows: the write went through. */
const written = (rows: Record<string, unknown>) =>
  fakeSupabase((table) => ({ data: rows[table] ?? [], error: null }));

const updatedTags = () => updateTag.mock.calls.map(([tag]) => tag as string);

describe("a confirmed write refreshes exactly its tags", { timeout: 30_000 }, () => {
  beforeEach(() => {
    updateTag.mockReset();
    notifyIndexNow.mockReset();
  });

  const published = (kind: string) => ({
    entries: {
      slug: "water",
      status: "published",
      region_slug: "europe",
      special_slug: null,
      kind,
      locale: "en",
    },
  });

  it("approveEntry: the lists and that article's page, not every article page", async () => {
    client.current = written(published("entry"));
    const { approveEntry } = await import("@/features/entries/workflow-actions");
    const result = await approveEntry("00000000-0000-4000-8000-000000000123");
    expect(result).toMatchObject({ ok: true });
    expect(updatedTags()).toEqual(["entries", "entry:water", "portrait:region:europe"]);
  });

  it("approveEntry of a news article: also the switches (News may join the menu)", async () => {
    client.current = written(published("news"));
    const { approveEntry } = await import("@/features/entries/workflow-actions");
    const result = await approveEntry("00000000-0000-4000-8000-000000000123");
    expect(result).toMatchObject({ ok: true });
    expect(updatedTags()).toEqual(["entries", "entry:water", "portrait:region:europe", "flags"]);
  });

  it("unpublishEntry of a news article: no switch changes, so not the switches", async () => {
    client.current = written(published("news"));
    const { unpublishEntry } = await import("@/features/entries/workflow-actions");
    await unpublishEntry("00000000-0000-4000-8000-000000000123");
    expect(updatedTags()).not.toContain("flags");
  });

  it("saveCountry: the map snapshot and that country's profile text", async () => {
    client.current = written({ countries: [{ iso3: "CZE", slug: "czechia" }] });
    const { saveCountry } = await import("@/features/portraits/actions");
    const result = await saveCountry(
      { ok: false },
      form({ iso3: "CZE", blurb: "", tagline: "", profile_html: "<p>x</p>", region_slug: "" }),
    );
    expect(result).toMatchObject({ ok: true });
    expect(updatedTags()).toEqual(["atlas", "country:CZE"]);
  });

  it("setValue: only that indicator's values, not the map snapshot", async () => {
    client.current = written({});
    const { setValue } = await import("@/features/indicators/actions");
    const result = await setValue(
      { ok: false },
      form({
        indicator_id: "hdi",
        country_iso3: "CZE",
        value: "0.9",
        year: "2023",
        note: "",
        source_note: "UNDP",
      }),
    );
    expect(result).toMatchObject({ ok: true });
    expect(updatedTags()).toEqual(["indicator:hdi"]);
  });

  it("deleteValue: only that indicator's values", async () => {
    client.current = written({ indicator_values: [{ country_iso3: "CZE" }] });
    const { deleteValue } = await import("@/features/indicators/actions");
    const result = await deleteValue("hdi", "CZE");
    expect(result).toMatchObject({ ok: true });
    expect(updatedTags()).toEqual(["indicator:hdi"]);
  });

  it("saveCategories: the definitions in the map snapshot, not the values", async () => {
    client.current = written({ indicator_categories: [{ value: 1 }] });
    const { saveCategories } = await import("@/features/indicators/actions");
    const result = await saveCategories(
      { ok: false },
      form({
        indicator_id: "regime-type",
        items: JSON.stringify([{ value: 1, label: "Autocracy", color: "#000000" }]),
      }),
    );
    expect(result).toMatchObject({ ok: true });
    expect(updatedTags()).toEqual(["atlas"]);
  });

  it("deleteIndicator: its definition and its values", async () => {
    client.current = written({ indicators: [{ id: "custom" }] });
    const { deleteIndicator } = await import("@/features/indicators/actions");
    const result = await deleteIndicator("custom");
    expect(result).toMatchObject({ ok: true });
    expect(updatedTags()).toEqual(["atlas", "indicator:custom"]);
  });

  it("deleteIssue: its portrait and every article page, whose group link was cleared", async () => {
    client.current = written({ special_regions: [{ slug: "sahel" }] });
    const { deleteIssue } = await import("@/features/portraits/actions");
    const result = await deleteIssue("sahel");
    expect(result).toMatchObject({ ok: true });
    expect(updatedTags()).toEqual(["atlas", "portrait:issue:sahel", "entries", "entry-pages"]);
  });

  it("saveMaintenanceMessage: only the maintenance notice, not the switches", async () => {
    client.current = written({ site_notices: [{ id: 1 }] });
    const { saveMaintenanceMessage } = await import("@/features/flags/actions");
    const result = await saveMaintenanceMessage(
      { ok: false },
      form({ maintenance_title: "Back soon", maintenance_text: "" }),
    );
    expect(result).toMatchObject({ ok: true });
    expect(updatedTags()).toEqual(["site-notices"]);
  });

  it("home page: only the home map's pins, not every article list", async () => {
    client.current = written({ home_settings: [{ id: 1 }] });
    const { saveHomeSettings, moveHomePin } = await import("@/features/home/actions");
    expect(await saveHomeSettings({ ok: false }, form({ featured_count: "3" }))).toMatchObject({
      ok: true,
    });
    expect(await moveHomePin("00000000-0000-4000-8000-000000000123", true)).toMatchObject({
      ok: true,
    });
    expect(updatedTags()).toEqual(["home", "home"]);
  });

  it("updateRedirect: the redirect map", async () => {
    client.current = written({ redirects: [{ id: "x" }] });
    const { updateRedirect } = await import("@/features/redirects/actions");
    const result = await updateRedirect(
      { ok: false },
      form({ id: "00000000-0000-4000-8000-000000000123", from_path: "/old", to_path: "/new" }),
    );
    expect(result).toMatchObject({ ok: true });
    expect(updatedTags()).toEqual(["redirects"]);
  });
});
