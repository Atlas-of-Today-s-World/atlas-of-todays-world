import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Server Actions of Site settings: validation before any write, the write as
 * the signed-in user (RLS decides — an empty result means "not allowed"), and
 * the `site` cache tag after a successful one.
 */

const updateTag = vi.hoisted(() => vi.fn());
const session = vi.hoisted(() => ({
  user: vi.fn(),
  /** What the "database" answers to the write: rows the RLS let through, or an error. */
  result: vi.fn(),
  rpc: vi.fn(),
  writes: [] as { table: string; op: string; values?: unknown }[],
}));

vi.mock("next/cache", () => ({ updateTag, revalidatePath: vi.fn() }));
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
        order: () => query,
        limit: () => query,
        maybeSingle: async () => ({ data: { position: 3 }, error: null }),
        then: (resolve: (value: unknown) => unknown) => resolve(session.result()),
      };
      return query;
    },
  }),
}));

const { addSocialLink, deleteSocialLink, moveSocialLink, saveSiteSettings } =
  await import("./actions");

const ID = "00000000-0000-4000-8000-000000000001";

function settingsForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  const values: Record<string, string> = {
    name: "Atlas of Today's World",
    alternate_names: "ATW",
    legal_name: "Atlas of Today's World, z. s.",
    company_id: "05363454",
    founding_date: "2016-09-07",
    street_address: "náměstí Jana Palacha 1/2",
    postal_code: "110 00",
    address_locality: "Praha 1",
    address_country: "CZ",
    description: "An atlas.",
    wikidata_id: "",
    contact_email: "info@atlasoftodaysworld.org",
    seo_title: "Atlas",
    title_suffix: "— Atlas",
    seo_description: "Explore.",
    og_image_url: "/og-image.png",
    copyright: "© Atlas",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

describe("site settings actions", () => {
  beforeEach(() => {
    updateTag.mockReset();
    session.user.mockReset().mockReturnValue({ id: "u1" });
    session.result.mockReset().mockReturnValue({ data: [{ id: 1 }], error: null });
    session.rpc.mockReset().mockResolvedValue({ error: null });
    session.writes.length = 0;
  });

  it("saves the settings as the signed-in user and refreshes the site", async () => {
    const state = await saveSiteSettings({ ok: false }, settingsForm());
    expect(state.ok).toBe(true);
    expect(session.writes).toEqual([
      expect.objectContaining({
        table: "site_settings",
        op: "update",
        values: expect.objectContaining({ wikidata_id: null, alternate_names: ["ATW"] }),
      }),
    ]);
    expect(updateTag).toHaveBeenCalledWith("site");
  });

  it("invalid input writes nothing", async () => {
    const state = await saveSiteSettings(
      { ok: false },
      settingsForm({ og_image_url: "//evil.example/x.png" }),
    );
    expect(state.ok).toBe(false);
    expect(state.fieldErrors?.og_image_url).toBeTruthy();
    expect(session.writes).toEqual([]);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("without the right (RLS lets no row through) it says so and refreshes nothing", async () => {
    session.result.mockReturnValue({ data: [], error: null });
    expect(await saveSiteSettings({ ok: false }, settingsForm())).toEqual({
      ok: false,
      error: "You can't change the site settings.",
    });
    expect(await deleteSocialLink(ID)).toMatchObject({ ok: false });
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("signed out: asks to sign in, writes nothing", async () => {
    session.user.mockReturnValue(null);
    expect((await saveSiteSettings({ ok: false }, settingsForm())).error).toMatch(/sign in/);
    expect(session.writes).toEqual([]);
  });

  it("a new social link goes to the end of the list", async () => {
    const form = new FormData();
    form.set("label", "Mastodon");
    form.set("url", "https://mastodon.social/@atlas");
    form.set("icon", "M");
    form.set("visible", "on");
    expect((await addSocialLink({ ok: false }, form)).ok).toBe(true);
    expect(session.writes).toEqual([
      {
        table: "site_social_links",
        op: "insert",
        values: {
          label: "Mastodon",
          url: "https://mastodon.social/@atlas",
          icon: "M",
          visible: true,
          position: 4,
        },
      },
    ]);
  });

  it("moving calls the RPC; a refusal from the DB is shown", async () => {
    expect((await moveSocialLink(ID, true)).ok).toBe(true);
    expect(session.rpc).toHaveBeenCalledWith("move_site_social_link", { p_id: ID, p_up: true });

    session.rpc.mockResolvedValue({
      error: { code: "42501", message: "You can't reorder social links." },
    });
    expect(await moveSocialLink(ID, false)).toEqual({
      ok: false,
      error: "You can't reorder social links.",
    });
    expect(await moveSocialLink("not-a-uuid", true)).toMatchObject({ ok: false });
  });
});
