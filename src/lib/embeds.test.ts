import { describe, expect, it } from "vitest";
import {
  DATAWRAPPER_HEIGHT,
  MAX_EMBED_LENGTH,
  datawrapperChartUrl,
  datawrapperHeight,
  extractDatawrapperUrl,
} from "./embeds";

const CHART = "https://datawrapper.dwcdn.net/aB3dE/2/";

/** Datawrapper's "responsive iframe" embed code, as copied from its Publish step. */
const EMBED = `<iframe title="Refugees by country of origin" aria-label="Bar Chart" id="datawrapper-chart-aB3dE" src="https://datawrapper.dwcdn.net/aB3dE/2/" scrolling="no" frameborder="0" style="width: 0; min-width: 100% !important; border: none;" height="420" data-external="1"></iframe><script type="text/javascript">!function(){"use strict";window.addEventListener("message",(function(a){if(void 0!==a.data["datawrapper-height"]){var e=document.querySelectorAll("iframe");for(var t in a.data["datawrapper-height"])for(var r=0;r<e.length;r++)if(e[r].contentWindow===a.source){var i=a.data["datawrapper-height"][t]+"px";e[r].style.height=i}}}))}();
</script>`;

describe("datawrapperChartUrl", () => {
  it("accepts a published chart URL and returns it in canonical form", () => {
    expect(datawrapperChartUrl(CHART)).toBe(CHART);
    expect(datawrapperChartUrl("  https://datawrapper.dwcdn.net/aB3dE/2  ")).toBe(CHART);
    expect(datawrapperChartUrl("HTTPS://DataWrapper.DWCDN.net/aB3dE/2/")).toBe(CHART);
    expect(datawrapperChartUrl("https://datawrapper.dwcdn.net/Xy12z/115/")).toBe(
      "https://datawrapper.dwcdn.net/Xy12z/115/",
    );
  });

  it.each([
    ["not a string", 42],
    ["empty", ""],
    ["plain http", "http://datawrapper.dwcdn.net/aB3dE/2/"],
    ["protocol-relative", "//datawrapper.dwcdn.net/aB3dE/2/"],
    ["javascript:", "javascript:alert(1)//https://datawrapper.dwcdn.net/aB3dE/2/"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["another host", "https://evil.example/aB3dE/2/"],
    ["lookalike suffix", "https://datawrapper.dwcdn.net.evil.com/aB3dE/2/"],
    ["lookalike prefix", "https://evildatawrapper.dwcdn.net/aB3dE/2/"],
    ["subdomain", "https://x.datawrapper.dwcdn.net/aB3dE/2/"],
    ["other Datawrapper host", "https://www.datawrapper.de/_/aB3dE/"],
    ["credentials", "https://datawrapper.dwcdn.net@evil.com/aB3dE/2/"],
    ["user in front", "https://user@datawrapper.dwcdn.net/aB3dE/2/"],
    ["port", "https://datawrapper.dwcdn.net:8443/aB3dE/2/"],
    ["no version", "https://datawrapper.dwcdn.net/aB3dE/"],
    ["non-numeric version", "https://datawrapper.dwcdn.net/aB3dE/latest/"],
    ["extra path", "https://datawrapper.dwcdn.net/aB3dE/2/full.png"],
    ["path traversal", "https://datawrapper.dwcdn.net/aB3dE/2/../../x/"],
    ["encoded characters", "https://datawrapper.dwcdn.net/aB%33dE/2/"],
    ["query", "https://datawrapper.dwcdn.net/aB3dE/2/?x=1"],
    ["fragment", "https://datawrapper.dwcdn.net/aB3dE/2/#x"],
    ["backslashes", "https:\\\\datawrapper.dwcdn.net\\aB3dE\\2\\"],
    ["whitespace inside", "https://datawrapper.dwcdn.net/aB3dE/2/ onload=alert(1)"],
    ["newline inside", "https://datawrapper.dwcdn.net/aB3dE/\n2/"],
  ])("refuses %s", (_name, value) => {
    expect(datawrapperChartUrl(value)).toBeNull();
  });
});

describe("extractDatawrapperUrl", () => {
  it("takes the chart URL out of Datawrapper's embed code", () => {
    expect(extractDatawrapperUrl(EMBED)).toBe(CHART);
    // Pasted into a one-line input: the browser drops line breaks.
    expect(extractDatawrapperUrl(EMBED.replace(/\n/g, ""))).toBe(CHART);
  });

  it("accepts the bare chart URL too", () => {
    expect(extractDatawrapperUrl(` ${CHART}\n`)).toBe(CHART);
  });

  it("reads single-quoted, bare and upper-case attributes and quoted >", () => {
    expect(extractDatawrapperUrl(`<IFRAME title='a > b' SRC='${CHART}'></IFRAME>`)).toBe(CHART);
    expect(extractDatawrapperUrl(`<iframe src=${CHART} height=400></iframe>`)).toBe(CHART);
    expect(extractDatawrapperUrl(`<iframe allowfullscreen src="${CHART}"/>`)).toBe(CHART);
  });

  it("keeps only the URL — extra attributes and scripts are dropped", () => {
    const url = extractDatawrapperUrl(
      `<iframe src="${CHART}" onload="alert(document.cookie)" style="position:fixed"></iframe><script>alert(1)</script>`,
    );
    expect(url).toBe(CHART);
  });

  it.each([
    ["not a string", null],
    ["too long", `${EMBED}${" ".repeat(MAX_EMBED_LENGTH)}`],
    ["no iframe", `<script src="${CHART}"></script>`],
    [
      "web-component embed",
      `<div id="datawrapper-vis-aB3dE"><script src="https://datawrapper.dwcdn.net/aB3dE/embed.js"></script></div>`,
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
  ])("refuses %s", (_name, value) => {
    expect(extractDatawrapperUrl(value)).toBeNull();
  });
});

describe("datawrapperHeight", () => {
  it("reads the height a chart asks for, clamped", () => {
    expect(datawrapperHeight({ "datawrapper-height": { aB3dE: 512.4 } })).toBe(512);
    expect(datawrapperHeight({ "datawrapper-height": { aB3dE: 10 } })).toBe(DATAWRAPPER_HEIGHT.min);
    expect(datawrapperHeight({ "datawrapper-height": { aB3dE: 1e9 } })).toBe(
      DATAWRAPPER_HEIGHT.max,
    );
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
    expect(datawrapperHeight(data)).toBeNull();
  });
});
