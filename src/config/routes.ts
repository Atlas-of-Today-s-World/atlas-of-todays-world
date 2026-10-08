/**
 * Every public URL of the site, built in one place (ARCHITEKTURA 15, one
 * definition of each constant). Components, Server Actions, SEO, the proxy and
 * the layout all ask here instead of writing `/country/${slug}` by hand.
 *
 * Plain TypeScript without imports, so client and server code, the proxy and
 * config files can all use it. Paths are without the language prefix (the
 * i18n `Link` / `localePath` adds it). Slugs are inserted as they are — they
 * come from the database, which allows only `[a-z0-9-]` — so this module does
 * not encode them (the produced URLs stay exactly as before).
 */

/** First path segment of each kind of public page (also the index pages of news and topics). */
export const ROUTE_PREFIX = {
  country: "/country",
  region: "/region",
  issue: "/global-issue",
  news: "/news",
  topics: "/topics",
  author: "/authors",
  view: "/view",
  preview: "/preview",
  membership: "/membership",
} as const;

const P = ROUTE_PREFIX;
const SEARCH = "/search";
const withAnchor = (path: string, anchor?: string | null) => (anchor ? `${path}#${anchor}` : path);

export const routes = {
  home: "/",
  /** Overview of all encyclopedia entries (full-width page, the globe in a corner window). */
  topics: P.topics,
  /**
   * Every region, country and global issue as a plain list: the way in without
   * the globe (keyboard, screen readers, browsers without WebGL).
   */
  countries: "/countries",
  /** News index. */
  newsIndex: P.news,
  about: "/about",
  /** Full search results page (`?q=`, see `searchFor`). */
  search: SEARCH,
  /** Newsletter sign-up page (the "Newsletter" button bottom right). */
  newsletter: "/newsletter",
  /** Donation flow (Atlas Patrons). */
  membership: P.membership,
  checkout: `${P.membership}/checkout`,
  thankYou: `${P.membership}/thank-you`,
  manageMembership: `${P.membership}/manage`,
  privacy: "/privacy",
  terms: "/terms",
  accessibility: "/accessibility",
  login: "/login",
  /** The page an e-mail link leads to; its button posts the token to /auth/confirm. */
  loginConfirm: "/login/confirm",
  /** The reader's account page. */
  account: "/ucet",
  /** Accepting an invitation to the team. */
  invitation: "/pozvanka",
  /** Administration (unlocalized; its own routes are not built here). */
  admin: "/admin",

  country: (slug: string) => `${P.country}/${slug}`,
  region: (slug: string) => `${P.region}/${slug}`,
  /** A global issue's portrait. */
  issue: (slug: string) => `${P.issue}/${slug}`,
  news: (slug: string) => `${P.news}/${slug}`,
  /** An encyclopedia entry; `anchor` opens one of its subtopics. */
  topic: (slug: string, anchor?: string | null) => withAnchor(`${P.topics}/${slug}`, anchor),
  author: (slug: string) => `${P.author}/${slug}`,
  /** A data layer's ranking; `anchor` picks one country (`/view/hdi#hun`). */
  view: (id: string, anchor?: string | null) => withAnchor(`${P.view}/${id}`, anchor),
  /**
   * Public address of an article: a news item under /news, an encyclopedia
   * entry (a topic) under /topics (old /entry/… addresses redirect, next.config).
   */
  article: (kind: string, slug: string) =>
    kind === "entry" ? `${P.topics}/${slug}` : `${P.news}/${slug}`,
  /** Search results for a query; Enter in the search over the map goes there. */
  searchFor: (query: string) => `${SEARCH}?q=${encodeURIComponent(query)}`,
} as const;

/** Is `path` the page `prefix` or anything under it (`/topics`, `/topics/x`)? */
export const isAtOrUnder = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}/`);

/** The first segment after `prefix/` (`/global-issue/sahel/x` → `sahel`), if any. */
export function segmentAfter(path: string, prefix: string): string | undefined {
  if (!path.startsWith(`${prefix}/`)) return undefined;
  return path.slice(prefix.length + 1).split("/")[0] || undefined;
}

/**
 * Private, transactional or per-user pages: nothing for search engines
 * (robots.txt). Localized paths; `/preview/` keeps its trailing slash.
 */
export const PRIVATE_PATHS: readonly string[] = [
  routes.checkout,
  routes.thankYou,
  routes.manageMembership,
  `${P.preview}/`,
  routes.account,
  routes.invitation,
];
