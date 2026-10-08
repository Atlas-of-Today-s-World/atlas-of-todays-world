import { beforeEach, describe, expect, it, vi } from "vitest";
import { withPreviews } from "./merge";
import { previewNote, storePreviewImages } from "./store";

const findPreviewImages = vi.hoisted(() => vi.fn());
vi.mock("./preview-image", () => ({ findPreviewImages }));

/** A Supabase stand-in recording each update chain; `rows` decides what a write returns. */
function fakeClient(rows: (url: string) => { id: string }[] | null) {
  const calls: { image: unknown; filters: [string, string, unknown][] }[] = [];
  const client = {
    from: (table: string) => {
      expect(table).toBe("resources");
      return {
        update: (values: { image_url: string }) => {
          const call = { image: values.image_url, filters: [] as [string, string, unknown][] };
          calls.push(call);
          const chain = {
            eq: (column: string, value: unknown) => (
              call.filters.push(["eq", column, value]),
              chain
            ),
            is: (column: string, value: unknown) => (
              call.filters.push(["is", column, value]),
              chain
            ),
            select: async () => {
              const url = call.filters.find(([, column]) => column === "url")?.[2] as string;
              const data = rows(url);
              return data ? { data, error: null } : { data: null, error: { message: "denied" } };
            },
          };
          return chain;
        },
      };
    },
  };
  return { client: client as never, calls };
}

describe("storePreviewImages", () => {
  beforeEach(() => findPreviewImages.mockReset());

  it("looks up only links without an image and writes what it found onto empty rows", async () => {
    findPreviewImages.mockResolvedValue(
      new Map([["https://a.example/1", "https://img.example/1.jpg"]]),
    );
    const { client, calls } = fakeClient(() => [{ id: "r1" }]);
    const stored = await storePreviewImages(client, { column: "entry_id", value: "e1" }, [
      { url: "https://a.example/1" },
      { url: "https://a.example/2", image_url: "https://img.example/own.jpg" },
      { url: "https://a.example/3", image_url: null },
    ]);
    expect(findPreviewImages).toHaveBeenCalledWith(["https://a.example/1", "https://a.example/3"]);
    expect(stored).toEqual({ "https://a.example/1": "https://img.example/1.jpg" });
    expect(calls).toEqual([
      {
        image: "https://img.example/1.jpg",
        filters: [
          ["eq", "entry_id", "e1"],
          ["eq", "url", "https://a.example/1"],
          ["is", "image_url", null],
        ],
      },
    ]);
  });

  it("reports only rows really written (RLS or an error leaves none)", async () => {
    findPreviewImages.mockResolvedValue(
      new Map([
        ["https://a.example/ok", "https://img.example/ok.jpg"],
        ["https://a.example/rls", "https://img.example/rls.jpg"],
        ["https://a.example/err", "https://img.example/err.jpg"],
      ]),
    );
    const { client } = fakeClient((url) =>
      url.endsWith("ok") ? [{ id: "r" }] : url.endsWith("rls") ? [] : null,
    );
    const stored = await storePreviewImages(
      client,
      { column: "region_slug", value: "middle-east" },
      [
        { url: "https://a.example/ok" },
        { url: "https://a.example/rls" },
        { url: "https://a.example/err" },
      ],
    );
    expect(stored).toEqual({ "https://a.example/ok": "https://img.example/ok.jpg" });
  });
});

describe("previewNote", () => {
  it("counts the links that got an image", () => {
    expect(previewNote({})).toBe("");
    expect(previewNote({ a: "x" })).toBe(" Preview images added to 1 link.");
    expect(previewNote({ a: "x", b: "y" })).toBe(" Preview images added to 2 links.");
  });
});

describe("withPreviews", () => {
  it("fills only empty images of matching links", () => {
    const previews = { "https://a.example/1": "https://img.example/1.jpg" };
    expect(
      withPreviews(
        [
          { url: "https://a.example/1", image_url: "" },
          { url: "https://a.example/1", image_url: "https://img.example/own.jpg" },
          { url: "https://a.example/2", image_url: "" },
          { url: "constructor", image_url: "" },
          { title: "no url" },
        ],
        previews,
      ),
    ).toEqual([
      { url: "https://a.example/1", image_url: "https://img.example/1.jpg" },
      { url: "https://a.example/1", image_url: "https://img.example/own.jpg" },
      { url: "https://a.example/2", image_url: "" },
      { url: "constructor", image_url: "" },
      { title: "no url" },
    ]);
  });

  it("returns a copy of the list when there's nothing to merge", () => {
    const items = [{ url: "https://a.example/1", image_url: "" }];
    const merged = withPreviews(items, undefined);
    expect(merged).toEqual(items);
    expect(merged).not.toBe(items);
  });
});
