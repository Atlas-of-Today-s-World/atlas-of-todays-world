import { expect, test } from "@playwright/test";
import { adminNav, go, isPhone, menuTabs, open, signIn, switchTo } from "./helpers";

/**
 * Administrace ukázky: kdo co vidí, přehled, nastavení webu, vlastní účet
 * a cesta článku od autora přes vrácení s důvodem až na globus.
 */

test.describe("sign-in and roles", () => {
  test("admin lands on the overview and sees every section", async ({ page }) => {
    await signIn(page, "Amara Okonjo");
    await expect(page.locator(".hello h2")).toContainText("Amara");
    expect(await menuTabs(page)).toEqual([
      "overview", "news", "approvals", "areas", "regions", "metrics", "appearance", "groups",
      "users", "members", "permissions", "settings", "account",
    ]);
    await expect(page.locator("[data-kpi]")).toHaveCount(6);
  });

  test("a publisher sees only its own corner", async ({ page }) => {
    await signIn(page, "Ravi Shankar Nair");
    const tabs = await menuTabs(page);
    expect(tabs).toEqual(expect.arrayContaining(["overview", "news", "regions", "metrics", "account"]));
    for (const closed of ["settings", "users", "permissions", "members", "approvals"]) expect(tabs).not.toContain(closed);
    // Ani přímá adresa do cizí sekce nepustí.
    await go(page, "#/admin/settings");
    await expect(page.locator('.admin-side [aria-current="true"]')).not.toHaveAttribute("data-tab", "settings");
    await expect(page.locator(".settings-layout")).toHaveCount(0);
  });

  test("a blocked account cannot sign in", async ({ page }) => {
    await open(page, "#/login");
    // Tlačítko je aria-disabled, ale klik jde: ukáže, proč přihlášení nejde.
    await page.locator(".login-list button", { hasText: "Kwame Mensah" }).click({ force: true });
    await expect(page.locator("#login")).toContainText("is blocked and cannot sign in");
    await expect(page.locator(".admin-shell")).toHaveCount(0);
  });

  test("granting a section in the matrix opens it, read-only", async ({ page }) => {
    await signIn(page, "Amara Okonjo");
    await adminNav(page, "permissions");
    await page.locator('[data-perm="content-editor|settings|v"]').check();
    await switchTo(page, "Lena Fischer");
    await adminNav(page, "settings");
    await expect(page.locator(".settings-main")).toContainText("only an admin can change them");
    await expect(page.locator("#set-siteName")).toBeDisabled();
    await expect(page.locator("#setSave")).toBeHidden();
  });
});

