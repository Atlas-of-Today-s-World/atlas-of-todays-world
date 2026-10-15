import type { Messages } from "@/lib/i18n/messages";
import { routes } from "./routes";

/**
 * The menus as the code knows them (ARCHITEKTURA 15.1, D4). The main menu and
 * the legal links are edited in Admin → Site menus (table nav_items,
 * features/navigation); the lists below are what the migration seeded and what
 * the site falls back to when that table can't be read. The account (sign-in)
 * is not a menu item but the header's account menu (components/AccountMenu).
 * The addresses themselves come from config/routes.ts.
 */

/** Menus the team edits (nav_items.menu). */
export const NAV_MENUS = ["main", "legal"] as const;
export type NavMenu = (typeof NAV_MENUS)[number];

/**
 * Feature switches an item can follow (nav_items.requires_flag): it shows only
 * while the switch is on. Same list as the CHECK in the migration.
 */
export const NAV_FLAGS = ["news_menu", "newsletter"] as const;
export type NavFlag = (typeof NAV_FLAGS)[number];

export interface NavItem {
  href: string;
  /** Text key in messages/<language>.json → `nav`. */
  key: keyof Messages["nav"];
  /** Highlighted item (call to support). */
  primary?: boolean;
  /** Little room above the globe: on desktop it only shows in the full menu. */
  compactHidden?: boolean;
  /** Shown only while this switch is on. */
  flag?: NavFlag;
}

/** Built-in main menu (fallback): News only while it is switched on (flag news_menu). */
export const MAIN_NAV: readonly NavItem[] = [
  { href: routes.topics, key: "topics" },
  { href: routes.globalIssues, key: "globalIssues" },
  // Over the globe the map itself leads to a country; the list waits in the full menu.
  { href: routes.countries, key: "countries", compactHidden: true },
  { href: routes.newsIndex, key: "news", compactHidden: true, flag: "news_menu" },
  { href: routes.about, key: "about" },
  { href: routes.membership, key: "patrons", primary: true },
];

/** Built-in footer links (fallback): legal and informational pages. */
export const LEGAL_NAV: readonly NavItem[] = [
  { href: routes.privacy, key: "privacy" },
  { href: routes.terms, key: "terms" },
  { href: routes.accessibility, key: "accessibility" },
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
