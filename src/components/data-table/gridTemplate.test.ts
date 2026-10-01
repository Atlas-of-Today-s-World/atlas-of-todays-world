import { describe, expect, it } from "vitest";
import {
  buildGridTemplate,
  columnTrack,
  DEFAULT_COLUMN_WIDTH,
  isContentDependentTrack,
  MIN_COLUMN_PX,
  SELECT_COLUMN_WIDTH,
} from "./gridTemplate";

describe("isContentDependentTrack", () => {
  it("flags tracks sized by their content", () => {
    for (const track of [
      "max-content",
      "min-content",
      "auto",
      "fit-content(200px)",
      "minmax(80px, max-content)",
    ]) {
      expect(isContentDependentTrack(track)).toBe(true);
    }
  });

  it("accepts fixed lengths and fractions", () => {
    for (const track of ["120px", "1fr", "minmax(120px, 1fr)", "minmax(180px, 1.4fr)", "32px"]) {
      expect(isContentDependentTrack(track)).toBe(false);
    }
  });
});

describe("buildGridTemplate", () => {
  const base = { columnWidths: ["200px", undefined], actionsWidth: null, hasSelect: false };

  it("gives a column without width the default track", () => {
    expect(buildGridTemplate(base)).toBe(`200px ${DEFAULT_COLUMN_WIDTH}`);
  });

  it("orders select, data columns, actions", () => {
    expect(buildGridTemplate({ ...base, actionsWidth: "96px", hasSelect: true })).toBe(
      `${SELECT_COLUMN_WIDTH} 200px ${DEFAULT_COLUMN_WIDTH} 96px`,
    );
  });

  it("has one track per rendered cell", () => {
    const out = buildGridTemplate({
      columnWidths: ["1fr", "1fr", "1fr"],
      actionsWidth: "96px",
      hasSelect: true,
    });
    expect(out.split(" ")).toHaveLength(5);
  });

  it("adds no track for actions when there are none", () => {
    expect(buildGridTemplate(base)).not.toMatch(/\s{2}|\s$/);
  });

  it("never produces a content-dependent template", () => {
    const out = buildGridTemplate({
      columnWidths: ["200px", undefined, "minmax(180px, 1.4fr)"],
      actionsWidth: "96px",
      hasSelect: true,
    });
    expect(isContentDependentTrack(out)).toBe(false);
  });
});

describe("columnTrack", () => {
  it("prefers the user's width in px", () => {
    expect(columnTrack("minmax(120px, 1fr)", 240.4)).toBe("240px");
  });

  it("falls back to the definition", () => {
    expect(columnTrack("88px", undefined)).toBe("88px");
    expect(columnTrack(undefined, 0)).toBeUndefined();
  });

  it("never goes below the minimum width", () => {
    expect(columnTrack(undefined, 10)).toBe(`${MIN_COLUMN_PX}px`);
  });
});
