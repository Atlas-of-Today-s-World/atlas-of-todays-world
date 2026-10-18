import { randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  cleanUp,
  createUser,
  requireDevAccounts,
  service,
  signIn,
  testEmail,
} from "./support/accounts";

/**
 * The custom map builder (Maps & charts → Custom map): a free view is saved as
 * the editor leaves the map — no "Use this view" to remember — the editor sees
 * whether the framing is saved and can reset it, and a point without a title
 * is flagged before the save instead of being refused silently. A publisher
 * edits their own draft topic in atlas-dev.
 */
requireDevAccounts();
test.afterAll(cleanUp);
test.describe.configure({ mode: "serial" });

const run = randomUUID().slice(0, 8);
const MAP_TITLE = `E2E builder map ${run}`;
let entryId = "";
let publisher = "";

test.beforeAll(async () => {
  publisher = testEmail("map-builder");
  const user = await createUser(publisher, "publisher");
  const { data, error } = await service
    .from("entries")
    .insert({
      slug: `e2e-map-builder-${run}`,
      kind: "entry",
      title: `E2E map builder ${run}`,
      summary: "A topic for the map builder test.",
      category: "Society",
      status: "draft",
      owner_id: user.id,
    })
    .select("id")
    .single();
  if (error) throw error;
  entryId = data.id;
});

/** The numbers after "Readers see …" (west, south, east, north). */
async function framed(status: Locator) {
  const text = (await status.textContent()) ?? "";
  const numbers = /·\s*(-?[\d.]+), (-?[\d.]+), (-?[\d.]+), (-?[\d.]+)/.exec(text);
  return numbers ? numbers.slice(1).join(", ") : "";
}

/** Drags the map by (dx, dy) pixels, as a mouse would. */
async function drag(page: Page, map: Locator, dx: number, dy: number) {
  const box = (await map.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 5 });
  await page.mouse.move(x + dx, y + dy, { steps: 5 });
  await page.mouse.up();
}

test("a free view is saved as left, a point needs a title before the save", async ({ page }) => {
  await signIn(page, publisher, `/admin/content/${entryId}?tab=visuals`);
  const visuals = page.getByRole("region", { name: "Maps & charts of the entry", exact: true });
  await visuals.locator("select[name=kind]").selectOption("map");
  await visuals.locator("input[name=title]").fill(MAP_TITLE);

  const status = visuals.getByTestId("map-view-status");
  await expect(status).toContainText("free view");
  await expect(status).toContainText("Saved when you add the map");
  const map = visuals.locator('div[role=region][aria-label="Map"]');
  // The map loads as it nears the viewport.
  await map.scrollIntoViewIfNeeded();
  // The zoom buttons come once the map has loaded.
  await expect(map.getByRole("button", { name: "Zoom in" })).toBeVisible({ timeout: 20_000 });

  // Moving the map in a free view moves the framing with it.
  const before = await framed(status);
  await drag(page, map, -160, 60);
  await expect.poll(() => framed(status)).not.toBe(before);
  const left = await framed(status);

  // A point, then its title cleared: flagged at once, by the field and above the map.
  await visuals.getByRole("button", { name: "Add points" }).click();
  const box = (await map.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.6);
  const points = visuals.getByRole("tabpanel", { name: "Points" });
  const title = points.getByRole("textbox", { name: "Title" });
  await expect(title).toHaveValue("Point 1");
  await title.fill("");
  await expect(title).toHaveAttribute("aria-invalid", "true");
  await expect(points.getByText("Give the point a title")).toBeVisible();
  await expect(visuals.getByTestId("map-untitled-points")).toContainText("A point has no title");

  // Saving says why it can't, next to the button; nothing is stored.
  await visuals.getByRole("button", { name: "Add map or chart" }).click();
  await expect(visuals.getByText(/A point on the map has no title/).first()).toBeVisible();
  const none = await service.from("visuals").select("id").eq("entry_id", entryId);
  expect(none.data).toEqual([]);

  await title.fill("Venue of the talks");
  await expect(visuals.getByTestId("map-untitled-points")).toHaveCount(0);
  await visuals.getByRole("button", { name: "Add map or chart" }).click();
  // (Not "Point added." of the builder's own status line.)
  await expect(visuals.getByRole("status").filter({ hasText: /^Added\.$/ })).toBeVisible();

  // Stored with the view the map was left at.
  const { data, error } = await service.from("visuals").select("map_spec").eq("entry_id", entryId);
  expect(error).toBeNull();
  expect(data).toHaveLength(1);
  const spec = data![0]!.map_spec as { view: { mode: string; bounds: number[] } };
  expect(spec.view.mode).toBe("bounds");
  expect(spec.view.bounds.map((value) => value.toFixed(1)).join(", ")).toBe(left);
});

test("the saved view is shown, a moved one can be reset to it", async ({ page }) => {
  await signIn(page, publisher, `/admin/content/${entryId}?tab=visuals`);
  const visuals = page.getByRole("region", { name: "Maps & charts of the entry", exact: true });
  await visuals.getByRole("link", { name: MAP_TITLE }).click();
  await expect(visuals.getByText(`Edit “${MAP_TITLE}”`)).toBeVisible();

  const status = visuals.getByTestId("map-view-status");
  await expect(status).toContainText("Saved view");
  const saved = await framed(status);
  const map = visuals.locator('div[role=region][aria-label="Map"]');
  // The map loads as it nears the viewport.
  await map.scrollIntoViewIfNeeded();
  await expect(map.getByRole("button", { name: "Venue of the talks" })).toBeVisible({
    timeout: 20_000,
  });

  await drag(page, map, 120, -40);
  await expect(status).toContainText("Changed — saved when you save the map");
  await expect(status).toContainText(
    `Saved view: the view you leave the map at (free view) · ${saved}`,
  );
  await status.getByRole("button", { name: "Reset to saved view" }).click();
  await expect(status.getByText("Saved view", { exact: true })).toBeVisible();
  await expect(status).not.toContainText("Changed");
  expect(await framed(status)).toBe(saved);
});
