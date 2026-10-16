import { describe, expect, it } from "vitest";
import { emptyMapSpec, MAP_LIMITS, parseMapSpec, type MapSpec } from ".";
import { IRAN_STRIKES_SAMPLE, PALESTINIANS_SAMPLE } from "./samples";
import { DEFAULT_POPUP, type MapPoint } from "./types";

const point = (index: number, overrides: Partial<MapPoint> = {}): MapPoint => ({
  id: `p${index}`,
  lat: 10,
  lon: 20,
  label: `Point ${index}`,
  showLabel: false,
  color: "#c0392b",
  size: 18,
  icon: null,
  pulse: false,
  popup: null,
  ...overrides,
});

const withPoints = (points: MapPoint[]): MapSpec => ({ ...emptyMapSpec(), points });

const errorOf = (input: unknown) => {
  const result = parseMapSpec(input);
  expect(result.ok).toBe(false);
  return result.ok ? "" : result.error;
};

describe("parseMapSpec", () => {
  it("accepts an empty map and both samples unchanged", () => {
    for (const spec of [emptyMapSpec(), PALESTINIANS_SAMPLE, IRAN_STRIKES_SAMPLE]) {
      const result = parseMapSpec(spec);
      expect(result).toEqual({ ok: true, spec: JSON.parse(JSON.stringify(spec)) });
    }
  });

  it("survives a JSON round trip (as stored in jsonb)", () => {
    const result = parseMapSpec(JSON.parse(JSON.stringify(IRAN_STRIKES_SAMPLE)));
    expect(result.ok).toBe(true);
  });

  it("normalises colours to lowercase", () => {
    const result = parseMapSpec(withPoints([point(1, { color: "#C0392B" })]));
    expect(result.ok && result.spec.points[0]?.color).toBe("#c0392b");
  });

  it("rejects what isn't a map spec", () => {
    expect(errorOf(null)).toMatch(/expected object|Invalid/i);
    expect(errorOf("map")).toBeTruthy();
    expect(errorOf({ ...emptyMapSpec(), version: 2 })).toMatch(/^version: /);
    expect(errorOf({ ...emptyMapSpec(), extra: true })).toMatch(/extra|Unrecognized/i);
  });

  it("names the field that is wrong", () => {
    // Points as the builder names them: numbered from 1, the label is the "title".
    expect(errorOf(withPoints([point(1), point(2, { lat: 91 })]))).toMatch(/^Point 2, latitude: /);
    expect(errorOf(withPoints([point(1, { color: "red" })]))).toMatch(/^Point 1, colour: /);
    expect(errorOf(withPoints([point(1, { size: 49 })]))).toMatch(/^Point 1, size: /);
    expect(errorOf(withPoints([point(1, { size: 5 })]))).toMatch(/^Point 1, size: /);
    expect(errorOf(withPoints([point(1, { icon: "not-an-icon" as never })]))).toMatch(
      /^Point 1, icon: /,
    );
    expect(errorOf(withPoints([point(1, { label: "  " })]))).toBe(
      "Point 1, title: Please fill this in.",
    );
    expect(errorOf(withPoints([point(1, { id: "Bad id" })]))).toMatch(/^Point 1, id: /);
    expect(errorOf(withPoints([point(1, { lon: Number.NaN })]))).toMatch(/^Point 1, longitude: /);
    expect(errorOf(withPoints([point(1, { popup: { ...DEFAULT_POPUP, maxWidth: 5 } })]))).toMatch(
      /^Point 1, popup\.maxWidth: /,
    );
    // Other paths stay as they are.
    expect(errorOf({ ...emptyMapSpec(), legend: { ...emptyMapSpec().legend, title: 5 } })).toMatch(
      /^legend\.title: /,
    );
  });

  it("checks the view box", () => {
    const view = emptyMapSpec().view;
    expect(errorOf({ ...emptyMapSpec(), view: { ...view, bounds: [10, 0, 5, 10] } })).toMatch(
      /^view\.bounds: /,
    );
    expect(errorOf({ ...emptyMapSpec(), view: { ...view, bounds: [-180, 0, 200, 10] } })).toMatch(
      /^view\.bounds: /,
    );
    expect(errorOf({ ...emptyMapSpec(), view: { ...view, bounds: [0, 10, 5, 10] } })).toMatch(
      /^view\.bounds: /,
    );
    // Across the antimeridian: east written past 180.
    expect(
      parseMapSpec({ ...emptyMapSpec(), view: { ...view, bounds: [160, -50, 200, -30] } }).ok,
    ).toBe(true);
    expect(errorOf({ ...emptyMapSpec(), view: { ...view, projection: "albers" } })).toMatch(
      /^view\.projection: /,
    );
  });

  it("holds the limits", () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => point(i));
    expect(parseMapSpec(withPoints(many(MAP_LIMITS.points))).ok).toBe(true);
    expect(errorOf(withPoints(many(MAP_LIMITS.points + 1)))).toMatch(/At most 500 points/);

    const countries = Array.from({ length: MAP_LIMITS.countries + 1 }, (_, i) => ({
      iso3: `A${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`,
      fill: "#e0a526",
      opacity: 0.5,
      outline: null,
    }));
    expect(errorOf({ ...emptyMapSpec(), countries })).toMatch(/At most 50 highlighted/);

    const items = Array.from({ length: MAP_LIMITS.legendItems + 1 }, () => ({
      label: "x",
      color: "#000000",
      icon: null,
    }));
    expect(errorOf({ ...emptyMapSpec(), legend: { ...emptyMapSpec().legend, items } })).toMatch(
      /At most 20 legend items/,
    );
  });

  it("refuses a spec over 200 kB before looking inside", () => {
    const html = `<p>${"x".repeat(MAP_LIMITS.popupHtml - 10)}</p>`;
    const points = Array.from({ length: 45 }, (_, i) =>
      point(i, { popup: { ...DEFAULT_POPUP, html } }),
    );
    expect(errorOf(withPoints(points))).toMatch(/too large \(\d+ kB, at most 200 kB\)/);
  });

  it("refuses input that can't be JSON", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(errorOf(cyclic)).toBe("The map isn't valid JSON.");
    expect(errorOf({ big: 1n })).toBe("The map isn't valid JSON.");
    expect(errorOf(undefined)).toBe("The map isn't valid JSON.");
  });

  it("refuses duplicate point ids and highlighted countries", () => {
    expect(errorOf(withPoints([point(1), point(1)]))).toMatch(/share the id p1/);
    const highlight = { iso3: "IRN", fill: "#b91c1c", opacity: 0.2, outline: null };
    expect(errorOf({ ...emptyMapSpec(), countries: [highlight, highlight] })).toMatch(
      /IRN is highlighted twice/,
    );
  });

  it("needs a colour or an icon on a legend item", () => {
    const legend = { ...emptyMapSpec().legend, items: [{ label: "x", color: null, icon: null }] };
    expect(errorOf({ ...emptyMapSpec(), legend })).toMatch(/colour, an icon or both/);
  });

  it("sanitizes popup HTML (XSS and styles out, formatting and classes in)", () => {
    const html =
      '<p onclick="alert(1)"><strong>A</strong> <span class="rt-color-red" style="position:fixed">red</span></p>' +
      '<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a>' +
      '<iframe src="https://evil.example"></iframe><a href="https://example.org">ok</a>';
    const result = parseMapSpec(withPoints([point(1, { popup: { ...DEFAULT_POPUP, html } })]));
    expect(result.ok).toBe(true);
    const clean = result.ok ? (result.spec.points[0]?.popup?.html ?? "") : "";
    expect(clean).toBe(
      '<p><strong>A</strong> <span class="rt-color-red">red</span></p><a rel="noopener noreferrer" target="_blank">x</a><a href="https://example.org" rel="noopener noreferrer" target="_blank">ok</a>',
    );
  });

  it("caps the popup HTML and its look", () => {
    const long = { ...DEFAULT_POPUP, html: "x".repeat(MAP_LIMITS.popupHtml + 1) };
    expect(errorOf(withPoints([point(1, { popup: long })]))).toMatch(/^Point 1, popup\.html: /);
    for (const popup of [
      { ...DEFAULT_POPUP, maxWidth: 1000 },
      { ...DEFAULT_POPUP, font: "comic" },
      { ...DEFAULT_POPUP, background: "url(x)" },
      { ...DEFAULT_POPUP, extra: 1 },
    ]) {
      expect(errorOf(withPoints([point(1, { popup: popup as never })]))).toMatch(/^Point 1, popup/);
    }
  });
});
