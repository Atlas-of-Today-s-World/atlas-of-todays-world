import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { cleanUp, createUser, requireDevAccounts, signIn, testEmail } from "./support/accounts";

/**
 * G2: rozepsaný článek přežije zavření stránky (záloha v prohlížeči) a koncept
 * jde ukázat komukoli bez účtu přes odkaz na náhled.
 */
requireDevAccounts();
test.afterAll(cleanUp);
test.describe.configure({ mode: "serial" });

const slug = `e2e-${randomUUID().slice(0, 8)}`;
const title = `E2E náhled ${slug}`;
let publisher: string;

test.beforeAll(async () => {
  publisher = testEmail("preview");
  await createUser(publisher, "publisher");
});

test("rozepsaný koncept se po znovuotevření nabídne k obnovení a náhled ho ukáže anonymovi", async ({
  page,
  browser,
}) => {
  await signIn(page, publisher, "/admin");
  await page.goto("/admin/obsah/novy");
  await page.getByLabel("Titulek").fill(title);
  await page.getByLabel("Adresa (slug)").fill(slug);
  await page.getByLabel("Kategorie").selectOption("Society");
  await page.getByRole("button", { name: "Vytvořit koncept" }).click();
  await expect(page).toHaveURL(/\/admin\/obsah\/[0-9a-f-]{36}/);

  // Změna bez uložení → záloha (interval 5 s) → po znovunačtení nabídka.
  await page.getByLabel("Perex").fill("Neuložený perex z e2e.");
  await page.waitForTimeout(6_000);
  await page.reload();
  await expect(page.getByText(/neuloženou rozepsanou verzi/)).toBeVisible();
  await page.getByRole("button", { name: "Obnovit" }).click();
  await expect(page.getByLabel("Perex")).toHaveValue("Neuložený perex z e2e.");
  await page.getByRole("button", { name: "Uložit změny" }).click();
  await expect(page.getByText(/neuloženou rozepsanou verzi/)).toHaveCount(0);

  // Odkaz na náhled otevře koncept i bez přihlášení.
  await page.getByRole("button", { name: "Vytvořit náhled" }).click();
  const link = page.getByLabel("Odkaz na náhled");
  await expect(link).toHaveValue(/\/preview\/[0-9a-f]{64}$/);
  const url = await link.inputValue();

  const anonymous = await (await browser.newContext()).newPage();
  await anonymous.goto(url);
  await expect(anonymous.getByRole("heading", { name: title, level: 1 })).toBeVisible();
  await expect(anonymous.getByRole("note")).toContainText("not published yet");

  // Zveřejněná adresa koncept neukáže a zkomolený token nic neprozradí. (Stránky
  // s loading.tsx streamují, takže „nenalezeno" je 200 + obsah not-found, ne 404.)
  for (const path of [`/news/${slug}`, url.replace(/.$/, (c) => (c === "0" ? "1" : "0"))]) {
    await anonymous.goto(path);
    await expect(anonymous.getByRole("heading", { name: title })).toHaveCount(0);
    await expect(anonymous.getByRole("note")).toHaveCount(0);
  }
});
