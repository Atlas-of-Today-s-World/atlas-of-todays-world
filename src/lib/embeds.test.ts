import { describe, expect, it } from "vitest";
import {
  EMBED_HEIGHT,
  EMBED_ORIGINS,
  MAX_EMBED_LENGTH,
  canonicalEmbedUrl,
  embedFromUrl,
  embedHeight,
  embedSrc,
  parseEmbed,
} from "./embeds";

const CHART = "https://datawrapper.dwcdn.net/aB3dE/2/";
const FLOURISH = "https://flo.uri.sh/visualisation/1810417/embed";
const OWID = "https://ourworldindata.org/grapher/life-expectancy?tab=chart&country=~CZE";
const WORLD_BANK = "https://data.worldbank.org/share/widget?indicators=SP.POP.TOTL&locations=CZ";

/** Datawrapper's "responsive iframe" embed code, as copied from its Publish step. */
const EMBED = `<iframe title="Refugees by country of origin" aria-label="Bar Chart" id="datawrapper-chart-aB3dE" src="https://datawrapper.dwcdn.net/aB3dE/2/" scrolling="no" frameborder="0" style="width: 0; min-width: 100% !important; border: none;" height="420" data-external="1"></iframe><script type="text/javascript">!function(){"use strict";window.addEventListener("message",(function(a){if(void 0!==a.data["datawrapper-height"]){var e=document.querySelectorAll("iframe");for(var t in a.data["datawrapper-height"])for(var r=0;r<e.length;r++)if(e[r].contentWindow===a.source){var i=a.data["datawrapper-height"][t]+"px";e[r].style.height=i}}}))}();
</script>`;

/** Datawrapper's script ("web component") embed. */
const DW_SCRIPT_EMBED = `<div style="min-height:420px" id="datawrapper-vis-aB3dE"><script type="text/javascript" defer src="https://datawrapper.dwcdn.net/aB3dE/embed.js" charset="utf-8" data-target="#datawrapper-vis-aB3dE"></script><noscript><img src="https://datawrapper.dwcdn.net/aB3dE/full.png" alt="Bar Chart" /></noscript></div>`;

/** Flourish's script embed and iframe embed. */
const FLOURISH_SCRIPT = `<div class="flourish-embed flourish-chart" data-src="visualisation/1810417"><script src="https://public.flourish.studio/resources/embed.js"></script><noscript><img src="https://public.flourish.studio/visualisation/1810417/thumbnail" width="100%" alt="chart visualization" /></noscript></div>`;
const FLOURISH_IFRAME = `<iframe src='https://flo.uri.sh/visualisation/1810417/embed' title='Interactive or visual content' class='flourish-embed-iframe' frameborder='0' scrolling='no' style='width:100%;height:600px;' sandbox='allow-same-origin allow-forms allow-scripts allow-downloads allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation'></iframe>`;

/** Our World in Data's embed code (the `&` arrives HTML-escaped). */
const OWID_IFRAME = `<iframe src="https://ourworldindata.org/grapher/life-expectancy?tab=chart&amp;country=~CZE" loading="lazy" style="width: 100%; height: 600px; border: 0px none;" allow="web-share; clipboard-write"></iframe>`;

/** The World Bank data site's Share → Embed code. */
const WORLD_BANK_IFRAME = `<iframe src="https://data.worldbank.org/share/widget?indicators=SP.POP.TOTL&locations=CZ" width='450' height='300' frameBorder='0' scrolling="no" ></iframe>`;

describe("canonicalEmbedUrl", () => {
  it.each([
    ["datawrapper", CHART],
    ["datawrapper", "https://datawrapper.dwcdn.net/aB3dE/"],
    ["flourish", FLOURISH],
    ["flourish", "https://flo.uri.sh/story/123456/embed"],
    ["owid", OWID],
    ["owid", "https://ourworldindata.org/grapher/co2"],
    ["worldbank", WORLD_BANK],
  ])("keeps a stored %s URL", (provider, url) => {
    expect(canonicalEmbedUrl(provider, url)).toBe(url);
  });

  it.each([
    ["unknown provider", "youtube", "https://www.youtube.com/embed/x"],
    ["another provider's URL", "datawrapper", FLOURISH],
    ["Flourish with a query", "flourish", `${FLOURISH}?auto=1`],
    ["OWID with a fragment", "owid", `${OWID}#x`],
    ["OWID with a quote", "owid", 'https://ourworldindata.org/grapher/x?a="b"'],
    ["OWID explorer", "owid", "https://ourworldindata.org/explorers/co2"],
    ["World Bank without a query", "worldbank", "https://data.worldbank.org/share/widget"],
    ["not a string", "owid", 42],
    ["too long", "owid", `https://ourworldindata.org/grapher/${"a".repeat(1000)}`],
  ])("refuses %s", (_name, provider, url) => {
    expect(canonicalEmbedUrl(provider, url)).toBeNull();
  });
});

