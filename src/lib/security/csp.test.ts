import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PRE_PAINT_CODE, PRE_PAINT_HASH } from "@/lib/pre-paint";
import { buildCsp, newNonce, securityHeaderEntries } from "./csp";

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

  it("static pages keep inline scripts without a nonce (ADR-025)", () => {
    expect(directive(prod, "script-src")).toContain("'unsafe-inline'");
    expect(directive(prod, "script-src")).not.toContain("nonce-");
  });
});

describe("buildCsp with a nonce (dynamic pages)", () => {
  const csp = buildCsp({ dev: false, supabaseUrl: "https://abc.supabase.co", nonce: "n0nce" });
  const scripts = directive(csp, "script-src").split(" ");

  it("runs only scripts with the nonce, those they load and the pre-paint script", () => {
    expect(scripts).toContain("'nonce-n0nce'");
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).toContain(`'${PRE_PAINT_HASH}'`);
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
  });

  it("keeps every other directive of the shared policy", () => {
    const rest = (policy: string) =>
      policy.split("; ").filter((part) => !part.startsWith("script-src "));
    expect(rest(csp)).toEqual(
      rest(buildCsp({ dev: false, supabaseUrl: "https://abc.supabase.co" })),
    );
  });
});

describe("newNonce", () => {
  it("is 128 random bits in base64, new each time", () => {
    const nonce = newNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(newNonce()).not.toBe(nonce);
  });
});

describe("PRE_PAINT_HASH", () => {
  it("is the SHA-256 of the inline pre-paint script", () => {
    const hash = createHash("sha256").update(PRE_PAINT_CODE).digest("base64");
    expect(PRE_PAINT_HASH).toBe(`sha256-${hash}`);
  });
});

describe("securityHeaderEntries", () => {
  it("HSTS only outside development", () => {
    const names = (dev: boolean) => securityHeaderEntries("x", { dev }).map(([name]) => name);
    expect(names(false)).toContain("Strict-Transport-Security");
    expect(names(true)).not.toContain("Strict-Transport-Security");
  });
});
