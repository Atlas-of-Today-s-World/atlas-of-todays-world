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
    users[role] = testEmail(role.startsWith("e2e-") ? "areas" : role);
    await createUser(users[role], role);
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
    await signIn(page, users[role], next);
  }
  await expect(page).toHaveURL((url) => url.pathname === next);
  if (!cookies) sessions.set(role, await page.context().cookies());
}

const forbidden = (page: Page) => expect(page.getByTestId("section-forbidden")).toBeVisible();

// ---------------------------------------------------------------------------
// 1) Menu ukáže jen sekce s právem „v"
// ---------------------------------------------------------------------------

const MENU: Record<Exclude<(typeof ROLES)[number], "reader">, string[]> = {
  "content-editor": [
    "Přehled",
    "Novinky a hesla",
    "Schvalování",
    "Regiony a země",
    "Global Issues",
    "Datové vrstvy",
  ],
  "content-approver": ["Přehled", "Novinky a hesla", "Schvalování"],
  publisher: ["Přehled", "Novinky a hesla", "Regiony a země", "Datové vrstvy"],
  "data-editor": ["Přehled", "Regiony a země", "Global Issues", "Datové vrstvy", "Vzhled mapy"],
  observer: ["Přehled", "Novinky a hesla"],
  [areasRole]: ["Přehled", "Mapové oblasti"],
};

