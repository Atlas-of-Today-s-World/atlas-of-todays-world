import { describe, expect, it } from "vitest";
import { COLLECTIONS } from "./schema";

const CHART = "https://datawrapper.dwcdn.net/aB3dE/2/";
const EMBED = `<iframe title="Chart" id="datawrapper-chart-aB3dE" src="${CHART}" scrolling="no" height="420"></iframe><script type="text/javascript">!function(){}();</script>`;

const visual = (item: Record<string, unknown>) =>
  COLLECTIONS.visuals.safeParse({ title: "Refugees", ...item });

describe("portrait visuals", () => {
  it("keeps only the chart URL from pasted Datawrapper embed code", () => {
    const parsed = visual({ provider: "datawrapper", url: EMBED });
    expect(parsed.success && parsed.data).toEqual({
      provider: "datawrapper",
      title: "Refugees",
      caption: "",
      url: CHART,
    });
  });

  it("switches the type to Datawrapper when a chart is pasted under another type", () => {
    const parsed = visual({ provider: "image", url: EMBED });
    expect(parsed.success && parsed.data.provider).toBe("datawrapper");
  });

  it("refuses a Datawrapper item that isn't a Datawrapper chart, with a hint", () => {
    for (const url of [
      `<iframe src="https://evil.example/aB3dE/2/"></iframe>`,
      "https://datawrapper.dwcdn.net.evil.com/aB3dE/2/",
      `<iframe srcdoc="<script>alert(1)</script>" src="${CHART}"></iframe>`,
    ]) {
      const parsed = visual({ provider: "datawrapper", url });
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0]?.path).toEqual(["url"]);
      expect(parsed.error?.issues[0]?.message).toMatch(/Datawrapper/);
    }
  });

  it("other types still need a plain https URL, and never keep pasted HTML", () => {
    expect(visual({ provider: "image", url: " https://example.org/map.png " }).data?.url).toBe(
      "https://example.org/map.png",
    );
    for (const url of [
      "http://example.org/map.png",
      `<iframe src="https://evil.example/"></iframe>`,
    ]) {
      const parsed = visual({ provider: "image", url });
      expect(parsed.error?.issues[0]?.message).toBe("The URL must start with https://.");
    }
    expect(visual({ provider: "youtube", url: "https://example.org/x" }).success).toBe(false);
  });

  it("passes a non-object through to the object check", () => {
    expect(COLLECTIONS.visuals.safeParse("x").success).toBe(false);
  });
});
