import { describe, expect, it } from "vitest";
import { GLOBE_DATA } from "@/components/map/mapStyle";
import { buildVisualStyle, VISUAL_LAYERS } from "./style";

const light = { basemap: "light", projection: "mercator", labels: true } as const;
const layer = (style: ReturnType<typeof buildVisualStyle>, id: string) =>
  style.layers.find((candidate) => candidate.id === id) as
    (Record<string, unknown> & { paint?: Record<string, unknown> }) | undefined;

describe("buildVisualStyle", () => {
  it("draws the plain light map from the globe's own data, without tiles", () => {
    const style = buildVisualStyle(light, []);
    expect(Object.keys(style.sources)).toEqual(["countries", "country-labels"]);
    expect(style.sources.countries).toMatchObject({ data: GLOBE_DATA.countries });
    expect(style.projection).toEqual({ type: "mercator" });
    expect(layer(style, VISUAL_LAYERS.land)?.paint?.["fill-opacity"]).toBe(1);
  });

  it("adds the globe's satellite imagery and globe projection when asked", () => {
    const style = buildVisualStyle({ ...light, basemap: "satellite", projection: "globe" }, []);
    expect(Object.keys(style.sources)).toContain("satellite");
    expect(style.layers.map((candidate) => candidate.id)).toContain("mv-satellite");
    expect(style.projection).toEqual({ type: "globe" });
  });

  it("colours each highlighted country and outlines only those with an outline", () => {
    const style = buildVisualStyle(light, [
      { iso3: "IRN", fill: "#b91c1c", opacity: 0.2, outline: "#ffffff" },
      { iso3: "IRQ", fill: "#e0a526", opacity: 0.7, outline: null },
    ]);
    const fill = layer(style, VISUAL_LAYERS.highlight);
    expect(fill?.filter).toEqual(["in", ["get", "iso3"], ["literal", ["IRN", "IRQ"]]]);
    expect(fill?.paint?.["fill-color"]).toEqual([
      "match",
      ["get", "iso3"],
      "IRN",
      "#b91c1c",
      "IRQ",
      "#e0a526",
      "#000000",
    ]);
    expect(fill?.paint?.["fill-opacity"]).toEqual([
      "match",
      ["get", "iso3"],
      "IRN",
      0.2,
      "IRQ",
      0.7,
      0,
    ]);
    const outline = layer(style, "mv-highlight-outline");
    expect(outline?.filter).toEqual(["in", ["get", "iso3"], ["literal", ["IRN"]]]);
  });

  it("uses plain values with nothing highlighted, and hides names when asked", () => {
    const style = buildVisualStyle({ ...light, labels: false }, []);
    expect(layer(style, VISUAL_LAYERS.highlight)?.paint?.["fill-color"]).toBe("#000000");
    expect(layer(style, "mv-label")?.layout).toMatchObject({ visibility: "none" });
  });
});
