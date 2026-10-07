import { describe, expect, it } from "vitest";
import { topicPrefill, volunteerHref } from "./prefill";

describe("volunteer form prefill", () => {
  it("links to the form on the membership page with the place in the query", () => {
    expect(volunteerHref("Canada")).toBe("/membership?topic=Canada#volunteer");
    expect(volunteerHref("Côte d’Ivoire & co")).toBe(
      "/membership?topic=C%C3%B4te+d%E2%80%99Ivoire+%26+co#volunteer",
    );
  });

  it("reads the place back from the query string", () => {
    expect(topicPrefill("?topic=Canada")).toBe("Canada");
    expect(topicPrefill(new URLSearchParams({ topic: "Côte d’Ivoire & co" }).toString())).toBe(
      "Côte d’Ivoire & co",
    );
  });

  it("is empty without the parameter", () => {
    expect(topicPrefill("")).toBe("");
    expect(topicPrefill("?other=1")).toBe("");
  });

  it("keeps it to one line of plain text, length-capped", () => {
    expect(topicPrefill("?topic=%20Middle%0A%0D%09East%00%20")).toBe("Middle East");
    expect(topicPrefill(`?topic=${"a".repeat(500)}`)).toHaveLength(120);
    // Markup stays inert text (it only ever becomes an input value).
    expect(topicPrefill("?topic=%3Cb%3EX%3C%2Fb%3E")).toBe("<b>X</b>");
  });
});
