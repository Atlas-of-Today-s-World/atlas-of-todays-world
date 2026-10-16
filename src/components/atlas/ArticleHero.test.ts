import { describe, expect, it } from "vitest";
import { heroStyle, heroWash } from "./ArticleHero";

describe("heroWash", () => {
  it("fades a plain hex colour into night", () => {
    expect(heroWash("#d9534f")).toBe(
      "linear-gradient(135deg, #d9534f 0%, var(--color-space) 55%, var(--color-space-deep) 100%)",
    );
  });

  it("gives nothing for anything but #rrggbb", () => {
    expect(heroWash(undefined)).toBeUndefined();
    expect(heroWash(null)).toBeUndefined();
    expect(heroWash("")).toBeUndefined();
    expect(heroWash("#fff")).toBeUndefined();
    expect(heroWash("red);background:url(https://evil.example)")).toBeUndefined();
  });
});

describe("heroStyle", () => {
  const wash = heroWash("#336699");

  it("uses the page's own colour first", () => {
    expect(heroStyle({ photo: false, background: "#1f3a5f", wash })).toEqual({
      backgroundColor: "#1f3a5f",
    });
    expect(heroStyle({ photo: true, background: "#1f3a5f" })).toEqual({
      backgroundColor: "#1f3a5f",
    });
  });

  it("washes the header only without a photo", () => {
    expect(heroStyle({ photo: false, wash })).toEqual({ backgroundImage: wash });
    expect(heroStyle({ photo: true, wash })).toBeUndefined();
  });

  it("ignores a colour that is not #rrggbb", () => {
    expect(heroStyle({ photo: false, background: "red;position:fixed" })).toBeUndefined();
    expect(heroStyle({ photo: false, background: "red", wash })).toEqual({
      backgroundImage: wash,
    });
  });
});
