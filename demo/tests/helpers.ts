import { expect, type Page } from "@playwright/test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Sestavená ukázka; `npm run test:demo` ji před testy postaví znovu. */
export const DEMO = pathToFileURL(join(process.cwd(), "demo", "atlas.html")).href;

export const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 760;

/** Otevře ukázku na dané adrese a počká, až je stránka obsloužená. */
export async function open(page: Page, hash = "#/") {
  await page.goto(DEMO + hash);
  await page.waitForFunction(() => document.readyState === "complete" && !!document.getElementById("railScroll"));
}

/** Přejde na jinou adresu uvnitř už otevřené ukázky (jako klik na odkaz). */
export async function go(page: Page, hash: string) {
  await page.evaluate((target) => { location.hash = target; }, hash);
}

/** Přihlášení bez hesla: výběr účtu na přihlašovací stránce. */
export async function signIn(page: Page, name: string) {
  if (page.url().startsWith(DEMO)) await go(page, "#/login");
  else await open(page, "#/login");
  await page.locator(".login-list button", { hasText: name }).first().click();
  await expect(page.locator(".admin-shell")).toBeVisible();
}

/** Odhlásí a přihlásí jiný účet — bez ztráty dat v prohlížeči. */
export async function switchTo(page: Page, name: string) {
  await go(page, "#/login");
  await page.locator(".login-list button", { hasText: name }).first().click();
  await expect(page.locator(".admin-shell")).toBeVisible();
}

/**
 * Klik na sekci v menu administrace. Na telefonu je menu vysouvací, takže
 * se napřed otevře — přesně jak to udělá člověk.
 */
export async function adminNav(page: Page, tab: string) {
  if (isPhone(page)) await page.locator("[data-drawer-open]").click();
  await page.locator(`.admin-side [data-tab="${tab}"]`).click();
  await expect(page.locator(`.admin-side [data-tab="${tab}"]`)).toHaveAttribute("aria-current", "true");
}

/** Sekce, které má přihlášený v menu. */
export async function menuTabs(page: Page) {
  return page.locator(".admin-side [data-tab]").evaluateAll((items) => items.map((item) => (item as HTMLElement).dataset.tab));
}
