import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GLOBE_COLORS, THEME_COLORS } from "./palette";

const src = join(__dirname, "..");
const css = readFileSync(join(src, "app/globals.css"), "utf8");
const kebab = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** Every component and module source file (stories and tests included, this one not). */
const sources = (readdirSync(src, { recursive: true }) as string[])
  .map((file) => file.replaceAll("\\", "/"))
  .filter((file) => /\.tsx?$/.test(file) && file !== "config/palette.test.ts")
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- the repo's own sources, listed above
  .map((file) => ({ file, text: readFileSync(join(src, file), "utf8") }));

/** Matches of `pattern` per file, as "file: match". */
const findAll = (pattern: RegExp, allowed: string[] = []) =>
  sources.flatMap(({ file, text }) =>
    [...text.matchAll(pattern)]
      .map((match) => `${file}: ${match[0]}`)
      .filter((hit) => !allowed.some((entry) => hit.startsWith(entry))),
  );

describe("palette", () => {
  it("theme colours match their globals.css tokens", () => {
    for (const [name, value] of Object.entries(THEME_COLORS)) {
      expect(css).toContain(`--color-${kebab(name)}: ${value};`);
    }
  });

  it("the topic pulse uses the badge text colour of the globe", () => {
    const start = css.indexOf(".topic-pulse {");
    expect(start).toBeGreaterThan(-1);
    const rule = css.slice(start, css.indexOf("}", start));
    expect(rule).toContain(`  color: ${GLOBE_COLORS.badgeText};`);
  });
});

describe("design tokens in class names", () => {
  it("page layers take their z-index from the named scale", () => {
    // z-[45] or a bare z-45 instead of z-full-page, z-overlay…; z-10 / -z-10 inside a component stay.
    expect(findAll(/(?<![\w-])z-(\[\d+\]|(?!10\b)\d{2,3}\b)/g)).toEqual([]);
  });

  it("colours come from tokens, not hex values", () => {
    const allowed = [
      // Search result preview: the link blue of a search engine, not ours.
      "features/entries/components/SeoForm.tsx: text-[#1a0dab]",
      // Mobile menu backdrop, a near-opaque shade of the space layer.
      "components/MenuDialog.tsx: bg-[#0b101f]",
    ];
    expect(findAll(/[\w:-]+-\[#[\da-fA-F]{3,8}\]/g, allowed)).toEqual([]);
  });
});