test.describe("overview", () => {
  test("tiles lead to the sections their numbers come from", async ({ page }) => {
    await signIn(page, "Amara Okonjo");
    await expect(page.locator('[data-kpi="accounts"] .k-val')).toHaveText("18");
    await page.locator('[data-kpi="accounts"]').click();
    await expect(page.locator('.admin-side [data-tab="users"]')).toHaveAttribute("aria-current", "true");
    await expect(page).toHaveURL(/#\/admin\/users$/);
  });

  test("the reading chart is drawn and described", async ({ page }) => {
    await signIn(page, "Amara Okonjo");
    const chart = page.locator('[data-kpi="reading"] svg.kpi-spark');
    await expect(chart).toBeVisible();
    await expect(chart).toHaveAttribute("aria-label", /last 30 days/);
    await expect(page.locator(".bar-row")).toHaveCount(9);
  });

  test("the browser back button returns to the previous section", async ({ page }) => {
    await signIn(page, "Amara Okonjo");
    await adminNav(page, "users");
    await adminNav(page, "settings");
    await page.goBack();
    await expect(page.locator('.admin-side [data-tab="users"]')).toHaveAttribute("aria-current", "true");
  });

  test("an approver without work is told so", async ({ page }) => {
    await signIn(page, "Mei-Lin Chen");
    await expect(page.locator(".todo")).toContainText("You are all caught up");
    await expect(page.locator('[data-kpi="approvals"] .k-val')).toHaveText("0");
  });
});

test.describe("site settings", () => {
  test("changes wait in a save bar and can be discarded", async ({ page }) => {
    await signIn(page, "Amara Okonjo");
    await adminNav(page, "settings");
    await expect(page.locator("#setSave")).toBeHidden();
    await page.locator("#set-siteName").fill("Atlas Test Edition");
    await expect(page.locator("#setSave")).toBeVisible();
    if (!isPhone(page)) await expect(page.locator('.admin-side [data-tab="settings"] .nav-dot')).toBeVisible();
    await page.locator("#setDiscard").click();
    await expect(page.locator("#set-siteName")).toHaveValue("Atlas of Today’s World");
    await expect(page.locator("#setSave")).toBeHidden();
  });

  test("an empty site name or a bad address is refused", async ({ page }) => {
    await signIn(page, "Amara Okonjo");
    await adminNav(page, "settings");
    await page.locator("#set-siteName").fill("   ");
    await page.locator("#set-contactEmail").fill("not-an-address");
    await page.locator("#setSaveBtn").click();
    await expect(page.locator("#setError")).toContainText("cannot be empty");
    await expect(page.locator("#setError")).toContainText("not an address");
    await expect(page.locator("#setSave")).toBeVisible();
  });

  test("saved settings drive the public globe", async ({ page }) => {
    await signIn(page, "Amara Okonjo");
    await adminNav(page, "settings");
    await page.locator('[data-stab="map"]').click();
    await page.locator("#set-defaultLayer").selectOption("hdi");
    await page.locator('[data-set-choice="homeView"][data-value="country"]').click();
    await page.locator("#set-homeCountry").selectOption("JPN");
    await page.locator('[data-set-bool="labels"]').click();
    await page.locator("#set-hotCount").fill("3");
    await page.locator("#setSaveBtn").click();
    await expect(page.locator("#toast")).toContainText("Settings saved");

    // Výchozí vrstva platí při otevření Atlasu, proto nové načtení stránky.
    await go(page, "#/");
    await page.reload();
    await expect(page.locator("#viewLabel")).toContainText("HDI");
    await expect(page.locator("#regionLabels")).toBeHidden();
    await page.locator(isPhone(page) ? "#dockHot" : "#hotBtn").click();
    await expect(page.locator("#hotItems li")).toHaveCount(3);
  });

  test("the site name changes in the header after saving", async ({ page }) => {
    await signIn(page, "Amara Okonjo");
    await adminNav(page, "settings");
    await page.locator("#set-siteName").fill("Atlas Test Edition");
    await page.locator("#setSaveBtn").click();
    await expect(page.locator(".admin-side .wordmark")).toHaveText("Atlas Test Edition");
    await go(page, "#/");
    await expect(page.locator("header .wordmark")).toHaveText("Atlas Test Edition");
  });

  test("the maintenance notice reaches visitors and the overview", async ({ page }) => {
    await signIn(page, "Amara Okonjo");
    await adminNav(page, "settings");
    await page.locator('[data-stab="data"]').click();
    await page.locator('[data-set-bool="maintenance"]').click();
    await page.locator("#set-maintenanceText").fill("Data refresh until 14:00 CET.");
    await page.locator("#setSaveBtn").click();

    await adminNav(page, "overview");
    await expect(page.locator(".todo")).toContainText("The maintenance notice is on");

    await go(page, "#/");
    await expect(page.locator("#siteNotice")).toBeVisible();
    await expect(page.locator("#siteNotice")).toContainText("Data refresh until 14:00 CET.");
  });

  test("every settings change lands in the audit log", async ({ page }) => {
    await signIn(page, "Amara Okonjo");
    await adminNav(page, "settings");
    await page.locator('[data-stab="content"]').click();
    await page.locator("#set-wordsPerMinute").fill("300");
    await page.locator("#setSaveBtn").click();
    await adminNav(page, "permissions");
    await page.locator('[data-ptab="security"]').click();
    await expect(page.locator(".audit")).toContainText("Changed site settings: reading speed");
  });

  test("the review rules the database enforces cannot be switched off", async ({ page }) => {
    await signIn(page, "Amara Okonjo");
    await adminNav(page, "settings");
    await page.locator('[data-stab="content"]').click();
    await expect(page.locator('[data-set-bool="requireApproval"]')).toBeDisabled();
    await expect(page.locator('[data-set-bool="requireApproval"]')).toHaveAttribute("aria-checked", "true");
    await expect(page.locator('[data-set-bool="noteOnSendBack"]')).toBeDisabled();
  });

  test("integrations list the keys by name and never their values", async ({ page }) => {
    await signIn(page, "Amara Okonjo");
    await adminNav(page, "settings");
    await page.locator('[data-stab="integrations"]').click();
    await expect(page.locator("[data-integration]")).toHaveCount(5);
    await expect(page.locator('[data-integration="supabase"]')).toContainText("SUPABASE_SERVICE_ROLE_KEY");
    await expect(page.locator(".integrations input")).toHaveCount(0);
  });

  test("reset asks twice and then starts from scratch", async ({ page }) => {
    await signIn(page, "Amara Okonjo");
    await adminNav(page, "settings");
    await page.locator('[data-stab="data"]').click();
    const reset = page.locator("#setReset");
    await reset.click();
    await expect(reset).toHaveText("Click again to erase everything");
    await reset.click();
    await page.waitForLoadState("load");
    await expect(page.locator(".admin-shell")).toHaveCount(0);
    const stored = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("atlas.session")));
    expect(stored).toEqual([]);
  });
});

