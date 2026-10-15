import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  configured: true,
  access: null as null | Record<string, unknown>,
  staff: false,
  profile: null as null | { name: string | null },
  filters: [] as Array<[string, unknown]>,
}));

vi.mock("@/lib/supabase/config", () => ({
  supabaseConfig: () => (state.configured ? { url: "https://x.supabase.co", anonKey: "k" } : null),
}));
vi.mock("@/features/auth/access", () => ({
  getAccess: async () => state.access,
  opensAdmin: async () => state.staff,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    from: (table: string) => {
      const builder = {
        select: (columns: string) => {
          expect([table, columns]).toEqual(["profiles", "name"]);
          return builder;
        },
        eq: (column: string, value: unknown) => {
          state.filters.push([column, value]);
          return builder;
        },
        maybeSingle: async () => ({ data: state.profile, error: null }),
      };
      return builder;
    },
  }),
}));

const { GET } = await import("./route");

const ACCESS = {
  userId: "u1",
  email: "ana@example.org",
  roleId: "publisher",
  roleName: "Article writer",
  isAdmin: false,
  permissions: { news: "vced" },
};

describe("GET /api/me", () => {
  beforeEach(() => {
    state.configured = true;
    state.access = null;
    state.staff = false;
    state.profile = null;
    state.filters = [];
  });

  it("answers signed out without a session, never cached", async () => {
    const response = await GET();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      signedIn: false,
      name: null,
      email: null,
      roleName: null,
      isStaff: false,
    });
  });

  it("answers signed out when the build has no Supabase", async () => {
    state.configured = false;
    state.access = ACCESS;
    expect((await (await GET()).json()).signedIn).toBe(false);
  });

  it("returns only the five fields the menu shows, the name from the own profile", async () => {
    state.access = ACCESS;
    state.staff = true;
    state.profile = { name: "  Ana Nováková " };
    const response = await GET();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      signedIn: true,
      name: "Ana Nováková",
      email: "ana@example.org",
      roleName: "Article writer",
      isStaff: true,
    });
    expect(state.filters).toEqual([["id", "u1"]]);
  });

  it("tells a reader from the team; no name is fine", async () => {
    state.access = { ...ACCESS, roleId: "reader", roleName: "Reader", permissions: {} };
    expect(await (await GET()).json()).toMatchObject({
      signedIn: true,
      name: null,
      isStaff: false,
    });
  });
});
