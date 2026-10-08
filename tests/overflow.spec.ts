import { expect, test, type Page } from "@playwright/test";

/**
 * Layout guard (UX audit 2026-10-08): on the key pages, at a small phone, a
 * common phone and a laptop width, nothing may stick out — no sideways scroll
 * of the page and no text wider than its own box (a label running out of a
 * button, a heading cut by its container). Carousels, tables and other boxes
 * that scroll on purpose, and text cut with an ellipsis by design, are fine.
 */
const PAGES = [
  "/",
  "/region/middle-east-north-africa",
  "/country/ukraine",
  "/global-issue/russia-ukraine-war",
  "/topics",
  "/news",
  "/view/hdi",
  "/about",
  "/membership",
  "/membership/checkout?period=monthly&amount=10",
  "/newsletter",
  "/search?q=Japan",
  "/login",
  "/this-page-does-not-exist",
];
const WIDTHS = [320, 375, 1280];

/** What sticks out on the current page (empty = fine). */
function overflowing(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = [];
    const root = document.documentElement;
    if (root.scrollWidth > innerWidth + 1) {
      problems.push(`page scrolls sideways: ${root.scrollWidth} > ${innerWidth}`);
    }
    const scrolls = (style: CSSStyleDeclaration) =>
      style.overflowX === "auto" || style.overflowX === "scroll";
    const inScroller = (element: Element) => {
      for (
        let node = element.parentElement;
        node && node !== document.body;
        node = node.parentElement
      ) {
        if (scrolls(getComputedStyle(node))) return true;
      }
      return false;
    };
    for (const element of document.body.querySelectorAll<HTMLElement>("*")) {
      const ownText = Array.from(element.childNodes).some(
        (child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
      );
      if (!ownText || ["svg", "canvas"].includes(element.tagName.toLowerCase())) continue;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      // Hidden or visually hidden (sr-only: clipped to nothing) — nobody sees it.
      const clipped = (style.clip && style.clip !== "auto") || style.clipPath !== "none";
      if (box.width <= 1 || box.height <= 1 || style.visibility === "hidden" || clipped) continue;
      if (scrolls(style) || style.textOverflow === "ellipsis" || inScroller(element)) continue;
      if (element.scrollWidth <= element.clientWidth + 1 || element.clientWidth === 0) continue;
      // Wider content counts when it is cut off (overflow hidden) or when the text
      // itself runs out of the box — not for a decorative glow drawn around it.
      let textLeft = Infinity;
      let textRight = -Infinity;
      const range = document.createRange();
      for (const child of element.childNodes) {
        if (child.nodeType !== Node.TEXT_NODE || !child.textContent?.trim()) continue;
        range.selectNodeContents(child);
        for (const rect of range.getClientRects()) {
          textLeft = Math.min(textLeft, rect.left);
          textRight = Math.max(textRight, rect.right);
        }
      }
      const spills = textRight > box.right + 1 || textLeft < box.left - 1;
      if (spills || style.overflowX === "hidden" || style.overflowX === "clip") {
        const name = `${element.tagName.toLowerCase()}.${String(element.className).split(" ").slice(0, 3).join(".")}`;
        problems.push(
          `${name} "${element.textContent?.trim().slice(0, 40)}": ${element.scrollWidth} > ${element.clientWidth}`,
        );
      }
    }
    return problems;
  });
}

test.describe("no overflow", () => {
  // Widths are set here, one browser is enough (the mobile project would repeat it).
  test.skip(({ isMobile }) => isMobile, "widths are set per test");

  for (const path of PAGES) {
    test(`no overflow: ${path}`, async ({ page }) => {
      // Three loads of a page with the globe in one test.
      test.setTimeout(150_000);
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: width < 768 ? 740 : 800 });
        await page.goto(path);
        // The globe keeps fetching tiles; settled layout is what matters, not idle network.
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
        expect(await overflowing(page), `${path} at ${width} px`).toEqual([]);
      }
    });
  }
});
