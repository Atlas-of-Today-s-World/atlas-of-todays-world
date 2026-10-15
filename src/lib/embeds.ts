/**
 * Embedded charts and maps — the one allowlist of providers (ARCHITEKTURA 8.1,
 * S13). The editors paste a provider's embed code or a link to the chart; we
 * never keep or render that HTML. The server pulls out the one URL, checks it
 * against a strict per-provider pattern and stores it rebuilt in the
 * provider's canonical shape (the DB checks the same shapes:
 * `visuals_embed_url_check`, migration 20261015000100). The page then renders
 * its own sandboxed iframe for it, and the CSP frames only these origins
 * (`EMBED_ORIGINS`, lib/security/csp.ts). Anything that isn't plainly one of
 * these charts is refused rather than "cleaned up".
 *
 * Providers:
 * - Datawrapper — `datawrapper.dwcdn.net/<id>/<version>/` (the responsive
 *   iframe or the script embed, or a `datawrapper.de/_/<id>/` share link);
 *   its height comes in a `datawrapper-height` message.
 * - Flourish — `flo.uri.sh/visualisation|story/<id>/embed` (the iframe embed,
 *   the script embed's `data-src`, or a `public.flourish.studio` link); framed
 *   with `?auto=1`, it reports its height (`iframe.resize`).
 * - Our World in Data — `ourworldindata.org/grapher/<chart>` with the chart's
 *   own settings in the query (tab, countries, years).
 * - World Bank — the data site's chart widget
 *   `data.worldbank.org/share/widget?indicators=…&locations=…` (its Share →
 *   Embed code, or an indicator page link). DataTopics pages
 *   (datatopics.worldbank.org) have no stable embed URL and are not accepted.
 *
 * No Zod here: the admin form (a client component) detects the provider as
 * the editor pastes, with the same functions the server validates with.
 */

const EMBED_PROVIDERS = ["datawrapper", "flourish", "owid", "worldbank"] as const;
export type EmbedProvider = (typeof EMBED_PROVIDERS)[number];

export const isEmbedProvider = (value: unknown): value is EmbedProvider =>
  typeof value === "string" && (EMBED_PROVIDERS as readonly string[]).includes(value);

interface ProviderInfo {
  /** Name in the admin and in the iframe's fallback title. */
  label: string;
  /** The only origin its frames come from (CSP frame-src, message origin). */
  origin: string;
  /** Frame height (px) before / without a resize message. */
  height: number;
  /** Does the chart report its own height (postMessage)? */
  resizes: boolean;
}

export const EMBED_PROVIDER_INFO: Record<EmbedProvider, ProviderInfo> = {
  datawrapper: {
    label: "Datawrapper",
    origin: "https://datawrapper.dwcdn.net",
    height: 400,
    resizes: true,
  },
  flourish: { label: "Flourish", origin: "https://flo.uri.sh", height: 500, resizes: true },
  owid: {
    label: "Our World in Data",
    origin: "https://ourworldindata.org",
    height: 600,
    resizes: false,
  },
  worldbank: {
    label: "World Bank",
    origin: "https://data.worldbank.org",
    height: 450,
    resizes: false,
  },
};

/** Every origin a visual may be framed from — the CSP's frame-src. */
export const EMBED_ORIGINS: readonly string[] = EMBED_PROVIDERS.map(
  (provider) => EMBED_PROVIDER_INFO[provider].origin,
);

/** Longest paste we look at; embed codes are about 1–2 kB. */
export const MAX_EMBED_LENGTH = 20_000;

/** Bounds for a frame's height (the DB's `visuals_height_range` too). */
export const EMBED_HEIGHT = { min: 200, max: 1600 } as const;

/*
 * Canonical (stored) shapes. Exact host, path and query alphabet; anchored, so
 * nothing before or after. A query (Our World in Data, World Bank: the chart's
 * settings) only of letters, digits and `_ . ~ % = & + , : -` — no quotes,
 * spaces, `<` or `#` (the DB patterns too). All linear: no nested quantifiers
 * over overlapping characters (the slug's "-" never matches `[a-z0-9]`), and
 * every optional group starts with a character nothing before it can match.
 * The patterns down to WB_INDICATOR share this property.
 */
/* eslint-disable security/detect-unsafe-regex -- star-height heuristic false positives; linear, see above */
const CANONICAL: Record<EmbedProvider, RegExp> = {
  datawrapper: /^https:\/\/datawrapper\.dwcdn\.net\/[A-Za-z0-9]{4,16}\/(?:\d{1,4}\/)?$/,
  flourish: /^https:\/\/flo\.uri\.sh\/(?:visualisation|story)\/\d{1,12}\/embed$/,
  owid: /^https:\/\/ourworldindata\.org\/grapher\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\?[\w.~%=&+,:-]+)?$/,
  worldbank: /^https:\/\/data\.worldbank\.org\/share\/widget\?[\w.~%=&+,:-]+$/,
};

/* eslint-enable security/detect-unsafe-regex */

