import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rememberAiReferrer, track } from "./track";

const sendBeacon = vi.fn(() => true);
let storage: Map<string, string>;

beforeEach(() => {
  storage = new Map();
  sendBeacon.mockClear();
  vi.stubGlobal("navigator", { sendBeacon });
  vi.stubGlobal("window", {
    location: { pathname: "/membership", search: "?amount=50" },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

const sent = () => JSON.parse(String((sendBeacon.mock.calls[0] as unknown[])[1]));

describe("track", () => {
  it("beacons the event and the path (no query) to /api/e", () => {
    track("donate_click");
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect((sendBeacon.mock.calls[0] as unknown[])[0]).toBe("/api/e");
    expect(sent()).toEqual({ e: "donate_click", p: "/membership" });
  });

  it("adds the AI assistant this tab session came from, remembered once", () => {
    expect(rememberAiReferrer("perplexity")).toBe(true);
    expect(rememberAiReferrer("perplexity")).toBe(false);
    track("share_click");
    expect(sent()).toEqual({ e: "share_click", p: "/membership", r: "perplexity" });
  });

  it("never throws: no beacon support, blocked storage or a failing beacon", () => {
    vi.stubGlobal("navigator", {});
    expect(() => track("share_click")).not.toThrow();
    vi.stubGlobal("navigator", {
      sendBeacon: () => {
        throw new Error("blocked");
      },
    });
    vi.stubGlobal("window", {
      location: { pathname: "/" },
      sessionStorage: {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("denied");
        },
      },
    });
    expect(() => track("share_click")).not.toThrow();
    expect(rememberAiReferrer("claude")).toBe(true);
  });
});