describe("embedFromUrl", () => {
  it("accepts each provider's chart URL", () => {
    expect(embedFromUrl(CHART)).toEqual({ provider: "datawrapper", url: CHART });
    expect(embedFromUrl(FLOURISH)).toEqual({ provider: "flourish", url: FLOURISH });
    expect(embedFromUrl(OWID)).toEqual({ provider: "owid", url: OWID });
    expect(embedFromUrl(WORLD_BANK)).toEqual({ provider: "worldbank", url: WORLD_BANK });
  });

  it("maps share and page links onto the embed URL", () => {
    expect(embedFromUrl("  https://datawrapper.dwcdn.net/aB3dE/2  ")?.url).toBe(CHART);
    expect(embedFromUrl("HTTPS://DataWrapper.DWCDN.net/aB3dE/2/")?.url).toBe(CHART);
    expect(embedFromUrl("https://www.datawrapper.de/_/aB3dE/")).toEqual({
      provider: "datawrapper",
      url: "https://datawrapper.dwcdn.net/aB3dE/",
    });
    expect(embedFromUrl("https://public.flourish.studio/visualisation/1810417/")?.url).toBe(
      FLOURISH,
    );
    expect(embedFromUrl("https://public.flourish.studio/story/42")?.url).toBe(
      "https://flo.uri.sh/story/42/embed",
    );
    expect(embedFromUrl(`${FLOURISH}?auto=1`)?.url).toBe(FLOURISH);
    expect(embedFromUrl(`${OWID}#fragment`)?.url).toBe(OWID);
    expect(
      embedFromUrl(
        "https://data.worldbank.org/indicator/SP.POP.TOTL?locations=CZ&start=1990&view=chart&name_desc=false",
      ),
    ).toEqual({
      provider: "worldbank",
      url: "https://data.worldbank.org/share/widget?indicators=SP.POP.TOTL&locations=CZ&start=1990&view=chart",
    });
  });

  it.each([
    ["not a string", 42],
    ["empty", ""],
    ["plain http", "http://datawrapper.dwcdn.net/aB3dE/2/"],
    ["protocol-relative", "//datawrapper.dwcdn.net/aB3dE/2/"],
    ["javascript:", "javascript:alert(1)//https://datawrapper.dwcdn.net/aB3dE/2/"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["another host", "https://evil.example/aB3dE/2/"],
    ["another host with the chart in its query", `https://evil.example/?u=${CHART}`],
    ["lookalike suffix", "https://datawrapper.dwcdn.net.evil.com/aB3dE/2/"],
    ["lookalike prefix", "https://evildatawrapper.dwcdn.net/aB3dE/2/"],
    ["subdomain", "https://x.datawrapper.dwcdn.net/aB3dE/2/"],
    ["credentials", "https://datawrapper.dwcdn.net@evil.com/aB3dE/2/"],
    ["user in front", "https://user@datawrapper.dwcdn.net/aB3dE/2/"],
    ["port", "https://datawrapper.dwcdn.net:8443/aB3dE/2/"],
    ["non-numeric version", "https://datawrapper.dwcdn.net/aB3dE/latest/"],
    ["extra path", "https://datawrapper.dwcdn.net/aB3dE/2/full.png"],
    ["path traversal", "https://datawrapper.dwcdn.net/aB3dE/2/../../x/"],
    ["encoded characters", "https://datawrapper.dwcdn.net/aB%33dE/2/"],
    ["Datawrapper query", "https://datawrapper.dwcdn.net/aB3dE/2/?x=1"],
    ["backslashes", "https:\\\\datawrapper.dwcdn.net\\aB3dE\\2\\"],
    ["whitespace inside", "https://datawrapper.dwcdn.net/aB3dE/2/ onload=alert(1)"],
    ["newline inside", "https://datawrapper.dwcdn.net/aB3dE/\n2/"],
    ["Flourish resources", "https://public.flourish.studio/resources/embed.js"],
    ["Flourish non-numeric id", "https://flo.uri.sh/visualisation/abc/embed"],
    ["OWID uppercase chart", "https://ourworldindata.org/grapher/Life-Expectancy"],
    ["OWID quote in the query", 'https://ourworldindata.org/grapher/x?a="><script>'],
    ["OWID angle bracket", "https://ourworldindata.org/grapher/x?a=<b>"],
    ["OWID on www", "https://www.ourworldindata.org/grapher/x"],
    ["DataTopics", "https://datatopics.worldbank.org/sdgatlas/goal-1-no-poverty"],
    ["World Bank site page", "https://www.worldbank.org/en/country/czechrepublic"],
    ["YouTube", "https://www.youtube.com/embed/dQw4w9WgXcQ"],
  ])("refuses %s", (_name, value) => {
    expect(embedFromUrl(value)).toBeNull();
  });
});

describe("parseEmbed", () => {
  it("takes the chart URL out of each provider's embed code", () => {
    expect(parseEmbed(EMBED)).toEqual({ provider: "datawrapper", url: CHART });
    // Pasted into a one-line input: the browser drops line breaks.
    expect(parseEmbed(EMBED.replace(/\n/g, ""))?.url).toBe(CHART);
    expect(parseEmbed(DW_SCRIPT_EMBED)).toEqual({
      provider: "datawrapper",
      url: "https://datawrapper.dwcdn.net/aB3dE/",
    });
    expect(parseEmbed(FLOURISH_SCRIPT)).toEqual({ provider: "flourish", url: FLOURISH });
    expect(parseEmbed(FLOURISH_IFRAME)).toEqual({ provider: "flourish", url: FLOURISH });
    expect(parseEmbed(OWID_IFRAME)).toEqual({ provider: "owid", url: OWID });
    expect(parseEmbed(WORLD_BANK_IFRAME)).toEqual({ provider: "worldbank", url: WORLD_BANK });
  });

  it("accepts a bare link too", () => {
    expect(parseEmbed(` ${CHART}\n`)?.url).toBe(CHART);
    expect(parseEmbed("https://www.datawrapper.de/_/aB3dE/")?.provider).toBe("datawrapper");
  });

  it("reads single-quoted, bare and upper-case attributes and quoted >", () => {
    expect(parseEmbed(`<IFRAME title='a > b' SRC='${CHART}'></IFRAME>`)?.url).toBe(CHART);
    expect(parseEmbed(`<iframe src=${CHART} height=400></iframe>`)?.url).toBe(CHART);
    expect(parseEmbed(`<iframe allowfullscreen src="${CHART}"/>`)?.url).toBe(CHART);
  });

  it("keeps only the URL — extra attributes and scripts are dropped", () => {
    const embed = parseEmbed(
      `<iframe src="${CHART}" onload="alert(document.cookie)" style="position:fixed"></iframe><script>alert(1)</script>`,
    );
    expect(embed).toEqual({ provider: "datawrapper", url: CHART });
  });

  it.each([
    ["not a string", null],
    ["too long", `${EMBED}${" ".repeat(MAX_EMBED_LENGTH)}`],
    ["a script that isn't Datawrapper's", `<script src="${CHART}"></script>`],
    ["an evil script loader", `<script src="https://evil.example/aB3dE/embed.js"></script>`],
    [
      "two Datawrapper scripts",
      `${DW_SCRIPT_EMBED}<script src="https://datawrapper.dwcdn.net/Zz9yX/embed.js"></script>`,
    ],
    ["two iframes", `${EMBED}<iframe src="https://datawrapper.dwcdn.net/Zz9yX/1/"></iframe>`],
    ["no src", `<iframe title="x"></iframe>`],
    ["two src attributes", `<iframe src="https://evil.example/" src="${CHART}"></iframe>`],
    ["srcdoc", `<iframe srcdoc="<script>alert(1)</script>" src="${CHART}"></iframe>`],
    ["srcdoc in upper case", `<iframe SRCDOC='x' src="${CHART}"></iframe>`],
    ["another host", `<iframe src="https://evil.example/aB3dE/2/"></iframe>`],
    ["lookalike host", `<iframe src="https://datawrapper.dwcdn.net.evil.com/aB3dE/2/"></iframe>`],
    ["javascript:", `<iframe src="javascript:alert(1)"></iframe>`],
    ["data:", `<iframe src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="></iframe>`],
    ["protocol-relative", `<iframe src="//datawrapper.dwcdn.net/aB3dE/2/"></iframe>`],
    [
      "entity-encoded scheme",
      `<iframe src="&#104;ttps://datawrapper.dwcdn.net/aB3dE/2/"></iframe>`,
    ],
    ["URL only in text", `<p>${CHART}</p>`],
    ["URL in another attribute", `<iframe title="${CHART}" src="https://evil.example/"></iframe>`],
    ["bare URL with junk after it", `${CHART}" onload="alert(1)`],
    [
      "Flourish data-src of another kind",
      `<div class="flourish-embed" data-src="template/1"></div>`,
    ],
    [
      "two Flourish charts",
      `<div data-src="visualisation/1"></div><div data-src="visualisation/2"></div>`,
    ],
    ["Flourish data-src with a path", `<div data-src="visualisation/1/../../evil"></div>`],
    [
      "an iframe beside a Flourish div",
      `${FLOURISH_SCRIPT}<iframe src="https://evil.example/"></iframe>`,
    ],
  ])("refuses %s", (_name, value) => {
    expect(parseEmbed(value)).toBeNull();
  });
});

describe("embedSrc", () => {
  it("frames a stored URL; Flourish reports its height with ?auto=1", () => {
    expect(embedSrc("datawrapper", CHART)).toBe(CHART);
    expect(embedSrc("flourish", FLOURISH)).toBe(`${FLOURISH}?auto=1`);
    expect(embedSrc("owid", OWID)).toBe(OWID);
  });

  it("frames nothing it doesn't recognise", () => {
    expect(embedSrc("owid", "https://evil.example/grapher/x")).toBeNull();
    expect(embedSrc("image", "https://example.org/a.png")).toBeNull();
    expect(embedSrc(undefined, CHART)).toBeNull();
  });

  it("every provider's frames come from one CSP origin", () => {
    expect(EMBED_ORIGINS).toEqual([
      "https://datawrapper.dwcdn.net",
      "https://flo.uri.sh",
      "https://ourworldindata.org",
      "https://data.worldbank.org",
    ]);
    for (const url of [CHART, FLOURISH, OWID, WORLD_BANK]) {
      const embed = embedFromUrl(url)!;
      expect(EMBED_ORIGINS).toContain(new URL(embedSrc(embed.provider, embed.url)!).origin);
    }
  });
});

describe("embedHeight", () => {
  it("reads the height a Datawrapper chart asks for, clamped", () => {
    expect(embedHeight("datawrapper", { "datawrapper-height": { aB3dE: 512.4 } })).toBe(512);
    expect(embedHeight("datawrapper", { "datawrapper-height": { aB3dE: 10 } })).toBe(
      EMBED_HEIGHT.min,
    );
    expect(embedHeight("datawrapper", { "datawrapper-height": { aB3dE: 1e9 } })).toBe(
      EMBED_HEIGHT.max,
    );
  });

  it("reads Flourish's resize message (a JSON string)", () => {
    const message = (fields: object) =>
      JSON.stringify({ sender: "Flourish", context: "iframe.resize", ...fields });
    expect(embedHeight("flourish", message({ height: 640 }))).toBe(640);
    expect(
      embedHeight("flourish", { source: "Flourish", context: "iframe.resize", height: 700 }),
    ).toBe(700);
    expect(embedHeight("flourish", message({ height: "640px" }))).toBeNull();
    expect(embedHeight("flourish", message({ context: "other", height: 640 }))).toBeNull();
    expect(
      embedHeight("flourish", JSON.stringify({ context: "iframe.resize", height: 640 })),
    ).toBeNull();
  });

  it.each([
    ["not an object", "datawrapper-height"],
    ["null", null],
    ["another message", { type: "resize", height: 400 }],
    ["heights not an object", { "datawrapper-height": 400 }],
    ["heights null", { "datawrapper-height": null }],
    ["no number", { "datawrapper-height": { aB3dE: "400px" } }],
    ["not finite", { "datawrapper-height": { aB3dE: Number.NaN } }],
  ])("ignores %s", (_name, data) => {
    expect(embedHeight("datawrapper", data)).toBeNull();
  });

  it("providers without a resize protocol never resize", () => {
    expect(embedHeight("owid", { "datawrapper-height": { x: 500 } })).toBeNull();
    expect(embedHeight("worldbank", '{"height":500}')).toBeNull();
  });
});
