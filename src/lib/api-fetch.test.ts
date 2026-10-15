import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "./api-fetch";

/** A fetch that never answers on its own — only the request's signal ends it. */
const hangingFetch = () =>
  vi.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("The operation was aborted.", "AbortError")),
        );
      }),
  );

/** The rejection of `promise` as an ApiError (fails the test when it resolves). */
async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => {
      throw new Error("expected apiFetch to reject");
    },
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("apiFetch", () => {
  it("returns the parsed JSON and passes the request options through", async () => {
    const fetch = vi.fn(async () => Response.json({ results: [1, 2] }));
    vi.stubGlobal("fetch", fetch);

    await expect(
      apiFetch<{ results: number[] }>("/api/search?q=x", { cache: "no-store" }),
    ).resolves.toEqual({
      results: [1, 2],
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/search?q=x",
      expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }),
    );
  });

  it("rejects a non-2xx answer as an http error with its status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "slow down" }, { status: 429 })),
    );

    const error = await failure(apiFetch("/api/search?q=x"));
    expect(error.kind).toBe("http");
    expect(error.status).toBe(429);
  });

  it("rejects a failed connection as a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    expect((await failure(apiFetch("/api/geo"))).kind).toBe("network");
  });

  it("rejects a body that isn't JSON as a parse error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>oops</html>")),
    );

    expect((await failure(apiFetch("/api/geo"))).kind).toBe("parse");
  });

  it("aborts with the caller's signal (a newer query replaced this one)", async () => {
    const fetch = hangingFetch();
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();

    const pending = apiFetch("/api/search?q=old", { signal: controller.signal });
    controller.abort();

    expect((await failure(pending)).kind).toBe("aborted");
    expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it("doesn't send a request whose signal is already aborted", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    const error = await failure(apiFetch("/api/geo", { signal: AbortSignal.abort() }));
    expect(error.kind).toBe("aborted");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("gives up after the timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangingFetch());

    const pending = failure(apiFetch("/api/geo", { timeoutMs: 1200 }));
    await vi.advanceTimersByTimeAsync(1199);
    let settled = false;
    void pending.finally(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).kind).toBe("timeout");
  });

  it("has a default timeout, so a hung request never stays loading", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangingFetch());

    const pending = failure(apiFetch("/api/search?q=x"));
    await vi.advanceTimersByTimeAsync(15_000);
    expect((await pending).kind).toBe("timeout");
  });

  it("stops listening to the caller's signal once the request is done", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: true })),
    );
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");

    await apiFetch("/api/geo", { signal: controller.signal });
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });
});
