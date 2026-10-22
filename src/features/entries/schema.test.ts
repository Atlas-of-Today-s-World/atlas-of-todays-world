import { describe, expect, it } from "vitest";
import { COLLECTIONS } from "@/features/portraits/schema";
import {
  ChapterInput,
  EntryFaqItem,
  EntryInput,
  LearnMoreInput,
  ScheduleInput,
  SeoInput,
} from "./schema";

const id = "00000000-0000-4000-8000-000000000001";
const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

describe("ScheduleInput", () => {
  it("accepts a time at least 5 minutes ahead and at most a year out", () => {
    expect(ScheduleInput.safeParse({ id, publish_at: inMinutes(60) }).success).toBe(true);
    expect(ScheduleInput.safeParse({ id, publish_at: "2099-01-01T10:00:00+02:00" }).success).toBe(
      false,
    );
  });

  it("rejects the past, too soon and nonsense", () => {
    for (const publish_at of [inMinutes(-10), inMinutes(2), "", "zítra", "2026-10-01T10:00"]) {
      expect(ScheduleInput.safeParse({ id, publish_at }).success).toBe(false);
    }
    expect(ScheduleInput.safeParse({ id: "x", publish_at: inMinutes(60) }).success).toBe(false);
  });
});

describe("ChapterInput", () => {
  const chapter = { title: "Roots", body_html: "<p>x</p>", illustration_url: "" };

  it("takes summary bullets line by line and skips empty lines", () => {
    const parsed = ChapterInput.parse({ ...chapter, summary_points: "One\r\n\n  Two  \nThree" });
    expect(parsed.summary_points).toEqual(["One", "Two", "Three"]);
    expect(parsed.illustration_url).toBeUndefined();
    expect(parsed.audio_url).toBeUndefined();
  });

  it("rejects more than 6 bullets, a long bullet, a non-https URL and an empty title", () => {
    const invalid = [
      { ...chapter, summary_points: "1\n2\n3\n4\n5\n6\n7" },
      { ...chapter, summary_points: "x".repeat(301) },
      { ...chapter, summary_points: "", illustration_url: "http://x" },
      { ...chapter, summary_points: "", audio_url: "http://cdn.example/1.mp3" },
      { ...chapter, title: " ", summary_points: "" },
    ];
    for (const input of invalid) expect(ChapterInput.safeParse(input).success).toBe(false);
  });
});

describe("EntryInput — encyclopedia entry", () => {
  const base = {
    slug: "kurdistan",
    kind: "entry",
    title: "Kurdistan",
    summary: "",
    category: "Society",
    cover_credit: "",
    author_name: "",
    body_html: "",
    countries: [],
  };

  it("author as uuid, empty values are optional", () => {
    const parsed = EntryInput.parse({ ...base, author_id: "", summary_points: "" });
    expect(parsed).toMatchObject({ author_id: undefined, summary_points: [] });
    expect(EntryInput.safeParse({ ...base, author_id: "nesmysl" }).success).toBe(false);
  });
});

describe("shared building blocks", () => {
  const entry = {
    slug: "a",
    title: "A",
    summary: "",
    category: "Society",
    cover_credit: "",
    author_name: "",
    body_html: "",
    countries: [],
  };

  it("a header colour is stored lowercase; mixed case is still accepted", () => {
    expect(EntryInput.parse({ ...entry, hero_background: "#1F3A5f" }).hero_background).toBe(
      "#1f3a5f",
    );
    expect(EntryInput.parse({ ...entry, hero_background: "" }).hero_background).toBeUndefined();
    expect(EntryInput.safeParse({ ...entry, hero_background: "#12345" }).success).toBe(false);
  });

  it("checkboxes take 'on' and 'true'; anything else is unticked", () => {
    expect(EntryInput.parse({ ...entry, planned: "on" }).planned).toBe(true);
    expect(EntryInput.parse({ ...entry, planned: "true" }).planned).toBe(true);
    expect(EntryInput.parse(entry).planned).toBe(false);
    expect(SeoInput.parse({ entry_id: id, noindex: "true" }).noindex).toBe(true);
  });

  it("an article is an entry unless it says news", () => {
    expect(EntryInput.parse(entry).kind).toBe("entry");
    expect(EntryInput.parse({ ...entry, kind: "news" }).kind).toBe("news");
    expect(EntryInput.safeParse({ ...entry, kind: "page" }).success).toBe(false);
  });

  it("a topic's FAQ answer stops at 2,000 characters (entry_faq), a portrait's at 3,000", () => {
    const item = { question: "Why?", answer: "x".repeat(2000) };
    expect(EntryFaqItem.safeParse(item).success).toBe(true);
    expect(EntryFaqItem.safeParse({ ...item, answer: "x".repeat(2001) }).success).toBe(false);
    expect(COLLECTIONS.faq.safeParse({ ...item, answer: "x".repeat(3000) }).success).toBe(true);
  });

  it("learn-more links have the limits of portrait resources", () => {
    const link = { title: "T", url: "https://example.org/" };
    const tiles = (links: object[]) => [{ tile_id: id, links }];
    expect(LearnMoreInput.safeParse(tiles([link])).success).toBe(true);
    for (const bad of [
      { ...link, source: "x".repeat(121) },
      { ...link, description: "x".repeat(601) },
      { ...link, url: `https://example.org/${"u".repeat(1000)}` },
    ]) {
      expect(LearnMoreInput.safeParse(tiles([bad])).success).toBe(false);
    }
  });
});
