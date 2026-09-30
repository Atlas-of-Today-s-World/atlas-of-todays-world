/**
 * Jediná definice menu (ARCHITEKTURA 15.1, D4) — hlavička nad mapou (desktop
 * i mobil) a hlavička stránek bez globusu.
 */
export interface NavItem {
  href: string;
  label: string;
  /** Zvýrazněná položka (výzva k podpoře). */
  primary?: boolean;
  /** Nad globusem je místa málo: na desktopu se ukáže jen v plném menu. */
  compactHidden?: boolean;
}

export const MAIN_NAV: readonly NavItem[] = [
  { href: "/", label: "Map" },
  { href: "/news", label: "News", compactHidden: true },
  { href: "/about", label: "About" },
  { href: "/patrons", label: "Atlas Patrons", primary: true },
];

export const ACCOUNT_NAV: NavItem = { href: "/login", label: "Sign in" };

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
