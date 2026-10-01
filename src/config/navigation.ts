import type { Messages } from "@/features/i18n/messages";

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

export const MAIN_NAV: readonly NavItem[] = [
  { href: "/", key: "map" },
  { href: "/news", key: "news", compactHidden: true },
  { href: "/about", key: "about" },
  { href: "/patrons", key: "patrons", primary: true },
];

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