test.describe("my account", () => {
  test("a new name and colour show across the administration", async ({ page }) => {
    await signIn(page, "Amara Okonjo");
    await adminNav(page, "account");
    await page.locator("#accName").fill("Amara O. Okonjo");
    await page.locator('[data-tone="#2f8f6b"]').click();
    await page.locator("#accSave").click();
    await expect(page.locator("#toast")).toContainText("Profile saved");
    await expect(page.locator(".admin-me b")).toHaveText("Amara O. Okonjo");
    await expect(page.locator("#accAvatar")).toHaveCSS("background-color", "rgb(47, 143, 107)");
  });

  test("a phone number with letters is refused", async ({ page }) => {
    await signIn(page, "Ravi Shankar Nair");
    await adminNav(page, "account");
    await page.locator("#accPhone").fill("call me maybe");
    await page.locator("#accSave").click();
    await expect(page.locator("#accError")).toContainText("digits");
  });

  test("the role's access is spelled out", async ({ page }) => {
    await signIn(page, "Ravi Shankar Nair");
    await adminNav(page, "account");
    await expect(page.locator(".access-list").first()).toContainText("News & entries");
    await expect(page.locator(".narrow")).toContainText("Closed to your role");
    await expect(page.locator(".narrow")).toContainText("Site settings");
  });

  test("e-mail preferences are saved at once", async ({ page }) => {
    await signIn(page, "Lena Fischer");
    await adminNav(page, "account");
    const digest = page.locator('[data-pref="digest"]');
    await expect(digest).toHaveAttribute("aria-checked", "false");
    await digest.click();
    await expect(digest).toHaveAttribute("aria-checked", "true");
    await page.reload();
    await expect(page.locator('[data-pref="digest"]')).toHaveAttribute("aria-checked", "true");
  });
});

test.describe("an entry from draft to the globe", () => {
  test("publisher writes, editor sends back with a reason, then publishes", async ({ page }) => {
    test.slow();   // čtyři přihlášení a dvě role; na telefonu to trvá
    const title = "Water Rights on the Nile " + Date.now().toString(36);

    // Autor: napíše a pošle ke schválení.
    await signIn(page, "Ravi Shankar Nair");
    await page.locator('[data-quick="entry"]').click();
    await page.locator("#aTitle").fill(title);
    await page.locator("#aSummary").fill("Who gets the river when the dam fills.");
    await page.locator("#aBody").click();
    await page.keyboard.type("Three states, one river and a reservoir that takes years to fill.");
    await page.locator("#aSend").click();
    await expect(page.locator(".admin-body")).toContainText(title);

    // Editorka: vidí ho v přehledu i v menu.
    await switchTo(page, "Lena Fischer");
    await expect(page.locator('[data-kpi="approvals"] .k-val')).toHaveText("1");
    await expect(page.locator(".todo")).toContainText(title);
    await adminNav(page, "approvals");
    if (!isPhone(page)) await expect(page.locator('.admin-side [data-tab="approvals"] .nav-badge')).toHaveText("1");

    // Vrácení bez důvodu neprojde.
    await page.locator("[data-reject]").first().click();
    await page.locator("#sbNote").fill("Too short");
    await page.locator('[data-sendback-form] button[type="submit"]').click();
    await expect(page.locator("#sbError")).toBeVisible();
    await page.locator("#sbNote").fill("The second paragraph needs a source for the reservoir figures.");
    await page.locator('[data-sendback-form] button[type="submit"]').click();
    await expect(page.locator("#toast")).toContainText("Sent back");

    // Autor: vidí důvod a posílá znovu.
    await switchTo(page, "Ravi Shankar Nair");
    await expect(page.locator(".todo")).toContainText("Rework");
    await adminNav(page, "news");
    await expect(page.locator(".review-note")).toContainText("needs a source");
    await page.locator("[data-nsend]").first().click();
    await expect(page.locator(".review-note")).toHaveCount(0);

    // Editorka: schválí a článek je na webu.
    await switchTo(page, "Lena Fischer");
    await adminNav(page, "approvals");
    await page.locator("[data-approve]").first().click();
    await go(page, "#/news");
    await expect(page.locator("#railScroll")).toContainText(title);
  });

  test("an assigned approver cannot approve outside the assignment", async ({ page }) => {
    await signIn(page, "Ravi Shankar Nair");
    await page.locator('[data-quick="entry"]').click();
    await page.locator("#aTitle").fill("Harbour Politics in Mombasa");
    await page.locator("#aSummary").fill("A port, a loan and an election.");
    await page.locator("#aSend").click();

    await switchTo(page, "Mei-Lin Chen");
    await adminNav(page, "approvals");
    await expect(page.locator("[data-approve]")).toHaveCount(0);
    await expect(page.locator(".admin-body")).toContainText("Outside your assignment");
  });
});
