import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ INDEXNOW_KEY: "atlas-key-1234" as string | undefined }));
const allowKey = vi.hoisted(() => vi.fn(async () => true));
const after = vi.hoisted(() => vi.fn((task: () => unknown) => task()));

vi.mock("@/lib/env.server", () => ({ serverEnv: env }));
vi.mock("@/lib/security/rate-limit", () => ({ allowKey }));
vi.mock("next/server", () => ({ after }));

const { indexNowPayload, notifyIndexNow, submitToIndexNow } = await import("./indexnow");
const { SITE_URL } = await import("@/lib/site");
const host = new URL(SITE_URL).host;

describe("IndexNow", () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));

  beforeEach(() => {
    env.INDEXNOW_KEY = "atlas-key-1234";
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
    allowKey.mockClear();
    allowKey.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("payload follows the protocol: host, key, keyLocation, urlList", () => {
    expect(indexNowPayload([`https://${host}/news/a`], "k")).toEqual({
      host,
      key: "k",
      keyLocation: new URL("/indexnow-key.txt", SITE_URL).toString(),
      urlList: [`https://${host}/news/a`],
    });
  });

  it("POSTs absolute, deduplicated URLs once per URL window", async () => {
    await submitToIndexNow(["/news/a", "/news/a", "/cs/region/x"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.indexnow.org/indexnow");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body));
    expect(body.urlList).toEqual([
      new URL("/news/a", SITE_URL).toString(),
      new URL("/cs/region/x", SITE_URL).toString(),
    ]);
    expect(allowKey).toHaveBeenCalledWith(expect.stringMatching(/^indexnow:[0-9a-f]{32}$/), {
      limit: 1,
      windowSeconds: 900,
    });
  });

  it("skips URLs pinged recently, and sends nothing when all were", async () => {
    allowKey.mockResolvedValue(false);
    await submitToIndexNow(["/news/a"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is off without a key or outside production", async () => {
    env.INDEXNOW_KEY = undefined;
    await submitToIndexNow(["/news/a"]);
    env.INDEXNOW_KEY = "atlas-key-1234";
    vi.stubEnv("VERCEL_ENV", "preview");
    await submitToIndexNow(["/news/a"]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(allowKey).not.toHaveBeenCalled();
  });

  it("never throws: network errors and refusals are only logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(submitToIndexNow(["/news/a"])).resolves.toBeUndefined();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(submitToIndexNow(["/news/b"])).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });

  it("notifyIndexNow runs after the response, with every language when asked", async () => {
    notifyIndexNow(["/region/x"], { everyLanguage: true });
    expect(after).toHaveBeenCalled();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(
      String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body),
    );
    expect(body.urlList).toEqual([new URL("/region/x", SITE_URL).toString()]);
  });
});
