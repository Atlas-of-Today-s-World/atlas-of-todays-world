import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({}) }));

const { pickFeatured } = await import("./featured");
const { clampFeaturedCount } = await import("@/features/home/config");

const tile = (id: string, createdAt: string, topicSlug = id) => ({
  id,
  topicSlug,
  topicTitle: topicSlug,
  title: id,
  anchor: "topic-1",
  createdAt,
});
// Newest first, as getSubtopicTiles returns them; each from its own topic.
const tiles = [
  tile("e", "2026-10-05"),
  tile("d", "2026-10-04"),
  tile("c", "2026-10-03"),
  tile("b", "2026-10-02"),
  tile("a", "2026-10-01"),
];
const ids = (list: { id: string }[]) => list.map((t) => t.id);

describe("home featured subtopics", () => {
  it("shows the newest when nothing is pinned, as many as the count", () => {
    expect(ids(pickFeatured(tiles, [], 2))).toEqual(["e", "d"]);
    expect(ids(pickFeatured(tiles, [], 1))).toEqual(["e"]);
    expect(ids(pickFeatured(tiles, [], 4))).toEqual(["e", "d", "c", "b"]);
  });

  it("puts the pins first in their order, then fills with the newest not shown", () => {
    expect(ids(pickFeatured(tiles, ["a"], 2))).toEqual(["a", "e"]);
    expect(ids(pickFeatured(tiles, ["b", "e"], 2))).toEqual(["b", "e"]);
    expect(ids(pickFeatured(tiles, ["b", "e"], 4))).toEqual(["b", "e", "d", "c"]);
  });

  it("shows no more than the count, even with more pins", () => {
    expect(ids(pickFeatured(tiles, ["a", "b", "c"], 2))).toEqual(["a", "b"]);
    expect(ids(pickFeatured(tiles, ["a", "b", "c"], 1))).toEqual(["a"]);
  });

  it("stops when there are fewer subtopics than the count", () => {
    expect(ids(pickFeatured(tiles.slice(0, 2), ["d"], 6))).toEqual(["d", "e"]);
    expect(pickFeatured([], ["x"], 3)).toEqual([]);
  });

  it("prefers subtopics of topics not shown yet", () => {
    const mixed = [
      tile("c2", "2026-10-03", "smuggling"),
      tile("c1", "2026-10-03", "smuggling"),
      tile("d1", "2026-10-02", "detention"),
    ];
    expect(ids(pickFeatured(mixed, [], 2))).toEqual(["c2", "d1"]);
    // A pinned subtopic counts too: the next one comes from another topic.
    expect(ids(pickFeatured(mixed, ["c1"], 2))).toEqual(["c1", "d1"]);
    // Once every topic is shown, the newest of the rest.
    expect(ids(pickFeatured(mixed, [], 3))).toEqual(["c2", "d1", "c1"]);
  });

  it("skips an unpublished or deleted pin and a repeated one", () => {
    expect(ids(pickFeatured(tiles, ["gone", "a"], 2))).toEqual(["a", "e"]);
    expect(ids(pickFeatured(tiles, ["a", "a"], 2))).toEqual(["a", "e"]);
  });
});

describe("home featured count", () => {
  it("keeps 1–6 and falls back to 2", () => {
    expect(clampFeaturedCount(4)).toBe(4);
    expect(clampFeaturedCount(0)).toBe(1);
    expect(clampFeaturedCount(9)).toBe(6);
    expect(clampFeaturedCount(null)).toBe(2);
    expect(clampFeaturedCount(undefined)).toBe(2);
    expect(clampFeaturedCount(2.5)).toBe(2);
  });
});
