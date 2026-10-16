import { describe, expect, it } from "vitest";
import {
  addHighlights,
  addLegendItem,
  addPoint,
  applyPopupStyleToAll,
  duplicatePoint,
  emptyHistory,
  frameCamera,
  legendFromPoints,
  moveLegendItem,
  newPointId,
  recordEdit,
  removeLegendItem,
  removePoint,
  sameFraming,
  specBytes,
  toggleHighlight,
  undo,
  untitledPoints,
  updateHighlight,
  updateLegendItem,
  updatePoint,
  withFraming,
} from "./builder-state";
import { parseMapSpec } from "./schema";
import { IRAN_STRIKES_SAMPLE, PALESTINIANS_SAMPLE } from "./samples";
import { DEFAULT_POPUP, emptyMapSpec, MAP_LIMITS, type MapSpec } from "./types";

/** A random source that repeats a fixed sequence. */
const sequence = (...values: number[]) => {
  let index = 0;
  return () => values[index++ % values.length]!;
};

describe("points", () => {
  it("makes a fresh short id, retrying on a clash or an empty draw", () => {
    const id = newPointId([], sequence(0.5));
    expect(id).toMatch(/^[a-z0-9]{1,16}$/);
    expect(newPointId([id], sequence(0.5, 0, 0.25))).not.toBe(id);
  });

  it("adds a point styled like the selected one, with an empty popup", () => {
    const { spec, id } = addPoint(emptyMapSpec(), { lat: 1, lon: 2 });
    expect(spec.points).toEqual([
      expect.objectContaining({ id, lat: 1, lon: 2, label: "Point 1", icon: null, popup: null }),
    ]);
    const template = IRAN_STRIKES_SAMPLE.points[0]!;
    const next = addPoint(spec, { lat: 3, lon: 4 }, template);
    expect(next.spec.points[1]).toMatchObject({
      label: "Point 2",
      color: template.color,
      icon: template.icon,
      pulse: true,
      popup: { ...template.popup, html: "" },
    });
    expect(parseMapSpec(next.spec).ok).toBe(true);
  });

  it("stops at the limit", () => {
    const full: MapSpec = {
      ...emptyMapSpec(),
      points: Array.from({ length: MAP_LIMITS.points }, (_, i) => ({
        ...PALESTINIANS_SAMPLE.points[0]!,
        id: `p${i}`,
      })),
    };
    expect(addPoint(full, { lat: 0, lon: 0 })).toEqual({ spec: full, id: null });
    expect(duplicatePoint(full, "p0")).toEqual({ spec: full, id: null });
  });

  it("updates, removes and duplicates (right after the original, nudged east)", () => {
    const base = IRAN_STRIKES_SAMPLE;
    const renamed = updatePoint(base, "natanz", { label: "Natanz site", id: "hijack" });
    expect(renamed.points[0]).toMatchObject({ id: "natanz", label: "Natanz site" });
    expect(base.points[0]?.label).toBe("Natanz");

    expect(removePoint(base, "natanz").points.map((point) => point.id)).not.toContain("natanz");

    const copy = duplicatePoint(base, "natanz", sequence(0.75));
    expect(copy.spec.points[1]).toMatchObject({
      id: copy.id,
      label: "Natanz (copy)",
      lon: base.points[0]!.lon + 0.5,
    });
    expect(duplicatePoint(base, "missing")).toEqual({ spec: base, id: null });
    const east = updatePoint(base, "natanz", { lon: 179.8 });
    expect(duplicatePoint(east, "natanz").spec.points[1]?.lon).toBeCloseTo(179.3);
  });

  it("gives every popup the same look, keeping each text", () => {
    const styled = applyPopupStyleToAll(PALESTINIANS_SAMPLE, {
      ...DEFAULT_POPUP,
      html: "ignored",
      background: "#0d1324",
    });
    expect(styled.points.every((point) => point.popup?.background === "#0d1324")).toBe(true);
    expect(styled.points[0]?.popup?.html).toBe(PALESTINIANS_SAMPLE.points[0]?.popup?.html);
    const noPopup = updatePoint(PALESTINIANS_SAMPLE, "jor", { popup: null });
    expect(applyPopupStyleToAll(noPopup, DEFAULT_POPUP).points[0]?.popup).toBeNull();
  });
});

describe("highlighted countries", () => {
  it("adds once, up to the limit, and toggles from a map click", () => {
    const spec = addHighlights(emptyMapSpec(), ["IRN", "IRQ", "IRN"]);
    expect(spec.countries.map((country) => country.iso3)).toEqual(["IRN", "IRQ"]);
    expect(addHighlights(spec, ["IRN"])).toBe(spec);
    expect(toggleHighlight(spec, "IRN").countries.map((country) => country.iso3)).toEqual(["IRQ"]);
    expect(toggleHighlight(spec, "SYR").countries).toHaveLength(3);

    const codes = Array.from({ length: 60 }, (_, i) => `C${String(i).padStart(2, "0")}`);
    expect(addHighlights(emptyMapSpec(), codes).countries).toHaveLength(MAP_LIMITS.countries);
  });

  it("restyles one country", () => {
    const spec = updateHighlight(addHighlights(emptyMapSpec(), ["IRN", "IRQ"]), "IRQ", {
      fill: "#000000",
      outline: "#ffffff",
    });
    expect(spec.countries[1]).toMatchObject({ iso3: "IRQ", fill: "#000000", outline: "#ffffff" });
    expect(spec.countries[0]?.fill).not.toBe("#000000");
  });
});

