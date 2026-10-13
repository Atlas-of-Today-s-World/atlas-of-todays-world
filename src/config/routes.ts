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
const ADMIN = "/admin";
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
  /** Administration (unlocalized; its pages are in `adminRoutes`). */
  admin: ADMIN,

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

type Query = Record<string, string>;

const withQuery = (path: string, query?: Query) => {
  const search = query ? new URLSearchParams(query).toString() : "";
  return search ? `${path}?${search}` : path;
};

/**
 * An admin section with a page per record: `section(id)` is the record's page
 * (`query` adds `?tab=…`, `?saved=1`…), `section.list` the section's index.
 */
const records = (list: string) =>
  Object.assign((id: string, query?: Query) => withQuery(`${list}/${id}`, query), { list });

/** A section whose records are also created in the admin: `section.new` is the empty form. */
const editable = (list: string) => Object.assign(records(list), { new: `${list}/new` });

/**
 * Every administration URL, built in one place like `routes` (the admin menu
 * in config/admin-nav.ts, links, redirects and `revalidatePath` all ask here).
 * Unlocalized. A section with records is callable — `adminRoutes.content(id)`
 * — and carries `.list` (its index) and, where records are created, `.new`;
 * a single-page section is a plain string.
 */
export const adminRoutes = {
  /** Dashboard (the admin's home). */
  overview: ADMIN,
  /** Articles: topics and news (`?tab=` picks a topic editor tab). */
  content: editable(`${ADMIN}/content`),
  /** The signed-in editor's own drafts. */
  myDrafts: `${ADMIN}/content?mine=1&status=draft`,
  /** The new-article form preset to a topic (encyclopedia entry). */
  newTopic: `${ADMIN}/content/new?kind=entry`,
  authors: editable(`${ADMIN}/authors`),
  topicTemplates: editable(`${ADMIN}/topic-templates`),
  approvals: `${ADMIN}/approvals`,
  /** URL redirects by id. */
  redirects: records(`${ADMIN}/redirects`),
  /** The home page's pinned subtopics. */
  homePage: `${ADMIN}/home`,
  /** Editable site pages (about, privacy…) by slug. */
  sitePages: records(`${ADMIN}/pages`),
  /** Regions by slug; their countries are under `country(slug)`. */
  regions: records(`${ADMIN}/regions`),
  country: (slug: string) => `${ADMIN}/regions/countries/${slug}`,
  globalIssues: editable(`${ADMIN}/global-issues`),
  /** The new global-issue form preset to a custom region. */
  newCustomRegion: `${ADMIN}/global-issues/new?kind=region`,
  /** Map data layers (indicators) by id. */
  data: editable(`${ADMIN}/data`),
  /** Custom map areas by slug. */
  areas: editable(`${ADMIN}/areas`),
  appearance: `${ADMIN}/appearance`,
  /** Feature switches and the maintenance message; a switch's note by its key. */
  switches: records(`${ADMIN}/switches`),
  accounts: records(`${ADMIN}/accounts`),
  /** Reader accounts (the accounts list's second tab). */
  readers: `${ADMIN}/accounts?kind=readers`,
  invitations: `${ADMIN}/accounts/invitations`,
  volunteers: `${ADMIN}/volunteers`,
  roles: `${ADMIN}/roles`,
  audit: `${ADMIN}/roles/audit`,
  members: `${ADMIN}/members`,
  /** Patron settings (the membership page's texts and FAQ). */
  patrons: `${ADMIN}/patrons`,
  /** Questions of the membership FAQ by id. */
  patronFaq: editable(`${ADMIN}/patrons/faq`),
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
