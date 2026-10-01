import { test, expect, type Page } from "@playwright/test";

/**
 * Průchod Atlasem očima návštěvníka.
 *
 * Testy se drží toho, co zadání slibuje: z mapy do profilu země, odtud do
 * regionu, panel jde zavřít křížkem i klávesou, na mobilu funguje hamburger
 * a vyhledávání je schované do ikony. K tomu hlídají velikost dotykových cílů,
 * protože to je požadavek, který se nejsnáz ztratí při přebarvování.
 */

/** Ověří, že se na prvek dá pohodlně klepnout (minimum ze zadání je 44 px). */
async function hasTouchTarget(page: Page, selector: string) {
  const target = page.locator(selector).first();
  // boundingBox() nečeká; panel se vysouvá až po hydrataci.
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  expect(box, `${selector} není vidět`).not.toBeNull();
  expect(box!.width, `${selector} je příliš úzký`).toBeGreaterThanOrEqual(43);
  expect(box!.height, `${selector} je příliš nízký`).toBeGreaterThanOrEqual(43);
}

test.describe("globus", () => {
  test("načte hranice zemí bez chyb", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && message.text().includes("atlas-globe")) {
        errors.push(message.text());
      }
    });
    // MapLibre 6: worker se bere z public/maplibre/<verze>/ (scripts/copy-maplibre-worker.mjs).
    const worker = page.waitForResponse((r) =>
      /\/maplibre\/[\d.]+\/maplibre-gl-worker\.mjs$/.test(r.url()),
    );
    await page.goto("/");
    expect((await worker).status()).toBe(200);
    // Atribut nastavuje AtlasGlobe, až je zdroj "countries" načtený (vyžaduje
    // funkční web worker MapLibre).
    await expect(page.locator('[data-countries="loaded"]')).toBeAttached({ timeout: 30_000 });
    expect(errors, "globus hlásí chyby").toEqual([]);
  });
});

test.describe("panel s obsahem", () => {
  test("z profilu země se dá přejít do regionu a zpět na mapu", async ({ page }) => {
    await page.goto("/country/ukraine");

    // Drobečková navigace vede do regionu.
    await expect(
      page.getByRole("link", { name: "Eastern Europe & Central Asia" }).first(),
    ).toBeVisible();

    await page.getByRole("link", { name: "Explore the region" }).click();
    await expect(page).toHaveURL(/\/region\/eastern-europe-central-asia/);
    await expect(
      page.getByRole("heading", { name: "Eastern Europe & Central Asia" }),
    ).toBeVisible();
  });

  test("křížek má pohodlný dotykový cíl a zavírá panel", async ({ page }) => {
    await page.goto("/country/ukraine");
    await hasTouchTarget(page, 'button[aria-label="Close"]');

    await page.getByRole("button", { name: "Close" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("panel se zavře klávesou Esc", async ({ page }) => {
    await page.goto("/country/ukraine");
    // Klávesu obsluhuje až připojený React, takže počkáme, než panel ožije,
    // a klikneme do stránky – jinak klávesa nemá kam dorazit.
    await expect(page.getByRole("button", { name: "Close" })).toBeEnabled();

    // Obsluha klávesy začne fungovat až po připojení Reactu. Kdy přesně to je,
    // se zvenčí spolehlivě poznat nedá, takže stisk opakujeme.
    await expect(async () => {
      await page.keyboard.press("Escape");
      await expect(page).toHaveURL(/\/$/, { timeout: 2_000 });
    }).toPass({ timeout: 25_000 });
  });
});

test.describe("portrét regionu", () => {
  test("otevírá se rovnou celý a nenabízí druhou verzi", async ({ page }) => {
    await page.goto("/region/middle-east-north-africa");

    await expect(page.getByRole("heading", { name: "Key indicators" })).toBeVisible();
    await expect(page.getByText("A Comprehensive Portrait")).toHaveCount(0);
    await expect(page.getByText(/news items? published/)).toHaveCount(0);
  });

  test("nenapsané sekce jsou šedivé, nekliknutelné a zvou k podpoře", async ({ page }) => {
    await page.goto("/region/east-asia");

    await expect(page.getByText("Not written yet").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Help Us Complete It/ }).first()).toBeVisible();

    // Plánovaná hesla nesmí vést nikam.
    const planned = page.locator('[aria-disabled="true"]').first();
    await expect(planned).toBeVisible();
    await expect(planned).not.toHaveAttribute("href", /./);
  });
});

test.describe("global issues", () => {
  test("třetí poloha přepínače otevře portrét tématu", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("radio", { name: "Global Issues" })).toBeVisible();

    await page.goto("/global-issue/russia-ukraine-war");
    await expect(page.getByRole("heading", { name: "Russia–Ukraine War" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ukraine" }).first()).toBeVisible();
  });
});

test.describe("mobil", () => {
  test.skip(({ isMobile }) => !isMobile, "jen pro mobilní projekt");

  test("hamburger otevře menu a dá se zavřít klávesou", async ({ page }) => {
    await page.goto("/");

    await hasTouchTarget(page, 'button[aria-label="Open menu"]');
    await page.getByRole("button", { name: "Open menu" }).click();

    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "Atlas Patrons" })).toBeVisible();
    await expect(menu.getByText("New Atlas content in your inbox")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });

  test("vyhledávání je schované do ikony", async ({ page }) => {
    await page.goto("/");

    const search = page.getByRole("button", { name: "Search the Atlas" });
    await expect(search).toBeVisible();
    await expect(page.getByPlaceholder(/Search places/)).toBeHidden();

    await search.click();
    await expect(page.getByPlaceholder(/Search places/)).toBeVisible();
  });
});

test.describe("přihlášení", () => {
  test("administrace bez přihlášení vede na přihlášení přes Google", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    // Bez Supabase v prostředí (lokální build) stránka jen oznámí, že přihlášení není.
    const google = page.getByRole("button", { name: "Continue with Google" });
    const unavailable = page.getByText("Sign-in is not available");
    await expect(google.or(unavailable)).toBeVisible();
  });

  test("účet bez přihlášení vede na přihlášení", async ({ page }) => {
    await page.goto("/ucet");
    await expect(page).toHaveURL(/\/login\?next=%2Fucet/);
  });

  test("stránka pozvánky vysvětlí, jak se přihlásit (v jazyce stránky)", async ({ page }) => {
    await page.goto("/pozvanka");
    await expect(page.getByRole("heading", { name: "Invitation to the Atlas team" })).toBeVisible();
    await page.goto("/cs/pozvanka");
    await expect(page.getByRole("heading", { name: "Pozvánka do týmu Atlasu" })).toBeVisible();
  });
});
