import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { cleanUp, createUser, requireDevAccounts, signIn, testEmail } from "./support/accounts";

/**
 * G2: an unsaved article survives closing the page (browser backup) and a draft
 * can be shown to anyone without an account via a preview link.
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

test("unsaved draft is offered for restore on reopen and the preview shows it to anonymous users", async ({
  page,
  browser,
}) => {
  await signIn(page, publisher, "/admin");
  await page.goto("/admin/content/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("URL (slug)").fill(slug);
  await page.getByLabel("Category").selectOption("Society");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page).toHaveURL(/\/admin\/content\/[0-9a-f-]{36}/);

  // Unsaved change → backup (5 s interval) → restore offer after reload.
  await page.getByLabel(/^Summary( \*)?$/).fill("Neuložený perex z e2e.");
  await page.waitForTimeout(6_000);
  await page.reload();
  await expect(page.getByText(/You have an unsaved draft/)).toBeVisible();
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByLabel(/^Summary( \*)?$/)).toHaveValue("Neuložený perex z e2e.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/You have an unsaved draft/)).toHaveCount(0);

  // The preview link opens the draft even without signing in.
  await page.getByRole("button", { name: "Create preview" }).click();
  const link = page.getByLabel("Preview link");
  await expect(link).toHaveValue(/\/preview\/[0-9a-f]{64}$/);
  const url = await link.inputValue();

  const anonymous = await (await browser.newContext()).newPage();
  await anonymous.goto(url);
  await expect(anonymous.getByRole("heading", { name: title, level: 1 })).toBeVisible();
  await expect(anonymous.getByRole("note")).toContainText("not published yet");

  // The public URL does not show the draft and a mangled token reveals nothing. (Pages
  // with loading.tsx stream, so "not found" is 200 + not-found content, not 404.)
  for (const path of [`/news/${slug}`, url.replace(/.$/, (c) => (c === "0" ? "1" : "0"))]) {
    await anonymous.goto(path);
    await expect(anonymous.getByRole("heading", { name: title })).toHaveCount(0);
    await expect(anonymous.getByRole("note")).toHaveCount(0);
  }
});
