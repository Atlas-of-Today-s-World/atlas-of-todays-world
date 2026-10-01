import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { cleanUp, createUser, requireDevAccounts, signIn, testEmail } from "./support/accounts";

/**
 * The main editorial flow (PLAN E9) with real roles in atlas-dev:
 * publisher writes and submits → content editor returns it with a note →
 * publisher fixes and resubmits → editor approves → the article is live.
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
  await page.goto("/admin/content?q=" + encodeURIComponent(slug));
  await page.getByRole("link", { name: title }).click();
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
}

async function confirm(page: Page, open: string, button: string) {
  await page.getByRole("button", { name: open }).click();
  await page.getByRole("dialog").getByRole("button", { name: button }).click();
}

test("publisher writes a draft and submits it for approval", async ({ page }) => {
  await signIn(page, publisher, "/admin");
  await page.goto("/admin/content/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("URL (slug)").fill(slug);
  await page.getByLabel("Category").selectOption("Society");
  await page.getByLabel(/^Summary( \*)?$/).fill("Krátký perex pro e2e test.");
  await page.getByRole("textbox", { name: "Article text" }).click();
  await page.keyboard.type("První odstavec napsaný v e2e testu.");
  await page.getByRole("button", { name: "Create draft" }).click();

  await expect(page).toHaveURL(/\/admin\/content\/[0-9a-f-]{36}/);
  await expect(page.getByText("Draft", { exact: true }).first()).toBeVisible();
  await confirm(page, "Submit for approval", "Submit");
  await expect(page.getByText("Pending approval", { exact: true }).first()).toBeVisible();
});

test("editor returns it with a note and the author sees it", async ({ page, browser }) => {
  await signIn(page, editor, "/admin");
  await page.goto("/admin/approvals");
  await page.getByRole("link", { name: title }).click();
  await page.getByLabel("Return to the author with a note").fill("Doplňte prosím zdroje.");
  await page.getByRole("button", { name: "Request changes" }).click();
  await expect(page.getByText("Returned to the author with a note.")).toBeVisible();

  const author = await (await browser.newContext()).newPage();
  await signIn(author, publisher, "/admin");
  await expect(author.getByText("Doplňte prosím zdroje.")).toBeVisible();
  await openEntry(author);
  await confirm(author, "Submit for approval", "Submit");
  await expect(author.getByText("Pending approval", { exact: true }).first()).toBeVisible();
});

test("publisher cannot approve own article, editor can and it goes live", async ({
  page,
  browser,
}) => {
  await signIn(page, publisher, "/admin");
  await openEntry(page);
  await expect(page.getByRole("button", { name: "Approve and publish" })).toHaveCount(0);

  const approver = await (await browser.newContext()).newPage();
  await signIn(approver, editor, "/admin");
  await openEntry(approver);
  await confirm(approver, "Approve and publish", "Publish");
  await expect(approver.getByText("Published", { exact: true }).first()).toBeVisible();

  await approver.goto(`/news/${slug}`);
  await expect(approver.getByRole("heading", { name: title })).toBeVisible();
  await expect(approver.getByText("První odstavec napsaný v e2e testu.")).toBeVisible();
});

test("row icons in Articles: editor unpublishes, then deletes the draft", async ({ page }) => {
  await signIn(page, editor, "/admin");
  await page.goto("/admin/content?q=" + encodeURIComponent(slug));
  const row = page.getByRole("row", { name: title });

  await row.getByRole("button", { name: "Unpublish" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Unpublish" }).click();
  await expect(row.getByText("Draft", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("row", { name: title })).toHaveCount(0);

  const gone = await page.goto(`/news/${slug}`);
  expect(gone?.status()).toBe(404);
});
