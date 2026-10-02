import "server-only";
import { createHash } from "node:crypto";
import { after } from "next/server";
import { LOCALES, localePath } from "@/features/i18n/config";
import { serverEnv } from "@/lib/env.server";
import { allowKey } from "@/lib/security/rate-limit";
import { SITE_URL } from "@/lib/site";
import { absoluteUrl } from "./index";

/**
 * IndexNow (ADR-021): tells Bing, Seznam, Yandex, Naver and others (Bing feeds
 * ChatGPT search and Copilot) right away that a page was published, changed or
 * removed. One POST to the shared endpoint reaches all participating engines.
 *
 * - Off unless INDEXNOW_KEY is set and this is the production deployment.
 * - Never blocks or fails the caller: run it in `after()`, errors are only logged.
 * - At most one ping per URL in 15 minutes (shared `rate_limits` in Postgres),
 *   so an editor saving ten times sends one notification.
 */
const ENDPOINT = "https://api.indexnow.org/indexnow";
const PER_URL_WINDOW_SECONDS = 15 * 60;
const TIMEOUT_MS = 5000;

export const indexNowKey = () => serverEnv.INDEXNOW_KEY;

const enabled = () => Boolean(indexNowKey()) && process.env.VERCEL_ENV === "production";

/** Request body per the IndexNow protocol (exported for tests). */
export function indexNowPayload(urls: string[], key: string) {
  return {
    host: new URL(SITE_URL).host,
    key,
    keyLocation: absoluteUrl("/indexnow-key.txt"),
    urlList: urls,
  };
}

/** Notifies IndexNow engines about changed pages (paths or absolute URLs of this site). */
export async function submitToIndexNow(paths: string[]): Promise<void> {
  const key = indexNowKey();
  if (!key || !enabled()) return;
  const urls = [...new Set(paths.map((path) => absoluteUrl(path)))];
  const due: string[] = [];
  for (const url of urls) {
    const hash = createHash("sha256").update(url).digest("hex").slice(0, 32);
    if (await allowKey(`indexnow:${hash}`, { limit: 1, windowSeconds: PER_URL_WINDOW_SECONDS })) {
      due.push(url);
    }
  }
  if (!due.length) return;
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(indexNowPayload(due, key)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // 200 = accepted, 202 = accepted, key check pending; anything else is worth a log line.
    if (response.status !== 200 && response.status !== 202) {
      console.error("[indexnow]", response.status, due.length);
    }
  } catch (error) {
    console.error("[indexnow]", error instanceof Error ? error.message : error);
  }
}

/**
 * Schedules a ping after the response is sent (Server Actions). `everyLanguage`
 * adds the /cs… versions of pages that exist in all languages (portraits).
 */
export function notifyIndexNow(paths: string[], { everyLanguage = false } = {}) {
  const all = everyLanguage
    ? paths.flatMap((path) => LOCALES.map((locale) => localePath(locale, path)))
    : paths;
  after(() => submitToIndexNow(all));
}
