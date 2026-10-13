import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Keeps server-side validation out of the browser bundle: Zod (~90 KB gzipped)
 * once shipped on every page because the header's newsletter form imported a
 * constant from a Zod schema module. This walks the import graph from every
 * "use client" module and fails when any module it reaches imports `zod`.
 *
 * Also `@supabase/ssr`: its browser client keeps the session in cookies page
 * scripts can read. Session cookies are httpOnly and every auth flow runs on
 * the server; the browser only has the session-less client in lib/supabase/browser.
 *
 * Boundaries the bundler doesn't cross are not followed: `import type` (erased)
 * and "use server" modules (the client only gets references to the actions).
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = join(ROOT, "src");
const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs"];
/** Packages that must never reach a client bundle. */
const FORBIDDEN = /^(zod|@supabase\/ssr)(\/|$)/;

/** `import … from "x"` and `export … from "x"` (clause: names, braces, `* as`, `type`). */
const STATIC_IMPORT = /\b(?:import|export)([\w\s{},*$]*?)\bfrom\s*["']([^"']+)["']/g;
/** `import "x"` (side effects only) and `import("x")` (a lazy chunk, still client code). */
const BARE_IMPORT = /\bimport\s*\(?\s*["']([^"']+)["']/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.(test|stories)\.tsx?$/.test(name) ? [path] : [];
  });
}

/** `{ type A, type B }` only: erased like `import type` (without verbatimModuleSyntax). */
const onlyTypes = (clause: string) => {
  const named = /^\{([\s\S]*)\}$/.exec(clause.trim());
  if (!named?.[1]) return false;
  const names = named[1]
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return names.length > 0 && names.every((part) => part.startsWith("type "));
};

/** Comments out, so an import clause is matched without spanning other statements. */
const withoutComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");

/** A module's first statement is the directive ("use client", "use server"). */
const hasDirective = (code: string, name: "client" | "server") =>
  [`"use ${name}"`, `'use ${name}'`].some((directive) =>
    withoutComments(code).trimStart().startsWith(directive),
  );

function valueImports(code: string): string[] {
  const source = withoutComments(code);
  const found: { at: number; specifier: string }[] = [];
  for (const match of source.matchAll(STATIC_IMPORT)) {
    const [, clause = "", from] = match;
    // `import type …` / `export type …` are erased, as is `{ type A, type B }`.
    if (/^\s+type\s/.test(clause) || onlyTypes(clause) || !from) continue;
    found.push({ at: match.index, specifier: from });
  }
  for (const match of source.matchAll(BARE_IMPORT)) {
    if (match[1]) found.push({ at: match.index, specifier: match[1] });
  }
  return found.sort((a, b) => a.at - b.at).map(({ specifier }) => specifier);
}

function resolveLocal(from: string, specifier: string): string | undefined {
  const base = specifier.startsWith("@/")
    ? join(SRC, specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(from), specifier)
      : undefined;
  if (!base) return undefined;
  const candidates = [
    base,
    ...EXTENSIONS.map((ext) => base + ext),
    ...EXTENSIONS.map((ext) => join(base, `index${ext}`)),
  ];
  return candidates.find((path) => existsSync(path) && statSync(path).isFile());
}

const isPackage = (specifier: string) => !specifier.startsWith(".") && !specifier.startsWith("@/");

/** Every forbidden import reachable from a client module, with the path that leads to it. */
function forbiddenChains(): { chains: string[]; reached: number } {
  const files = sourceFiles(SRC);
  const code = new Map(files.map((file) => [file, readFileSync(file, "utf8")]));
  const read = (file: string) => code.get(file) ?? readFileSync(file, "utf8");
  const chains: string[] = [];
  const seen = new Set<string>();
  const queue = files
    .filter((file) => hasDirective(read(file), "client"))
    .map((file) => ({ file, path: [file] }));

  for (let next = queue.shift(); next; next = queue.shift()) {
    const { file, path } = next;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of valueImports(read(file))) {
      if (isPackage(specifier)) {
        if (FORBIDDEN.test(specifier)) {
          const steps = path.map((step) => relative(ROOT, step).split(sep).join("/"));
          chains.push([...steps, specifier].join(" → "));
        }
        continue;
      }
      const target = resolveLocal(file, specifier);
      // JSON, CSS and other assets have no imports of their own.
      if (!target || !/\.(ts|tsx|js|mjs)$/.test(target)) continue;
      if (hasDirective(read(target), "server")) continue;
      queue.push({ file: target, path: [...path, target] });
    }
  }
  return { chains, reached: seen.size };
}

describe("client bundle", () => {
  it("parses the import forms the guard relies on", () => {
    const code = [
      `import type { A } from "zod";`,
      `import { type B, type C } from "zod";`,
      `export type { D } from "zod";`,
      `export type Props = { a: string };`,
      `import { z } from "zod";`,
      `import {\n  x, // why\n  y,\n} from "./xy";`,
      `import { type E, f } from "./f";`,
      `export { g } from "./g";`,
      `import "./side-effect";`,
      `const h = await import("./h");`,
    ].join("\n");
    expect(valueImports(code)).toEqual(["zod", "./xy", "./f", "./g", "./side-effect", "./h"]);
  });

  it("no module a client component reaches imports zod or @supabase/ssr", () => {
    const { chains, reached } = forbiddenChains();
    // The walk really follows imports (a broken parser would pass vacuously).
    expect(reached).toBeGreaterThan(100);
    expect(chains).toEqual([]);
  });
});
