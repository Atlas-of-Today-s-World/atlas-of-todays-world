import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { cleanUp, createUser, requireDevAccounts, signIn, testEmail } from "./support/accounts";

/**
 * Hlavní redakční tok (PLAN E9) se skutečnými rolemi v atlas-dev:
 * publisher napíše a odešle → content editor vrátí s poznámkou → publisher
 * opraví a pošle znovu → editor schválí → článek je na webu.
 */
requireDevAccounts();
test.afterAll(cleanUp);
test.describe.configure({ mode: "serial" });

const slug = `e2e-${randomUUID().slice(0, 8)}`;
const title = `E2E článek ${slug}`;
let publisher: string;
let editor: string;

test.beforeAll(async () => {
  publisher = testEmail("writer");
  editor = testEmail("editor");
  await createUser(publisher, "publisher");
  await createUser(editor, "content-editor");
});

async function openEntry(page: Page) {
  await page.goto("/admin/obsah?q=" + encodeURIComponent(slug));
  await page.getByRole("link", { name: title }).click();
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
}

async function confirm(page: Page, open: string, button: string) {
  await page.getByRole("button", { name: open }).click();
  await page.getByRole("dialog").getByRole("button", { name: button }).click();
}

test("publisher napíše koncept a odešle ho ke schválení", async ({ page }) => {
  await signIn(page, publisher, "/admin");
  await page.goto("/admin/obsah/novy");
  await page.getByLabel("Titulek").fill(title);
  await page.getByLabel("Adresa (slug)").fill(slug);
  await page.getByLabel("Kategorie").selectOption("Society");
  await page.getByLabel("Perex").fill("Krátký perex pro e2e test.");
  await page.getByRole("textbox", { name: "Text článku" }).click();
  await page.keyboard.type("První odstavec napsaný v e2e testu.");
  await page.getByRole("button", { name: "Vytvořit koncept" }).click();

  await expect(page).toHaveURL(/\/admin\/obsah\/[0-9a-f-]{36}/);
  await expect(page.getByText("Koncept", { exact: true }).first()).toBeVisible();
  await confirm(page, "Odeslat ke schválení", "Odeslat");
  await expect(page.getByText("Čeká na schválení", { exact: true }).first()).toBeVisible();
});

test("editor ho vrátí s poznámkou a autor ji uvidí", async ({ page, browser }) => {
  await signIn(page, editor, "/admin");
  await page.goto("/admin/schvalovani");
  await page.getByRole("link", { name: title }).click();
  await page.getByLabel("Vrátit autorovi s poznámkou").fill("Doplňte prosím zdroje.");
  await page.getByRole("button", { name: "Vrátit k úpravě" }).click();
  await expect(page.getByText("Vráceno autorovi s poznámkou.")).toBeVisible();

  const author = await (await browser.newContext()).newPage();
  await signIn(author, publisher, "/admin");
  await expect(author.getByText("Doplňte prosím zdroje.")).toBeVisible();
  await openEntry(author);
  await confirm(author, "Odeslat ke schválení", "Odeslat");
  await expect(author.getByText("Čeká na schválení", { exact: true }).first()).toBeVisible();
});

test("publisher svůj článek neschválí, editor ano a článek je na webu", async ({
  page,
  browser,
}) => {
  await signIn(page, publisher, "/admin");
  await openEntry(page);
  await expect(page.getByRole("button", { name: "Schválit a zveřejnit" })).toHaveCount(0);

  const approver = await (await browser.newContext()).newPage();
  await signIn(approver, editor, "/admin");
  await openEntry(approver);
  await confirm(approver, "Schválit a zveřejnit", "Zveřejnit");
  await expect(approver.getByText("Zveřejněno", { exact: true }).first()).toBeVisible();

  await approver.goto(`/news/${slug}`);
  await expect(approver.getByRole("heading", { name: title })).toBeVisible();
  await expect(approver.getByText("První odstavec napsaný v e2e testu.")).toBeVisible();
});
