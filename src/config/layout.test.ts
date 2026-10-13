import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DESKTOP_MIN_PX,
  GLOBE_LABEL_MOBILE,
  MINI_GLOBE,
  MOBILE_SHEET,
  RAIL,
  RAIL_WIDE,
  TOUCH_MIN_PX,
  isFullPage,
  railKind,
  railWidthPx,
} from "./layout";

const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");
const rail = readFileSync(join(__dirname, "../components/ContentRail.tsx"), "utf8");

describe("layout tokens", () => {
  it("CSS variables match config/layout.ts", () => {
    expect(css).toContain(`--rail-width: min(${RAIL.vw}vw, ${RAIL.rem}rem);`);
    expect(css).toContain(`--rail-width-wide: min(${RAIL_WIDE.vw}vw, ${RAIL_WIDE.rem}rem);`);
    expect(css).toContain(`--touch-min: ${TOUCH_MIN_PX}px;`);
    expect(css).toContain(`--mini-globe-width: ${MINI_GLOBE.mobile.width}px;`);
    expect(css).toContain(`--mini-globe-height: ${MINI_GLOBE.mobile.height}px;`);
    expect(css).toContain(`@media (min-width: ${MINI_GLOBE.desktopMinPx}px)`);
    expect(css).toContain(`--mini-globe-width: ${MINI_GLOBE.desktop.width}px;`);
    expect(css).toContain(`--mini-globe-height: ${MINI_GLOBE.desktop.height}px;`);
  });

  it("phone rules around the bottom sheet follow its height and the desktop breakpoint", () => {
    const sheet = `${Math.round(MOBILE_SHEET.ratio * 100)}dvh`;
    expect(MOBILE_SHEET.className).toContain(sheet);
    // The globe's place label sits above the sheet, not under it.
    expect(GLOBE_LABEL_MOBILE.sheet).toContain(`bottom-[calc(${sheet}+`);
    // The cookie notice leaves the sheet below the same width as Tailwind `md`.
    expect(css).toContain(`@media (width < ${DESKTOP_MIN_PX / 16}rem)`);
  });

  it("the cookie notice never covers the bottom sheet's handle and close button", () => {
    const phones = css.slice(css.indexOf(`@media (width < ${DESKTOP_MIN_PX / 16}rem)`));
    // The media block ends at the first closing brace at the start of a line.
    const rules = phones.slice(0, phones.search(/\n\}/));
    // Under the sheet in the stacking order, whatever the screen height.
    expect(rules).toContain("z-index: calc(var(--z-index-panel) - 1);");
    // Out of the way while the sheet is pulled up to nearly full height (ContentRail).
    expect(rules).toMatch(
      /:root:has\(\[data-content-rail\]\[data-sheet="expanded"\]\) \[data-cookie-notice\] \{\s*display: none;/,
    );
    expect(rail).toContain('data-sheet={expanded ? "expanded" : undefined}');
  });

  it("detects the panel kind from the path", () => {
    expect(railKind("/")).toBe("none");
    expect(railKind("/country/ukraine")).toBe("normal");
    expect(railKind("/region/sub-saharan-africa")).toBe("wide");
    expect(railKind("/news/sahel-coup-belt")).toBe("wide");
    expect(railKind("/global-issue/sahel")).toBe("wide");
    // The internal route English pages render under on the server.
    expect(railKind("/en")).toBe("none");
    expect(railKind("/en/region/sub-saharan-africa")).toBe("wide");
  });

  it("classifies the same paths as the former route regexes", () => {
    // Before config/routes.ts: wide = /^\/(news|region|global-issue)\//, full = /^\/topics(\/|$)/.
    const wide = /^\/(news|region|global-issue)\//;
    const full = /^\/topics(\/|$)/;
    const paths = [
      "/",
      "/news",
      "/news/",
      "/news/x",
      "/newsletter",
      "/region",
      "/region/x",
      "/region/x/full",
      "/regions/x",
      "/global-issue",
      "/global-issue/sahel",
      "/global-issues/sahel",
      "/country/ukraine",
      "/countries",
      "/view/hdi",
      "/authors/x",
      "/topics",
      "/topics/",
      "/topics/x",
      "/topicsx",
      "/membership",
      "/search",
      "/about",
    ];
    for (const path of paths) {
      const expected =
        path === "/" || full.test(path) ? "none" : wide.test(path) ? "wide" : "normal";
      expect([path, railKind(path)]).toEqual([path, expected]);
      expect([path, railKind(`/en${path === "/" ? "" : path}`)]).toEqual([path, expected]);
      expect([path, isFullPage(path)]).toEqual([path, full.test(path)]);
    }
  });

  it("detects full-width pages", () => {
    expect(isFullPage("/topics")).toBe(true);
    expect(isFullPage("/topics/migrant-smuggling")).toBe(true);
    expect(isFullPage("/en/topics/migrant-smuggling")).toBe(true);
    expect(isFullPage("/")).toBe(false);
    expect(isFullPage("/news/sahel-coup-belt")).toBe(false);
    expect(isFullPage("/topicsx")).toBe(false);
    // No side panel there: the page itself is full width.
    expect(railKind("/topics/migrant-smuggling")).toBe("none");
  });

  it("computes the panel width", () => {
    expect(railWidthPx("normal", 500)).toBe(0);
    expect(railWidthPx("none", 1400)).toBe(0);
    expect(railWidthPx("normal", 1000)).toBe(380);
    expect(railWidthPx("normal", 2000)).toBe(432);
    expect(railWidthPx("wide", 2000)).toBe(736);
  });
});
