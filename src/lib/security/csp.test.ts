import { describe, expect, it } from "vitest";
import { buildCsp, securityHeaderEntries } from "./csp";

function directive(csp: string, name: string) {
  return csp.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";
}

describe("buildCsp", () => {
  const prod = buildCsp({ dev: false, supabaseUrl: "https://abc.supabase.co" });

  it("v produkci bez unsafe-eval a s upgrade-insecure-requests", () => {
    expect(directive(prod, "script-src")).not.toContain("unsafe-eval");
    expect(prod).toContain("upgrade-insecure-requests");
  });

  it("ve vývoji povolí unsafe-eval", () => {
    const dev = buildCsp({ dev: true });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });

  it("povolí Supabase (REST i realtime) a MapTiler", () => {
    const connect = directive(prod, "connect-src");
    expect(connect).toContain("https://abc.supabase.co");
    expect(connect).toContain("wss://abc.supabase.co");
    expect(connect).toContain("https://api.maptiler.com");
    expect(directive(prod, "form-action")).toContain("https://abc.supabase.co");
  });

  it("zvuk hesel jen z vlastního webu a přes https", () => {
    expect(directive(prod, "media-src")).toBe("media-src 'self' https:");
  });

  it("bez Supabase URL nevloží prázdné položky", () => {
    const csp = buildCsp({ dev: false });
    expect(csp).not.toMatch(/ {2}|\s;/);
  });

  it("Turnstile smí skript a iframe jen z challenges.cloudflare.com", () => {
    expect(directive(prod, "script-src")).toContain("https://challenges.cloudflare.com");
    expect(directive(prod, "frame-src")).toContain("https://challenges.cloudflare.com");
    expect(directive(prod, "script-src")).not.toMatch(/https:(\s|$)/);
  });

  it("zakáže vložení do rámu a pluginy", () => {
    expect(directive(prod, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(prod, "object-src")).toBe("object-src 'none'");
  });
});

describe("securityHeaderEntries", () => {
  it("HSTS jen mimo vývoj", () => {
    const names = (dev: boolean) => securityHeaderEntries("x", { dev }).map(([name]) => name);
    expect(names(false)).toContain("Strict-Transport-Security");
    expect(names(true)).not.toContain("Strict-Transport-Security");
  });
});
