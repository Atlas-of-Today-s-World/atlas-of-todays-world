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
 * Oprávnění sekcí administrace „bez práva / s právem" (PLAN E9) se skutečnými
 * rolemi v atlas-dev: menu, přímé adresy a Server Actions (zápis hlídá RLS,
 * aplikace jen ukáže chybu). Role s povinným 2FA (admin, permission-admin)
 * se tu nepoužívají; plochy mapy dnes nemá žádná jiná seedovaná role, proto
 * si test založí dočasnou roli e2e-… jen s právem „areas".
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
 * Každá role se přihlásí jen jednou a další testy převezmou její cookies:
 * Supabase povolí jen 30 ověření odkazu za 5 minut z jedné adresy.
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
// 1) Menu ukáže jen sekce s právem „v"
// ---------------------------------------------------------------------------

// Sekce news přináší i Autoři a Přesměrování; regions/specials/layers i Překlady.
const MENU: Record<Exclude<(typeof ROLES)[number], "reader">, string[]> = {
  "content-editor": [
    "Overview",
    "News & entries",
    "Authors",
    "Approvals",
    "Redirects",
    "Regions & countries",
    "Global Issues",
    "Data layers",
    "Translations",
  ],
  "content-approver": ["Overview", "News & entries", "Authors", "Approvals", "Redirects"],
  publisher: [
    "Overview",
    "News & entries",
    "Authors",
    "Redirects",
    "Regions & countries",
    "Data layers",
    "Translations",
  ],
  "data-editor": [
    "Overview",
    "Regions & countries",
    "Global Issues",
    "Data layers",
    "Translations",
    "Map appearance",
  ],
  observer: ["Overview", "News & entries", "Authors", "Redirects"],
  [areasRole]: ["Overview", "Map areas"],
};

