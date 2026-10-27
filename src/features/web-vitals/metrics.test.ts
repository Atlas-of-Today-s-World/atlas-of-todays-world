import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEVICES, NAV_TYPES, VALUE_MAX, WEB_VITALS, formatVital, rating } from "./metrics";
import { VitalsInput } from "./schema";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20261027000100_web_vitals.sql"),
  "utf8",
);
/** The quoted words of every list that opens with `marker` (ending in "(") in the migration. */
const sqlLists = (marker: string) => {
  const lists: string[][] = [];
  for (let at = migration.indexOf(marker); at >= 0; at = migration.indexOf(marker, at + 1)) {
    const start = at + marker.length;
    const list = migration.slice(start, migration.indexOf(")", start));
    lists.push([...list.matchAll(/'([A-Za-z_-]+)'/g)].map((match) => match[1] ?? ""));
  }
  return lists;
};

describe("web vitals allowlists", () => {
  it("match the database's CHECKs and record_web_vitals()", () => {
    expect(sqlLists("metric in (")).toEqual([[...WEB_VITALS]]);
    expect(sqlLists("v_metric not in (")).toEqual([[...WEB_VITALS]]);
    expect(sqlLists("device in (")).toEqual([[...DEVICES]]);
    expect(sqlLists("p_device not in (")).toEqual([[...DEVICES]]);
    expect(sqlLists("nav_type in (")).toEqual([[...NAV_TYPES]]);
    expect(sqlLists("v_nav not in (")).toEqual([[...NAV_TYPES]]);
  });

  it("have the database's value bounds: ms up to 60000, CLS × 1000 up to 10000", () => {
    expect(migration).toContain("case when v_metric = 'CLS' then 10000 else 60000 end");
    expect(VALUE_MAX).toEqual({ LCP: 60000, INP: 60000, CLS: 10000, FCP: 60000, TTFB: 60000 });
  });
});

describe("rating", () => {
  it.each([
    ["LCP", 2500, "good"],
    ["LCP", 2501, "needs-improvement"],
    ["LCP", 4000, "needs-improvement"],
    ["LCP", 4001, "poor"],
    ["INP", 200, "good"],
    ["INP", 500, "needs-improvement"],
    ["INP", 501, "poor"],
    ["CLS", 100, "good"],
    ["CLS", 250, "needs-improvement"],
    ["CLS", 251, "poor"],
    ["FCP", 1800, "good"],
    ["FCP", 3001, "poor"],
    ["TTFB", 800, "good"],
    ["TTFB", 1801, "poor"],
  ] as const)("%s %d → %s", (metric, value, expected) => {
    expect(rating(metric, value)).toBe(expected);
  });
});

describe("formatVital", () => {
  it("shows CLS as a score, short timings in ms and long ones in seconds", () => {
    expect(formatVital("CLS", 83)).toBe("0.08");
    expect(formatVital("CLS", 0)).toBe("0.00");
    expect(formatVital("INP", 184)).toBe("184 ms");
    expect(formatVital("LCP", 2450)).toBe("2.45 s");
  });
});

describe("VitalsInput", () => {
  const beacon = { d: "mobile", m: [{ n: "LCP", v: 2400, p: "/topics", t: "navigate" }] };

  it("accepts a device and 1–10 allowlisted metrics within their bounds", () => {
    expect(VitalsInput.safeParse(beacon).success).toBe(true);
    expect(
      VitalsInput.safeParse({
        d: "desktop",
        m: [
          { n: "CLS", v: 10000, p: "/", t: "soft" },
          { n: "TTFB", v: 60000, p: "/other", t: "back-forward" },
        ],
      }).success,
    ).toBe(true);
    const ten = { ...beacon, m: Array.from({ length: 10 }, () => beacon.m[0]) };
    expect(VitalsInput.safeParse(ten).success).toBe(true);
  });

  it.each([
    [{ ...beacon, d: "tablet" }],
    [{ ...beacon, m: [] }],
    [{ ...beacon, m: Array.from({ length: 11 }, () => beacon.m[0]) }],
    [{ ...beacon, ua: "Mozilla/5.0" }],
    [{ ...beacon, m: [{ ...beacon.m[0], ip: "203.0.113.7" }] }],
    [{ ...beacon, m: [{ ...beacon.m[0], n: "FID" }] }],
    [{ ...beacon, m: [{ ...beacon.m[0], v: -1 }] }],
    [{ ...beacon, m: [{ ...beacon.m[0], v: 12.5 }] }],
    [{ ...beacon, m: [{ ...beacon.m[0], v: "2400" }] }],
    [{ ...beacon, m: [{ ...beacon.m[0], v: 60001 }] }],
    [{ ...beacon, m: [{ ...beacon.m[0], n: "CLS", v: 10001 }] }],
    [{ ...beacon, m: [{ ...beacon.m[0], p: "/country/china" }] }],
    [{ ...beacon, m: [{ ...beacon.m[0], p: "https://evil.example/" }] }],
    [{ ...beacon, m: [{ ...beacon.m[0], t: "prerender" }] }],
    [null],
    ["LCP"],
  ])("refuses %j", (input) => {
    expect(VitalsInput.safeParse(input).success).toBe(false);
  });
});
