import { describe, expect, it } from "vitest";
import { toEditableVisuals, toVisualItems, type VisualRow } from "./rows";
import { EMBED_HINT, HTML_TOO_LONG, VisualInput } from "./schema";
import { emptyMapSpec } from "./map/types";

const CHART = "https://datawrapper.dwcdn.net/aB3dE/2/";
const EMBED = `<iframe title="Chart" id="datawrapper-chart-aB3dE" src="${CHART}" scrolling="no" height="420"></iframe><script type="text/javascript">!function(){}();</script>`;
const REGION = { owner_kind: "region", owner_key: "east-asia" };

const parse = (fields: Record<string, unknown>) =>
  VisualInput.safeParse({ ...REGION, kind: "embed", title: "Refugees", ...fields });

const issueAt = (result: ReturnType<typeof parse>) => result.error?.issues[0]?.path;

describe("VisualInput", () => {
  it("keeps only the provider and the chart URL from a pasted embed code", () => {
    const parsed = parse({ embed: EMBED, caption: " UNHCR ", height: "" });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({
      id: undefined,
      owner: { kind: "region", key: "east-asia" },
      visual: {
        kind: "embed",
        title: "Refugees",
        caption: "UNHCR",
        source_label: "",
        source_url: null,
        provider: "datawrapper",
        embed_url: CHART,
        image_url: null,
        height: null,
        map_spec: null,
        html: null,
      },
    });
  });

  it("detects each provider from a link", () => {
    for (const [embed, provider] of [
      ["https://public.flourish.studio/visualisation/1810417/", "flourish"],
      ["https://ourworldindata.org/grapher/life-expectancy", "owid"],
      ["https://data.worldbank.org/indicator/SP.POP.TOTL?locations=CZ", "worldbank"],
    ]) {
      expect(parse({ embed }).data?.visual.provider).toBe(provider);
    }
  });

  it.each([
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["another host", "https://evil.example/aB3dE/2/"],
    ["srcdoc", `<iframe srcdoc="<script>alert(1)</script>" src="${CHART}"></iframe>`],
    ["an iframe of another host", `<iframe src="https://evil.example/"></iframe>`],
    ["nothing", ""],
  ])("refuses an embed of %s, with a hint at the field", (_name, embed) => {
    const parsed = parse({ embed });
    expect(parsed.success).toBe(false);
    expect(issueAt(parsed)).toEqual(["embed"]);
    expect(parsed.error?.issues[0]?.message).toBe(EMBED_HINT);
  });

  it("an image needs an https picture and stores nothing else", () => {
    const parsed = parse({
      kind: "image",
      image_url: " https://example.org/map.png ",
      embed: EMBED,
    });
    expect(parsed.data?.visual).toMatchObject({
      kind: "image",
      image_url: "https://example.org/map.png",
      provider: null,
      embed_url: null,
    });
    expect(issueAt(parse({ kind: "image", image_url: "" }))).toEqual(["image_url"]);
    expect(issueAt(parse({ kind: "image", image_url: "http://example.org/a.png" }))).toEqual([
      "image_url",
    ]);
  });

  it("a custom map is saved only as a valid map spec", () => {
    const ok = parse({ kind: "map", map_spec: JSON.stringify(emptyMapSpec()) });
    expect(ok.data?.visual).toMatchObject({
      kind: "map",
      map_spec: emptyMapSpec(),
      provider: null,
    });
    const parsed = parse({ kind: "map", map_spec: '{"layers":[]}' });
    expect(issueAt(parsed)).toEqual(["map_spec"]);
    expect(issueAt(parse({ kind: "map", map_spec: "{" }))).toEqual(["map_spec"]);
    expect(
      parse({ kind: "map", map_spec: JSON.stringify({ x: "x".repeat(210_000) }) }).error?.issues[0]
        ?.message,
    ).toBe("The map is too large.");
  });

  it("custom code is stored as pasted, and only for its own kind", () => {
    const code = "<div id=x></div>\n<script>draw('x')</script>";
    expect(parse({ kind: "html", html: code, embed: EMBED }).data?.visual).toMatchObject({
      kind: "html",
      html: code,
      provider: null,
      embed_url: null,
      image_url: null,
      map_spec: null,
    });
    expect(parse({ embed: EMBED, html: code }).data?.visual.html).toBeNull();
    expect(issueAt(parse({ kind: "html", html: "  \n " }))).toEqual(["html"]);
    // The limit is in bytes: 300 000 two-byte characters are over 512 kB.
    const tooLong = parse({ kind: "html", html: "é".repeat(300_000) });
    expect(issueAt(tooLong)).toEqual(["html"]);
    expect(tooLong.error?.issues[0]?.message).toBe(HTML_TOO_LONG);
    expect(parse({ kind: "html", html: "x".repeat(524_288) }).success).toBe(true);
  });

  it("checks the owner, the limits and the source link", () => {
    expect(parse({ owner_kind: "region", owner_key: "East Asia!", embed: CHART }).success).toBe(
      false,
    );
    expect(parse({ owner_kind: "entry", owner_key: "east-asia", embed: CHART }).success).toBe(
      false,
    );
    expect(
      parse({
        owner_kind: "chapter",
        owner_key: "00000000-0000-4000-8000-000000000001",
        embed: CHART,
      }).success,
    ).toBe(true);
    expect(parse({ owner_kind: "country", owner_key: "CZE", embed: CHART }).success).toBe(false);
    expect(issueAt(parse({ title: " ", embed: CHART }))).toEqual(["title"]);
    expect(issueAt(parse({ title: "x".repeat(201), embed: CHART }))).toEqual(["title"]);
    expect(issueAt(parse({ caption: "x".repeat(601), embed: CHART }))).toEqual(["caption"]);
    expect(issueAt(parse({ source_label: "x".repeat(121), embed: CHART }))).toEqual([
      "source_label",
    ]);
    expect(issueAt(parse({ source_url: "javascript:alert(1)", embed: CHART }))).toEqual([
      "source_url",
    ]);
    expect(issueAt(parse({ height: "120", embed: CHART }))).toEqual(["height"]);
    expect(issueAt(parse({ height: "1601", embed: CHART }))).toEqual(["height"]);
    expect(parse({ height: "640", embed: CHART }).data?.visual.height).toBe(640);
    expect(issueAt(parse({ id: "x", embed: CHART }))).toEqual(["id"]);
    expect(issueAt(parse({ kind: "video", embed: CHART }))).toEqual(["kind"]);
  });
});

