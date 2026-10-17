import { describe, expect, it } from "vitest";
import { isKnownSitePath } from "./pages";
import { navHref, NavItemInput, NavItemUpdate } from "./schema";

const ID = "00000000-0000-4000-8000-000000000001";

const form = (overrides: Record<string, unknown> = {}) => ({
  menu: "main",
  label: "About",
  href: "/about",
  visible: "on",
  ...overrides,
});

describe("navHref", () => {
  it("accepts a known path on this site (with a query or anchor) or https://", () => {
    for (const href of [
      "/",
      "/about",
      "/entries",
      "/country/ukraine",
      "/view/hdi#hun",
      "/search?q=water",
      "/membership/checkout",
      "https://example.org/",
      "https://shop.example.org/atlas?x=1",
    ]) {
      expect(navHref.safeParse(href).success, href).toBe(true);
    }
    expect(navHref.parse("  /about  ")).toBe("/about");
  });

  it("refuses protocol-relative, script and other schemes, like the DB CHECK", () => {
    for (const href of [
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "data:text/html,hi",
      "http://example.org/",
      "https://",
      "mailto:info@example.org",
      "about",
      "",
      "/About",
      "/with space",
      `/${"x".repeat(500)}`,
    ]) {
      expect(navHref.safeParse(href).success, href).toBe(false);
    }
  });

  it("refuses a path to a section the site doesn't have, with one message", () => {
    const result = navHref.safeParse("/countires");
    expect(result.success).toBe(false);
    expect(result.error?.issues).toHaveLength(1);
    expect(result.error?.issues[0]?.message).toMatch(/no such page/);
    // The administration and private previews are not menu targets.
    expect(isKnownSitePath("/admin")).toBe(false);
    expect(isKnownSitePath("/preview/x")).toBe(false);
    expect(navHref.safeParse("javascript:x").error?.issues).toHaveLength(1);
  });
});

describe("NavItemInput", () => {
  it("parses the form: checkboxes, no switch, a switch", () => {
    expect(NavItemInput.parse(form())).toEqual({
      menu: "main",
      label: "About",
      href: "/about",
      visible: true,
      is_primary: false,
      compact_hidden: false,
      requires_flag: null,
    });
    expect(NavItemInput.parse(form({ requires_flag: "news_menu" })).requires_flag).toBe(
      "news_menu",
    );
  });

  it("refuses an unknown menu, switch, an empty or too long label", () => {
    expect(NavItemInput.safeParse(form({ menu: "account" })).success).toBe(false);
    expect(NavItemInput.safeParse(form({ requires_flag: "maintenance" })).success).toBe(false);
    expect(NavItemInput.safeParse(form({ label: "  " })).success).toBe(false);
    expect(NavItemInput.safeParse(form({ label: "x".repeat(61) })).success).toBe(false);
  });

  it("drops the main-menu styles from a footer link (DB nav_items_main_only_styles)", () => {
    expect(
      NavItemInput.parse(form({ menu: "legal", is_primary: "on", compact_hidden: "on" })),
    ).toMatchObject({ is_primary: false, compact_hidden: false });
    expect(NavItemInput.parse(form({ is_primary: "on", compact_hidden: "on" }))).toMatchObject({
      is_primary: true,
      compact_hidden: true,
    });
  });

  it("an update needs the item's id", () => {
    expect(NavItemUpdate.safeParse(form()).success).toBe(false);
    expect(NavItemUpdate.safeParse(form({ id: "1" })).success).toBe(false);
    expect(NavItemUpdate.parse(form({ id: ID })).id).toBe(ID);
  });
});