/** The stored URL, if it is exactly this provider's canonical shape (render-time re-check). */
export function canonicalEmbedUrl(provider: unknown, url: unknown): string | null {
  if (!isEmbedProvider(provider) || typeof url !== "string" || url.length > 1000) return null;
  return CANONICAL[provider].test(url) ? url : null;
}

export interface Embed {
  provider: EmbedProvider;
  url: string;
}

/* eslint-disable security/detect-unsafe-regex -- linear, see CANONICAL above */
/** A chart page: `…/<id>/` or `…/<id>/<version>/` (trailing slash optional). */
const DW_CHART = /^https:\/\/datawrapper\.dwcdn\.net\/([A-Za-z0-9]{4,16})(?:\/(\d{1,4}))?\/?$/;
/** The share link of the Datawrapper app. */
const DW_SHARE = /^https:\/\/(?:www\.)?datawrapper\.de\/_\/([A-Za-z0-9]{4,16})\/?$/;
/** The script embed's loader. */
const DW_SCRIPT =
  /^https:\/\/datawrapper\.dwcdn\.net\/([A-Za-z0-9]{4,16})\/(?:(\d{1,4})\/)?embed\.js$/;

const FL_EMBED =
  /^https:\/\/flo\.uri\.sh\/(visualisation|story)\/(\d{1,12})\/embed(?:\?[A-Za-z0-9=&]{0,100})?$/;
const FL_PUBLIC =
  /^https:\/\/public\.flourish\.studio\/(visualisation|story)\/(\d{1,12})(?:\/(?:embed)?)?$/;
/** `data-src` of the script embed's `<div class="flourish-embed">`. */
const FL_DATA_SRC = /^(visualisation|story)\/(\d{1,12})(?:\?[A-Za-z0-9=&]{0,100})?$/;

const WB_INDICATOR =
  /^https:\/\/data\.worldbank\.org\/indicator\/([\w.]{1,40})\/?(?:\?([\w.~%=&+,:-]+))?$/;
/* eslint-enable security/detect-unsafe-regex */
/** Settings of an indicator page the widget takes over. */
const WB_SETTINGS = ["locations", "start", "end", "view"] as const;

const datawrapper = (id: string, version?: string): Embed => ({
  provider: "datawrapper",
  url: `${EMBED_PROVIDER_INFO.datawrapper.origin}/${id}/${version ? `${version}/` : ""}`,
});

const flourish = (kind: string, id: string): Embed => ({
  provider: "flourish",
  url: `${EMBED_PROVIDER_INFO.flourish.origin}/${kind}/${id}/embed`,
});

/**
 * `https://Host.Example/x` → `https://host.example/x` (hosts are case-blind,
 * paths are not); null unless it starts with https:// and has no whitespace.
 */