test.describe("menu administrace", () => {
  for (const [role, items] of Object.entries(MENU)) {
    test(`${role.startsWith("e2e-") ? "role jen s plochami" : role} vidí jen své sekce`, async ({
      page,
    }) => {
      await signInAs(page, role as (typeof ROLES)[number]);
      const menu = page.getByRole("navigation", { name: "Administrace" });
      await expect(menu.getByRole("link")).toHaveText(items);
    });
  }

  test("čtenář do administrace nesmí vůbec", async ({ page }) => {
    await signInAs(page, "reader");
    await expect(page.getByTestId("admin-forbidden")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Administrace" })).toHaveCount(0);
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
      "/admin/schvalovani",
      "/admin/global-issues",
      "/admin/global-issues/novy",
      "/admin/data/novy",
      "/admin/oblasti",
      "/admin/oblasti/nova",
      "/admin/vzhled",
      "/admin/ucty",
      "/admin/ucty/pozvanky",
      "/admin/role",
      "/admin/role/audit",
      "/admin/clenove",
    ],
  ],
  ["observer", ["/admin/obsah/novy", "/admin/schvalovani", "/admin/regiony", "/admin/data"]],
  ["data-editor", ["/admin/obsah", "/admin/schvalovani", "/admin/oblasti", "/admin/ucty"]],
  ["content-editor", ["/admin/data/novy", "/admin/global-issues/novy", "/admin/vzhled"]],
  [areasRole, ["/admin/obsah", "/admin/regiony", "/admin/data", "/admin/role"]],
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
    page.locator("form").filter({ has: page.getByRole("button", { name: "Uložit hodnotu" }) });

  async function fillValue(page: Page, source: string) {
    await page.getByLabel("Země").selectOption(country);
    await page.getByLabel(/^Hodnota/).fill("12.5");
    await page.getByLabel("Rok").fill("2025");
    await page.getByLabel("Zdroj hodnoty").fill(source);
    await page.getByRole("button", { name: "Uložit hodnotu" }).click();
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
    await expect(valueForm(page).getByRole("alert")).toHaveText("Zkontrolujte zvýrazněná pole.");
    await expect(page.getByLabel("Země")).toHaveValue(country);
    await expect(page.getByLabel(/^Hodnota/)).toHaveValue("12.5");
    await expect(page.getByLabel("Rok")).toHaveValue("2025");
  });

  test("data-editor se zdrojem hodnotu uloží", async ({ page }) => {
    await signInAs(page, "data-editor", `/admin/data/${indicator}`);
    const source = `e2e zdroj ${run}`;
    await fillValue(page, source);
    await expect(valueForm(page).getByRole("status")).toHaveText("Hodnota uložena.");
    await expect(page.getByText(`Ručně: ${source}`)).toBeVisible();
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
    await signInAs(page, "publisher", "/admin/oblasti/nova");
    await forbidden(page);
    await expect(page.getByRole("button", { name: "Založit plochu" })).toHaveCount(0);

    const other = await (await browser.newContext()).newPage();
    await signInAs(other, "data-editor", "/admin/oblasti/nova");
    await forbidden(other);
  });

  test("role s právem ploch plochu založí a smaže", async ({ page }) => {
    await signInAs(page, areasRole, "/admin/oblasti");
    await page.getByRole("link", { name: "Nová plocha" }).click();
    await page.getByLabel("Název").fill(`E2E plocha ${run}`);
    await page.getByLabel("Identifikátor").fill(slug);
    await page.getByLabel("Obrazec (GeoJSON Polygon)").fill(polygon);
    await page.getByRole("button", { name: "Založit plochu" }).click();

    await expect(page).toHaveURL((url) => url.pathname === `/admin/oblasti/${slug}`);
    const { data: created } = await service
      .from("map_areas")
      .select("slug, name")
      .eq("slug", slug)
      .single();
    expect(created?.name).toBe(`E2E plocha ${run}`);

    await page.getByRole("button", { name: "Smazat" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Smazat" }).click();
    await expect(page).toHaveURL(/\/admin\/oblasti$/);
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
    const faq = page.getByRole("region", { name: "Časté otázky" });
    await faq.getByRole("button", { name: "Přidat otázka" }).click();
    const index = await faq.locator("fieldset").count();
    await faq
      .getByLabel(/^Otázka \*$/)
      .nth(index - 1)
      .fill(question);
    await faq
      .getByLabel(/^Odpověď/)
      .nth(index - 1)
      .fill("Odpověď napsaná v e2e testu.");
    await faq.getByRole("button", { name: "Uložit sekci" }).click();
    return faq;
  }

  // Texty portrétu smí jen redakce s právem na všechny články (RLS); ostatní
  // je vidí jen pro čtení, s vysvětlením — žádný editor, který by pak selhal.
  test("publisher portrét vidí jen pro čtení", async ({ page }) => {
    await signInAs(page, "publisher", `/admin/regiony/${region}`);
    const faq = page.getByRole("region", { name: "Časté otázky" });
    await expect(faq.getByRole("button", { name: "Uložit sekci" })).toBeDisabled();
    await expect(faq.getByRole("button", { name: "Přidat otázka" })).toBeDisabled();
    await expect(
      page.getByText("Texty portrétu (osa, FAQ, zdroje, vizuály) upravuje redakce").first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Uložit region" })).toBeDisabled();
  });

  test("data-editor upraví hlavičku a karty, texty jen čte", async ({ page }) => {
    await signInAs(page, "data-editor", `/admin/regiony/${region}`);
    await expect(page.getByRole("button", { name: "Uložit region" })).toBeEnabled();
    const metrics = page.getByRole("region", { name: "Klíčové ukazatele" });
    await expect(metrics.getByRole("button", { name: "Uložit sekci" })).toBeEnabled();
    const faq = page.getByRole("region", { name: "Časté otázky" });
    await expect(faq.getByRole("button", { name: "Uložit sekci" })).toBeDisabled();
  });

  test("content-editor sekci uloží", async ({ page }) => {
    await signInAs(page, "content-editor", `/admin/regiony/${region}`);
    const question = `E2E otázka ${run}?`;
    const faq = await addFaq(page, question);
    await expect(faq.getByRole("status")).toHaveText("Sekce uložena.");
    const { data } = await service
      .from("faq_items")
      .select("question")
      .eq("region_slug", region)
      .eq("question", question);
    expect(data).toHaveLength(1);
  });
});
