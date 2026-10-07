import { describe, expect, it } from "vitest";
import { buildCsp, securityHeaderEntries } from "./csp";

function directive(csp: string, name: string) {
  return csp.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";
}

describe("buildCsp", () => {
  const prod = buildCsp({ dev: false, supabaseUrl: "https://abc.supabase.co" });

  it("in production without unsafe-eval and with upgrade-insecure-requests", () => {
    expect(directive(prod, "script-src")).not.toContain("unsafe-eval");
    expect(prod).toContain("upgrade-insecure-requests");
  });

  it("allows unsafe-eval in development", () => {
    const dev = buildCsp({ dev: true });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });

  it("allows Supabase (REST and realtime) and MapTiler", () => {
    const connect = directive(prod, "connect-src");
    expect(connect).toContain("https://abc.supabase.co");
    expect(connect).toContain("wss://abc.supabase.co");
    expect(connect).toContain("https://api.maptiler.com");
    expect(directive(prod, "form-action")).toContain("https://abc.supabase.co");
  });

  it("entry audio only from our own site and over https", () => {
    expect(directive(prod, "media-src")).toBe("media-src 'self' https:");
  });

  it("without a Supabase URL inserts no empty entries", () => {
    const csp = buildCsp({ dev: false });
    expect(csp).not.toMatch(/ {2}|\s;/);
  });

  it("Turnstile may load script and iframe only from challenges.cloudflare.com", () => {
    expect(directive(prod, "script-src")).toContain("https://challenges.cloudflare.com");
    expect(directive(prod, "frame-src")).toContain("https://challenges.cloudflare.com");
    expect(directive(prod, "script-src")).not.toMatch(/https:(\s|$)/);
  });

  it("frames Datawrapper charts only from their exact CDN host", () => {
    const frames = directive(prod, "frame-src").split(" ");
    expect(frames).toContain("https://datawrapper.dwcdn.net");
    expect(frames.filter((source) => source.includes("datawrapper"))).toEqual([
      "https://datawrapper.dwcdn.net",
    ]);
    expect(frames).not.toContain("https:");
  });

  it("forbids framing and plugins", () => {
    expect(directive(prod, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(prod, "object-src")).toBe("object-src 'none'");
  });
});

describe("securityHeaderEntries", () => {
  it("HSTS only outside development", () => {
    const names = (dev: boolean) => securityHeaderEntries("x", { dev }).map(([name]) => name);
    expect(names(false)).toContain("Strict-Transport-Security");
    expect(names(true)).not.toContain("Strict-Transport-Security");
  });
});
