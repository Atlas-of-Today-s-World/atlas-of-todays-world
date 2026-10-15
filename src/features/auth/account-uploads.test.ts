import { describe, expect, it, vi } from "vitest";
import { removeUnusedUploads } from "./account-uploads";

const USER = "00000000-0000-4000-8000-000000000001";

type Item = { id: string | null; name: string };

/** A service client whose Storage holds `files` per bucket (names inside `{USER}/`). */
function fakeService(files: Record<string, Item[]>, unused: (paths: string[]) => string[]) {
  const removed: Record<string, string[][]> = {};
  const listed: Array<{ bucket: string; folder: string; offset: number }> = [];
  const rpc = vi.fn(async (_name: string, args: { p_paths: string[] }) => ({
    data: unused(args.p_paths),
    error: null,
  }));
  const service = {
    rpc,
    storage: {
      from: (bucket: string) => ({
        list: async (folder: string, { limit, offset }: { limit: number; offset: number }) => {
          listed.push({ bucket, folder, offset });
          return { data: (files[bucket] ?? []).slice(offset, offset + limit), error: null };
        },
        remove: async (paths: string[]) => {
          (removed[bucket] ??= []).push(paths);
          return { data: [], error: null };
        },
      }),
    },
  };
  // The helper only uses `rpc` and `storage`; the rest of the client is irrelevant here.
  return { service: service as never, rpc, removed, listed };
}

describe("removeUnusedUploads", () => {
  it("removes only the files the database reports unused, in the user's own folder", async () => {
    const { service, rpc, removed } = fakeService(
      {
        "entry-images": [
          { id: "1", name: "used.jpg" },
          { id: "2", name: "unused.png" },
          { id: null, name: "nested-folder" },
        ],
        "entry-audio": [{ id: "3", name: "talk.mp3" }],
      },
      // Whatever the RPC says, only listed paths of this user are removed.
      (paths) => [...paths.filter((p) => !p.endsWith("used.jpg")), "someone-else/file.jpg"],
    );
    expect(await removeUnusedUploads(service, USER)).toBe(2);
    expect(rpc).toHaveBeenCalledWith("unreferenced_uploads", {
      p_paths: [`${USER}/used.jpg`, `${USER}/unused.png`],
    });
    expect(removed).toEqual({
      "entry-images": [[`${USER}/unused.png`]],
      "entry-audio": [[`${USER}/talk.mp3`]],
    });
  });

  it("asks nothing and removes nothing when the folders are empty", async () => {
    const { service, rpc, removed } = fakeService({}, () => []);
    expect(await removeUnusedUploads(service, USER)).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
    expect(removed).toEqual({});
  });

  it("pages through a large folder and removes in chunks", async () => {
    const many = Array.from({ length: 1001 }, (_, i) => ({ id: String(i), name: `f${i}.jpg` }));
    const { service, removed, listed } = fakeService({ "entry-images": many }, (paths) => paths);
    expect(await removeUnusedUploads(service, USER)).toBe(1001);
    expect(listed.filter((l) => l.bucket === "entry-images").map((l) => l.offset)).toEqual([
      0, 1000,
    ]);
    expect(removed["entry-images"]).toHaveLength(11);
  });

  it("throws (and removes nothing more) when the check fails", async () => {
    const { service, rpc, removed } = fakeService(
      { "entry-images": [{ id: "1", name: "a.jpg" }] },
      () => [],
    );
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } } as never);
    await expect(removeUnusedUploads(service, USER)).rejects.toThrow(/check entry-images: boom/);
    expect(removed).toEqual({});
  });
});
