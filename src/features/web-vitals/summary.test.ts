import { describe, expect, it } from "vitest";
import { TREND_DAYS, summariseVitals, type P75Row } from "./summary";

const today = new Date("2026-10-27T09:00:00Z");
const row = (over: Partial<P75Row>): P75Row => ({
  day: null,
  metric: "LCP",
  device: "mobile",
  samples: 10,
  p75: 2400,
  ...over,
});

describe("summariseVitals", () => {
  it("gives every metric × device for both windows, rated, null where nothing was measured", () => {
    const summary = summariseVitals(
      [row({ p75: 2400 }), row({ metric: "CLS", device: "desktop", p75: 300, samples: 4 })],
      [row({ p75: 4100, samples: 50 }), row({ metric: "INP", p75: 210, samples: 30 })],
      [],
      today,
    );
    expect(summary.table.map((item) => `${item.metric} ${item.device}`)).toEqual([
      "LCP mobile",
      "LCP desktop",
      "INP mobile",
      "INP desktop",
      "CLS mobile",
      "CLS desktop",
      "FCP mobile",
      "FCP desktop",
      "TTFB mobile",
      "TTFB desktop",
    ]);
    const find = (metric: string, device: string) =>
      summary.table.find((item) => item.metric === metric && item.device === device);
    expect(find("LCP", "mobile")).toEqual({
      metric: "LCP",
      device: "mobile",
      week: { p75: 2400, samples: 10, rating: "good" },
      month: { p75: 4100, samples: 50, rating: "poor" },
    });
    expect(find("CLS", "desktop")?.week).toEqual({ p75: 300, samples: 4, rating: "poor" });
    expect(find("INP", "mobile")?.month?.rating).toBe("needs-improvement");
    expect(find("FCP", "desktop")).toMatchObject({ week: null, month: null });
  });

  it("follows mobile LCP and INP for 28 days ending today, oldest first, gaps as null", () => {
    const summary = summariseVitals(
      [],
      [],
      [
        row({ day: "2026-10-27", p75: 2000 }),
        row({ day: "2026-10-27", metric: "INP", p75: 150 }),
        row({ day: "2026-09-30", p75: 3000 }),
        // Desktop, another metric, or outside the window: not in the trend.
        row({ day: "2026-10-26", device: "desktop" }),
        row({ day: "2026-10-26", metric: "TTFB" }),
        row({ day: "2026-09-29", p75: 9999 }),
        // Unknown metric names are ignored.
        row({ day: "2026-10-25", metric: "FID" }),
      ],
      today,
    );
    expect(summary.trend).toHaveLength(TREND_DAYS);
    expect(summary.trend[0]).toEqual({
      day: "2026-09-30",
      readings: { LCP: { p75: 3000, samples: 10, rating: "needs-improvement" }, INP: null },
    });
    expect(summary.trend.at(-1)).toEqual({
      day: "2026-10-27",
      readings: {
        LCP: { p75: 2000, samples: 10, rating: "good" },
        INP: { p75: 150, samples: 10, rating: "good" },
      },
    });
    expect(summary.trend.at(-2)?.readings).toEqual({ LCP: null, INP: null });
  });
});
