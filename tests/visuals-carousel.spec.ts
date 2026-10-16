import { createHash, randomUUID } from "node:crypto";
import { devices, expect, test, type Locator, type Page } from "@playwright/test";
import { requireDevAccounts, service } from "./support/accounts";

/**
 * "Maps & charts" with more than one visual: the public topic page and the
 * preview by link show them as one carousel — arrows, dots, keyboard and
 * swipe — and a custom map opens on the framing saved in its spec. Data is
 * set up with the service key in atlas-dev (never production) and removed
 * afterwards.
 */
requireDevAccounts();
test.describe.configure({ mode: "serial" });

const run = randomUUID().slice(0, 8);
const IMAGE_TITLE = `Displacement in figures ${run}`;
const MAP_TITLE = `Where the talks take place ${run}`;
const created: string[] = [];
let publishedSlug = "";
let previewToken = "";

/** Framed tightly round Prague: Vienna is on the map but outside the saved view. */
const MAP_SPEC = {
  version: 1,
  view: {
    mode: "bounds",
    countries: [],
    region: null,
    bounds: [13.9, 49.6, 14.9, 50.5],
    projection: "mercator",
    basemap: "light",
    labels: true,
  },
  countries: [],
  points: [
    {
      id: "prague",
      lat: 50.08,
      lon: 14.42,
      label: "Prague",
      showLabel: true,
      color: "#c0392b",
      size: 18,
      icon: null,
      pulse: false,
      popup: null,
    },
    {
      id: "vienna",
      lat: 48.21,
      lon: 16.37,
      label: "Vienna",
      showLabel: false,
      color: "#2c3e50",
      size: 18,
      icon: null,
      pulse: false,
      popup: null,
    },
  ],
  legend: { visible: false, title: "", position: "bottom-left", items: [] },
};

/** A topic with two visuals (an image, then a custom map); returns its id. */
async function topicWithVisuals(slug: string, status: "published" | "draft") {
  const { data: entry, error } = await service
    .from("entries")
    .insert({
      slug,
      kind: "entry",
      title: `E2E maps ${slug}`,
      summary: "Two visuals in one carousel.",
      category: "Society",
      status,
      published_on: status === "published" ? "2026-10-01" : null,
      body_html: "<p>Intro.</p>",
    })
    .select("id")
    .single();
  if (error) throw error;
  created.push(entry.id);
  const { error: visualsError } = await service.from("visuals").insert([
    {
      owner_kind: "entry",
      entry_id: entry.id,
      position: 10,
      kind: "image",
      title: IMAGE_TITLE,
      caption: "People displaced, 2025.",
      image_url:
        "https://upload.wikimedia.org/wikipedia/commons/8/80/World_map_-_low_resolution.svg",
    },
    {
      owner_kind: "entry",
      entry_id: entry.id,
      position: 20,
      kind: "map",
      title: MAP_TITLE,
      // One insert of two rows: every row names every column it sets.
      caption: "Venues of the 2026 talks.",
      map_spec: MAP_SPEC,
    },
  ]);
  if (visualsError) throw visualsError;
  return entry.id as string;
}

