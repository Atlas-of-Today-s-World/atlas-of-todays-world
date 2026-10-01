import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RAIL, RAIL_WIDE, TOUCH_MIN_PX, railKind, railWidthPx } from "./layout";

const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");

describe("layout tokeny", () => {
  it("CSS proměnné odpovídají config/layout.ts", () => {
    expect(css).toContain(`--rail-width: min(${RAIL.vw}vw, ${RAIL.rem}rem);`);
    expect(css).toContain(`--rail-width-wide: min(${RAIL_WIDE.vw}vw, ${RAIL_WIDE.rem}rem);`);
    expect(css).toContain(`--touch-min: ${TOUCH_MIN_PX}px;`);
  });

  it("rozpozná druh panelu podle cesty", () => {
    expect(railKind("/")).toBe("none");
    expect(railKind("/country/ukraine")).toBe("normal");
    expect(railKind("/region/sub-saharan-africa")).toBe("wide");
    expect(railKind("/news/sahel-coup-belt")).toBe("wide");
    expect(railKind("/global-issue/sahel")).toBe("wide");
  });

  it("spočítá šířku panelu", () => {
    expect(railWidthPx("normal", 500)).toBe(0);
    expect(railWidthPx("none", 1400)).toBe(0);
    expect(railWidthPx("normal", 1000)).toBe(380);
    expect(railWidthPx("normal", 2000)).toBe(432);
    expect(railWidthPx("wide", 2000)).toBe(736);
  });
});
