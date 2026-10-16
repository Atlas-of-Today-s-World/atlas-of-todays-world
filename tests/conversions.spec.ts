import { expect, test, type Request } from "@playwright/test";
import { service } from "./support/accounts";

/**
 * Cookie-less conversion counter (features/conversions): a click on "Donate &
 * Join" sends exactly one beacon to /api/e, the server takes it (204) and —
 * where the dev project's service key is at hand — the daily count grows.
 * Against atlas-dev only (never production).
 */
const PROD_REF = "ewbzkxialhtwuqlenjof";
const canReadCounts = Boolean(service) && !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes(PROD_REF);

/** Today's count of donate_click on /membership by visitors not from an AI assistant. */
async function donateCount(): Promise<number> {
  const { data, error } = await service
    .from("conversion_events_daily")
    .select("count")
    .eq("day", new Date().toISOString().slice(0, 10))
    .eq("event", "donate_click")
    .eq("path_group", "/membership")
    .eq("referrer_group", "none")
    .maybeSingle();
  if (error) throw error;
  return (data?.count as number | undefined) ?? 0;
}

const eventOf = (request: Request) => {
  try {
    return (JSON.parse(request.postData() ?? "") as { e?: string }).e;
  } catch {
    return undefined;
  }
};

test.describe("conversions", () => {
  test.skip(({ isMobile }) => isMobile, "desktop project only");

  test("Donate & Join records one donate_click", async ({ page }) => {
    const before = canReadCounts ? await donateCount() : 0;
    const beacons: Request[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/e") beacons.push(request);
    });

    await page.goto("/membership");
    // The beacon is sent by the card's script: wait for it to be running.
    await page.waitForLoadState("networkidle");
    // The card is rendered twice (hero and closing band); use the first one.
    const card = page.locator("main form").first();
    const answered = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/e" &&
        eventOf(response.request()) === "donate_click",
    );
    await card.getByRole("button", { name: "Donate & Join" }).click();
    await expect(page).toHaveURL(/\/membership\/checkout\?/);
    expect((await answered).status()).toBe(204);

    const donations = beacons.filter((request) => eventOf(request) === "donate_click");
    expect(donations).toHaveLength(1);
    expect(donations[0]?.method()).toBe("POST");
    // The body names the event and the page — nothing about the visitor.
    expect(JSON.parse(donations[0]?.postData() ?? "{}")).toEqual({
      e: "donate_click",
      p: "/membership",
    });

    if (canReadCounts) await expect.poll(donateCount).toBeGreaterThan(before);
  });

  test("/api/e refuses what it doesn't count", async ({ request }) => {
    const invalid = await request.post("/api/e", { data: { e: "page_view", p: "/" } });
    expect(invalid.status()).toBe(400);
    const foreign = await request.post("/api/e", {
      data: { e: "share_click", p: "/" },
      headers: { origin: "https://evil.example" },
    });
    expect(foreign.status()).toBe(403);
    expect((await request.get("/api/e")).status()).toBe(405);
  });
});
