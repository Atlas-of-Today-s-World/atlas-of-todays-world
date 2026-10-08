/**
 * Preview images of "Learn more" resources (videos, articles, reports): the
 * picture a site shows when its link is shared (og:image / twitter:image), or
 * a YouTube thumbnail derived from the video id without any request at all.
 *
 * Fetching an address an editor typed is a server-side request forgery risk,
 * so every hop is checked before it is made: https on the default port only,
 * no credentials, the hostname resolved and refused when any of its addresses
 * is private, loopback, link-local (cloud metadata), reserved or otherwise not
 * public — and the connection is pinned to the address that passed, so a
 * second DNS answer can't swap in an internal one. At most 3 redirects (each
 * checked again), 5 s for everything, ~512 kB of text/html.
 *
 * The image itself is never fetched or proxied: only its https address is
 * stored, and visitors' browsers load it like any other <img> (next.config
 * keeps such hosts out of the image optimizer).
 *
 * No "server-only" import: scripts/backfill-resource-previews.mjs runs this
 * module in plain Node. It needs node:https and node:dns, so it can't end up
 * in a client bundle anyway.
 */
import type { LookupAddress } from "node:dns";
import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import { Readable, type Transform } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

const TIMEOUT_MS = 5000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
/** Same limit as `resources.url` / `image_url` in the admin forms. */
const MAX_URL_LENGTH = 1000;
const USER_AGENT = "Mozilla/5.0 (compatible; AtlasPreviewBot/1.0; +https://atlasoftodaysworld.org)";

/** IPv4 ranges that are not the public internet (RFC 6890 and friends). */
const NON_PUBLIC_V4 = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], // "this network", incl. 0.0.0.0
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, incl. the cloud metadata 169.254.169.254
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, incl. 255.255.255.255
] as const) {
  NON_PUBLIC_V4.addSubnet(network, prefix, "ipv4");
}

/**
 * IPv6 is allowed, not denied: only global unicast (2000::/3) passes, so
 * ::1, ::, fc00::/7 (incl. the AWS metadata fd00:ec2::254), fe80::/10,
 * multicast, IPv4-mapped ::ffff:0:0/96 and NAT64 64:ff9b::/96 are all out —
 * minus the special blocks inside it that tunnel to or stand for anything.
 */
const GLOBAL_V6 = new BlockList();
GLOBAL_V6.addSubnet("2000::", 3, "ipv6");
const SPECIAL_V6 = new BlockList();
for (const [network, prefix] of [
  ["2001::", 23], // IETF protocol assignments, incl. Teredo 2001::/32
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4: embeds an arbitrary IPv4 address
  ["3fff::", 20], // documentation
] as const) {
  SPECIAL_V6.addSubnet(network, prefix, "ipv6");
}

/** Names that only mean something inside a network. */
const LOCAL_NAME = /(?:^|\.)(?:localhost|local|internal|intranet|lan|home\.arpa)\.?$/i;

/** Is this IP address on the public internet? (false for anything that isn't an IP) */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !NON_PUBLIC_V4.check(address, "ipv4");
  if (family === 6) {
    return GLOBAL_V6.check(address, "ipv6") && !SPECIAL_V6.check(address, "ipv6");
  }
  return false;
}

/** An IPv6 literal as the URL parser writes it ("[::1]") → the bare address. */
const bareHost = (hostname: string) => hostname.replace(/^\[(.*)\]$/, "$1");

/**
 * A host whose name alone is acceptable: a public IP literal, or a dotted name
 * that isn't a local one (single labels resolve through search domains).
 */
function acceptableHost(hostname: string): boolean {
  const host = bareHost(hostname);
  if (isIP(host)) return isPublicAddress(host);
  return host.includes(".") && !LOCAL_NAME.test(host);
}

/** https on the default port, no credentials, an acceptable host. */
export function isAllowedTarget(url: URL): boolean {
  return (
    url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    // The parser drops an explicit :443, so any port left is another port.
    url.port === "" &&
    acceptableHost(url.hostname)
  );
}

