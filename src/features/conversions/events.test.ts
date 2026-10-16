import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AI_REFERRERS, CONVERSION_EVENTS, aiReferrerGroup } from "./events";
import { EventInput } from "./schema";
import { summarise } from "./summary";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20261016000010_conversion_events.sql"),
  "utf8",
);
/** The quoted words of the list that opens with `marker` (ending in "(") in the migration. */
const sqlList = (marker: string) => {
  const start = migration.indexOf(marker) + marker.length;
  const list = migration.slice(start, migration.indexOf(")", start));
  return [...list.matchAll(/'([a-z_-]+)'/g)].map((match) => match[1]);
};

describe("conversion allowlists", () => {
  it("match the database's CHECKs and record_event()", () => {
    expect(sqlList("event          text not null check (event in (")).toEqual([
      ...CONVERSION_EVENTS,
    ]);
    expect(sqlList("or event not in (")).toEqual([...CONVERSION_EVENTS]);
    expect(sqlList("referrer_group text not null check (referrer_group in (")).toEqual([
      "none",
      ...AI_REFERRERS,
    ]);
    expect(sqlList("v_ref not in (")).toEqual(["none", ...AI_REFERRERS]);
  });
});

describe("aiReferrerGroup", () => {
  it.each([
    ["https://chatgpt.com/", "chatgpt"],
    ["https://chat.openai.com/c/abc", "chatgpt"],
    ["https://www.perplexity.ai/search?q=x", "perplexity"],
    ["https://gemini.google.com/app", "gemini"],
    ["https://copilot.microsoft.com/", "copilot"],
    ["https://claude.ai/chat/1", "claude"],
    ["https://www.bing.com/chat?q=atlas", "bing-chat"],
  ])("%s → %s", (referrer, group) => {
    expect(aiReferrerGroup(referrer)).toBe(group);
  });

  it("ignores everything else — search engines, look-alike hosts, our own site", () => {
    for (const referrer of [
      "",
      "https://www.bing.com/search?q=atlas",
      "https://www.google.com/",
      "https://notchatgpt.com/",
      "https://chatgpt.com.evil.example/",
      "https://atlas-of-todays-world.vercel.app/topics",
      "not a url",
    ]) {
      expect(aiReferrerGroup(referrer)).toBeNull();
    }
  });

  it("reads a utm_source naming an assistant when the referrer is hidden", () => {
    expect(aiReferrerGroup("", "?utm_source=chatgpt.com")).toBe("chatgpt");
    expect(aiReferrerGroup("", "?utm_source=perplexity.ai&x=1")).toBe("perplexity");
    expect(aiReferrerGroup("", "?utm_source=newsletter")).toBeNull();
    expect(aiReferrerGroup("", "")).toBeNull();
  });
});

describe("EventInput", () => {
  it("accepts an allowlisted event with a path and an optional assistant", () => {
    expect(EventInput.safeParse({ e: "donate_click", p: "/membership" }).success).toBe(true);
    expect(EventInput.safeParse({ e: "ai_referral", p: "/", r: "claude" }).success).toBe(true);
  });

  it.each([
    [{ e: "page_view", p: "/" }],
    [{ e: "donate_click", p: "membership" }],
    [{ e: "donate_click", p: "" }],
    [{ e: "donate_click", p: `/${"a".repeat(512)}` }],
    [{ e: "donate_click", p: "/", r: "google" }],
    [{ e: "donate_click", p: "/", ip: "203.0.113.7" }],
    [{ e: "ai_referral", p: "/" }],
    [null],
    ["donate_click"],
  ])("refuses %j", (input) => {
    expect(EventInput.safeParse(input).success).toBe(false);
  });
});

describe("summarise", () => {
  const today = new Date("2026-10-16T12:00:00Z");

  it("sums each event per day over the last 30 days, oldest first", () => {
    const summary = summarise(
      [
        { day: "2026-10-16", event: "donate_click", referrer_group: "none", count: 2 },
        { day: "2026-10-16", event: "donate_click", referrer_group: "chatgpt", count: 1 },
        { day: "2026-09-17", event: "donate_click", referrer_group: "none", count: 4 },
        // Outside the window or unknown: left out.
        { day: "2026-09-16", event: "donate_click", referrer_group: "none", count: 100 },
        { day: "2026-10-16", event: "page_view", referrer_group: "none", count: 100 },
      ],
      today,
    );
    const donate = summary.events.find((item) => item.event === "donate_click");
    expect(donate?.total).toBe(7);
    expect(donate?.daily).toHaveLength(30);
    expect(donate?.daily[0]).toBe(4);
    expect(donate?.daily[29]).toBe(3);
    expect(summary.events.map((item) => item.event)).toEqual([...CONVERSION_EVENTS]);
    expect(summary.fromAi).toBe(1);
  });

  it("totals visits per AI assistant, in the fixed order", () => {
    const summary = summarise(
      [
        { day: "2026-10-15", event: "ai_referral", referrer_group: "perplexity", count: 2 },
        { day: "2026-10-14", event: "ai_referral", referrer_group: "chatgpt", count: 3 },
        { day: "2026-10-16", event: "ai_referral", referrer_group: "chatgpt", count: 1 },
      ],
      today,
    );
    expect(summary.aiReferrals).toEqual([
      { group: "chatgpt", label: "ChatGPT", total: 4 },
      { group: "perplexity", label: "Perplexity", total: 2 },
    ]);
    expect(summary.fromAi).toBe(0);
  });
});
