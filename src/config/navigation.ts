import type { Messages } from "@/features/i18n/messages";
import { MEMBERSHIP_PATH } from "@/features/membership/config";

/** Overview of all encyclopedia entries (full-width page, the globe in a corner window). */
export const TOPICS_PATH = "/topics";

/**
 * Every region, country and global issue as a plain list: the way in without
 * the globe (keyboard, screen readers, browsers without WebGL).
 */
export const COUNTRIES_PATH = "/countries";

/** Newsletter sign-up page (the "Newsletter" button bottom right). */
export const NEWSLETTER_PATH = "/newsletter";

/** Full search results page (`?q=`); Enter in the search over the map goes there. */
export const searchHref = (query: string) => `/search?q=${encodeURIComponent(query)}`;

/**
 * Public address of an article: a news item under /news, an encyclopedia entry
 * (a topic) under /topics. The only place that knows the mapping (old /entry/…
 * addresses redirect, next.config).
 */
export const articlePath = (kind: string, slug: string) =>
  kind === "entry" ? `${TOPICS_PATH}/${slug}` : `/news/${slug}`;

/**
 * Single definition of the menu (ARCHITEKTURA 15.1, D4) — the header above the map
 * (desktop and mobile) and the header of pages without the globe.
 */
export interface NavItem {
  href: string;
  /** Text key in messages/<language>.json → `nav`. */
  key: keyof Messages["nav"];
  /** Highlighted item (call to support). */
  primary?: boolean;
  /** Little room above the globe: on desktop it only shows in the full menu. */
  compactHidden?: boolean;
}

const MAIN_NAV: readonly NavItem[] = [
  { href: TOPICS_PATH, key: "topics" },
  // Over the globe the map itself leads to a country; the list waits in the full menu.
  { href: COUNTRIES_PATH, key: "countries", compactHidden: true },
  { href: "/news", key: "news", compactHidden: true },
  { href: "/about", key: "about" },
  { href: MEMBERSHIP_PATH, key: "support" },
  { href: MEMBERSHIP_PATH, key: "patrons", primary: true },
];

/** The main menu as the site shows it: News only while it is switched on (flag news_menu). */
export const mainNav = ({ news }: { news: boolean }): readonly NavItem[] =>
  MAIN_NAV.filter((item) => news || item.key !== "news");

export const ACCOUNT_NAV: NavItem = { href: "/login", key: "signIn" };

/** Footer: legal and informational pages. */
export const LEGAL_NAV: readonly NavItem[] = [
  { href: "/privacy", key: "privacy" },
  { href: "/terms", key: "terms" },
  { href: "/accessibility", key: "accessibility" },
];

export const SOCIALS = [
  {
    href: "https://www.instagram.com/atlasoftodaysworld_official/",
    label: "Instagram",
    icon: "IG",
  },
  {
    href: "https://www.linkedin.com/company/atlas-of-todays-world/",
    label: "LinkedIn",
    icon: "in",
  },
  { href: "https://www.facebook.com/atlasoftodaysworld/", label: "Facebook", icon: "f" },
  { href: "https://bsky.app/profile/atlas-otw.bsky.social", label: "Bluesky", icon: "bs" },
] as const;
