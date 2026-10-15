/**
 * Redirects built into the site (next.config `redirects()`): old URL shapes
 * that must keep working whatever is in the database. They run before any
 * page, so they win over a live page and over the redirects editors manage in
 * the admin (`redirects` table, which only replaces a 404). The admin shows
 * this list read-only next to the editable ones.
 *
 * Plain data without imports — next.config.ts loads it before the app's
 * path aliases exist. First match wins: specific paths before general ones.
 */

export interface BuiltInRedirect {
  source: string;
  destination: string;
  permanent: boolean;
  /** Why it exists (shown in the admin). */
  reason: string;
}

const permanent = (source: string, destination: string, reason: string): BuiltInRedirect => ({
  source,
  destination,
  permanent: true,
  reason,
});

const TOPICS_MOVED = "Topics moved from /entry/<slug> (2026-10-06)";
const ISSUES_RENAMED = "Custom units were renamed to Global Issues";
const ENGLISH_ONLY = "The site is English only (2026-10-05); the former Czech version";
const MEMBERSHIP = "Atlas Patrons live at /membership, the address of the original site";
const ADMIN_ENGLISH = "The admin moved to English URLs; old Czech bookmarks";
const ACCOUNT_ENGLISH =
  "Account pages moved to English URLs (2026-10-15); old links, bookmarks and shared invitations";

export const BUILT_IN_REDIRECTS: readonly BuiltInRedirect[] = [
  permanent("/entry/:slug.md", "/topics/:slug.md", TOPICS_MOVED),
  permanent("/entry/:slug", "/topics/:slug", TOPICS_MOVED),
  permanent("/special/:slug", "/global-issue/:slug", ISSUES_RENAMED),
  permanent("/cs/:old(support|patrons)", "/membership", ENGLISH_ONLY),
  permanent("/cs", "/", ENGLISH_ONLY),
  permanent("/cs/:path*", "/:path*", ENGLISH_ONLY),
  permanent("/:old(support|patrons)", "/membership", MEMBERSHIP),
  // The query string goes along (Next passes it through), so nothing an old
  // link carried is lost; the pages themselves read no secret from it.
  permanent("/ucet", "/account", ACCOUNT_ENGLISH),
  permanent("/pozvanka", "/invite", ACCOUNT_ENGLISH),
  permanent(
    "/region/:slug/full",
    "/region/:slug",
    "There is only one region portrait; the former “full” version",
  ),
  permanent("/admin/obsah/novy", "/admin/content/new", ADMIN_ENGLISH),
  permanent("/admin/autori/novy", "/admin/authors/new", ADMIN_ENGLISH),
  permanent("/admin/oblasti/nova", "/admin/areas/new", ADMIN_ENGLISH),
  permanent("/admin/data/novy", "/admin/data/new", ADMIN_ENGLISH),
  permanent("/admin/global-issues/novy", "/admin/global-issues/new", ADMIN_ENGLISH),
  permanent("/admin/ucty/pozvanky", "/admin/accounts/invitations", ADMIN_ENGLISH),
  permanent("/admin/regiony/zeme/:slug", "/admin/regions/countries/:slug", ADMIN_ENGLISH),
  permanent("/admin/obsah/:path*", "/admin/content/:path*", ADMIN_ENGLISH),
  permanent("/admin/autori/:path*", "/admin/authors/:path*", ADMIN_ENGLISH),
  permanent("/admin/schvalovani", "/admin/approvals", ADMIN_ENGLISH),
  permanent("/admin/presmerovani", "/admin/redirects", ADMIN_ENGLISH),
  permanent("/admin/regiony/:path*", "/admin/regions/:path*", ADMIN_ENGLISH),
  permanent("/admin/oblasti/:path*", "/admin/areas/:path*", ADMIN_ENGLISH),
  permanent("/admin/vzhled", "/admin/appearance", ADMIN_ENGLISH),
  permanent("/admin/ucty/:path*", "/admin/accounts/:path*", ADMIN_ENGLISH),
  permanent("/admin/role/:path*", "/admin/roles/:path*", ADMIN_ENGLISH),
  permanent("/admin/clenove", "/admin/members", ADMIN_ENGLISH),
  permanent(
    "/admin/learn-more-tiles/:path*",
    "/admin/topic-templates",
    "Default learn-more tiles became topic templates (ADR-024)",
  ),
];
