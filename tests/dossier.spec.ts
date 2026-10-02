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
import { jsonLdNodes, validateJsonLd } from "../src/lib/seo/jsonld-rules";

/**
 * Dossier (encyclopedia entry): topic tiles and "Learn more" tiles side by
 * side, each opening its panel; FAQ and SEO/GEO overrides on the page; the
 * editor's tabs in the admin. Data is set up with the service key in atlas-dev.
 */
requireDevAccounts();
test.describe.configure({ mode: "serial" });

const run = randomUUID().slice(0, 8);
const slug = `e2e-dossier-${run}`;
const title = `E2E dossier ${run}`;
let entryId = "";
let authorId = "";
let authorSlug = "";
let editor = "";

test.beforeAll(async () => {
  editor = testEmail("dossier");
  await createUser(editor, "content-editor");

  // An author profile (G8): the DB generates the public slug from the name.
  const { data: author, error: authorError } = await service
    .from("authors")
    .insert({ name: `E2E Autorka ${run}`, slug: "", bio: "Geographer of migration routes." })
    .select("id, slug")
    .single();
  if (authorError) throw authorError;
  authorId = author.id;
  authorSlug = author.slug;

  const { data: entry, error } = await service
    .from("entries")
    .insert({
      slug,
      kind: "entry",
      title,
      summary: "How smuggling networks work and why policies keep failing.",
      category: "Society",
      status: "published",
      published_on: "2026-10-01",
      body_html: "<p>Introduction of the dossier.</p>",
      author_id: authorId,
      seo_title: `Smuggling explained ${run}`,
      geo_summary: "Migrant smuggling is the paid facilitation of irregular border crossing.",
    })
    .select("id")
    .single();
  if (error) throw error;
  entryId = entry.id;

  await service.from("entry_chapters").insert([
    { entry_id: entryId, position: 0, title: "Brief overview", body_html: "<p>Overview text.</p>" },
    { entry_id: entryId, position: 1, title: "Smuggling routes", body_html: "<p>Routes text.</p>" },
  ]);
  const { data: tile } = await service
    .from("learn_more_tiles")
    .insert({ entry_id: entryId, slug: "field-notes", label: "Field notes", icon: "pen" })
    .select("id")
    .single();
  await service.from("entry_tile_notes").insert({
    entry_id: entryId,
    tile_id: tile?.id,
    body_html: "<p>Notes from the Libyan coast.</p>",
  });
  await service.from("resources").insert({
    entry_id: entryId,
    kind: "Videos & Documentaries",
    title: "What is migrant smuggling?",
    source: "UNODC",
    url: "https://www.unodc.org/",
  });
  await service.from("entry_faq").insert({
    entry_id: entryId,
    position: 0,
    question: "Is smuggling trafficking?",
    answer: "No.",
  });
});

test.afterAll(async () => {
  if (service && entryId) await service.from("entries").delete().eq("id", entryId);
  if (service && authorId) await service.from("authors").delete().eq("id", authorId);
  await cleanUp();
});

test("dossier page: topic and learn-more tiles open their panels", async ({ page }) => {
  await page.goto(`/entry/${slug}`);
  await expect(page).toHaveTitle(`Smuggling explained ${run} — Atlas of Today's World`);
  await expect(page.getByText("Migrant smuggling is the paid facilitation")).toBeVisible();

  const topics = page.getByRole("region", { name: "Topics" });
  await expect(topics.getByRole("button")).toHaveCount(2);
  // The first topic is open by default.
  await expect(page.getByRole("heading", { level: 2, name: "Brief overview" })).toBeVisible();

  await topics.getByRole("button", { name: /Smuggling routes/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Smuggling routes" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Brief overview" })).toBeHidden();
  await expect(page).toHaveURL(/#topic-2$/);

  const learn = page.getByRole("region", { name: "Learn more" });
  await learn.getByRole("button", { name: /Field notes/ }).click();
  await expect(page.getByText("Notes from the Libyan coast.")).toBeVisible();
  await learn.getByRole("button", { name: /Videos & Documentaries/ }).click();
  await expect(page.getByRole("link", { name: /What is migrant smuggling\?/ })).toBeVisible();

  const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(jsonLd.join("")).toContain('"FAQPage"');
});

test("SEO & GEO: valid Article graph, author profile and a Markdown version", async ({
  page,
  request,
}) => {
  expect(authorSlug).toBe(`e2e-autorka-${run}`);
  const html = await (await request.get(`/entry/${slug}`)).text();
  const data = [
    ...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
  ].map((block) => JSON.parse((block[1] ?? "").replace(/\\u003c/g, "<")));
  expect(validateJsonLd(data)).toEqual([]);
  const article = data.flatMap(jsonLdNodes).find((node) => node["@type"] === "Article");
  expect(article).toMatchObject({
    abstract: expect.stringContaining("Migrant smuggling"),
    author: { "@type": "Person", url: expect.stringContaining(`/authors/${authorSlug}`) },
  });

  const markdown = await request.get(`/entry/${slug}.md`);
  expect(markdown.headers()["content-type"]).toContain("text/markdown");
  expect(await markdown.text()).toContain("Migrant smuggling is the paid facilitation");

  await page.goto(`/entry/${slug}`);
  await page.getByText(`About the author: E2E Autorka ${run}`).click();
  await page.getByRole("link", { name: `Articles by E2E Autorka ${run}` }).click();
  await expect(page).toHaveURL(new RegExp(`/authors/${authorSlug}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`E2E Autorka ${run}`);
  await expect(page.getByRole("link", { name: title })).toBeVisible();
});

test("a shared link to a topic opens it", async ({ page }) => {
  await page.goto(`/entry/${slug}#topic-2`);
  await expect(page.getByRole("heading", { level: 2, name: "Smuggling routes" })).toBeVisible();
});

test("admin: dossier tabs, SEO and a tile only for this dossier", async ({ page }) => {
  await signIn(page, editor, `/admin/content/${entryId}`);
  const tabs = page.getByRole("navigation", { name: "Dossier sections" });
  await expect(tabs.getByRole("link", { name: "Article" })).toHaveAttribute("aria-current", "page");

  await tabs.getByRole("link", { name: "SEO & GEO" }).click();
  await page.getByLabel("Meta description").fill("Routes, actors and policy of migrant smuggling.");
  await page.getByRole("button", { name: "Save SEO & GEO" }).click();
  await expect(page.getByText("SEO & GEO saved.")).toBeVisible();

  await tabs.getByRole("link", { name: "Learn more" }).click();
  await page.getByLabel("Label").last().fill("Podcasts");
  await page.getByRole("button", { name: "Add tile to this dossier" }).click();
  await expect(page.getByText("Tile added.")).toBeVisible();

  const { data } = await service
    .from("learn_more_tiles")
    .select("slug")
    .eq("entry_id", entryId)
    .order("slug");
  expect(data?.map((row) => row.slug)).toEqual(["field-notes", "podcasts"]);
});
