import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  configured: true,
  access: null as null | Record<string, unknown>,
  staff: false,
}));

vi.mock("@/lib/supabase/config", () => ({
  supabaseConfig: () => (state.configured ? { url: "https://x.supabase.co", anonKey: "k" } : null),
}));
vi.mock("@/features/auth/access", () => ({
  getAccess: async () => state.access,
  opensAdmin: async () => state.staff,
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
  });

  it("answers signed out without a session, never cached", async () => {
    const response = await GET();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      signedIn: false,
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

  it("returns only the four fields the menu shows", async () => {
    state.access = ACCESS;
    state.staff = true;
    const response = await GET();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      signedIn: true,
      email: "ana@example.org",
      roleName: "Article writer",
      isStaff: true,
    });
  });

  it("tells a reader from the team", async () => {
    state.access = { ...ACCESS, roleId: "reader", roleName: "Reader", permissions: {} };
    expect(await (await GET()).json()).toMatchObject({ signedIn: true, isStaff: false });
  });
});
