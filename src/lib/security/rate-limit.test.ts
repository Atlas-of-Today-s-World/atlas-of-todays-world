import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ SUPABASE_SERVICE_ROLE_KEY: "service" as string | undefined }));
const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env.server", () => ({ serverEnv: env }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ rpc }) }));

const { allowEmail, allowKey, allowRequest } = await import("./rate-limit");

const opts = { limit: 3, windowSeconds: 60 };
const headers = (ip?: string) => new Headers(ip ? { "x-forwarded-for": ip } : {});

describe("allowRequest", () => {
  beforeEach(() => {
    env.SUPABASE_SERVICE_ROLE_KEY = "service";
    rpc.mockReset();
  });

  it("without a service key in production allows the request but reports the missing key", async () => {
    env.SUPABASE_SERVICE_ROLE_KEY = undefined;
    vi.stubEnv("VERCEL_ENV", "production");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await allowRequest("search", headers("1.2.3.4"), opts)).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("SUPABASE_SERVICE_ROLE_KEY"));
    expect(rpc).not.toHaveBeenCalled();
    log.mockRestore();
    vi.unstubAllEnvs();
  });

  it("without a service key (locally) allows everything and doesn't touch the DB", async () => {
    env.SUPABASE_SERVICE_ROLE_KEY = undefined;
    expect(await allowRequest("search", headers("1.2.3.4"), opts)).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("key contains the scope and a hash of the first address, not the address itself", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await allowRequest("search", headers("1.2.3.4, 10.0.0.1"), opts)).toBe(true);
    const args = rpc.mock.calls[0]?.[1];
    expect(rpc).toHaveBeenCalledWith("hit_rate_limit", expect.any(Object));
    expect(args.p_key).toMatch(/^search:[0-9a-f]{32}$/);
    expect(args.p_key).not.toContain("1.2.3.4");
    expect(args).toMatchObject({ p_limit: 3, p_window_seconds: 60 });
  });

  it("without an address counts under a shared key and rejects over the limit", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await allowRequest("search", headers(), opts)).toBe(false);
    rpc.mockResolvedValue({ data: false, error: null });
    await allowRequest("search", headers(), opts);
    expect(rpc.mock.calls[0]?.[1].p_key).toBe(rpc.mock.calls[1]?.[1].p_key);
  });

  it("a database outage doesn't block the request", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    expect(await allowRequest("search", headers("1.2.3.4"), opts)).toBe(true);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("a database outage refuses sign-in codes instead of opening them", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    expect(await allowRequest("email-code", headers("1.2.3.4"), opts)).toBe(false);
    expect(await allowRequest("email-verify", headers("1.2.3.4"), opts)).toBe(false);
    log.mockRestore();
  });

  it("a database outage also refuses the public forms that send mail or write rows", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    expect(await allowRequest("newsletter", headers("1.2.3.4"), opts)).toBe(false);
    expect(await allowRequest("volunteer", headers("1.2.3.4"), opts)).toBe(false);
    log.mockRestore();
  });
});

describe("allowEmail", () => {
  beforeEach(() => {
    env.SUPABASE_SERVICE_ROLE_KEY = "service";
    rpc.mockReset();
  });

  it("counts one address under one key whatever its case, never storing the address", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await allowEmail("email-verify-address", " Ana@Example.org", opts)).toBe(true);
    await allowEmail("email-verify-address", "ana@example.org", opts);
    const [first, second] = rpc.mock.calls.map((call) => call[1].p_key as string);
    expect(first).toMatch(/^email-verify-address:[0-9a-f]{32}$/);
    expect(first).toBe(second);
    expect(first).not.toContain("ana");
  });

  it("refuses over the limit and when the store is down", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await allowEmail("email-verify-address", "ana@example.org", opts)).toBe(false);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    expect(await allowEmail("email-verify-address", "ana@example.org", opts)).toBe(false);
    log.mockRestore();
  });

  it("without a service key (locally) has no limit", async () => {
    env.SUPABASE_SERVICE_ROLE_KEY = undefined;
    expect(await allowEmail("email-verify-address", "ana@example.org", opts)).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("allowKey", () => {
  beforeEach(() => {
    env.SUPABASE_SERVICE_ROLE_KEY = "service";
    rpc.mockReset();
  });

  it("limits under the given key as is", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await allowKey("indexnow:abc", { limit: 1, windowSeconds: 900 })).toBe(false);
    expect(rpc).toHaveBeenCalledWith("hit_rate_limit", {
      p_key: "indexnow:abc",
      p_limit: 1,
      p_window_seconds: 900,
    });
  });
});
