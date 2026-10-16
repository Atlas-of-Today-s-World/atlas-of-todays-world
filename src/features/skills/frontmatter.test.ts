import { describe, expect, it } from "vitest";
import { asList, asText, parseFrontmatter } from "./frontmatter";

describe("parseFrontmatter", () => {
  it("reads plain, quoted and listed values and returns the body", () => {
    const { data, body } = parseFrontmatter(
      [
        "---",
        "name: atlas-web",
        'title: "Atlas: the \\"web\\" skill"',
        "description: 'Use it when it''s about # pages' # a comment",
        "roles: [designer, \"front, end\", 'qa']",
        "tags:",
        "  - one",
        "  - 'two'",
        "# a comment",
        "",
        "---",
        "",
        "# Heading",
        "Text",
      ].join("\n"),
    );
    expect(data).toEqual({
      name: "atlas-web",
      title: 'Atlas: the "web" skill',
      description: "Use it when it's about # pages",
      roles: ["designer", "front, end", "qa"],
      tags: ["one", "two"],
    });
    expect(body).toBe("# Heading\nText");
  });

  it("drops a comment after a plain value", () => {
    expect(parseFrontmatter("---\nname: x # the name\n---\n").data).toEqual({ name: "x" });
  });

  it("joins a plain value continued on indented lines", () => {
    const { data } = parseFrontmatter("---\ndescription: one\n  two\n  three\nname: x\n---\n");
    expect(data).toEqual({ description: "one two three", name: "x" });
  });

  it("reads folded and literal blocks", () => {
    const { data } = parseFrontmatter(
      "---\ndescription: >\n  folded\n  text\n\n  next\nnotes: |-\n  line 1\n  line 2\n---\n",
    );
    expect(data.description).toBe("folded text\nnext");
    expect(data.notes).toBe("line 1\nline 2");
  });

  it("skips a nested map and an empty key", () => {
    const { data } = parseFrontmatter("---\nmetadata:\n  version: 1\nempty:\nname: x\n---\nBody");
    expect(data).toEqual({ name: "x" });
  });

  it("handles CRLF and a byte order mark", () => {
    const { data, body } = parseFrontmatter("\uFEFF---\r\nname: x\r\n---\r\nBody\r\n");
    expect(data).toEqual({ name: "x" });
    expect(body).toBe("Body\n");
  });

  it("returns the whole text as the body without frontmatter or without its end", () => {
    expect(parseFrontmatter("# Just text")).toEqual({ data: {}, body: "# Just text" });
    expect(parseFrontmatter("---\nname: x\n")).toEqual({ data: {}, body: "---\nname: x\n" });
  });
});

describe("asText / asList", () => {
  it("turns any value into text or a list", () => {
    expect(asText(undefined)).toBe("");
    expect(asText(" x ")).toBe("x");
    expect(asText(["a", "b"])).toBe("a, b");
    expect(asList(undefined)).toEqual([]);
    expect(asList("designer, frontend")).toEqual(["designer", "frontend"]);
    expect(asList(["a", " ", "b "])).toEqual(["a", "b"]);
  });
});
