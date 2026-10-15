import { LEGAL_NAV, MAIN_NAV, type NavFlag, type NavItem, type NavMenu } from "@/config/navigation";
import { DEFAULT_LOCALE } from "@/features/i18n/config";
import { getMessages } from "@/features/i18n/messages";
import type { Flags } from "@/features/flags/queries";
import type { Tables } from "@/lib/db/types.gen";
import { safeUrl } from "@/lib/security/urls";

/**
 * Site menus (Admin → Site menus; table nav_items). Plain data and mappers,
 * no server dependency: the public read is in queries.ts, the admin's in
 * editorial.ts.
 *
 * The defaults are the items the code had before the admin took them over —
 * the same items and labels the migration seeds — so a failed read shows
 * exactly what the site showed before.
 */

/** One menu item as the header and the footer draw it. */
export interface NavLink {
  id: string;
  label: string;
  href: string;
  /** An https:// address (opens in a new tab); otherwise a path on this site. */
  external: boolean;
  /** The highlighted pill ("Atlas Patrons"). */
  primary: boolean;
  /** Over the globe only in the full menu (desktop). */
  compactHidden: boolean;
}

/** The menus the public site shows, already filtered by the feature switches. */
export interface Navigation {
  main: readonly NavLink[];
  legal: readonly NavLink[];
}

/** The columns the public site reads (anon has a grant on exactly these and a few more). */
export const NAV_COLUMNS = "id, menu, label, href, is_primary, compact_hidden, requires_flag";

export type NavRow = Pick<
  Tables<"nav_items">,
  "id" | "menu" | "label" | "href" | "is_primary" | "compact_hidden" | "requires_flag"
>;

/** The switches an item can follow, by the flag key the DB stores. */
export type NavSwitches = Pick<Flags, "newsMenu" | "newsletter">;

const SWITCH: Record<NavFlag, keyof NavSwitches> = {
  news_menu: "newsMenu",
  newsletter: "newsletter",
};

/** Is the item's switch on (no switch = always)? An unknown key hides the item. */
export function flagAllows(flag: string | null, switches: NavSwitches): boolean {
  if (!flag) return true;
  const key = SWITCH[flag as NavFlag];
  return key ? switches[key] : false;
}

/** https:// = a link off the site (the DB allows only that or a path on this site). */
export const isExternal = (href: string) => href.startsWith("https://");

function defaultRows(menu: NavMenu, items: readonly NavItem[]): NavRow[] {
  const nav = getMessages(DEFAULT_LOCALE).nav;
  return items.map((item, index) => ({
    id: `default-${menu}-${index}`,
    menu,
    label: nav[item.key],
    href: item.href,
    is_primary: item.primary ?? false,
    compact_hidden: item.compactHidden ?? false,
    requires_flag: item.flag ?? null,
  }));
}

/** The built-in menus as rows (fallback when nav_items can't be read). */
export const NAV_DEFAULT_ROWS: readonly NavRow[] = [
  ...defaultRows("main", MAIN_NAV),
  ...defaultRows("legal", LEGAL_NAV),
];

/**
 * Rows (already in their order) → the menus the site shows: items whose
 * switch is off are left out, and so is a row whose address isn't safe
 * (the DB CHECK allows only a site path or https://; safeUrl guards the page anyway).
 */
export function navigationFrom(rows: readonly NavRow[], switches: NavSwitches): Navigation {
  const menu = (which: NavMenu): NavLink[] =>
    rows.flatMap((row) => {
      if (row.menu !== which || !flagAllows(row.requires_flag, switches)) return [];
      const href = safeUrl(row.href);
      if (!href) return [];
      const external = isExternal(href);
      return [
        {
          id: row.id,
          label: row.label,
          href,
          external,
          primary: which === "main" && row.is_primary,
          compactHidden: which === "main" && row.compact_hidden,
        },
      ];
    });
  return { main: menu("main"), legal: menu("legal") };
}
