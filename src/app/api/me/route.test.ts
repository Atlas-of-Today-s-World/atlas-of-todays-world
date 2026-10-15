import { beforeEach, describe, expect, it, vi } from "vitest";

const user = vi.hoisted(() => ({ current: null as null | { id: string; email?: string } }));
const profile = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }));
const filters = vi.hoisted(() => [] as Array<[string, unknown]>);

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: user.current } }) },
    from: () => {
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return builder;
        },
        maybeSingle: async () => ({ data: profile.current, error: null }),
      };
      return builder;
    },
  }),
}));

const { GET } = await import("./route");

describe("GET /api/me", () => {
  beforeEach(() => {
    user.current = null;
    profile.current = null;
    filters.length = 0;
  });

  it("says nothing but 'signed out' to a visitor, never cached", async () => {
    const response = await GET();
    expect(await response.json()).toEqual({ signedIn: false });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("gives a signed-in reader their e-mail and name, not the team", async () => {
    user.current = { id: "u1", email: "ana@example.org" };
    profile.current = { name: " Ana ", kind: "reader", status: "active" };
    const body = await (await GET()).json();
    expect(body).toEqual({ signedIn: true, email: "ana@example.org", name: "Ana", staff: false });
    // Only the visitor's own profile is read.
    expect(filters).toEqual([["id", "u1"]]);
  });

  it("marks active team members, not blocked ones", async () => {
    user.current = { id: "u2", email: "ed@example.org" };
    profile.current = { name: "", kind: "staff", status: "active" };
    const staff = await (await GET()).json();
    expect(staff).toMatchObject({ staff: true });
    // An empty name is left out (the menu shows the e-mail).
    expect(staff).not.toHaveProperty("name");
    profile.current = { name: "Ed", kind: "staff", status: "blocked" };
    expect(await (await GET()).json()).toMatchObject({ staff: false });
  });
});
