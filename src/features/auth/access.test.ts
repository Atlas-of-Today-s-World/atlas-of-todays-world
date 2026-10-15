import { beforeEach, describe, expect, it, vi } from "vitest";

const awaitsSecondFactor = vi.hoisted(() => vi.fn());
vi.mock("./mfa", () => ({ awaitsSecondFactor }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn() }));

const { opensAdmin } = await import("./access");

const access = (permissions: Record<string, string>) =>
  ({
    userId: "u1",
    email: "ana@example.org",
    roleId: null,
    roleName: null,
    isAdmin: false,
    permissions,
  }) as Parameters<typeof opensAdmin>[0];

describe("opensAdmin (account menu, /account → admin)", () => {
  beforeEach(() => awaitsSecondFactor.mockReset().mockResolvedValue(false));

  it("is true with a section to view", async () => {
    expect(await opensAdmin(access({ news: "v" }))).toBe(true);
  });

  it("is false for a reader", async () => {
    expect(await opensAdmin(access({}))).toBe(false);
  });

  it("is true for a team role still waiting for its second factor", async () => {
    awaitsSecondFactor.mockResolvedValue(true);
    expect(await opensAdmin(access({}))).toBe(true);
  });
});
