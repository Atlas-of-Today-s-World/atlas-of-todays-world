import type { Messages } from "@/features/i18n/messages";
import { routes } from "./routes";

/**
 * Single definition of the menu (ARCHITEKTURA 15.1, D4) — the header above the map
 * (desktop and mobile) and the header of pages without the globe. The addresses
 * themselves come from config/routes.ts.
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
  { href: routes.topics, key: "topics" },
  // Over the globe the map itself leads to a country; the list waits in the full menu.
  { href: routes.countries, key: "countries", compactHidden: true },
  { href: routes.newsIndex, key: "news", compactHidden: true },
  { href: routes.about, key: "about" },
  { href: routes.membership, key: "support" },
  { href: routes.membership, key: "patrons", primary: true },
];

/** The main menu as the site shows it: News only while it is switched on (flag news_menu). */
export const mainNav = ({ news }: { news: boolean }): readonly NavItem[] =>
  MAIN_NAV.filter((item) => news || item.key !== "news");

export const ACCOUNT_NAV: NavItem = { href: routes.login, key: "signIn" };

/** Footer: legal and informational pages. */
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
