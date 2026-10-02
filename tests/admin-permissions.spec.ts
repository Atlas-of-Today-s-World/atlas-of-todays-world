import { randomUUID } from "node:crypto";
import { expect, test, type Cookie, type Page } from "@playwright/test";
import {
  cleanUp,
  createUser,
  requireDevAccounts,
  service,
  signIn,
  testEmail,
} from "./support/accounts";

/**
 * Admin section permissions "without / with the right" (PLAN E9) using real
 * roles in atlas-dev: menu, direct URLs and Server Actions (RLS guards writes,
 * the app only shows an error). Roles with mandatory 2FA (admin,
 * permission-admin) are not used here; no other seeded role has map areas
 * today, so the test creates a temporary e2e-… role with only the "areas" right.
 */
requireDevAccounts();
test.describe.configure({ mode: "serial" });

const run = randomUUID().slice(0, 8);
const areasRole = `e2e-areas-${run}`;
const users: Record<string, string> = {};
const ROLES = [
  "content-editor",
  "content-approver",
  "publisher",
  "data-editor",
  "observer",
  "reader",
  areasRole,
] as const;

test.beforeAll(async () => {
  const { error: roleError } = await service
    .from("roles")
    .insert({ id: areasRole, name: `E2E plochy ${run}`, note: "Dočasná role e2e testu." });
  if (roleError) throw roleError;
  const { error: permError } = await service
    .from("role_permissions")
    .insert({ role_id: areasRole, section: "areas", actions: "vced" });
  if (permError) throw permError;
  for (const role of ROLES) {
    const email = testEmail(role.startsWith("e2e-") ? "areas" : role);
    users[role] = email;
    await createUser(email, role);
  }
});

test.afterAll(async () => {
  await service.from("map_areas").delete().like("slug", "e2e-%");
  await cleanUp();
  await service.from("role_permissions").delete().eq("role_id", areasRole);
  await service.from("roles").delete().eq("id", areasRole);
});

/**
 * Each role signs in only once and later tests reuse its cookies:
 * Supabase allows only 30 link verifications per 5 minutes from one address.
 */
const sessions = new Map<string, Cookie[]>();

async function signInAs(page: Page, role: (typeof ROLES)[number], next = "/admin") {
  const cookies = sessions.get(role);
  if (cookies) {
    await page.context().addCookies(cookies);
    await page.goto(next);
  } else {
    const email = users[role];
    if (!email) throw new Error(`Účet pro roli ${role} nevznikl`);
    await signIn(page, email, next);
  }
  await expect(page).toHaveURL((url) => url.pathname === next);
  if (!cookies) sessions.set(role, await page.context().cookies());
}

const forbidden = (page: Page) => expect(page.getByTestId("section-forbidden")).toBeVisible();

// ---------------------------------------------------------------------------
// 1) The menu shows only sections with the "v" (view) right
// ---------------------------------------------------------------------------

// The news section also brings Authors and Redirects; regions/specials/layers also Translations.
const MENU: Record<Exclude<(typeof ROLES)[number], "reader">, string[]> = {
  "content-editor": [
    "Overview",
    "Articles",
    "Author profiles",
    "Learn-more tiles",
    "Article approvals",
    "URL redirects",
    "Regions & countries",
    "Country groups",
    "Map data layers",
    "Translations",
  ],
  "content-approver": [
    "Overview",
    "Articles",
    "Author profiles",
    "Learn-more tiles",
    "Article approvals",
    "URL redirects",
  ],
  publisher: [
    "Overview",
    "Articles",
    "Author profiles",
    "Learn-more tiles",
    "URL redirects",
    "Regions & countries",
    "Map data layers",
    "Translations",
  ],
  "data-editor": [
    "Overview",
    "Regions & countries",
    "Country groups",
    "Map data layers",
    "Translations",
    "Map appearance",
  ],
  observer: ["Overview", "Articles", "Author profiles", "Learn-more tiles", "URL redirects"],
  [areasRole]: ["Overview", "Custom map areas"],
};

