import { afterEach, describe, expect, it, vi } from "vitest";
import {
  VITALS_PER_BEACON,
  createVitalsQueue,
  deviceClass,
  navType,
  pageSegment,
  storedValue,
  vitalItem,
  type ReportedMetric,
} from "./report";

afterEach(() => vi.unstubAllGlobals());

function screen({ coarse, width }: { coarse: boolean; width: number }) {
  vi.stubGlobal("window", {
    innerWidth: width,
    matchMedia: (query: string) => ({ matches: query === "(pointer: coarse)" && coarse }),
  });
}

describe("deviceClass", () => {
  it("is mobile on a touch screen or in a window under 768 px, else desktop — no user agent", () => {
    screen({ coarse: true, width: 1280 });
    expect(deviceClass()).toBe("mobile");
    screen({ coarse: false, width: 767 });
    expect(deviceClass()).toBe("mobile");
    screen({ coarse: false, width: 768 });
    expect(deviceClass()).toBe("desktop");
  });
});

describe("pageSegment", () => {
  it.each([
    ["https://atlas.example/country/china?x=1#y", "/country"],
    ["https://atlas.example/", "/"],
    ["https://atlas.example/?utm_source=chatgpt.com", "/"],
    ["https://atlas.example/Global-Issue/climate", "/global-issue"],
    ["https://atlas.example/%E2%9C%93/x", "/other"],
    ["https://atlas.example/topics2", "/other"],
    [`https://atlas.example/${"a".repeat(33)}`, "/other"],
  ])("%s → %s", (url, segment) => {
    expect(pageSegment(url, "/ignored")).toBe(segment);
  });

  it("falls back to the current path without a navigation URL", () => {
    expect(pageSegment(undefined, "/news/some-story")).toBe("/news");
    expect(pageSegment("", "/")).toBe("/");
  });
});

describe("navType", () => {
  it.each([
    ["navigate", "navigate"],
    ["prerender", "navigate"],
    ["restore", "navigate"],
    [undefined, "navigate"],
    ["reload", "reload"],
    ["back-forward", "back-forward"],
    ["back-forward-cache", "back-forward"],
    ["soft-navigation", "soft"],
  ])("%s → %s", (type, expected) => {
    expect(navType(type)).toBe(expected);
  });
});

describe("storedValue", () => {
  it("rounds timings to whole ms and CLS to thousandths", () => {
    expect(storedValue("LCP", 2412.6)).toBe(2413);
    expect(storedValue("INP", 0)).toBe(0);
    expect(storedValue("CLS", 0.0834)).toBe(83);
    expect(storedValue("CLS", 0.0005)).toBe(1);
  });

  it("drops values out of range or not a number", () => {
    expect(storedValue("LCP", 60000.4)).toBe(60000);
    expect(storedValue("LCP", 60001)).toBeNull();
    expect(storedValue("TTFB", -3)).toBeNull();
    expect(storedValue("CLS", 10.5)).toBeNull();
    expect(storedValue("FCP", Number.NaN)).toBeNull();
    expect(storedValue("FCP", Number.POSITIVE_INFINITY)).toBeNull();
  });
});

const metric = (over: Partial<ReportedMetric> = {}): ReportedMetric => ({
  name: "LCP",
  value: 2400.2,
  id: "v6-1",
  navigationType: "navigate",
  navigationURL: "https://atlas.example/topics/water",
  ...over,
});

describe("vitalItem", () => {
  it("keeps the name, the rounded value, the first segment and the navigation type", () => {
    expect(vitalItem(metric(), "/")).toEqual({ n: "LCP", v: 2400, p: "/topics", t: "navigate" });
    expect(vitalItem(metric({ name: "CLS", value: 0.12, navigationURL: undefined }), "/")).toEqual({
      n: "CLS",
      v: 120,
      p: "/",
      t: "navigate",
    });
  });

  it("ignores other metrics and values out of range", () => {
    expect(vitalItem(metric({ name: "FID" }), "/")).toBeNull();
    expect(vitalItem(metric({ name: "Next.js-hydration" }), "/")).toBeNull();
    expect(vitalItem(metric({ value: 90000 }), "/")).toBeNull();
  });
});

describe("createVitalsQueue", () => {
  function setup({ hidden = false } = {}) {
    const send = vi.fn<(body: string) => void>();
    const state = { hidden };
    const queue = createVitalsQueue({
      send,
      device: () => "mobile",
      path: () => "/",
      hidden: () => state.hidden,
    });
    const bodies = () => send.mock.calls.map(([body]) => JSON.parse(body) as unknown);
    return { queue, send, state, bodies };
  }

  it("waits for the flush, then sends every metric once in one beacon", () => {
    const { queue, send, bodies } = setup();
    queue.add(metric({ id: "a", name: "TTFB", value: 300 }));
    queue.add(metric({ id: "b", name: "FCP", value: 900 }));
    queue.add(metric({ id: "c", name: "LCP", value: 2400 }));
    expect(send).not.toHaveBeenCalled();
    queue.flush();
    expect(bodies()).toEqual([
      {
        d: "mobile",
        m: [
          { n: "TTFB", v: 300, p: "/topics", t: "navigate" },
          { n: "FCP", v: 900, p: "/topics", t: "navigate" },
          { n: "LCP", v: 2400, p: "/topics", t: "navigate" },
        ],
      },
    ]);
    // A second hide, or the same metric reported again: nothing more.
    queue.add(metric({ id: "c", name: "LCP", value: 2600 }));
    queue.flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("keeps the latest value of a metric that is reported again before the flush", () => {
    const { queue, bodies } = setup();
    queue.add(metric({ id: "x", name: "CLS", value: 0.01 }));
    queue.add(metric({ id: "x", name: "CLS", value: 0.04 }));
    queue.flush();
    expect(bodies()).toEqual([
      { d: "mobile", m: [{ n: "CLS", v: 40, p: "/topics", t: "navigate" }] },
    ]);
  });

  it(`sends at most ${VITALS_PER_BEACON} metrics per beacon`, () => {
    const { queue, bodies } = setup();
    for (let index = 0; index < VITALS_PER_BEACON + 3; index++) {
      queue.add(metric({ id: `m${index}`, navigationType: "soft-navigation" }));
    }
    queue.flush();
    const sizes = bodies().map((body) => (body as { m: unknown[] }).m.length);
    expect(sizes).toEqual([VITALS_PER_BEACON, 3]);
  });

  it("sends a metric reported after the page was hidden at once (next microtask)", async () => {
    const { queue, send, state } = setup();
    state.hidden = true;
    queue.add(metric({ id: "late", name: "INP", value: 180 }));
    queue.add(metric({ id: "later", name: "CLS", value: 0 }));
    expect(send).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("drops metrics it doesn't keep and never throws", () => {
    const { queue, send } = setup();
    queue.add(metric({ name: "FID" }));
    queue.flush();
    expect(send).not.toHaveBeenCalled();

    send.mockImplementation(() => {
      throw new Error("beacon blocked");
    });
    queue.add(metric({ id: "boom" }));
    expect(() => queue.flush()).not.toThrow();
    expect(() => queue.add(null as unknown as ReportedMetric)).not.toThrow();
  });
});