describe("legend", () => {
  const item = (label: string) => ({ label, color: "#000000", icon: null });

  it("adds, edits, moves and removes items", () => {
    let spec = addLegendItem(addLegendItem(emptyMapSpec(), item("a")), item("b"));
    spec = updateLegendItem(spec, 0, { label: "A" });
    expect(spec.legend.items.map((entry) => entry.label)).toEqual(["A", "b"]);
    spec = moveLegendItem(spec, 0, 1);
    expect(spec.legend.items.map((entry) => entry.label)).toEqual(["b", "A"]);
    expect(moveLegendItem(spec, 0, -1)).toBe(spec);
    expect(moveLegendItem(spec, 1, 1)).toBe(spec);
    expect(removeLegendItem(spec, 0).legend.items.map((entry) => entry.label)).toEqual(["A"]);
  });

  it("stops at the limit", () => {
    let spec = emptyMapSpec();
    for (let i = 0; i < MAP_LIMITS.legendItems + 3; i++) spec = addLegendItem(spec, item(`${i}`));
    expect(spec.legend.items).toHaveLength(MAP_LIMITS.legendItems);
  });

  it("makes one item per kind of point", () => {
    expect(legendFromPoints(IRAN_STRIKES_SAMPLE.points)).toEqual([
      { label: "Natanz", color: "#b91c1c", icon: "bomb" },
      { label: "Tehran", color: "#1f2a44", icon: "crosshair" },
      { label: "Shahran depot", color: "#c2410c", icon: "flame" },
    ]);
  });
});

describe("undo history", () => {
  const a = emptyMapSpec();
  const b = { ...a, legend: { ...a.legend, title: "b" } };

  it("records each edit, one step per field while typing", () => {
    let history = recordEdit(emptyHistory(), a, "label");
    history = recordEdit(history, b, "label");
    expect(history.past).toEqual([a]);
    history = recordEdit(history, b);
    expect(history.past).toEqual([a, b]);
    history = recordEdit(history, a);
    expect(history.past).toHaveLength(3);
  });

  it("steps back and forgets the typing group", () => {
    const history = recordEdit(recordEdit(emptyHistory(), a), b, "title");
    const back = undo(history);
    expect(back?.spec).toBe(b);
    expect(back?.history).toEqual({ past: [a], key: null });
    expect(undo(emptyHistory())).toBeNull();
  });

  it("keeps the last 50 steps", () => {
    let history = emptyHistory();
    for (let i = 0; i < 60; i++) history = recordEdit(history, a);
    expect(history.past).toHaveLength(50);
  });
});

it("measures the spec as stored (jsonb text: a space after each : and ,)", () => {
  expect(specBytes(emptyMapSpec())).toBeGreaterThan(JSON.stringify(emptyMapSpec()).length);
  // UTF-8 ("≈" is 3 bytes) on top of the separators.
  expect(specBytes(PALESTINIANS_SAMPLE)).toBeGreaterThan(
    JSON.stringify(PALESTINIANS_SAMPLE).length,
  );
});

describe("points without a title", () => {
  it("are the ones whose title is empty or blank", () => {
    const one = addPoint(emptyMapSpec(), { lat: 1, lon: 2 }, null, sequence(0.11)).spec;
    const two = addPoint(one, { lat: 3, lon: 4 }, null, sequence(0.22)).spec;
    expect(untitledPoints(two)).toEqual([]);
    const [first, second] = two.points;
    const blank = updatePoint(updatePoint(two, first!.id, { label: "  " }), second!.id, {
      label: "",
    });
    expect(untitledPoints(blank).map((point) => point.id)).toEqual([first!.id, second!.id]);
    // The server refuses the same map, naming the first one as the builder does.
    const parsed = parseMapSpec(blank);
    expect(parsed.ok ? "" : parsed.error).toBe("Point 1, title: Please fill this in.");
  });
});

describe("the framing", () => {
  const countries: MapSpec = {
    ...emptyMapSpec(),
    view: {
      ...emptyMapSpec().view,
      mode: "countries",
      countries: ["CZE", "AUT"],
      bounds: [9, 45, 20, 52],
    },
  };

  it("is the same only with the same mode, area, countries and region", () => {
    const view = countries.view;
    expect(sameFraming(view, structuredClone(view))).toBe(true);
    expect(sameFraming(view, { ...view, mode: "bounds" })).toBe(false);
    expect(sameFraming(view, { ...view, bounds: [9, 45, 20, 52.1] })).toBe(false);
    expect(sameFraming(view, { ...view, countries: ["CZE"] })).toBe(false);
    expect(sameFraming(view, { ...view, region: { slug: "europe", name: "Europe" } })).toBe(false);
    // The look is not part of it.
    const globe: MapSpec["view"] = { ...view, projection: "globe", basemap: "satellite" };
    expect(sameFraming(view, globe)).toBe(true);
  });

  it("comes back from the saved view, keeping the look", () => {
    const satellite = { ...countries, view: { ...countries.view, basemap: "satellite" as const } };
    const reset = withFraming(frameCamera(satellite, [0, 0, 5, 5]), countries.view);
    expect(sameFraming(reset.view, countries.view)).toBe(true);
    expect(reset.view.basemap).toBe("satellite");
    expect(reset.view.bounds).not.toBe(countries.view.bounds);
  });

  it("follows the map in a free view, keeping the camera's own array", () => {
    const camera: MapSpec["view"]["bounds"] = [13.9, 49.6, 14.9, 50.5];
    const framed = frameCamera(countries, camera);
    expect(framed.view.mode).toBe("bounds");
    expect(framed.view.bounds).toBe(camera);
    expect(framed.view.countries).toEqual(["CZE", "AUT"]);
    expect(parseMapSpec(framed).ok).toBe(true);
  });
});
