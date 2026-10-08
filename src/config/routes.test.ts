import { describe, expect, it } from "vitest";
import { PRIVATE_PATHS, ROUTE_PREFIX, isAtOrUnder, routes, segmentAfter } from "./routes";

describe("routes", () => {
  it("builds the public page addresses", () => {
    expect(routes.country("ukraine")).toBe("/country/ukraine");
    expect(routes.region("sub-saharan-africa")).toBe("/region/sub-saharan-africa");
    expect(routes.issue("sahel")).toBe("/global-issue/sahel");
    expect(routes.news("sahel-coup-belt")).toBe("/news/sahel-coup-belt");
    expect(routes.topic("migrant-smuggling")).toBe("/topics/migrant-smuggling");
    expect(routes.topic("migrant-smuggling", "topic-2")).toBe("/topics/migrant-smuggling#topic-2");
    expect(routes.topic("migrant-smuggling", "")).toBe("/topics/migrant-smuggling");
    expect(routes.topic("migrant-smuggling", null)).toBe("/topics/migrant-smuggling");
    expect(routes.author("jana-novak")).toBe("/authors/jana-novak");
    expect(routes.view("hdi")).toBe("/view/hdi");
    expect(routes.view("hdi", "hun")).toBe("/view/hdi#hun");
  });

  it("maps an article to its address by kind", () => {
    expect(routes.article("entry", "migrant-smuggling")).toBe("/topics/migrant-smuggling");
    expect(routes.article("news", "sahel-coup-belt")).toBe("/news/sahel-coup-belt");
  });

  it("inserts slugs as they are (the database allows only [a-z0-9-])", () => {
    // Same output as the hand-built template literals it replaced.
    expect(routes.country("a b/č")).toBe("/country/a b/č");
    expect(routes.news("x?y#z")).toBe("/news/x?y#z");
    expect(routes.issue("")).toBe("/global-issue/");
  });

  it("encodes only the search query", () => {
    expect(routes.searchFor("Côte d'Ivoire & co")).toBe(
      `/search?q=${encodeURIComponent("Côte d'Ivoire & co")}`,
    );
    expect(routes.searchFor("a b")).toBe("/search?q=a%20b");
  });

  it("keeps the static addresses", () => {
    expect(routes).toMatchObject({
      home: "/",
      topics: "/topics",
      countries: "/countries",
      newsIndex: "/news",
      about: "/about",
      search: "/search",
      newsletter: "/newsletter",
      membership: "/membership",
      checkout: "/membership/checkout",
      thankYou: "/membership/thank-you",
      manageMembership: "/membership/manage",
      privacy: "/privacy",
      terms: "/terms",
      accessibility: "/accessibility",
      login: "/login",
      loginConfirm: "/login/confirm",
      account: "/ucet",
      invitation: "/pozvanka",
      admin: "/admin",
    });
    expect(ROUTE_PREFIX.issue).toBe("/global-issue");
    expect(ROUTE_PREFIX.author).toBe("/authors");
  });

  it("lists the private paths for robots.txt", () => {
    expect(PRIVATE_PATHS).toEqual([
      "/membership/checkout",
      "/membership/thank-you",
      "/membership/manage",
      "/preview/",
      "/ucet",
      "/pozvanka",
    ]);
  });

  it("matches a page and the pages under it", () => {
    expect(isAtOrUnder("/topics", "/topics")).toBe(true);
    expect(isAtOrUnder("/topics/x", "/topics")).toBe(true);
    expect(isAtOrUnder("/topicsx", "/topics")).toBe(false);
    expect(isAtOrUnder("/", "/topics")).toBe(false);
  });

  it("reads the segment after a prefix", () => {
    expect(segmentAfter("/global-issue/sahel", ROUTE_PREFIX.issue)).toBe("sahel");
    expect(segmentAfter("/global-issue/sahel/more", ROUTE_PREFIX.issue)).toBe("sahel");
    expect(segmentAfter("/global-issue/", ROUTE_PREFIX.issue)).toBeUndefined();
    expect(segmentAfter("/global-issue", ROUTE_PREFIX.issue)).toBeUndefined();
    expect(segmentAfter("/global-issues/sahel", ROUTE_PREFIX.issue)).toBeUndefined();
    expect(segmentAfter("/region/sahel", ROUTE_PREFIX.issue)).toBeUndefined();
  });
});
