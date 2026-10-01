import { describe, expect, it } from "vitest";
import { ChapterInput, EntryInput, ScheduleInput } from "./schema";

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

  it("rejects more than 5 bullets, a long bullet, a non-https URL and an empty title", () => {
    const invalid = [
      { ...chapter, summary_points: "1\n2\n3\n4\n5\n6" },
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