test.describe("menu administrace", () => {
  for (const [role, items] of Object.entries(MENU)) {
    test(`${role.startsWith("e2e-") ? "role jen s plochami" : role} vidí jen své sekce`, async ({
      page,
    }) => {
      await signInAs(page, role as (typeof ROLES)[number]);
      const menu = page.getByRole("navigation", { name: "Administration" });
      await expect(menu.getByRole("link")).toHaveText(items);
    });
  }

  test("čtenář do administrace nesmí vůbec", async ({ page }) => {
    await signInAs(page, "reader");
    await expect(page.getByTestId("admin-forbidden")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Administration" })).toHaveCount(0);
    await page.goto("/admin/data/internet-users");
    await expect(page.getByTestId("admin-forbidden")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2) Přímá adresa sekce bez práva → „Na tuto sekci nemáte oprávnění"
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

test.describe("přímé adresy bez práva", () => {
  for (const [role, paths] of FORBIDDEN) {
    test(`${role.startsWith("e2e-") ? "role jen s plochami" : role}: ${paths.length} zakázaných stránek`, async ({
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
// 3) Ruční hodnota ukazatele: data-editor ano, publisher (jen „v") ne
// ---------------------------------------------------------------------------

test.describe("ruční hodnota ukazatele", () => {
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
    original = data;
  });

  test.afterAll(async () => {
    // Ruční hodnota přepsala importovaný řádek → vrátit ho přesně, jak byl.
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

  // Mimo formulář má roli „alert" i hlasatel změny stránky v Next.js.
  const valueForm = (page: Page) =>
    page.locator("form").filter({ has: page.getByRole("button", { name: "Save value" }) });

  async function fillValue(page: Page, source: string) {
    await page.getByLabel(/^Country( \*)?$/).selectOption(country);
    await page.getByLabel(/^Value( \*)?$/).fill("12.5");
    await page.getByLabel(/^Year( \*)?$/).fill("2025");
    await page.getByLabel("Value source").fill(source);
    await page.getByRole("button", { name: "Save value" }).click();
  }

  test("publisher sekci vidí, ale hodnotu neuloží", async ({ page }) => {
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

  test("data-editor bez zdroje dostane chybu a pole zůstanou vyplněná", async ({ page }) => {
    await signInAs(page, "data-editor", `/admin/data/${indicator}`);
    // Mezery projdou atributem required prohlížeče, ale ne validací na serveru.
    await fillValue(page, "   ");
    await expect(valueForm(page).getByRole("alert")).toHaveText(
      "Please check the highlighted fields.",
    );
    await expect(page.getByLabel(/^Country( \*)?$/)).toHaveValue(country);
    await expect(page.getByLabel(/^Value( \*)?$/)).toHaveValue("12.5");
    await expect(page.getByLabel(/^Year( \*)?$/)).toHaveValue("2025");
  });

  test("data-editor se zdrojem hodnotu uloží", async ({ page }) => {
    await signInAs(page, "data-editor", `/admin/data/${indicator}`);
    const source = `e2e zdroj ${run}`;
    await fillValue(page, source);
    await expect(valueForm(page).getByRole("status")).toHaveText("Value saved.");
    // Tabulka hodnot je stránkovaná — ruční hodnotu najde hledání v liště tabulky.
    await page.getByRole("searchbox", { name: /^Search Values of/ }).fill(source);
    await expect(page.getByRole("cell", { name: source })).toBeVisible();
    const { data } = await service
      .from("indicator_values")
      .select("value, year, is_manual, source_note")
      .eq("indicator_id", indicator)
      .eq("country_iso3", country)
      .single();
    expect(data).toMatchObject({ value: 12.5, year: 2025, is_manual: true, source_note: source });

    // Zápis obnoví cache Atlasu; veřejné stránky z ní musí dál jít (dříve 404
    // u stránek s dynamicParams = false — NoFallbackError v Next).
    for (const path of ["/country/ukraine", "/region/eastern-europe-central-asia", "/view/hdi"]) {
      expect((await page.request.get(path)).status(), path).toBe(200);
    }
  });
});

// ---------------------------------------------------------------------------
// 4) Mapové oblasti: role s právem „areas" založí a smaže, ostatní ne
// ---------------------------------------------------------------------------

test.describe("mapové oblasti", () => {
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

  test("publisher ani data-editor na založení plochy nedosáhnou", async ({ page, browser }) => {
    await signInAs(page, "publisher", "/admin/areas/new");
    await forbidden(page);
    await expect(page.getByRole("button", { name: "Create area" })).toHaveCount(0);

    const other = await (await browser.newContext()).newPage();
    await signInAs(other, "data-editor", "/admin/areas/new");
    await forbidden(other);
  });

  test("role s právem ploch plochu založí a smaže", async ({ page }) => {
    await signInAs(page, areasRole, "/admin/areas");
    await page.getByRole("link", { name: "New area" }).click();
    // Seznam má v hlavičce tabulky ovládání se jmény sloupců („Filter Name") — počkat na formulář.
    await expect(page).toHaveURL((url) => url.pathname === "/admin/areas/new");
    await page.getByLabel("Name").fill(`E2E plocha ${run}`);
    await page.getByLabel("Identifier").fill(slug);
    await page.getByLabel("Shape (GeoJSON Polygon)").fill(polygon);
    await page.getByRole("button", { name: "Create area" }).click();

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
// 5) Sekce portrétu regionu: content-editor uloží, publisher (vlastní články) ne
// ---------------------------------------------------------------------------

test.describe("sekce portrétu regionu", () => {
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

  // Texty portrétu smí jen redakce s právem na všechny články (RLS); ostatní
  // je vidí jen pro čtení, s vysvětlením — žádný editor, který by pak selhal.
  test("publisher portrét vidí jen pro čtení", async ({ page }) => {
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

  test("data-editor upraví hlavičku a karty, texty jen čte", async ({ page }) => {
    await signInAs(page, "data-editor", `/admin/regions/${region}`);
    await expect(page.getByRole("button", { name: "Save region" })).toBeEnabled();
    const metrics = page.getByRole("region", { name: "Key indicators" });
    await expect(metrics.getByRole("button", { name: "Save section" })).toBeEnabled();
    const faq = page.getByRole("region", { name: "FAQ", exact: true });
    await expect(faq.getByRole("button", { name: "Save section" })).toBeDisabled();
  });

  test("content-editor sekci uloží", async ({ page }) => {
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
