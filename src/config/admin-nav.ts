import {
  BadgeCheck,
  Brush,
  Globe2,
  HandHeart,
  House,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  type LucideIcon,
  Map as MapIcon,
  Newspaper,
  PenLine,
  ShieldCheck,
  SignpostBig,
  ToggleRight,
  Shapes,
  UserRound,
  Users,
} from "lucide-react";
import { adminRoutes } from "@/config/routes";
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
  { href: adminRoutes.overview, label: "Overview", section: null, icon: LayoutDashboard },
  { href: adminRoutes.content.list, label: "Articles", section: "news", icon: Newspaper },
  { href: adminRoutes.authors.list, label: "Author profiles", section: "news", icon: PenLine },
  {
    href: adminRoutes.topicTemplates.list,
    label: "Topic templates",
    section: "news",
    icon: LayoutGrid,
  },
  {
    href: adminRoutes.approvals,
    label: "Article approvals",
    section: "approvals",
    icon: BadgeCheck,
  },
  {
    href: adminRoutes.redirects.list,
    label: "URL redirects",
    section: ["news", "site"],
    icon: SignpostBig,
  },
  { href: adminRoutes.homePage, label: "Home page", section: "news", icon: House },
  {
    href: adminRoutes.regions.list,
    label: "Regions & countries",
    section: "regions",
    icon: Globe2,
  },
  {
    href: adminRoutes.globalIssues.list,
    label: "Global issues",
    section: "specials",
    icon: Shapes,
  },
  { href: adminRoutes.data.list, label: "Map data layers", section: "layers", icon: Layers },
  { href: adminRoutes.areas.list, label: "Custom map areas", section: "areas", icon: MapIcon },
  { href: adminRoutes.appearance, label: "Map appearance", section: "appearance", icon: Brush },
  {
    href: adminRoutes.switches.list,
    label: "Switches & maintenance",
    section: ["permissions", "site"],
    icon: ToggleRight,
  },
  {
    href: adminRoutes.accounts.list,
    label: "Accounts & invitations",
    section: "users",
    icon: Users,
  },
  { href: adminRoutes.volunteers, label: "Volunteer editors", section: "users", icon: HandHeart },
  {
    href: adminRoutes.roles,
    label: "Roles & permissions",
    section: "permissions",
    icon: ShieldCheck,
  },
  { href: adminRoutes.members, label: "Patron memberships", section: "members", icon: UserRound },
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
