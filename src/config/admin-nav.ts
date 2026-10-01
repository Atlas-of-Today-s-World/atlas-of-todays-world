import {
  BadgeCheck,
  Brush,
  Globe2,
  Languages,
  LayoutDashboard,
  Layers,
  type LucideIcon,
  Map as MapIcon,
  Newspaper,
  PenLine,
  ShieldCheck,
  SignpostBig,
  Shapes,
  UserRound,
  Users,
} from "lucide-react";
import type { Permissions } from "@/features/auth/access";
import type { Section } from "@/features/auth/sections";

export interface AdminNavItem {
  href: string;
  label: string;
  /**
   * Permission section(s) (role_permissions.section); with several, any one is enough;
   * null = visible to every team member.
   */
  section: Section | readonly Section[] | null;
  icon: LucideIcon;
}

/** Single definition of the admin menu (ARCHITEKTURA 5.2); shows only sections with the "v" right. */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { href: "/admin", label: "Overview", section: null, icon: LayoutDashboard },
  { href: "/admin/content", label: "Articles", section: "news", icon: Newspaper },
  { href: "/admin/authors", label: "Author profiles", section: "news", icon: PenLine },
  { href: "/admin/approvals", label: "Article approvals", section: "approvals", icon: BadgeCheck },
  { href: "/admin/redirects", label: "URL redirects", section: "news", icon: SignpostBig },
  { href: "/admin/regions", label: "Regions & countries", section: "regions", icon: Globe2 },
  { href: "/admin/global-issues", label: "Country groups", section: "specials", icon: Shapes },
  { href: "/admin/data", label: "Map data layers", section: "layers", icon: Layers },
  {
    href: "/admin/translations",
    label: "Translations",
    section: ["regions", "specials", "layers"],
    icon: Languages,
  },
  { href: "/admin/areas", label: "Custom map areas", section: "areas", icon: MapIcon },
  { href: "/admin/appearance", label: "Map appearance", section: "appearance", icon: Brush },
  { href: "/admin/accounts", label: "Accounts & invitations", section: "users", icon: Users },
  { href: "/admin/roles", label: "Roles & permissions", section: "permissions", icon: ShieldCheck },
  { href: "/admin/members", label: "Patron memberships", section: "members", icon: UserRound },
];

/** Section icon by URL (tile in PageHeader) — same as in the menu. */
export function navIcon(href: string): LucideIcon | undefined {
  return ADMIN_NAV.find((item) => item.href === href)?.icon;
}

/** May the user see the menu item ("v" right in any of its sections)? */
export function navVisible(item: AdminNavItem, permissions: Permissions): boolean {
  if (item.section === null) return true;
  const sections = typeof item.section === "string" ? [item.section] : item.section;
  // Same as can(…, "v"); config is imported by the client menu too, hence no access.ts.
  return sections.some((section) => permissions[section]?.includes("v") ?? false);
}
