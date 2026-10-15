import type { NavFlag, NavMenu } from "@/config/navigation";
import { ROUTE_PREFIX, routes } from "@/config/routes";

/**
 * Admin → Site menus: the names of the menus and switches, and the pages an
 * item can point to. No server dependency: the admin page and its (client)
 * form both use it; the Zod schema checks addresses with `isKnownSitePath`.
 */

export const MENU_LABELS: Record<NavMenu, string> = {
  main: "Main menu",
  legal: "Footer links",
};

/** What the "Shown" select says for each switch an item can follow. */
export const FLAG_LABELS: Record<NavFlag, string> = {
  news_menu: "Only while the switch news_menu is on (News in the menu)",
  newsletter: "Only while the switch newsletter is on",
};

/** Common pages, offered as suggestions in the address field. */
export const NAV_PAGE_CHOICES: readonly { label: string; href: string }[] = [
  { label: "Home (the globe)", href: routes.home },
  { label: "Topics", href: routes.topics },
  { label: "Global issues", href: routes.globalIssues },
  { label: "Countries", href: routes.countries },
  { label: "News", href: routes.newsIndex },
  { label: "About", href: routes.about },
  { label: "Atlas Patrons (membership)", href: routes.membership },
  { label: "Newsletter", href: routes.newsletter },
  { label: "Search", href: routes.search },
  { label: "Privacy", href: routes.privacy },
  { label: "Terms", href: routes.terms },
  { label: "Accessibility", href: routes.accessibility },
];

/** First segment of a path ("/news/x?y#z" → "news"; "/" → ""). */
const firstSegment = (path: string) => (path.split(/[?#]/)[0] ?? "").split("/")[1] ?? "";

/**
 * First path segments of the public site: every fixed page in `routes` and
 * every kind of record page (country, news…). Not the administration or the
 * private previews — the public menu never leads there.
 */
const SITE_SEGMENTS = new Set(
  [...Object.values(routes), ...Object.values(ROUTE_PREFIX)]
    .flatMap((value: unknown) => (typeof value === "string" ? [value] : []))
    .filter((path) => path !== routes.admin && path !== ROUTE_PREFIX.preview)
    .map(firstSegment),
);

/**
 * Does a site path lead to a page this site has? Only the first segment is
 * checked (`/country/anything` passes, `/countires` doesn't) — enough to catch
 * a typo; a wrong slug still shows the site's 404 page.
 */
export const isKnownSitePath = (path: string): boolean => SITE_SEGMENTS.has(firstSegment(path));
