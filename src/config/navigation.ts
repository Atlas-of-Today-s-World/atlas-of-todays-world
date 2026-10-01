import type { Messages } from "@/features/i18n/messages";

/**
 * Jediná definice menu (ARCHITEKTURA 15.1, D4) — hlavička nad mapou (desktop
 * i mobil) a hlavička stránek bez globusu.
 */
export interface NavItem {
  href: string;
  /** Klíč textu v messages/<jazyk>.json → `nav`. */
  key: keyof Messages["nav"];
  /** Zvýrazněná položka (výzva k podpoře). */
  primary?: boolean;
  /** Nad globusem je místa málo: na desktopu se ukáže jen v plném menu. */
  compactHidden?: boolean;
}

export const MAIN_NAV: readonly NavItem[] = [
  { href: "/", key: "map" },
  { href: "/news", key: "news", compactHidden: true },
  { href: "/about", key: "about" },
  { href: "/patrons", key: "patrons", primary: true },
];

export const ACCOUNT_NAV: NavItem = { href: "/login", key: "signIn" };

/** Patička: právní a informační stránky. */
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
