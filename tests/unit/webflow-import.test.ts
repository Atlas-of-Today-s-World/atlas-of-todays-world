import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildRedirects,
  clip,
  isoDate,
  isWebflowFile,
  mapCollection,
  normalizePath,
  parseCsv,
  plain,
  readItems,
  rewriteFiles,
  webflowFiles,
  youtubeIds,
} from "../../scripts/webflow/core.mjs";
import config from "../../scripts/webflow/mapping.config.mjs";

const FIXTURES = resolve(__dirname, "fixtures/webflow");
const fixture = (name: string) => readFileSync(resolve(FIXTURES, name), "utf8");
const collection = (name: string) => config.collections.find((c) => c.name === name)!;

describe("čtení exportu", () => {
  it("CSV: uvozovky, zdvojené uvozovky, nový řádek v poli, BOM", () => {
    const rows = parseCsv('﻿Name,Note\r\n"A, b","say ""hi""\nthere"\r\nC,\r\n');
    expect(rows).toEqual([
      { Name: "A, b", Note: 'say "hi"\nthere' },
      { Name: "C", Note: "" },
    ]);
  });

  it("CSV export vynechá koncepty a pole převede na klíče ve tvaru slugu", () => {
    const items = readItems(fixture("global-issues.csv"), "csv");
    expect(items.map((item: { slug: string }) => item.slug)).toEqual(["sahel-coups-explained"]);
    expect(items[0].fields["main-image"]).toContain("website-files.com");
    expect(items[0].fields["post-body"]).toContain("second line");
  });

  it("JSON z API v2 vynechá koncepty a rozbalí fieldData", () => {
    const items = readItems(fixture("mena-timeline.json"), "json");
    expect(items.map((item: { slug: string }) => item.slug)).toEqual([
      "arab-spring",
      "abraham-accords",
    ]);
    expect(items[0].fields.image).toEqual({
      url: "https://uploads-ssl.webflow.com/abc/arab-spring.png",
      alt: "",
    });
  });
});

describe("pomocníci", () => {
  it("prostý text, zkrácení, datum", () => {
    expect(plain("<p>A &amp; B</p><p>C</p>")).toBe("A & B\nC");
    expect(clip("one two three four", 10)).toBe("one two…");
    expect(clip("short", 10)).toBe("short");
    expect(isoDate("Wed Mar 05 2025 10:00:00 GMT+0000")).toBe("2025-03-05");
    expect(isoDate("nesmysl")).toBeNull();
  });

  it("YouTube: všechny tvary odkazu, každé video jednou", () => {
    expect(
      youtubeIds(
        "https://youtu.be/aqz-KE-bpKQ https://www.youtube.com/embed/dQw4w9WgXcQ https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      ),
    ).toEqual(["aqz-KE-bpKQ", "dQw4w9WgXcQ"]);
  });

  it("soubory z Webflow CDN se najdou a přepíšou, cizí ne", () => {
    const html =
      '<img src="https://cdn.prod.website-files.com/a/b.jpg"><img src="https://example.org/c.jpg">';
    expect(webflowFiles(html)).toEqual(["https://cdn.prod.website-files.com/a/b.jpg"]);
    expect(isWebflowFile("https://evil-website-files.com/x.jpg")).toBe(false);
    expect(
      rewriteFiles(
        html,
        new Map([["https://cdn.prod.website-files.com/a/b.jpg", "https://s/x.jpg"]]),
      ),
    ).toBe('<img src="https://s/x.jpg"><img src="https://example.org/c.jpg">');
  });

  it("cesty přesměrování bez domény a koncového lomítka", () => {
    expect(normalizePath("https://atlasoftodaysworld.org/post/abc/")).toBe("/post/abc");
    expect(normalizePath("adecadeofwarinukraine")).toBe("/adecadeofwarinukraine");
  });
});

describe("mapování podle konfigurace", () => {
  it("Global Issues → plánovaná hesla: slug, kategorie, perex, bez textu", () => {
    const { rows } = mapCollection(
      readItems(fixture("global-issues.csv"), "csv"),
      collection("global-issues-topics"),
    );
    expect(rows).toEqual([
      {
        slug: "sahel-coups-explained",
        kind: "entry",
        status: "planned",
        title: "Sahel coups, explained",
        summary: 'Why "coup belt" is back.',
        category: "Political System",
        region_slug: null,
        special_slug: null,
        body_html: "",
        countries: [],
      },
    ]);
  });

  it("časová osa MENA z API: rok, popis jako prostý text, obrázek", () => {
    const { rows } = mapCollection(
      readItems(fixture("mena-timeline.json"), "json"),
      collection("mena-timeline"),
    );
    expect(rows).toEqual([
      {
        date_label: "2011",
        title: "Arab Spring",
        body: "Protests spread across the region.",
        image_url: "https://uploads-ssl.webflow.com/abc/arab-spring.png",
      },
      {
        date_label: "2020",
        title: "Abraham Accords",
        body: "Normalisation & trade.",
        image_url: null,
      },
    ]);
  });

  it("videa → zdroje „Videos & Documentaries“ s náhledem", () => {
    const { rows } = mapCollection(
      readItems(fixture("mena-videos.csv"), "csv"),
      collection("mena-videos"),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      kind: "Videos & Documentaries",
      url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      image_url: "https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg",
    });
  });

  it("přesměrování: všech šest starých stránek vede na existující cesty Atlasu", () => {
    const rows = buildRedirects(config, new Map());
    expect(rows.map((row) => row.from_path)).toEqual([
      "/about-us",
      "/membership",
      "/middle-east-and-north-africa",
      "/russia",
      "/adecadeofwarinukraine",
      "/global-issues",
    ]);
    expect(rows.every((row) => row.permanent && row.to_path.startsWith("/"))).toBe(true);
  });

  it("přesměrování: vzor kolekce, bez duplicit a bez cesty samé na sebe", () => {
    const items = new Map([["posts", readItems(fixture("global-issues.csv"), "csv")]]);
    const rows = buildRedirects(
      {
        collections: [{ name: "posts", oldPath: "/post/{slug}", newPath: "/news/{slug}" }],
        redirects: [
          { from: "/post/sahel-coups-explained", to: "/elsewhere" },
          { from: "/same", to: "/same/" },
        ],
      },
      items,
    );
    expect(rows).toEqual([
      { from_path: "/post/sahel-coups-explained", to_path: "/elsewhere", permanent: true },
    ]);
  });
});

describe("importér nanečisto", () => {
  it("bez --apply nic nezapíše a ohlásí chybějící soubory", () => {
    const output = execFileSync(
      process.execPath,
      ["scripts/import-webflow.mjs", "--dir", FIXTURES],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    expect(output).toContain("global-issues-topics: 1 položek → 1 řádků");
    expect(output).toContain("mena-timeline: 2 položek → 2 řádků");
    expect(output).toContain("Nanečisto — nic se nezapsalo");
  });

  it("--apply bez odpovídajícího --project odmítne zápis", () => {
    expect(() =>
      execFileSync(
        process.execPath,
        [
          "scripts/import-webflow.mjs",
          "--dir",
          FIXTURES,
          "--apply",
          "--project",
          "prod",
          "--env",
          "nic",
        ],
        {
          encoding: "utf8",
          stdio: "pipe",
          // Cizí projekt v adrese: --project prod k němu nesedí.
          env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" },
        },
      ),
    ).toThrow(/Zápis odmítnut/);
  });
});
