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
   * Sekce oprávnění (role_permissions.section); více sekcí = stačí kterákoli;
   * null = vidí každý člen týmu.
   */
  section: Section | readonly Section[] | null;
  icon: LucideIcon;
}

/** Jediná definice menu administrace (ARCHITEKTURA 5.2); zobrazí se jen sekce s právem „v". */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { href: "/admin", label: "Přehled", section: null, icon: LayoutDashboard },
  { href: "/admin/obsah", label: "Novinky a hesla", section: "news", icon: Newspaper },
  { href: "/admin/autori", label: "Autoři", section: "news", icon: PenLine },
  { href: "/admin/schvalovani", label: "Schvalování", section: "approvals", icon: BadgeCheck },
  { href: "/admin/presmerovani", label: "Přesměrování", section: "news", icon: SignpostBig },
  { href: "/admin/regiony", label: "Regiony a země", section: "regions", icon: Globe2 },
  { href: "/admin/global-issues", label: "Global Issues", section: "specials", icon: Shapes },
  { href: "/admin/data", label: "Datové vrstvy", section: "layers", icon: Layers },
  {
    href: "/admin/preklady",
    label: "Překlady",
    section: ["regions", "specials", "layers"],
    icon: Languages,
  },
  { href: "/admin/oblasti", label: "Mapové oblasti", section: "areas", icon: MapIcon },
  { href: "/admin/vzhled", label: "Vzhled mapy", section: "appearance", icon: Brush },
  { href: "/admin/ucty", label: "Účty a pozvánky", section: "users", icon: Users },
  { href: "/admin/role", label: "Role a práva", section: "permissions", icon: ShieldCheck },
  { href: "/admin/clenove", label: "Členové", section: "members", icon: UserRound },
];

/** Smí položku menu vidět (právo „v" v některé z jejích sekcí)? */
export function navVisible(item: AdminNavItem, permissions: Permissions): boolean {
  if (item.section === null) return true;
  const sections = typeof item.section === "string" ? [item.section] : item.section;
  // Stejné jako can(…, "v"); config importuje i klientské menu, proto bez access.ts.
  return sections.some((section) => permissions[section]?.includes("v") ?? false);
}