function normalized(value: string): string | null {
  const match = /^https:\/\/([^/?#\s]+)([^\s]*)$/i.exec(value.trim());
  return match ? `https://${match[1]!.toLowerCase()}${match[2]}` : null;
}

/** A World Bank indicator page → its chart widget, with the page's settings. */
function worldBankWidget(code: string, query: string | undefined): Embed {
  const page = new URLSearchParams(query ?? "");
  const widget = new URLSearchParams({ indicators: code });
  for (const name of WB_SETTINGS) {
    const value = page.get(name);
    if (value) widget.set(name, value);
  }
  return {
    provider: "worldbank",
    url: `${EMBED_PROVIDER_INFO.worldbank.origin}/share/widget?${widget}`,
  };
}

/**
 * Provider and canonical URL from a link: a chart's embed URL or a page that
 * maps onto one (a Datawrapper share link, a Flourish public page, a World
 * Bank indicator page). A trailing `#fragment` is dropped. null = not an
 * allowed chart.
 */
export function embedFromUrl(input: unknown): Embed | null {
  if (typeof input !== "string" || input.length > 2000) return null;
  const url = normalized(input.replace(/#[^#]*$/, ""));
  if (!url) return null;
  let m: RegExpExecArray | null;
  if ((m = DW_CHART.exec(url))) return datawrapper(m[1]!, m[2]);
  if ((m = DW_SHARE.exec(url))) return datawrapper(m[1]!);
  if ((m = FL_EMBED.exec(url)) || (m = FL_PUBLIC.exec(url))) return flourish(m[1]!, m[2]!);
  if ((m = WB_INDICATOR.exec(url))) return worldBankWidget(m[1]!, m[2]);
  for (const provider of ["owid", "worldbank"] as const) {
    if (url.length <= 1000 && CANONICAL[provider].test(url)) return { provider, url };
  }
  return null;
}

/**
 * One opening tag of each kind an embed code may hold; quoted values may
 * contain `>`. Linear (the alternatives start with disjoint characters).
 */
/* eslint-disable security/detect-unsafe-regex -- star-height heuristic false positive; linear, see above */
const TAG = {
  iframe: /<iframe\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi,
  script: /<script\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi,
  div: /<div\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi,
};
/* eslint-enable security/detect-unsafe-regex */

/**
 * One attribute of a tag: name, optionally `=` and a double-quoted, single-quoted
 * or bare value. Linear: the name can't contain `=` or a quote, and each value
 * form starts with a different character.
 */
// eslint-disable-next-line security/detect-unsafe-regex -- star-height heuristic false positive; linear, see above
const ATTRIBUTE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/** Attributes of every `name` tag in the paste, names lower-cased; `&amp;` decoded. */
function tags(html: string, name: keyof typeof TAG): [string, string][][] {
  return [...html.matchAll(TAG[name])].map((tag) =>
    [...tag[1]!.matchAll(ATTRIBUTE)].map(
      (m) =>
        [m[1]!.toLowerCase(), (m[2] ?? m[3] ?? m[4] ?? "").replace(/&amp;|&#38;/g, "&")] as [
          string,
          string,
        ],
    ),
  );
}

const values = (attrs: [string, string][], name: string) =>
  attrs.filter(([attr]) => attr === name).map(([, value]) => value);

/**
 * Provider and canonical URL from what the editor pasted: an embed code or a
 * link. An embed code is read in this order, and has to be unambiguous:
 *
 * 1. `<iframe>` — exactly one, with exactly one `src` and no `srcdoc` (which
 *    a browser would show instead of `src`); its `src` must be an allowed chart.
 * 2. Datawrapper's script embed — exactly one `<script src=".../<id>/embed.js">`.
 * 3. Flourish's script embed — exactly one `data-src="visualisation/<id>"`.
 *
 * Everything else in the paste (other attributes, scripts, styles) is ignored
 * and dropped. null = nothing we may embed.
 */
export function parseEmbed(input: unknown): Embed | null {
  if (typeof input !== "string" || input.length > MAX_EMBED_LENGTH) return null;
  const pasted = input.trim();
  if (!pasted.includes("<")) return embedFromUrl(pasted);

  const frames = tags(pasted, "iframe");
  if (frames.length > 1) return null;
  if (frames.length === 1) {
    const attrs = frames[0]!;
    if (attrs.some(([name]) => name === "srcdoc")) return null;
    const sources = values(attrs, "src");
    return sources.length === 1 ? embedFromUrl(sources[0]) : null;
  }

  const scripts = tags(pasted, "script")
    .flatMap((attrs) => values(attrs, "src"))
    .map((src) => DW_SCRIPT.exec(normalized(src) ?? ""))
    .filter((match): match is RegExpExecArray => match !== null);
  if (scripts.length === 1) return datawrapper(scripts[0]![1]!, scripts[0]![2]);
  if (scripts.length > 1) return null;

  const flourishSources = tags(pasted, "div").flatMap((attrs) => values(attrs, "data-src"));
  if (flourishSources.length !== 1) return null;
  const m = FL_DATA_SRC.exec(flourishSources[0]!.trim());
  return m ? flourish(m[1]!, m[2]!) : null;
}

/**
 * The iframe's `src` for a stored embed (re-checked; null = don't frame it).
 * Flourish gets `?auto=1`: the chart then reports its height instead of
 * filling a fixed frame.
 */
export function embedSrc(provider: unknown, url: unknown): string | null {
  const canonical = canonicalEmbedUrl(provider, url);
  if (!canonical) return null;
  return provider === "flourish" ? `${canonical}?auto=1` : canonical;
}

const clampHeight = (value: number) =>
  Math.round(Math.min(EMBED_HEIGHT.max, Math.max(EMBED_HEIGHT.min, value)));

/** A Flourish message arrives as a JSON string; Datawrapper's as an object. */
function asObject(data: unknown): Record<string, unknown> | null {
  if (typeof data === "string") {
    if (data.length > 2000) return null;
    try {
      return asObject(JSON.parse(data) as unknown);
    } catch {
      return null;
    }
  }
  return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
}

/**
 * Height (px) a chart asks for in its `postMessage`, clamped; null when the
 * message is something else. Datawrapper: `{"datawrapper-height": {"<id>": 512}}`;
 * Flourish: `'{"sender":"Flourish","context":"iframe.resize","height":512}'`.
 * The caller checks the origin (`EMBED_PROVIDER_INFO[provider].origin`) and
 * that the message comes from its own frame.
 */
export function embedHeight(provider: EmbedProvider, data: unknown): number | null {
  const message = asObject(data);
  if (!message) return null;
  if (provider === "datawrapper") {
    const heights = asObject(message["datawrapper-height"]);
    const value = heights
      ? Object.values(heights).find(
          (height): height is number => typeof height === "number" && Number.isFinite(height),
        )
      : undefined;
    return value === undefined ? null : clampHeight(value);
  }
  if (provider === "flourish") {
    const fromFlourish = message.sender === "Flourish" || message.source === "Flourish";
    const height = message.height;
    return fromFlourish &&
      message.context === "iframe.resize" &&
      typeof height === "number" &&
      Number.isFinite(height)
      ? clampHeight(height)
      : null;
  }
  return null;
}
