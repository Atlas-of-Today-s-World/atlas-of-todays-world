import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({}) }));

const { pickFeatured } = await import("./featured");

const tile = (id: string, createdAt: string) => ({
  id,
  topicSlug: "t",
  topicTitle: "T",
  title: id,
  anchor: "topic-1",
  createdAt,
});
// Newest first, as getSubtopicTiles returns them.
const tiles = [tile("c", "2026-10-03"), tile("b", "2026-10-02"), tile("a", "2026-10-01")];

describe("home featured subtopics", () => {
  it("shows the two newest when nothing is pinned", () => {
    expect(pickFeatured(tiles, [null, null]).map((t) => t.id)).toEqual(["c", "b"]);
  });

  it("keeps a pinned subtopic in its slot and fills the other with the newest", () => {
    expect(pickFeatured(tiles, [null, "c"]).map((t) => t.id)).toEqual(["b", "c"]);
    expect(pickFeatured(tiles, ["a", null]).map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("an unpublished or deleted pin falls back to the newest", () => {
    expect(pickFeatured(tiles, ["gone", "a"]).map((t) => t.id)).toEqual(["c", "a"]);
  });
});