// ---------------------------------------------------------------------------
// Videos
// ---------------------------------------------------------------------------

const YOUTUBE_HOST = /^(?:www\.|m\.|music\.)?(?:youtube\.com|youtube-nocookie\.com)$/;
const YOUTUBE_ID = /^[\w-]{11}$/;

/**
 * YouTube's own thumbnail for a video link — youtu.be/<id>,
 * youtube.com/watch?v=<id>, /embed/, /shorts/, /live/ — without a request.
 */
export function videoThumbnail(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  const [, first = "", second] = url.pathname.split("/");
  let id: string | null | undefined = null;
  if (host === "youtu.be" || host === "www.youtu.be") id = first;
  else if (YOUTUBE_HOST.test(host)) {
    if (first === "watch") id = url.searchParams.get("v");
    else if (["embed", "shorts", "live", "v"].includes(first)) id = second;
  }
  return id && YOUTUBE_ID.test(id) ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

/**
 * A Vimeo player link → the video's page, whose og:image is the thumbnail
 * (Vimeo has no thumbnail address derivable from the id alone).
 */
function vimeoPage(url: URL): URL {
  const player = /^\/video\/(\d+)/.exec(url.pathname);
  return url.hostname.toLowerCase() === "player.vimeo.com" && player
    ? new URL(`https://vimeo.com/${player[1]}`)
    : url;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Preferred first: the explicit https variant, then Open Graph, then Twitter. */
const IMAGE_KEYS = [
  "og:image:secure_url",
  "og:image",
  "og:image:url",
  "twitter:image",
  "twitter:image:src",
];

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  sol: "/",
  colon: ":",
  equals: "=",
  quest: "?",
  num: "#",
};

/** HTML entities of an attribute value, in one pass (`&amp;amp;` → `&amp;`). */
function decodeAttribute(value: string): string {
  return value.replace(
    /&(?:#(\d{1,7})|#x([\da-f]{1,6})|([a-z]+));/gi,
    (match, decimal?: string, hex?: string, name?: string) => {
      if (name) return NAMED_ENTITIES[name.toLowerCase()] ?? match;
      const code = decimal ? Number(decimal) : parseInt(hex as string, 16);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match;
    },
  );
}

const ATTRIBUTE = /([^\s"'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+))/g;

/** Attributes of one start tag (names lower-cased, the first of a repeated one wins). */
function attributes(tag: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const [, name = "", double, single, bare] of tag.matchAll(ATTRIBUTE)) {
    const key = name.toLowerCase();
    if (!found.has(key)) found.set(key, decodeAttribute(double ?? single ?? bare ?? ""));
  }
  return found;
}

/**
 * An image address fit to store: absolute https on the default port, no
 * credentials, a public host (a browser shouldn't be sent to someone's LAN),
 * short enough for the column.
 */
function storableImage(value: string, base: URL): string | null {
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return null;
  }
  if (!isAllowedTarget(url)) return null;
  return url.href.length <= MAX_URL_LENGTH ? url.href : null;
}

/**
 * The preview image a page declares in its <head>: og:image (or its
 * secure_url / url variants), else twitter:image. A relative address is
 * resolved against the page (or its <base href>); anything that isn't https
 * is skipped in favour of the next candidate. Comments and scripts are
 * ignored so a tag inside them doesn't count.
 */
export function extractPreviewImage(html: string, pageUrl: string): string | null {
  const markup = html
    .replace(/<!--[\s\S]*?(?:-->|$)/g, " ")
    .replace(/<(script|style|template)\b[\s\S]*?(?:<\/\1\s*>|$)/gi, " ");
  let base = new URL(pageUrl);
  const baseHref = /<base\b[^>]*>/i.exec(markup)?.[0];
  const href = baseHref && attributes(baseHref).get("href");
  if (href) {
    try {
      base = new URL(href, base);
    } catch {
      // A broken <base> is ignored, as browsers do.
    }
  }

  const candidates = new Map<string, string[]>();
  for (const [tag] of markup.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(tag);
    const key = (attrs.get("property") ?? attrs.get("name") ?? "").trim().toLowerCase();
    const content = attrs.get("content")?.trim();
    if (!content || !IMAGE_KEYS.includes(key)) continue;
    candidates.set(key, [...(candidates.get(key) ?? []), content]);
  }
  for (const key of IMAGE_KEYS) {
    for (const content of candidates.get(key) ?? []) {
      const image = storableImage(content, base);
      if (image) return image;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

/** What the fetcher needs of a response (the body still content-encoded). */
export interface PreviewResponse {
  status: number;
  location?: string;
  contentType: string;
  contentEncoding: string;
  body: AsyncIterable<Uint8Array>;
  close(): void;
}

/** DNS: every address a hostname resolves to. */
export type PreviewLookup = (hostname: string) => Promise<LookupAddress[]>;
/** One GET connected to the given, already checked address. */
export type PreviewRequest = (
  url: URL,
  address: LookupAddress,
  signal: AbortSignal,
) => Promise<PreviewResponse>;

export interface FindOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  lookup?: PreviewLookup;
  request?: PreviewRequest;
}

const systemLookup: PreviewLookup = (hostname) =>
  dnsLookup(hostname, { all: true, verbatim: true });

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/**
 * A `lookup` for node:https that answers with the address already checked —
 * the socket can only ever connect there, whatever DNS says by now. (Node
 * asks for `all` addresses when it races IPv4 and IPv6.)
 */
export function pinnedLookup(address: LookupAddress) {
  return (_hostname: string, options: { all?: boolean }, callback: LookupCallback) => {
    if (options.all) callback(null, [address]);
    else callback(null, address.address, address.family);
  };
}

/* v8 ignore start -- the real network: exercised by the backfill script, mocked in tests. */
const pinnedRequest: PreviewRequest = (url, address, signal) =>
  new Promise((resolve, reject) => {
    const request = httpsRequest(
      url,
      {
        method: "GET",
        // A fresh connection: a pooled socket could belong to another lookup.
        agent: false,
        signal,
        lookup: pinnedLookup(address) as never,
        headers: {
          accept: "text/html,application/xhtml+xml;q=0.9",
          "accept-encoding": "gzip, deflate, br",
          "accept-language": "en",
          "user-agent": USER_AGENT,
        },
      },
      (response) =>
        resolve({
          status: response.statusCode ?? 0,
          location: response.headers.location,
          contentType: response.headers["content-type"] ?? "",
          contentEncoding: response.headers["content-encoding"] ?? "",
          body: response,
          close: () => response.destroy(),
        }),
    );
    request.on("error", reject);
    request.end();
  });
/* v8 ignore stop */

class Refused extends Error {}

/** The first address of a host, when every address it has is public. */
async function publicAddress(hostname: string, lookup: PreviewLookup): Promise<LookupAddress> {
  const host = bareHost(hostname);
  const family = isIP(host);
  if (family) return { address: host, family };
  const addresses = await lookup(host);
  const [first] = addresses;
  // All of them, not just the first: the pinned one must not be a lucky pick.
  if (!first || !addresses.every((entry) => isPublicAddress(entry.address))) {
    throw new Refused(`${host} resolves to a non-public address`);
  }
  return first;
}

const DECODERS: Record<string, (() => Transform) | null> = {
  "": null,
  identity: null,
  gzip: createGunzip,
  "x-gzip": createGunzip,
  deflate: createInflate,
  br: createBrotliDecompress,
};

/** The body as text: decompressed, cut at MAX_BYTES or once the <head> is over. */
async function readHtml(response: PreviewResponse): Promise<string> {
  const encoding = response.contentEncoding.trim().toLowerCase();
  if (!Object.hasOwn(DECODERS, encoding)) throw new Refused(`encoding ${encoding}`);
  const decoder = DECODERS[encoding];
  const source = Readable.from(response.body);
  const stream = decoder ? source.pipe(decoder()) : source;
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      const part = Buffer.from(chunk).subarray(0, MAX_BYTES - size);
      chunks.push(part);
      size += part.length;
      if (size >= MAX_BYTES || /<\/head\s*>|<body[\s>]/i.test(part.toString("latin1"))) break;
    }
  } finally {
    stream.destroy();
    source.destroy();
    response.close();
  }
  const charset = /charset\s*=\s*"?([\w-]+)/i.exec(response.contentType)?.[1] ?? "utf-8";
  let text: TextDecoder;
  try {
    text = new TextDecoder(charset);
  } catch {
    text = new TextDecoder();
  }
  return text.decode(Buffer.concat(chunks));
}

const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const mediaType = (contentType: string) => contentType.split(";")[0]?.trim().toLowerCase();

/** The page (following checked redirects) → its preview image. */
async function fetchPreview(
  start: URL,
  lookup: PreviewLookup,
  request: PreviewRequest,
  signal: AbortSignal,
): Promise<string | null> {
  let url = start;
  for (let redirects = 0; ; redirects += 1) {
    if (!isAllowedTarget(url)) throw new Refused(`target ${url.origin}`);
    // A short link may lead to a video: its thumbnail needs no page.
    const video = videoThumbnail(url);
    if (video) return video;
    const address = await publicAddress(url.hostname, lookup);
    const response = await request(url, address, signal);
    if (REDIRECTS.has(response.status)) {
      response.close();
      if (redirects >= MAX_REDIRECTS || !response.location) throw new Refused("redirects");
      url = new URL(response.location, url);
      continue;
    }
    if (
      response.status < 200 ||
      response.status > 299 ||
      mediaType(response.contentType) !== "text/html"
    ) {
      response.close();
      throw new Refused(`status ${response.status} ${response.contentType}`);
    }
    return extractPreviewImage(await readHtml(response), url.href);
  }
}

/** Settles with `work`, or rejects as soon as the signal aborts (a hung socket or DNS). */
function untilAborted<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const stop = () => reject(new Refused("timeout"));
    if (signal.aborted) stop();
    signal.addEventListener("abort", stop, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", stop));
  });
}

