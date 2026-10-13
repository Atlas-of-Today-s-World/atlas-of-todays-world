import { z } from "zod";
import { NAV_FLAGS, NAV_MENUS } from "@/config/navigation";
import { checkbox, requiredText, uuid } from "@/lib/validation/common";
import { isKnownSitePath } from "./pages";

/**
 * Admin form of a menu item. Limits and shapes match the CHECKs in
 * 20261013000270_navigation_items.sql; on top of them a site path must start
 * with a section the site has (a typo is caught at the field).
 */

/** A path on this site: lowercase, no spaces, never "//host" (protocol-relative). */
const SITE_PATH = /^\/[a-z0-9/_#?=&.-]*$/;
const HTTPS = /^https:\/\/[^\s/?#]+\S*$/;

export const navHref = z
  .string()
  .trim()
  .max(500, "At most 500 characters.")
  .refine((value) => HTTPS.test(value) || (SITE_PATH.test(value) && !value.startsWith("//")), {
    message: "A path on this site starting with / (lowercase, no spaces) or an https:// address.",
    abort: true,
  })
  .refine(
    (value) => HTTPS.test(value) || isKnownSitePath(value),
    "This site has no such page — pick one of the suggestions or check the address.",
  );

/** Empty select = no switch. */
const requiresFlag = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.enum(NAV_FLAGS, { message: "Unknown switch." }).nullable(),
);

const fields = {
  menu: z.enum(NAV_MENUS, { message: "Pick a menu." }),
  label: requiredText(60),
  href: navHref,
  visible: checkbox,
  is_primary: checkbox,
  compact_hidden: checkbox,
  requires_flag: requiresFlag,
};

/** The pill and "full menu only" exist only in the main menu (DB: nav_items_main_only_styles). */
const mainOnlyStyles = <T extends { menu: string; is_primary: boolean; compact_hidden: boolean }>(
  item: T,
): T => (item.menu === "main" ? item : { ...item, is_primary: false, compact_hidden: false });

export const NavItemInput = z.object(fields).transform(mainOnlyStyles);

/** Editing: the same fields plus the item's id (the menu is posted but not changed). */
export const NavItemUpdate = z.object({ ...fields, id: uuid }).transform(mainOnlyStyles);
