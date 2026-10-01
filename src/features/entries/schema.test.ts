import { describe, expect, it } from "vitest";
import { ChapterInput, EntryInput, ScheduleInput } from "./schema";

const id = "00000000-0000-4000-8000-000000000001";
const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

describe("ScheduleInput", () => {
  it("přijme čas aspoň 5 minut dopředu a nejvýš za rok", () => {
    expect(ScheduleInput.safeParse({ id, publish_at: inMinutes(60) }).success).toBe(true);
    expect(ScheduleInput.safeParse({ id, publish_at: "2099-01-01T10:00:00+02:00" }).success).toBe(
      false,
    );
  });

  it("odmítne minulost, příliš brzy a nesmysl", () => {
    for (const publish_at of [inMinutes(-10), inMinutes(2), "", "zítra", "2026-10-01T10:00"]) {
      expect(ScheduleInput.safeParse({ id, publish_at }).success).toBe(false);
    }
    expect(ScheduleInput.safeParse({ id: "x", publish_at: inMinutes(60) }).success).toBe(false);
  });
});

describe("ChapterInput", () => {
  const chapter = { title: "Roots", body_html: "<p>x</p>", illustration_url: "" };

  it("odrážky shrnutí bere po řádcích a prázdné řádky vynechá", () => {
    const parsed = ChapterInput.parse({ ...chapter, summary_points: "One\r\n\n  Two  \nThree" });
    expect(parsed.summary_points).toEqual(["One", "Two", "Three"]);
    expect(parsed.illustration_url).toBeUndefined();
  });

  it("odmítne víc než 5 odrážek, dlouhou odrážku, ilustraci bez https a prázdný titulek", () => {
    const invalid = [
      { ...chapter, summary_points: "1\n2\n3\n4\n5\n6" },
      { ...chapter, summary_points: "x".repeat(301) },
      { ...chapter, summary_points: "", illustration_url: "http://x" },
      { ...chapter, title: " ", summary_points: "" },
    ];
    for (const input of invalid) expect(ChapterInput.safeParse(input).success).toBe(false);
  });
});

describe("EntryInput — heslo", () => {
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

  it("zvuk jen přes https, autor jako uuid, prázdné hodnoty jsou volitelné", () => {
    const parsed = EntryInput.parse({ ...base, audio_url: "", author_id: "", summary_points: "" });
    expect(parsed).toMatchObject({
      audio_url: undefined,
      author_id: undefined,
      summary_points: [],
    });
    expect(EntryInput.safeParse({ ...base, audio_url: "http://cdn.example/a.mp3" }).success).toBe(
      false,
    );
    expect(EntryInput.safeParse({ ...base, author_id: "nesmysl" }).success).toBe(false);
  });
});