const row = (fields: Partial<VisualRow>): VisualRow => ({
  id: "v1",
  kind: "embed",
  title: "Chart",
  provider: "datawrapper",
  embed_url: CHART,
  ...fields,
});

describe("toVisualItems", () => {
  it("orders the visuals and keeps what the page may show", () => {
    const items = toVisualItems([
      row({
        id: "b",
        position: 20,
        kind: "image",
        provider: null,
        embed_url: null,
        image_url: "https://x.org/a.png",
      }),
      row({
        id: "a",
        position: 10,
        caption: " Note ",
        source_label: "UNHCR",
        source_url: "https://unhcr.org/",
      }),
      row({
        id: "c",
        position: 30,
        kind: "map",
        provider: null,
        embed_url: null,
        map_spec: emptyMapSpec(),
      }),
      row({ id: "d", position: 40, kind: "html", provider: null, embed_url: null }),
    ]);
    expect(items).toEqual([
      {
        id: "a",
        kind: "embed",
        provider: "datawrapper",
        url: CHART,
        title: "Chart",
        caption: "Note",
        source: { label: "UNHCR", url: "https://unhcr.org/" },
        height: undefined,
      },
      {
        id: "b",
        kind: "image",
        url: "https://x.org/a.png",
        title: "Chart",
        caption: undefined,
        source: undefined,
        height: undefined,
      },
      {
        id: "c",
        kind: "map",
        spec: emptyMapSpec(),
        title: "Chart",
        caption: undefined,
        source: undefined,
        height: undefined,
      },
      // Custom code: only the id — its frame loads the code.
      {
        id: "d",
        kind: "html",
        title: "Chart",
        caption: undefined,
        source: undefined,
        height: undefined,
      },
    ]);
  });

  it("leaves out whatever the database should never have held", () => {
    expect(
      toVisualItems([
        row({ embed_url: "https://evil.example/aB3dE/2/" }),
        row({ provider: "youtube", embed_url: "https://www.youtube.com/embed/x" }),
        row({ provider: "owid", embed_url: CHART }),
        row({ kind: "image", image_url: "javascript:alert(1)" }),
        row({ kind: "image", image_url: "/relative.png" }),
        row({ kind: "map", map_spec: [1, 2] }),
        row({ kind: "map", map_spec: { layers: [] } }),
        row({ kind: "video" }),
        row({ title: "  " }),
      ]),
    ).toEqual([]);
    expect(toVisualItems(null)).toEqual([]);
    // A stored map's popup HTML is sanitized again on the way to the page.
    const stored = emptyMapSpec();
    stored.points.push({
      id: "p1",
      lat: 1,
      lon: 2,
      label: "P",
      showLabel: false,
      color: "#000000",
      size: 18,
      icon: null,
      pulse: false,
      popup: {
        html: '<p onclick="alert(1)">a</p><script>alert(1)</script>',
        font: "sans",
        size: "md",
        color: "#000000",
        background: "#ffffff",
        maxWidth: 280,
      },
    });
    const [map] = toVisualItems([row({ kind: "map", map_spec: stored })]);
    expect(map?.kind === "map" && JSON.stringify(map.spec)).toContain('"html":"<p>a</p>"');
    // A source link that isn't https is dropped; its label stays.
    expect(
      toVisualItems([row({ source_label: "X", source_url: "http://x.org/" })])[0]?.source,
    ).toEqual({
      label: "X",
      url: undefined,
    });
  });
});

describe("toEditableVisuals", () => {
  it("gives the form strings and keeps the provider only when known", () => {
    const [visual] = toEditableVisuals([
      row({ caption: null, height: 500, updated_at: "2026-10-15" }),
    ]);
    expect(visual).toEqual({
      id: "v1",
      kind: "embed",
      title: "Chart",
      caption: "",
      source_label: "",
      source_url: "",
      provider: "datawrapper",
      embed_url: CHART,
      image_url: "",
      height: 500,
      map_spec: null,
      html: "",
      updated_at: "2026-10-15",
    });
    expect(
      toEditableVisuals([
        row({ kind: "html", provider: null, embed_url: null, html: "<p>x</p>" }),
      ])[0]?.html,
    ).toBe("<p>x</p>");
    expect(toEditableVisuals([row({ provider: "youtube" })])[0]?.provider).toBeNull();
  });
});
