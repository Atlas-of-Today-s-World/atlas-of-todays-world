import { describe, expect, it } from "vitest";
import { SITE_URL } from "@/lib/site";
import {
  clampText,
  DEFAULT_OG_IMAGE,
  fullTitle,
  pageMetadata,
  pageTitle,
  TITLE_SUFFIX,
} from "./metadata";

const SITE = SITE_URL.replace(/\/$/, "");

describe("clampText", () => {
  it("keeps short text, collapses whitespace", () => {
    expect(clampText("  A  short\n text ", 160)).toBe("A short text");
  });

  it("cuts at a word boundary with an ellipsis, within the limit", () => {
    const text =
      "The workshop of the global economy and the arena where the century's rivalry plays out.";
    const cut = clampText(text, 40);
    expect(cut.length).toBeLessThanOrEqual(40);
    expect(cut.endsWith("…")).toBe(true);
    expect(text.startsWith(cut.slice(0, -1))).toBe(true);
    expect(cut).not.toMatch(/\s…$/);
  });
});

describe("pageTitle", () => {
  it("adds the qualifier only when the whole title fits 60 characters", () => {
    expect(pageTitle("Food", "Hunger")).toBe("Food — Hunger");
    expect(
      pageTitle("Food Insecurity", "Where hunger is a political outcome, not a harvest failure"),
    ).toBe("Food Insecurity");
  });

  it("drops the brand when even the bare title is too long", () => {
    const long = "A very long encyclopedia entry title about smuggling routes";
    expect(pageTitle(long)).toEqual({ absolute: long });
    expect(fullTitle(pageTitle(long))).toBe(long);
    expect(fullTitle("East Asia")).toBe(`East Asia${TITLE_SUFFIX}`);
    expect(fullTitle(`East Asia${TITLE_SUFFIX}`).length).toBeLessThanOrEqual(60);
  });
});

describe("pageMetadata", () => {
  it("sets canonical, hreflang, og:url and og:locale", () => {
    const meta = pageMetadata({
      locale: "en",
      path: "/region/east-asia",
      title: "East Asia",
      description: "x".repeat(300),
    });
    expect(meta.alternates?.canonical).toBe("/region/east-asia");
    expect(meta.alternates?.languages).toMatchObject({
      en: "/region/east-asia",
      "x-default": "/region/east-asia",
    });
    expect(meta.openGraph).toMatchObject({
      url: `${SITE}/region/east-asia`,
      locale: "en_US",
      images: [{ url: DEFAULT_OG_IMAGE }],
    });
    expect(String(meta.description).length).toBeLessThanOrEqual(160);
    // Absent, not undefined: an undefined key would wipe the root layout's robots
    // (max-image-preview:large) and the segment's opengraph-image when Next merges.
    expect("robots" in meta).toBe(false);
    expect(Object.values(meta)).not.toContain(undefined);
    expect(Object.values(meta.openGraph ?? {})).not.toContain(undefined);
  });

  it("keeps an editor's description whole and marks noindex pages", () => {
    const description = `${"word ".repeat(33)}end`;
    const meta = pageMetadata({
      locale: "en",
      path: "/search",
      title: "Search",
      description,
      authoredDescription: true,
      noindex: true,
    });
    expect(meta.description).toBe(description.trim());
    expect(meta.robots).toMatchObject({ index: false, follow: true });
  });
});
