import {
  BadgeCheck,
  Brush,
  Globe2,
  LayoutDashboard,
  Layers,
  type LucideIcon,
  Map as MapIcon,
  Newspaper,
  ShieldCheck,
  SignpostBig,
  Shapes,
  UserRound,
  Users,
} from "lucide-react";
import type { Section } from "@/features/auth/sections";

export interface AdminNavItem {
  href: string;
  label: string;
  /** Sekce oprávnění (role_permissions.section); null = vidí každý člen týmu. */
  section: Section | null;
  icon: LucideIcon;
}

/** Jediná definice menu administrace (ARCHITEKTURA 5.2); zobrazí se jen sekce s právem „v". */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { href: "/admin", label: "Přehled", section: null, icon: LayoutDashboard },
  { href: "/admin/obsah", label: "Novinky a hesla", section: "news", icon: Newspaper },
  { href: "/admin/schvalovani", label: "Schvalování", section: "approvals", icon: BadgeCheck },
  { href: "/admin/presmerovani", label: "Přesměrování", section: "news", icon: SignpostBig },
  { href: "/admin/regiony", label: "Regiony a země", section: "regions", icon: Globe2 },
  { href: "/admin/global-issues", label: "Global Issues", section: "specials", icon: Shapes },
  { href: "/admin/data", label: "Datové vrstvy", section: "layers", icon: Layers },
  { href: "/admin/oblasti", label: "Mapové oblasti", section: "areas", icon: MapIcon },
  { href: "/admin/vzhled", label: "Vzhled mapy", section: "appearance", icon: Brush },
  { href: "/admin/ucty", label: "Účty a pozvánky", section: "users", icon: Users },
  { href: "/admin/role", label: "Role a práva", section: "permissions", icon: ShieldCheck },
  { href: "/admin/clenove", label: "Členové", section: "members", icon: UserRound },
];
