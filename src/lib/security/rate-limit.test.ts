import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ SUPABASE_SERVICE_ROLE_KEY: "service" as string | undefined }));
const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env.server", () => ({ serverEnv: env }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ rpc }) }));

const { allowRequest } = await import("./rate-limit");

const opts = { limit: 3, windowSeconds: 60 };
const headers = (ip?: string) => new Headers(ip ? { "x-forwarded-for": ip } : {});

describe("allowRequest", () => {
  beforeEach(() => {
    env.SUPABASE_SERVICE_ROLE_KEY = "service";
    rpc.mockReset();
  });

  it("bez servisního klíče (lokálně) pustí vše a do DB nesahá", async () => {
    env.SUPABASE_SERVICE_ROLE_KEY = undefined;
    expect(await allowRequest("search", headers("1.2.3.4"), opts)).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("klíč obsahuje rozsah a hash první adresy, ne adresu samotnou", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await allowRequest("search", headers("1.2.3.4, 10.0.0.1"), opts)).toBe(true);
    const args = rpc.mock.calls[0][1];
    expect(rpc).toHaveBeenCalledWith("hit_rate_limit", expect.any(Object));
    expect(args.p_key).toMatch(/^search:[0-9a-f]{32}$/);
    expect(args.p_key).not.toContain("1.2.3.4");
    expect(args).toMatchObject({ p_limit: 3, p_window_seconds: 60 });
  });

  it("bez adresy počítá pod společným klíčem a odmítne nad limitem", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await allowRequest("search", headers(), opts)).toBe(false);
    rpc.mockResolvedValue({ data: false, error: null });
    await allowRequest("search", headers(), opts);
    expect(rpc.mock.calls[0][1].p_key).toBe(rpc.mock.calls[1][1].p_key);
  });

  it("výpadek databáze požadavek nezablokuje", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    expect(await allowRequest("search", headers("1.2.3.4"), opts)).toBe(true);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
