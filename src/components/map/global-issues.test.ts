import { describe, expect, it } from "vitest";
import type { ExpressionSpecification } from "maplibre-gl";
import { STATUS_IMAGES, openIssueSlug, statusesOf, withStatusMark } from "./global-issues";

const text = ["match", ["get", "slug"], "mena", "12", "0"] as unknown as ExpressionSpecification;

describe("openIssueSlug", () => {
  it("reads the slug of an open global issue panel", () => {
    expect(openIssueSlug("/global-issue/migration")).toBe("migration");
    expect(openIssueSlug("/en/global-issue/war-in-ukraine")).toBe("war-in-ukraine");
    expect(openIssueSlug("/global-issue/migration/extra")).toBe("migration");
  });

  it("nothing on other pages", () => {
    expect(openIssueSlug("/")).toBeUndefined();
    expect(openIssueSlug("/region/middle-east-north-africa")).toBeUndefined();
    expect(openIssueSlug("/global-issue")).toBeUndefined();
  });
});

describe("statusesOf", () => {
  it("maps each group to its status", () => {
    expect(
      statusesOf({
        mena: { status: "ready" },
        eeca: { status: "preparing" },
        latam: { status: "none" },
      }),
    ).toEqual({ mena: "ready", eeca: "preparing", latam: "none" });
  });
});

describe("withStatusMark", () => {
  it("keeps the plain text while no group has started", () => {
    expect(withStatusMark(text, { mena: "none", latam: "none" })).toBe(text);
    expect(withStatusMark(text, {})).toBe(text);
  });

  it("adds a check mark for ready and an hourglass for groups in preparation", () => {
    expect(
      withStatusMark(text, { mena: "ready", eeca: "preparing", eu: "preparing", x: "none" }),
    ).toEqual([
      "format",
      text,
      {},
      [
        "image",
        [
          "match",
          ["get", "slug"],
          ["mena"],
          STATUS_IMAGES.ready,
          ["eeca", "eu"],
          STATUS_IMAGES.preparing,
          STATUS_IMAGES.none,
        ],
      ],
      { "vertical-align": "center" },
    ]);
  });

  it("leaves out an empty branch (MapLibre refuses empty match labels)", () => {
    const mark = withStatusMark(text, { eeca: "preparing" }, "iso3") as unknown[];
    expect(mark[3]).toEqual([
      "image",
      ["match", ["get", "iso3"], ["eeca"], STATUS_IMAGES.preparing, STATUS_IMAGES.none],
    ]);
  });
});
