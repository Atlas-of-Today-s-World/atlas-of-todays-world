import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

describe("proxy: lowercase redirect", () => {
  it("lowercases the path on the same host", async () => {
    const response = await proxy(new NextRequest("https://atlas.example/News?page=2"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://atlas.example/news?page=2");
  });

  it("never sends a path that starts with // to another host", async () => {
    const response = await proxy(new NextRequest("https://atlas.example//Evil.com/x"));
    const location = new URL(response.headers.get("location") ?? "", "https://atlas.example");
    expect(location.host).toBe("atlas.example");
    expect(location.pathname).toBe("/evil.com/x");
  });

  it("the /en/ prefix redirect never turns into a protocol-relative URL", async () => {
    const response = await proxy(new NextRequest("https://atlas.example/en//evil.com/x?a=1"));
    expect(response.status).toBe(308);
    const location = new URL(response.headers.get("location") ?? "", "https://atlas.example");
    expect(location.host).toBe("atlas.example");
    expect(location.pathname).toBe("/evil.com/x");
    expect(location.search).toBe("?a=1");
  });
});

describe("proxy: script policy", () => {
  const csp = (response: Response) => response.headers.get("content-security-policy") ?? "";
  const scripts = (response: Response) =>
    csp(response)
      .split("; ")
      .find((part) => part.startsWith("script-src ")) ?? "";

  it("dynamic pages with a session get a fresh nonce, also handed to Next in the request", async () => {
    for (const path of ["/login", "/login/confirm", "/pozvanka", "/membership/checkout"]) {
      const response = await proxy(new NextRequest(`https://atlas.example${path}`));
      expect(scripts(response)).toMatch(/'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
      expect(scripts(response)).not.toContain("'unsafe-inline'");
      expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(
        csp(response),
      );
    }
    const [a, b] = await Promise.all(
      [1, 2].map(() => proxy(new NextRequest("https://atlas.example/login"))),
    );
    expect(csp(a!)).not.toBe(csp(b!));
  });

  it("static public pages keep the shared policy without a nonce", async () => {
    for (const path of ["/", "/about", "/membership", "/news"]) {
      const response = await proxy(new NextRequest(`https://atlas.example${path}`));
      expect(scripts(response)).toContain("'unsafe-inline'");
      expect(scripts(response)).not.toContain("nonce-");
    }
  });
});
