/**
 * Cookie-less conversion counter — the one definition of what is counted
 * (client, route handler and admin). The database holds the same lists in
 * record_event() and the CHECKs of conversion_events_daily (migration
 * 20261016000010_conversion_events; events.test.ts keeps them equal).
 *
 * No imports: client code (the tracker) uses it as well.
 */

/** Moments worth counting — nothing else is ever recorded. */
export const CONVERSION_EVENTS = [
  /** "Donate & Join" submitted on the donation card. */
  "donate_click",
  /** The (demo) thank-you page after a payment. */
  "checkout_complete",
  /** A volunteer editor application sent. */
  "volunteer_submit",
  /** A newsletter sign-up sent. */
  "newsletter_signup",
  /** The Share button on a place, issue or topic. */
  "share_click",
  /** "Write a topic" on a place without (many) topics. */
  "topic_write_click",
  /** A visit that arrived from an AI assistant (once per tab session). */
  "ai_referral",
] as const;
export type ConversionEvent = (typeof CONVERSION_EVENTS)[number];

/** AI assistants told apart in the counts (the referrer is reduced to this name). */
export const AI_REFERRERS = [
  "chatgpt",
  "perplexity",
  "gemini",
  "copilot",
  "claude",
  "bing-chat",
] as const;
export type AiReferrer = (typeof AI_REFERRERS)[number];

/** Labels in the admin overview. */
export const EVENT_LABEL: Record<ConversionEvent, string> = {
  donate_click: "Donate & Join clicks",
  checkout_complete: "Completed checkouts (demo)",
  volunteer_submit: "Volunteer applications",
  newsletter_signup: "Newsletter sign-ups",
  share_click: "Share clicks",
  topic_write_click: "“Write a topic” clicks",
  ai_referral: "Visits from AI assistants",
};

export const AI_REFERRER_LABEL: Record<AiReferrer, string> = {
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  gemini: "Gemini",
  copilot: "Copilot",
  claude: "Claude",
  "bing-chat": "Bing Chat",
};

/** Hosts of each assistant (a subdomain counts too: www.perplexity.ai). */
const AI_HOSTS: readonly (readonly [string, AiReferrer])[] = [
  ["chatgpt.com", "chatgpt"],
  ["chat.openai.com", "chatgpt"],
  ["perplexity.ai", "perplexity"],
  ["gemini.google.com", "gemini"],
  ["copilot.microsoft.com", "copilot"],
  ["claude.ai", "claude"],
];

const hostIs = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

function groupOfUrl(value: string): AiReferrer | null {
  let url: URL;
  try {
    url = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  for (const [domain, group] of AI_HOSTS) if (hostIs(host, domain)) return group;
  // Bing's chat lives under bing.com/chat; plain Bing search is not an assistant.
  if (hostIs(host, "bing.com") && /^\/chat(\/|$)/i.test(url.pathname)) return "bing-chat";
  return null;
}

/**
 * Which AI assistant sent the visitor, from `document.referrer` or — since
 * assistants often hide the referrer — a `utm_source` naming one (ChatGPT adds
 * `?utm_source=chatgpt.com`). Only the group name leaves the browser.
 */
export function aiReferrerGroup(referrer: string, search = ""): AiReferrer | null {
  if (referrer) {
    const group = groupOfUrl(referrer);
    if (group) return group;
  }
  const source = new URLSearchParams(search).get("utm_source");
  return source ? groupOfUrl(source) : null;
}

/** Elements carrying `data-track="<event>"` are counted when clicked (ConversionTracker). */
export const TRACK_ATTRIBUTE = "data-track";
