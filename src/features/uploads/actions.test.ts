import { beforeEach, describe, expect, it, vi } from "vitest";

const signedIn = vi.hoisted(() => vi.fn());
const createSignedUploadUrl = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());

vi.mock("@/lib/actions", () => ({ signedIn }));

const { prepareUpload } = await import("./actions");

const USER = "11111111-2222-4333-8444-555555555555";
const SESSION_SECRETS = ["access-token-secret", "refresh-token-secret"];

describe("prepareUpload", () => {
  beforeEach(() => {
    createSignedUploadUrl.mockReset().mockImplementation(async (path: string) => ({
      data: {
        path,
        token: "upload-token",
        signedUrl: `https://x.supabase.co/storage/v1/object/upload/sign/b/${path}?token=upload-token`,
      },
      error: null,
    }));
    from.mockReset().mockImplementation((bucket: string) => ({
      createSignedUploadUrl,
      getPublicUrl: (path: string) => ({
        data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/${bucket}/${path}` },
      }),
    }));
    signedIn.mockReset().mockResolvedValue({
      user: { id: USER },
      supabase: {
        storage: { from },
        // A session the action must never hand out.
        auth: { session: { access_token: SESSION_SECRETS[0], refresh_token: SESSION_SECRETS[1] } },
      },
    });
  });

  it("signs a new object in the caller's own folder and returns its public URL", async () => {
    const result = await prepareUpload({ kind: "image", type: "image/png", size: 1000 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(from).toHaveBeenCalledWith("entry-images");
    expect(result.bucket).toBe("entry-images");
    expect(result.path).toMatch(new RegExp(`^${USER}/[0-9a-f-]{36}\\.png$`));
    // No upsert: an upload URL can never overwrite an existing file.
    expect(createSignedUploadUrl).toHaveBeenCalledWith(result.path);
    expect(result.publicUrl).toBe(
      `https://x.supabase.co/storage/v1/object/public/entry-images/${result.path}`,
    );
  });

  it("returns only the one-object upload token — never the session", async () => {
    const result = await prepareUpload({ kind: "audio", type: "audio/mpeg", size: 1000 });
    expect(Object.keys(result).sort()).toEqual(["bucket", "ok", "path", "publicUrl", "token"]);
    const json = JSON.stringify(result);
    for (const secret of SESSION_SECRETS) expect(json).not.toContain(secret);
    expect(json).not.toMatch(/access_token|refresh_token/);
  });

  it("each upload gets a fresh random name", async () => {
    const a = await prepareUpload({ kind: "image", type: "image/webp", size: 1 });
    const b = await prepareUpload({ kind: "image", type: "image/webp", size: 1 });
    expect(a.ok && b.ok && a.path !== b.path).toBe(true);
  });

  it.each([
    ["unknown kind", { kind: "video", type: "video/mp4", size: 1 }],
    ["missing fields", { kind: "image" }],
    ["negative size", { kind: "image", type: "image/png", size: -1 }],
    ["fractional size", { kind: "image", type: "image/png", size: 1.5 }],
    ["not an object", "image/png"],
    ["long type", { kind: "image", type: "x".repeat(101), size: 1 }],
  ])("refuses invalid input (%s) without signing anything", async (_label, input) => {
    expect(await prepareUpload(input)).toEqual({ ok: false, error: "Invalid file." });
    expect(signedIn).not.toHaveBeenCalled();
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("refuses types and sizes the bucket wouldn't take, with the plain-language message", async () => {
    expect(await prepareUpload({ kind: "image", type: "image/svg+xml", size: 1 })).toEqual({
      ok: false,
      error: "Allowed formats: JPEG, PNG, WebP and AVIF.",
    });
    expect(await prepareUpload({ kind: "image", type: "toString", size: 1 })).toMatchObject({
      ok: false,
    });
    expect(
      await prepareUpload({ kind: "image", type: "image/png", size: 3 * 1024 * 1024 + 1 }),
    ).toEqual({ ok: false, error: "Images can be at most 3 MB." });
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("a signed-out caller gets nothing", async () => {
    signedIn.mockResolvedValue(null);
    expect(await prepareUpload({ kind: "image", type: "image/png", size: 1 })).toEqual({
      ok: false,
      error: "Please sign in again.",
    });
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("when Storage refuses (no right to add content) the caller gets no token", async () => {
    createSignedUploadUrl.mockResolvedValue({ data: null, error: { message: "new row violates" } });
    expect(await prepareUpload({ kind: "image", type: "image/png", size: 1 })).toEqual({
      ok: false,
      error: "Upload failed. Do you have permission to add content?",
    });
  });
});
