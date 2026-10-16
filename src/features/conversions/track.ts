import { apiRoutes } from "@/config/routes";
import { AI_REFERRERS, type AiReferrer, type ConversionEvent } from "./events";

/**
 * Sending a conversion from the browser: fire-and-forget through
 * `navigator.sendBeacon` to our own /api/e (CSP connect-src 'self'), so it
 * never waits, never blocks a click or a navigation and survives the page
 * unloading right after. No cookie, no identifier — the body is the event,
 * the page path (the server keeps only its first segment) and, for a visit
 * that came from an AI assistant, that assistant's name.
 */

/** Tab-session memory of the AI assistant this visit came from (sessionStorage). */
const REFERRER_KEY = "atlas:ai-referrer";

const isAiReferrer = (value: unknown): value is AiReferrer =>
  typeof value === "string" && (AI_REFERRERS as readonly string[]).includes(value);

/** The AI assistant this tab session came from, if any. */
function sessionReferrer(): AiReferrer | null {
  try {
    const value = window.sessionStorage.getItem(REFERRER_KEY);
    return isAiReferrer(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Remembers the AI assistant of this landing; true when it is new for the tab
 * session (the `ai_referral` is counted once, not on every reload).
 */
export function rememberAiReferrer(group: AiReferrer): boolean {
  if (sessionReferrer() === group) return false;
  try {
    window.sessionStorage.setItem(REFERRER_KEY, group);
  } catch {
    // Storage blocked (private mode): counted, just not remembered.
  }
  return true;
}

/** Counts one event. Never throws, never waits. */
export function track(event: ConversionEvent): void {
  try {
    if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return;
    const referrer = sessionReferrer();
    const body = JSON.stringify({
      e: event,
      p: window.location.pathname,
      ...(referrer ? { r: referrer } : {}),
    });
    navigator.sendBeacon(apiRoutes.event, body);
  } catch {
    // Counting must never break the page.
  }
}