/**
 * The preview image of a resource link, or null — never throws. YouTube
 * links get their thumbnail directly; anything else is fetched under the
 * rules at the top of this file.
 */
export async function findPreviewImage(
  input: string,
  options: FindOptions = {},
): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (!isAllowedTarget(url)) return null;
  const video = videoThumbnail(url);
  if (video) return video;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? TIMEOUT_MS);
  const signal = options.signal
    ? AbortSignal.any([controller.signal, options.signal])
    : controller.signal;
  const work = fetchPreview(
    vimeoPage(url),
    options.lookup ?? systemLookup,
    options.request ?? pinnedRequest,
    signal,
  );
  try {
    return await untilAborted(work, signal);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    // Whatever is still open (a socket, a stream) is torn down.
    controller.abort();
  }
}

export interface FindManyOptions {
  /** At most this many distinct links are looked up (the rest wait for the next save). */
  max?: number;
  /** All lookups together; whatever isn't done by then is dropped. */
  budgetMs?: number;
  find?: typeof findPreviewImage;
}

/**
 * Preview images of several links in parallel, within one time budget:
 * { link → image } for those that have one. Never throws.
 */
export async function findPreviewImages(
  urls: readonly string[],
  { max = 8, budgetMs = TIMEOUT_MS, find = findPreviewImage }: FindManyOptions = {},
): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  const unique = [...new Set(urls)].slice(0, max);
  if (!unique.length) return found;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budgetMs);
  await Promise.all(
    unique.map(async (url) => {
      const image = await find(url, { signal: controller.signal }).catch(() => null);
      if (image && !controller.signal.aborted) found.set(url, image);
    }),
  );
  clearTimeout(timer);
  return found;
}
