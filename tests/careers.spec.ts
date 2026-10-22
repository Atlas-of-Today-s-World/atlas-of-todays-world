import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  cleanUp,
  createUser,
  requireDevAccounts,
  service,
  signIn,
  testEmail,
} from "./support/accounts";

/**
 * Careers: the team adds a position in the admin, a visitor applies for it on
 * /careers with a CV, and the team sees the application and opens the CV
 * (atlas-dev; everything is removed again afterwards). The account gets a
 * temporary role with only the `users` section — the seeded roles that have it
 * require a second factor.
 */
requireDevAccounts();
test.describe.configure({ mode: "serial" });

const run = randomUUID().slice(0, 8);
const role = `e2e-careers-${run}`;
const slug = `e2e-position-${run}`;
const title = `E2E position ${run}`;
const applicant = testEmail("applicant");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
let staff = "";

// The form is limited per address; each run applies from its own documentation address.
const octet = () => 1 + Math.floor(Math.random() * 254);
test.use({ extraHTTPHeaders: { "x-forwarded-for": `198.18.${octet()}.${octet()}` } });

test.beforeAll(async () => {
  const { error } = await service
    .from("roles")
    .insert({ id: role, name: `E2E careers ${run}`, note: "Temporary role of an e2e test." });
  if (error) throw error;
  const { error: rightsError } = await service
    .from("role_permissions")
    .insert({ role_id: role, section: "users", actions: "vced" });
  if (rightsError) throw rightsError;
  staff = testEmail("careers");
  await createUser(staff, role);
});

test.afterAll(async () => {
  const { data } = await service
    .from("job_applications")
    .delete()
    .eq("email", applicant)
    .select("cv_path");
  if (data?.length) {
    await service.storage.from("job-applications").remove(data.map((row) => row.cv_path));
  }
  await service.from("job_positions").delete().eq("slug", slug);
  await cleanUp();
  await service.from("role_permissions").delete().eq("role_id", role);
  await service.from("roles").delete().eq("id", role);
});

test("the team opens a position in the admin", async ({ page }) => {
  await signIn(page, staff, "/admin/careers/new");
  await page.getByLabel("Job title").fill(title);
  await page.getByLabel("Address").fill(slug);
  await page.getByLabel("Summary").fill("A position made by an e2e test.");
  await page.getByLabel("Status").selectOption("open");
  await page.getByRole("button", { name: "Add position" }).click();
  await expect(page.getByRole("status")).toContainText("Position added");

  await page.goto("/careers");
  await expect(page.getByRole("link", { name: title })).toBeVisible();
});

test("a visitor applies with a CV", async ({ page }) => {
  await page.goto(`/careers/${slug}`);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  const form = page.getByRole("region", { name: "Apply for this position" });
  await form.getByLabel("Your name").fill("E2E Applicant");
  await form.getByLabel("E-mail").fill(applicant);
  await form.getByLabel("Your CV").setInputFiles({
    name: "page.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("<html>not a pdf</html>"),
  });
  await form.getByLabel("Your message").fill("First paragraph.\n\nSecond paragraph.");
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Send application" }).click();
  await expect(form.getByText("Attach the CV as a PDF, Word or OpenDocument file.")).toBeVisible();

  await form.getByLabel("Your CV").setInputFiles({
    name: "E2E CV.pdf",
    mimeType: "application/pdf",
    buffer: PDF,
  });
  await form.getByRole("button", { name: "Send application" }).click();
  await expect(form.getByRole("status")).toContainText("We have your application");

  const { data } = await service
    .from("job_applications")
    .select("name, message, cv_name, cv_size, position_title, status")
    .eq("email", applicant);
  expect(data).toEqual([
    {
      name: "E2E Applicant",
      message: "First paragraph.\n\nSecond paragraph.",
      cv_name: "E2E CV.pdf",
      cv_size: PDF.length,
      position_title: title,
      status: "new",
    },
  ]);
});

test("the team reads the application and opens the CV; nobody else can", async ({
  page,
  request,
}) => {
  const { data } = await service
    .from("job_applications")
    .select("id")
    .eq("email", applicant)
    .single();
  const cv = `/admin/careers/applications/${data!.id}/cv`;
  // Signed out: the proxy sends the request to sign-in, never to the file.
  const anonymous = await request.get(cv, { maxRedirects: 0 });
  expect(anonymous.headers().location ?? "").not.toContain("supabase.co");

  await signIn(page, staff, "/admin/careers/applications");
  await expect(page.getByText("E2E Applicant")).toBeVisible();
  const response = await page.request.get(cv);
  expect(response.ok()).toBe(true);
  expect(Buffer.from(await response.body()).equals(PDF)).toBe(true);
});
