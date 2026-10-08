import { describe, expect, it } from "vitest";
import { rateLimitAddress } from "./ip";

describe("rate-limit address", () => {
  it("keeps IPv4 as it is", () => {
    expect(rateLimitAddress("203.0.113.7")).toBe("203.0.113.7");
  });

  it("counts IPv6 by its /64 network, however it is written", () => {
    const network = "2001:db8:85a3:8d3::/64";
    expect(rateLimitAddress("2001:db8:85a3:8d3:1319:8a2e:370:7348")).toBe(network);
    expect(rateLimitAddress("2001:0db8:85a3:08d3:ffff::1")).toBe(network);
    expect(rateLimitAddress("2001:DB8:85A3:8D3::")).toBe(network);
    expect(rateLimitAddress("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(rateLimitAddress("::1")).toBe("0:0:0:0::/64");
  });
});
