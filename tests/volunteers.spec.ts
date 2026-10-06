import { expect, test } from "@playwright/test";
import { requireDevAccounts, service, testEmail } from "./support/accounts";

/**
 * Volunteer editors: a visitor applies on /membership and the application is
 * stored for the accounts team (atlas-dev; removed again afterwards).
 */
requireDevAccounts();

test("a visitor applies as a volunteer editor on the membership page", async ({ page }) => {
  const email = testEmail("volunteer");
  try {
    await page.goto("/membership#volunteer");
    const section = page.getByRole("region", { name: "Write for the Atlas as a volunteer" });
    await section.getByLabel("Your name").fill("E2E Volunteer");
    await section.getByLabel("E-mail").fill(email);
    await section.getByLabel("What would you like to write about?").fill("The Sahel");
    await section.getByRole("checkbox").check();
    await section.getByRole("button", { name: "Apply as a volunteer editor" }).click();
    await expect(section.getByRole("status")).toContainText("We have your application");

    const { data } = await service
      .from("volunteer_applications")
      .select("name, topics, status")
      .eq("email", email);
    expect(data).toEqual([{ name: "E2E Volunteer", topics: "The Sahel", status: "new" }]);
  } finally {
    await service.from("volunteer_applications").delete().eq("email", email);
  }
});
