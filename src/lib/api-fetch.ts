/**
 * The one way client code calls our own JSON endpoints (`/api/*`) — ARCHITEKTURA
 * 15.1; ESLint bans a bare `fetch(` in components. Mutations go through Server
 * Actions instead; this is for reads the browser makes on its own (search as
 * you type, a globe layer, the visitor's country).
 *
 * - a timeout (`timeoutMs`), so a hung request ends in an error state instead
 *   of "loading" forever;
 * - the caller's `signal` (abort when a newer query replaced this one);
 * - the response parsed as JSON;
 * - every failure as an `ApiError` with a `kind` the caller can tell apart.
 *
 * The JSON is not validated here (no Zod in client bundles): the caller reads
 * it defensively, as from any network.
 */

/** Long enough for a cold serverless start, short enough not to leave a spinner forever. */
const DEFAULT_TIMEOUT_MS = 15_000;

type ApiErrorKind =
  /** The caller's signal aborted the request (e.g. a newer query). */
  | "aborted"
  /** No answer within the timeout. */
  | "timeout"
  /** Offline, DNS, CORS — no response at all. */
  | "network"
  /** The server answered with a non-2xx status (`status`). */
  | "http"
  /** A 2xx answer that isn't JSON. */
  | "parse";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

interface ApiFetchOptions extends Omit<RequestInit, "signal"> {
  /** Aborts the request (the promise rejects with kind "aborted"). */
  signal?: AbortSignal;
  /** Milliseconds before the request is given up (kind "timeout"). */
  timeoutMs?: number;
}

/**
 * GET (or `init.method`) `url` and return its JSON body as `T`.
 * Rejects with `ApiError` on abort, timeout, network failure, a non-2xx
 * status or a body that isn't JSON.
 */
export async function apiFetch<T>(
  url: string,
  { signal, timeoutMs = DEFAULT_TIMEOUT_MS, ...init }: ApiFetchOptions = {},
): Promise<T> {
  if (signal?.aborted) throw new ApiError("aborted", `Request to ${url} aborted`);

  // One controller for both reasons to stop (AbortSignal.any is too new for
  // some of the browsers we support).
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forward = () => controller.abort();
  signal?.addEventListener("abort", forward, { once: true });
  const stopped = (): ApiError | null =>
    timedOut
      ? new ApiError("timeout", `Request to ${url} timed out after ${timeoutMs} ms`)
      : signal?.aborted
        ? new ApiError("aborted", `Request to ${url} aborted`)
        : null;

  try {
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
    } catch {
      throw stopped() ?? new ApiError("network", `Request to ${url} failed`);
    }
    if (!response.ok) {
      throw new ApiError("http", `${url} answered ${response.status}`, response.status);
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw stopped() ?? new ApiError("parse", `${url} did not answer with JSON`);
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forward);
  }
}
