import { describe, expect, it } from "vitest";
import { AreaInput } from "./schema";

const base = {
  slug: "donbas",
  name: "Donbas",
  label: "",
  note: "",
  fill: "#FF0000",
  stroke: "#990000",
};
const ring = [
  [37, 47],
  [40, 47],
  [40, 49],
  [37, 47],
];

describe("AreaInput", () => {
  it("přijme Polygon i Feature a barvy převede na malá písmena", () => {
    const polygon = AreaInput.parse({
      ...base,
      geometry: JSON.stringify({ type: "Polygon", coordinates: [ring] }),
    });
    expect(polygon.fill).toBe("#ff0000");
    const feature = AreaInput.parse({
      ...base,
      geometry: JSON.stringify({
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [ring] },
      }),
    });
    expect(feature.geometry.coordinates[0]).toHaveLength(4);
  });

  it("odmítne neuzavřený obrazec, souřadnice mimo rozsah a nesmysl", () => {
    const open = { type: "Polygon", coordinates: [[...ring.slice(0, 3), [38, 48]]] };
    expect(AreaInput.safeParse({ ...base, geometry: JSON.stringify(open) }).success).toBe(false);
    const far = {
      type: "Polygon",
      coordinates: [
        [
          [200, 0],
          [0, 0],
          [0, 1],
          [200, 0],
        ],
      ],
    };
    expect(AreaInput.safeParse({ ...base, geometry: JSON.stringify(far) }).success).toBe(false);
    expect(AreaInput.safeParse({ ...base, geometry: "{nope" }).success).toBe(false);
  });
});
