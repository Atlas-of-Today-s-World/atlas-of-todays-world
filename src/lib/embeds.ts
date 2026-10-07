/**
 * Datawrapper charts in portrait carousels (ARCHITEKTURA 8.1, S13).
 *
 * The editors copy Datawrapper's "responsive iframe" embed code — an
 * `<iframe src="https://datawrapper.dwcdn.net/<id>/<version>/">` plus a resizer
 * `<script>` — or just the chart URL, and paste it into the admin. We never keep
 * or render that HTML: the server pulls out the one chart URL, checks it against
 * a strict pattern and stores it rebuilt from the matched parts; the page then
 * renders its own sandboxed iframe for it. Anything that isn't plainly a
 * Datawrapper chart is refused rather than "cleaned up".
 */

/** The only origin a Datawrapper chart may come from (also in CSP frame-src). */
export const DATAWRAPPER_ORIGIN = "https://datawrapper.dwcdn.net";

/**
 * A published chart: exact host, chart id, version number, nothing else — no
 * port, credentials, query, fragment, escapes or backslashes. Linear (no ReDoS).
 */
const CHART_URL = /^https:\/\/datawrapper\.dwcdn\.net\/([A-Za-z0-9]{4,16})\/(\d{1,4})\/?$/i;

/** Longest paste we look at; Datawrapper's embed code is about 1–2 kB. */
export const MAX_EMBED_LENGTH = 20_000;

/** One opening `<iframe …>` tag; quoted values may contain `>`. Linear (disjoint alternatives). */
const IFRAME_TAG = /<iframe\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;

/** One attribute of a tag: name, optionally `=` and a double-quoted, single-quoted or bare value. */
const ATTRIBUTE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/** Canonical chart URL (`https://datawrapper.dwcdn.net/<id>/<version>/`), or null. */
export function datawrapperChartUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = CHART_URL.exec(value.trim());
  return match ? `${DATAWRAPPER_ORIGIN}/${match[1]}/${match[2]}/` : null;
}

/** Attributes of one tag's inner text, names lower-cased; repeated names keep every value. */
function attributes(tag: string): [string, string][] {
  return [...tag.matchAll(ATTRIBUTE)].map(
    (m) => [m[1]!.toLowerCase(), m[2] ?? m[3] ?? m[4] ?? ""] as [string, string],
  );
}

/**
 * Chart URL from what the editor pasted: the embed code or the URL itself.
 *
 * Embed code must contain exactly one `<iframe>` with exactly one `src` and no
 * `srcdoc` (which a browser would show instead of `src`) — otherwise it's
 * ambiguous what the code really embeds, so it's refused. Everything else in
 * the paste (other attributes, the resizer script) is ignored and dropped.
 */
export function extractDatawrapperUrl(input: unknown): string | null {
  if (typeof input !== "string" || input.length > MAX_EMBED_LENGTH) return null;
  const pasted = input.trim();
  if (!pasted.includes("<")) return datawrapperChartUrl(pasted);

  const tags = [...pasted.matchAll(IFRAME_TAG)];
  if (tags.length !== 1) return null;
  const attrs = attributes(tags[0]![1]!);
  if (attrs.some(([name]) => name === "srcdoc")) return null;
  const sources = attrs.filter(([name]) => name === "src");
  return sources.length === 1 ? datawrapperChartUrl(sources[0]![1]) : null;
}

/** Bounds for a chart's height from its own resize message — a frame can't grow without limit. */
export const DATAWRAPPER_HEIGHT = { min: 200, max: 1600 } as const;

/**
 * Height (px) a Datawrapper chart asks for in its `postMessage`
 * (`{"datawrapper-height": {"<chart id>": 512}}`), clamped; null when the
 * message is something else. The caller checks the origin and the sender frame.
 */
export function datawrapperHeight(data: unknown): number | null {
  if (typeof data !== "object" || data === null) return null;
  const heights = (data as Record<string, unknown>)["datawrapper-height"];
  if (typeof heights !== "object" || heights === null) return null;
  const value = Object.values(heights).find(
    (height): height is number => typeof height === "number" && Number.isFinite(height),
  );
  if (value === undefined) return null;
  return Math.round(Math.min(DATAWRAPPER_HEIGHT.max, Math.max(DATAWRAPPER_HEIGHT.min, value)));
}
