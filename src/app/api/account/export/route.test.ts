import { beforeEach, describe, expect, it, vi } from "vitest";

const user = vi.hoisted(() => ({
  current: null as null | Record<string, unknown>,
}));
const tables = vi.hoisted(() => ({}) as Record<string, { data: unknown; error: unknown }>);
const rpc = vi.hoisted(() => vi.fn());
const filters = vi.hoisted(() => [] as Array<[string, string, unknown]>);

/** A query builder that records `.eq()` filters and resolves to the table's canned result. */
function query(table: string) {
  const result = () => tables[table] ?? { data: null, error: null };
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      filters.push([table, column, value]);
      return builder;
    },
    order: () => builder,
    maybeSingle: () => Promise.resolve(result()),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: user.current } }) },
    from: query,
    rpc,
  }),
}));

const { GET } = await import("./route");

const PERSONAL = {
  authorProfile: { id: "a1", slug: "ana", name: "Ana" },
  invitations: [{ id: "i1", email: "ana@example.org", acceptedAt: null }],
  volunteerApplications: [{ id: "v1", message: "Hi" }],
  entryRevisions: [{ id: 1, entryId: "e1", savedAt: "2026-10-01", published: false }],
};

describe("GET /api/account/export", () => {
  beforeEach(() => {
    filters.length = 0;
    user.current = {
      id: "u1",
      email: "ana@example.org",
      created_at: "2026-01-01",
      last_sign_in_at: "2026-10-01",
      app_metadata: { providers: ["email"] },
    };
    Object.assign(tables, {
      profiles: { data: { id: "u1", email: "ana@example.org", kind: "reader" }, error: null },
      memberships: { data: null, error: null },
      entries: { data: [{ slug: "topic-a" }], error: null },
      page_views_daily: { data: [{ day: "2026-10-01", views: 3 }], error: null },
      approver_countries: { data: [{ country_iso3: "BRA" }], error: null },
      approver_authors: { data: [{ author_id: "p2" }], error: null },
    });
    rpc.mockReset().mockResolvedValue({ data: PERSONAL, error: null });
  });

  it("refuses anonymous callers", async () => {
    user.current = null;
    expect((await GET()).status).toBe(401);
  });

  it("keeps every earlier key and adds the rest of the user's data", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toMatch(/attachment/);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    // The keys of the first version, unchanged.
    expect(body).toMatchObject({
      account: { id: "u1", email: "ana@example.org", providers: ["email"] },
      profile: { id: "u1", kind: "reader" },
      membership: null,
      entries: [{ slug: "topic-a" }],
    });
    expect(typeof body.exportedAt).toBe("string");
    // Added keys.
    expect(body.pageViews).toEqual([{ day: "2026-10-01", views: 3 }]);
    expect(body.approverScope).toEqual({ countries: ["BRA"], authorAccounts: ["p2"] });
    expect(body.authorProfile).toEqual(PERSONAL.authorProfile);
    expect(body.invitations).toEqual(PERSONAL.invitations);
    expect(body.volunteerApplications).toEqual(PERSONAL.volunteerApplications);
    expect(body.entryRevisions).toEqual(PERSONAL.entryRevisions);
    expect(rpc).toHaveBeenCalledWith("my_personal_data");
  });

  it("reads every table for the signed-in user only", async () => {
    await GET();
    expect(filters).toEqual(
      expect.arrayContaining([
        ["profiles", "id", "u1"],
        ["memberships", "user_id", "u1"],
        ["entries", "owner_id", "u1"],
        ["page_views_daily", "user_id", "u1"],
        ["approver_countries", "user_id", "u1"],
        ["approver_authors", "user_id", "u1"],
      ]),
    );
    expect(filters).toHaveLength(6);
  });

  it("an empty account still has every key", async () => {
    rpc.mockResolvedValue({
      data: { authorProfile: null, invitations: [], volunteerApplications: [], entryRevisions: [] },
      error: null,
    });
    Object.assign(tables, {
      page_views_daily: { data: [], error: null },
      approver_countries: { data: [], error: null },
      approver_authors: { data: [], error: null },
    });
    const body = await (await GET()).json();
    expect(body).toMatchObject({
      pageViews: [],
      approverScope: { countries: [], authorAccounts: [] },
      authorProfile: null,
      invitations: [],
      volunteerApplications: [],
      entryRevisions: [],
    });
  });

  it("a failed read fails the export instead of returning an incomplete copy", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const response = await GET();
    expect(response.status).toBe(500);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
