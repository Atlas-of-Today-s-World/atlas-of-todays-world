import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACTIONS_CELL_INSET_PX,
  buildGridTemplate,
  columnTrack,
  DEFAULT_COLUMN_WIDTH,
  isContentDependentTrack,
  MIN_ACTION_SLOTS,
  MIN_COLUMN_PX,
  ROW_ICON_GAP_PX,
  ROW_ICON_PX,
  rowActionsWidth,
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

describe("rowActionsWidth", () => {
  /** Resolves the track for a given icon size (24 px with a mouse, 44 px on touch). */
  const px = (track: string, iconPx = ROW_ICON_PX) => {
    const match = /^calc\((\d+) \* var\(--row-icon, (\d+)px\) \+ (\d+)px\)$/.exec(track);
    if (!match) throw new Error(`Unexpected track: ${track}`);
    expect(Number(match[2])).toBe(ROW_ICON_PX);
    return Number(match[1]) * iconPx + Number(match[3]);
  };

  it("fits the icons, the gaps between them and the cell padding", () => {
    expect([2, 3, 4, 5, 6].map((count) => px(rowActionsWidth(count)))).toEqual([
      63, 89, 115, 141, 167,
    ]);
    for (const count of [2, 3, 6]) {
      expect(px(rowActionsWidth(count))).toBe(
        count * ROW_ICON_PX + (count - 1) * ROW_ICON_GAP_PX + ACTIONS_CELL_INSET_PX,
      );
    }
  });

  it("grows with the 44 px touch buttons", () => {
    expect(px(rowActionsWidth(3), 44)).toBe(3 * 44 + 2 * ROW_ICON_GAP_PX + ACTIONS_CELL_INSET_PX);
  });

  it("is never narrower than two icons, so the header label fits", () => {
    expect(MIN_ACTION_SLOTS).toBe(2);
    expect(rowActionsWidth(0)).toBe(rowActionsWidth(2));
    expect(rowActionsWidth(1)).toBe(rowActionsWidth(2));
  });

  it("counts whole icons", () => {
    expect(rowActionsWidth(2.2)).toBe(rowActionsWidth(3));
  });

  it("is a fixed track, never sized by its content", () => {
    expect(isContentDependentTrack(rowActionsWidth(4))).toBe(false);
  });

  it("matches the button size, gap and cell padding the components use", () => {
    const button = readFileSync(join(__dirname, "../ui/button.tsx"), "utf8");
    const rowActions = readFileSync(join(__dirname, "RowActions.tsx"), "utf8");
    const table = readFileSync(join(__dirname, "DataTable.tsx"), "utf8");
    // Tailwind spacing: 1 unit = 4 px.
    expect(button).toContain(
      `rowIcon: "size-${ROW_ICON_PX / 4} rounded-md pointer-coarse:size-(--touch-min)"`,
    );
    expect(rowActions).toContain(`"flex items-center justify-end gap-${ROW_ICON_GAP_PX / 4}"`);
    // Padding 6 px on both sides + the 1 px sticky border.
    expect(ACTIONS_CELL_INSET_PX).toBe(2 * 6 + 1);
    expect(table).toContain(`"justify-end px-1.5"`); // body cell
    expect(table).toContain(`"justify-end px-1.5 uppercase"`); // header cell
    expect(table).toMatch(/const stickyRight =\s*"sticky right-0 z-1 border-l /);
    expect(table).toContain("pointer-coarse:[--row-icon:var(--touch-min)]");
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
