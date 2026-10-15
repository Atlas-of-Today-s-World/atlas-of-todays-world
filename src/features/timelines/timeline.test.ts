import { describe, expect, it } from "vitest";
import {
  plainText,
  toEditableEvents,
  toSources,
  toStoredEvent,
  toTimeline,
  toTimelineItems,
  type EventRow,
} from "./rows";
import {
  EVENT_HTML_MAX,
  EVENT_TEXT_MAX,
  TimelineEventInput,
  TimelineHeadInput,
  TimelineOwner,
  TimelineSourceInput,
} from "./schema";

const row = (fields: Partial<EventRow> = {}): EventRow => ({
  position: 0,
  date_label: "1991",
  title: "Independence",
  body: "",
  body_html: "",
  sources: [],
  image_url: null,
  ...fields,
});

describe("timeline owner", () => {
  it("takes each owner's own key", () => {
    for (const [kind, key] of [
      ["region", "middle-east-north-africa"],
      ["issue", "russia-ukraine-war"],
      ["country", "EGY"],
      ["topic", "4b8f2c1e-3d4a-4f6b-9c2d-1e2f3a4b5c6d"],
    ]) {
      expect(TimelineOwner.safeParse({ kind, key }).success, kind).toBe(true);
    }
  });

  it("refuses a key of another kind or an unknown kind", () => {
    for (const [kind, key] of [
      ["region", "EGY"],
      ["country", "egypt"],
      ["topic", "middle-east"],
      ["issue", "Bad Slug"],
      ["planet", "earth"],
    ]) {
      expect(TimelineOwner.safeParse({ kind, key }).success, `${kind}:${key}`).toBe(false);
    }
  });
});

describe("timeline event", () => {
  const event = (fields: Record<string, unknown> = {}) =>
    TimelineEventInput.safeParse({
      date_label: "1924",
      title: "Fall of the Ottoman Empire",
      body_html: "<p>Text</p>",
      sources: [],
      image_url: "",
      ...fields,
    });

  it("needs a date and a title within the DB limits", () => {
    expect(event().success).toBe(true);
    expect(event({ date_label: " " }).success).toBe(false);
    expect(event({ title: "" }).success).toBe(false);
    expect(event({ title: "x".repeat(201) }).success).toBe(false);
    expect(event({ date_label: "x".repeat(61) }).success).toBe(false);
  });

  it("keeps an old image only as an https link", () => {
    expect(event({ image_url: "https://example.org/a.jpg" }).success).toBe(true);
    expect(event({ image_url: "http://example.org/a.jpg" }).success).toBe(false);
  });

  it("takes at most 20 sources", () => {
    const source = { title: "UN", url: "https://www.un.org/" };
    expect(event({ sources: Array.from({ length: 20 }, () => source) }).success).toBe(true);
    expect(event({ sources: Array.from({ length: 21 }, () => source) }).success).toBe(false);
  });
});

describe("timeline source", () => {
  it("needs an https link; an empty name becomes the link's host", () => {
    expect(TimelineSourceInput.parse({ title: "", url: "https://www.britannica.com/x" })).toEqual({
      title: "www.britannica.com",
      url: "https://www.britannica.com/x",
    });
    expect(TimelineSourceInput.safeParse({ title: "UN", url: "http://un.org" }).success).toBe(
      false,
    );
    expect(TimelineSourceInput.safeParse({ title: "", url: "not a url" }).success).toBe(false);
    expect(TimelineSourceInput.safeParse("https://un.org").success).toBe(false);
  });
});

describe("timeline heading", () => {
  it("treats an empty heading as none and keeps the DB limits", () => {
    expect(TimelineHeadInput.parse({ timeline_title: " ", timeline_subtitle: "" })).toEqual({});
    expect(TimelineHeadInput.safeParse({ timeline_title: "x".repeat(121) }).success).toBe(false);
    expect(TimelineHeadInput.safeParse({ timeline_subtitle: "x".repeat(301) }).success).toBe(false);
  });
});

describe("stored event", () => {
  const input = (body_html: string) =>
    TimelineEventInput.parse({ date_label: "1979", title: "Revolution", body_html, sources: [] });

  it("sanitizes the rich text and keeps its plain text beside it", () => {
    const stored = toStoredEvent(
      input(
        '<p>One <strong>two</strong><script>x()</script></p><p>Three<br>four</p><a href="https://x.org">x</a>',
      ),
    );
    expect(stored?.body_html).toBe(
      '<p>One <strong>two</strong></p><p>Three<br />four</p><a href="https://x.org" rel="noopener noreferrer">x</a>',
    );
    expect(stored?.body).toBe("One two\n\nThree\nfour\n\nx");
    expect(stored?.image_url).toBeNull();
  });

  it("refuses rich text that is over the limit once sanitized", () => {
    expect(toStoredEvent(input(`<p>${"x".repeat(EVENT_HTML_MAX)}</p>`))).toBeNull();
  });

  it("cuts the plain text to the column's limit", () => {
    const text = plainText(`<p>${"word ".repeat(1000)}</p>`);
    expect(text.length).toBe(EVENT_TEXT_MAX);
    expect(text.endsWith("…")).toBe(true);
  });
});

describe("reading events", () => {
  it("orders events and shows plain text where no rich text was written", () => {
    const items = toTimelineItems([
      row({ position: 1, title: "Second", body_html: "<p>Rich</p>" }),
      row({ position: 0, title: "First", body: "Plain" }),
    ]);
    expect(items.map((item) => [item.title, item.text, item.html])).toEqual([
      ["First", "Plain", undefined],
      ["Second", "", "<p>Rich</p>"],
    ]);
  });

  it("keeps only well-formed https sources", () => {
    expect(
      toSources([
        { title: "UN", url: "https://www.un.org/" },
        { title: "Bad", url: "javascript:alert(1)" },
        { title: "Relative", url: "/about" },
        { title: "", url: "https://x.org" },
        { url: "https://x.org" },
        "https://x.org",
        null,
      ]),
    ).toEqual([{ title: "UN", url: "https://www.un.org/" }]);
    expect(toSources({ title: "UN" })).toEqual([]);
  });

  it("gives no timeline without events, and the heading only when written", () => {
    expect(toTimeline({ timeline_title: "History" }, [])).toBeNull();
    expect(toTimeline(null, [row()])).toMatchObject({ title: undefined, subtitle: undefined });
    expect(
      toTimeline({ timeline_title: " History ", timeline_subtitle: "Key events" }, [row()]),
    ).toMatchObject({ title: "History", subtitle: "Key events" });
  });

  it("gives the editor rich text, turning plain text from before into paragraphs", () => {
    expect(
      toEditableEvents([
        row({ position: 1, body: "Line\n\nNext", image_url: "https://x.org/a.jpg" }),
        row({ position: 0, body: "ignored", body_html: "<p>Rich</p>", sources: "bad" }),
      ]),
    ).toEqual([
      {
        date_label: "1991",
        title: "Independence",
        body_html: "<p>Rich</p>",
        sources: [],
        image_url: "",
      },
      {
        date_label: "1991",
        title: "Independence",
        body_html: "<p>Line</p><p>Next</p>",
        sources: [],
        image_url: "https://x.org/a.jpg",
      },
    ]);
  });
});