test.beforeAll(async () => {
  publishedSlug = `e2e-visuals-${run}`;
  await topicWithVisuals(publishedSlug, "published");
  // A draft shown by a preview link, the way PreviewShare creates one (only the hash is stored).
  const draft = await topicWithVisuals(`e2e-visuals-draft-${run}`, "draft");
  previewToken = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
  const { error } = await service.from("preview_links").insert({
    entry_id: draft,
    token_hash: createHash("sha256").update(previewToken).digest("hex"),
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  if (error) throw error;
});

test.afterAll(async () => {
  // Visuals and preview links go with their topic (on delete cascade).
  if (service && created.length) await service.from("entries").delete().in("id", created);
});

const carouselOf = (page: Page) =>
  page.locator("#maps-and-charts").getByRole("region", { name: "Seen through maps and data" });

const LABEL = "Seen through maps and data";

const slide = (carousel: Locator, title: string) =>
  carousel.getByRole("figure").filter({ hasText: title });

/** The slide sits at the start of the track (scrolling and snapping done), its dot current. */
async function expectShown(carousel: Locator, title: string, number: 1 | 2) {
  const figure = slide(carousel, title);
  const track = carousel.locator("> div").first();
  await expect
    .poll(async () => {
      const [a, b] = await Promise.all([figure.boundingBox(), track.boundingBox()]);
      return a && b ? Math.round(Math.abs(a.x - b.x)) : Infinity;
    })
    .toBeLessThanOrEqual(6);
  await expect(figure).toBeInViewport({ ratio: 0.9 });
  await expect(
    carousel.getByRole("button", { name: `${LABEL}: show ${number} of 2` }),
  ).toHaveAttribute("aria-current", "true");
}

/** The arrows, the dots and the keyboard all page through the visuals. */
async function expectWorkingCarousel(page: Page) {
  const carousel = carouselOf(page);
  await carousel.scrollIntoViewIfNeeded();
  await expect(carousel).toHaveAttribute("aria-roledescription", "carousel");
  await expect(carousel.getByRole("figure")).toHaveCount(2);
  const dots = carousel.getByRole("button", { name: new RegExp(`^${LABEL}: show \\d of 2$`) });
  await expect(dots).toHaveCount(2);
  const previous = carousel.getByRole("button", { name: `${LABEL}: previous` });
  const next = carousel.getByRole("button", { name: `${LABEL}: next` });

  // First slide shown: the image, named by its title.
  await expectShown(carousel, IMAGE_TITLE, 1);
  await expect(carousel.getByRole("img", { name: IMAGE_TITLE })).toBeVisible();
  await expect(previous).toBeDisabled();

  // Next arrow → the map; the dot and the live text follow.
  await next.click();
  await expectShown(carousel, MAP_TITLE, 2);
  await expect(carousel.getByText("2 of 2")).toBeAttached();
  await expect(next).toBeDisabled();

  // The map opens on its saved framing: Prague is inside it, Vienna outside.
  const map = carousel.getByRole("region", { name: `Map: ${MAP_TITLE}` });
  await expect(map.getByRole("button", { name: "Prague" })).toBeVisible({ timeout: 20_000 });
  const box = (await map.boundingBox())!;
  const inside = async (name: string) => {
    const point = (await map.getByRole("button", { name }).boundingBox())!;
    const x = point.x + point.width / 2;
    const y = point.y + point.height / 2;
    return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
  };
  expect(await inside("Prague")).toBe(true);
  expect(await inside("Vienna")).toBe(false);

  // A dot jumps straight to its slide.
  await dots.first().click();
  await expectShown(carousel, IMAGE_TITLE, 1);

  // Keyboard: the track takes focus; → and ← page, End and Home jump.
  const track = carousel.locator("> div[tabindex='0']");
  await track.focus();
  await page.keyboard.press("ArrowRight");
  await expectShown(carousel, MAP_TITLE, 2);
  await page.keyboard.press("ArrowLeft");
  await expectShown(carousel, IMAGE_TITLE, 1);
  await page.keyboard.press("End");
  await expectShown(carousel, MAP_TITLE, 2);
  await page.keyboard.press("Home");
  await expectShown(carousel, IMAGE_TITLE, 1);
}

test("the topic page shows its maps & charts as a carousel", async ({ page }) => {
  await page.goto(`/topics/${publishedSlug}`);
  await expectWorkingCarousel(page);
});

test("the preview link shows a draft's maps & charts as the same carousel", async ({ page }) => {
  const { error } = await service.rpc("entry_preview_visuals", { p_token: "0".repeat(64) });
  test.skip(
    error?.code === "PGRST202",
    "migration 20261016000300_preview_visuals is not on atlas-dev yet",
  );
  await page.goto(`/preview/${previewToken}`);
  await expect(page.getByRole("note")).toContainText("not published yet");
  await expectWorkingCarousel(page);
});

test("on a phone a swipe moves to the next visual", async ({ browser }) => {
  const context = await browser.newContext({ ...devices["Pixel 7"] });
  const page = await context.newPage();
  try {
    await page.goto(`/topics/${publishedSlug}`);
    const carousel = carouselOf(page);
    await carousel.scrollIntoViewIfNeeded();
    await expectShown(carousel, IMAGE_TITLE, 1);
    const box = (await slide(carousel, IMAGE_TITLE).boundingBox())!;
    // A finger dragged right to left across most of the first slide (raw touch events:
    // the browser scrolls the track itself, as on a phone).
    const cdp = await context.newCDPSession(page);
    const y = Math.round(box.y + Math.min(box.height / 2, 120));
    const from = Math.round(box.x + box.width * 0.9);
    const steps = 12;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: from, y }],
    });
    for (let step = 1; step <= steps; step++) {
      const x = Math.round(from - (box.width * 0.75 * step) / steps);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    // The map is now the visual shown (headless Chromium doesn't finish the snap of a
    // synthetic touch, so the slide may stop short of the edge; the dot says which one).
    await expect(slide(carousel, MAP_TITLE)).toBeInViewport({ ratio: 0.5 });
    await expect(carousel.getByRole("button", { name: `${LABEL}: show 2 of 2` })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(carousel.getByRole("button", { name: `${LABEL}: previous` })).toBeEnabled();
  } finally {
    await context.close();
  }
});
