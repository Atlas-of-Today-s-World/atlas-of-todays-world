import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MINI_GLOBE,
  RAIL,
  RAIL_WIDE,
  TOUCH_MIN_PX,
  isFullPage,
  railKind,
  railWidthPx,
} from "./layout";

const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");

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

  it("detects full-width pages", () => {
    expect(isFullPage("/topics")).toBe(true);
    expect(isFullPage("/entry/migrant-smuggling")).toBe(true);
    expect(isFullPage("/en/entry/migrant-smuggling")).toBe(true);
    expect(isFullPage("/")).toBe(false);
    expect(isFullPage("/news/sahel-coup-belt")).toBe(false);
    expect(isFullPage("/topicsx")).toBe(false);
    // No side panel there: the page itself is full width.
    expect(railKind("/entry/migrant-smuggling")).toBe("none");
  });

  it("computes the panel width", () => {
    expect(railWidthPx("normal", 500)).toBe(0);
    expect(railWidthPx("none", 1400)).toBe(0);
    expect(railWidthPx("normal", 1000)).toBe(380);
    expect(railWidthPx("normal", 2000)).toBe(432);
    expect(railWidthPx("wide", 2000)).toBe(736);
  });
});
