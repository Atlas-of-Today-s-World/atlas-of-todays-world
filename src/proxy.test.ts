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
});
