import { beforeEach, describe, expect, it, vi } from "vitest";

const user = vi.hoisted(() => ({
  current: null as null | Record<string, unknown>,
}));
const tables = vi.hoisted(() => ({}) as Record<string, { data: unknown; error: unknown }>);
const rpc = vi.hoisted(() => vi.fn());
const listFactors = vi.hoisted(() => vi.fn());
const selects = vi.hoisted(() => ({}) as Record<string, string>);
const filters = vi.hoisted(() => [] as Array<[string, string, unknown]>);

/** A query builder that records `.eq()` filters and resolves to the table's canned result. */
function query(table: string) {
  const result = () => tables[table] ?? { data: null, error: null };
  const builder = {
    select: (columns: string) => {
      selects[table] = columns;
      return builder;
    },
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
    auth: { getUser: async () => ({ data: { user: user.current } }), mfa: { listFactors } },
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
  sitePageRevisions: [{ id: 7, slug: "about", savedAt: "2026-10-02" }],
  auditActions: [
    {
      action: "entries.update",
      table: "entries",
      targetId: "topic-a",
      at: "2026-10-03",
      columns: ["title"],
    },
  ],
};

/** A factor as Supabase Auth returns it, plus fields that must never reach the export. */
const FACTOR = {
  id: "f1",
  friendly_name: "Phone",
  factor_type: "totp",
  status: "verified",
  created_at: "2026-09-01",
  updated_at: "2026-09-02",
  totp: { qr_code: "data:image/svg+xml;QR", secret: "JBSWY3DPEHPK3PXP", uri: "otpauth://x" },
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
    listFactors.mockReset().mockResolvedValue({
      data: { all: [FACTOR], totp: [FACTOR], phone: [] },
      error: null,
    });
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

  it("adds notes, site page revisions, own audit actions and second factors (2026-10-15)", async () => {
    Object.assign(tables, {
      profiles: {
        data: { id: "u1", kind: "reader", blocked_note: "Spam in comments" },
        error: null,
      },
    });
    const body = await (await GET()).json();
    expect(selects.profiles).toMatch(/\bblocked_note\b/);
    expect(body.profile.blocked_note).toBe("Spam in comments");
    expect(body.sitePageRevisions).toEqual(PERSONAL.sitePageRevisions);
    expect(body.auditActions).toEqual(PERSONAL.auditActions);
    expect(body.twoFactorFactors).toEqual([
      { friendlyName: "Phone", factorType: "totp", status: "verified", createdAt: "2026-09-01" },
    ]);
    expect(listFactors).toHaveBeenCalledOnce();
  });

  it("never exports a factor's secret, QR code or URI", async () => {
    const text = await (await GET()).text();
    expect(text).not.toMatch(/JBSWY3DPEHPK3PXP|qr_code|otpauth|secret/);
  });

  it("a factor without a name exports null for it", async () => {
    listFactors.mockResolvedValue({
      data: { all: [{ ...FACTOR, friendly_name: undefined }], totp: [], phone: [] },
      error: null,
    });
    const body = await (await GET()).json();
    expect(body.twoFactorFactors[0].friendlyName).toBeNull();
  });

  it("a failed factor list fails the export", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    listFactors.mockResolvedValue({ data: null, error: { message: "auth down" } });
    expect((await GET()).status).toBe(500);
    error.mockRestore();
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
    listFactors.mockResolvedValue({ data: { all: [], totp: [], phone: [] }, error: null });
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
      // An older database function without the newer keys still gives every key.
      sitePageRevisions: [],
      auditActions: [],
      twoFactorFactors: [],
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