test.describe("menu administrace", () => {
  for (const [role, items] of Object.entries(MENU)) {
    test(`${role.startsWith("e2e-") ? "areas-only role" : role} sees only its sections`, async ({
      page,
    }) => {
      await signInAs(page, role as (typeof ROLES)[number]);
      const menu = page.getByRole("navigation", { name: "Administration" });
      await expect(menu.getByRole("link")).toHaveText(items);
    });
  }

  test("reader may not enter the admin at all", async ({ page }) => {
    await signInAs(page, "reader");
    await expect(page.getByTestId("admin-forbidden")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Administration" })).toHaveCount(0);
    await page.goto("/admin/data/internet-users");
    await expect(page.getByTestId("admin-forbidden")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2) Direct URL of a section without the right → "Na tuto sekci nemáte oprávnění"
// ---------------------------------------------------------------------------

const FORBIDDEN: [(typeof ROLES)[number], string[]][] = [
  [
    "publisher",
    [
      "/admin/approvals",
      "/admin/global-issues",
      "/admin/global-issues/new",
      "/admin/data/new",
      "/admin/areas",
      "/admin/areas/new",
      "/admin/appearance",
      "/admin/accounts",
      "/admin/accounts/invitations",
      "/admin/roles",
      "/admin/roles/audit",
      "/admin/members",
    ],
  ],
  ["observer", ["/admin/content/new", "/admin/approvals", "/admin/regions", "/admin/data"]],
  ["data-editor", ["/admin/content", "/admin/approvals", "/admin/areas", "/admin/accounts"]],
  ["content-editor", ["/admin/data/new", "/admin/global-issues/new", "/admin/appearance"]],
  [areasRole, ["/admin/content", "/admin/regions", "/admin/data", "/admin/roles"]],
];

test.describe("direct URLs without the right", () => {
  for (const [role, paths] of FORBIDDEN) {
    test(`${role.startsWith("e2e-") ? "areas-only role" : role}: ${paths.length} forbidden pages`, async ({
      page,
    }) => {
      await signInAs(page, role);
      for (const path of paths) {
        await page.goto(path);
        await forbidden(page);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 3) Manual indicator value: data-editor yes, publisher ("v" only) no
// ---------------------------------------------------------------------------

test.describe("manual indicator value", () => {
  const indicator = "internet-users";
  const country = "ISL";
  type Row = Record<string, unknown>;
  let original: Row | null = null;

  test.beforeAll(async () => {
    const { data, error } = await service
      .from("indicator_values")
      .select("*")
      .eq("indicator_id", indicator)
      .eq("country_iso3", country)
      .maybeSingle();
    if (error) throw error;
    // A cancelled CI run can leave its manual e2e value behind; never treat that
    // leftover as the original row (afterAll would restore it and later runs fail).
    original = String(data?.source_note ?? "").startsWith("e2e zdroj ") ? null : data;
    if (!original && data) {
      await service
        .from("indicator_values")
        .delete()
        .eq("indicator_id", indicator)
        .eq("country_iso3", country);
    }
  });

  test.afterAll(async () => {
    // The manual value overwrote an imported row → restore it exactly as it was.
    if (original) {
      const { error } = await service
        .from("indicator_values")
        .upsert(original, { onConflict: "indicator_id,country_iso3" });
      if (error) throw error;
    } else {
      await service
        .from("indicator_values")
        .delete()
        .eq("indicator_id", indicator)
        .eq("country_iso3", country);
    }
  });

  // Outside the form, Next.js's route announcer also has the "alert" role.
  const valueForm = (page: Page) =>
    page.locator("form").filter({ has: page.getByRole("button", { name: "Save value" }) });

  async function fillValue(page: Page, source: string) {
    await page.getByLabel(/^Country( \*)?$/).selectOption(country);
    await page.getByLabel(/^Value( \*)?$/).fill("12.5");
    await page.getByLabel(/^Year( \*)?$/).fill("2025");
    await page.getByLabel("Value source").fill(source);
    await page.getByRole("button", { name: "Save value" }).click();
  }

  test("publisher sees the section but cannot save a value", async ({ page }) => {
    await signInAs(page, "publisher", `/admin/data/${indicator}`);
    await fillValue(page, `e2e zdroj ${run}`);
    await expect(valueForm(page).getByRole("alert")).toBeVisible();
    const { data } = await service
      .from("indicator_values")
      .select("value, is_manual")
      .eq("indicator_id", indicator)
      .eq("country_iso3", country)
      .maybeSingle();
    expect(data?.is_manual ?? false).toBe(false);
  });

  test("data-editor without a source gets an error and fields stay filled", async ({ page }) => {
    await signInAs(page, "data-editor", `/admin/data/${indicator}`);
    // Whitespace passes the browser's required attribute but not server validation.
    await fillValue(page, "   ");
    await expect(valueForm(page).getByRole("alert")).toHaveText(
      "Please check the highlighted fields.",
    );
    await expect(page.getByLabel(/^Country( \*)?$/)).toHaveValue(country);
    await expect(page.getByLabel(/^Value( \*)?$/)).toHaveValue("12.5");
    await expect(page.getByLabel(/^Year( \*)?$/)).toHaveValue("2025");
  });

  test("data-editor with a source saves the value", async ({ page }) => {
    await signInAs(page, "data-editor", `/admin/data/${indicator}`);
    const source = `e2e zdroj ${run}`;
    await fillValue(page, source);
    await expect(valueForm(page).getByRole("status")).toHaveText("Value saved.");
    // The values table is paginated — the table toolbar search finds the manual value.
    await page.getByRole("searchbox", { name: /^Search Values of/ }).fill(source);
    await expect(page.getByRole("cell", { name: source })).toBeVisible();
    const { data } = await service
      .from("indicator_values")
      .select("value, year, is_manual, source_note")
      .eq("indicator_id", indicator)
      .eq("country_iso3", country)
      .single();
    expect(data).toMatchObject({ value: 12.5, year: 2025, is_manual: true, source_note: source });

    // The write refreshes the Atlas cache; public pages must still render from it
    // (previously 404 on pages with dynamicParams = false — NoFallbackError in Next).
    for (const path of ["/country/ukraine", "/region/eastern-europe-central-asia", "/view/hdi"]) {
      expect((await page.request.get(path)).status(), path).toBe(200);
    }
  });
});

// ---------------------------------------------------------------------------
// 4) Map areas: a role with the "areas" right creates and deletes, others cannot
// ---------------------------------------------------------------------------

test.describe("map areas", () => {
  const slug = `e2e-plocha-${run}`;
  const polygon = JSON.stringify({
    type: "Polygon",
    coordinates: [
      [
        [10, 10],
        [11, 10],
        [11, 11],
        [10, 11],
        [10, 10],
      ],
    ],
  });

  test("neither publisher nor data-editor can create an area", async ({ page, browser }) => {
    await signInAs(page, "publisher", "/admin/areas/new");
    await forbidden(page);
    await expect(page.getByRole("button", { name: "Create map area" })).toHaveCount(0);

    const other = await (await browser.newContext()).newPage();
    await signInAs(other, "data-editor", "/admin/areas/new");
    await forbidden(other);
  });

  test("role with the areas right creates and deletes an area", async ({ page }) => {
    await signInAs(page, areasRole, "/admin/areas");
    await page.getByRole("link", { name: "New map area" }).click();
    // The list table header has controls named after columns ("Filter Name") — wait for the form.
    await expect(page).toHaveURL((url) => url.pathname === "/admin/areas/new");
    await page.getByLabel("Name").fill(`E2E plocha ${run}`);
    await page.getByLabel("Identifier").fill(slug);
    await page.getByLabel("Shape (GeoJSON Polygon)").fill(polygon);
    await page.getByRole("button", { name: "Create map area" }).click();

    await expect(page).toHaveURL((url) => url.pathname === `/admin/areas/${slug}`);
    const { data: created } = await service
      .from("map_areas")
      .select("slug, name")
      .eq("slug", slug)
      .single();
    expect(created?.name).toBe(`E2E plocha ${run}`);

    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/admin\/areas$/);
    const { data: gone } = await service.from("map_areas").select("slug").eq("slug", slug);
    expect(gone).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5) Region portrait sections: content-editor saves, publisher (own articles) cannot
// ---------------------------------------------------------------------------

test.describe("region portrait sections", () => {
  const region = "south-asia";
  type Faq = { position: number; question: string; answer: string };
  let original: Faq[] = [];

  test.beforeAll(async () => {
    const { data, error } = await service
      .from("faq_items")
      .select("position, question, answer")
      .eq("region_slug", region)
      .order("position");
    if (error) throw error;
    original = data;
  });

  test.afterAll(async () => {
    await service.from("faq_items").delete().eq("region_slug", region);
    if (original.length) {
      const { error } = await service
        .from("faq_items")
        .insert(original.map((row) => ({ ...row, region_slug: region })));
      if (error) throw error;
    }
  });

  async function addFaq(page: Page, question: string) {
    const faq = page.getByRole("region", { name: "FAQ", exact: true });
    await faq.getByRole("button", { name: "Add question" }).click();
    const index = await faq.locator("fieldset").count();
    await faq
      .getByLabel(/^Question \*$/)
      .nth(index - 1)
      .fill(question);
    await faq
      .getByLabel(/^Answer/)
      .nth(index - 1)
      .fill("Odpověď napsaná v e2e testu.");
    await faq.getByRole("button", { name: "Save section" }).click();
    return faq;
  }

  // Only editors with rights to all articles may edit portrait texts (RLS); others
  // see them read-only with an explanation — no editor that would then fail.
  test("publisher sees the portrait read-only", async ({ page }) => {
    await signInAs(page, "publisher", `/admin/regions/${region}`);
    const faq = page.getByRole("region", { name: "FAQ", exact: true });
    await expect(faq.getByRole("button", { name: "Save section" })).toBeDisabled();
    await expect(faq.getByRole("button", { name: "Add question" })).toBeDisabled();
    await expect(
      page
        .getByText("Portrait texts (timeline, FAQ, sources, visuals) are edited by editors")
        .first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Save region" })).toBeDisabled();
  });

  test("data-editor edits header and cards, texts read-only", async ({ page }) => {
    await signInAs(page, "data-editor", `/admin/regions/${region}`);
    await expect(page.getByRole("button", { name: "Save region" })).toBeEnabled();
    const metrics = page.getByRole("region", { name: "Key indicators" });
    await expect(metrics.getByRole("button", { name: "Save section" })).toBeEnabled();
    const faq = page.getByRole("region", { name: "FAQ", exact: true });
    await expect(faq.getByRole("button", { name: "Save section" })).toBeDisabled();
  });

  test("content-editor saves the section", async ({ page }) => {
    await signInAs(page, "content-editor", `/admin/regions/${region}`);
    const question = `E2E otázka ${run}?`;
    const faq = await addFaq(page, question);
    await expect(faq.getByRole("status")).toHaveText("Section saved.");
    const { data } = await service
      .from("faq_items")
      .select("question")
      .eq("region_slug", region)
      .eq("question", question);
    expect(data).toHaveLength(1);
  });
});
