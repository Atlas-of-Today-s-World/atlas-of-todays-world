import "server-only";
/* eslint-disable security/detect-non-literal-fs-filename -- reads only the repository's own .claude/skills folder */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { cache } from "react";
import { asList, asText, parseFrontmatter } from "./frontmatter";
import { SKILL_FILE, SKILLS_FOLDER, type Skill, type SkillFile } from "./model";
import { zip, type ZipEntry } from "./zip";

/**
 * Skills are read from the files at build time: the pages and the files of
 * /skills are prerendered, so nothing reads them per request. Pages may still
 * re-render later (ISR of the shared layout's data, an unknown name), and the
 * admin list renders per request — next.config `outputFileTracingIncludes`
 * ships .claude/skills with those functions (and .vercelignore uploads it).
 */
// Literal segments (SKILLS_FOLDER spelled out): a computed path makes Turbopack
// trace the whole project into every function that imports this module.
const ROOT = join(process.cwd(), ".claude", "skills");

/** Claude's own rule for a skill name: lowercase letters, digits and hyphens. */
const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
/** Taken by the ZIP of every skill (`skillFiles.all`). */
const RESERVED = "all";

/** A file's text, or null when it isn't text (a NUL byte or invalid UTF-8). */
function textOf(bytes: Uint8Array): string | null {
  if (bytes.includes(0)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** Every file under `dir` (paths relative to it, "/"-separated), dotfiles skipped. */
function listFiles(dir: string, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .flatMap((entry) => {
      const path = `${prefix}${entry.name}`;
      if (entry.isDirectory()) return listFiles(join(dir, entry.name), `${path}/`);
      return entry.isFile() ? [path] : [];
    });
}

function readSkill(name: string): Skill | null {
  const dir = join(ROOT, name);
  const paths = listFiles(dir)
    .filter((path) => path !== SKILL_FILE)
    .sort((a, b) => a.localeCompare(b));
  const files: SkillFile[] = [SKILL_FILE, ...paths].map((path) => {
    const file = join(dir, ...path.split("/"));
    const bytes = new Uint8Array(readFileSync(file));
    return { path, bytes, text: textOf(bytes), modified: statSync(file).mtime };
  });
  const main = files[0]!.text;
  if (main === null) return null;
  const { data, body } = parseFrontmatter(main);
  const heading = /^#[ \t]+(.+?)[ \t#]*$/m.exec(body)?.[1];
  return {
    name,
    title: asText(data.title) || heading || asText(data.name) || name,
    description: asText(data.description),
    roles: asList(data.roles),
    body,
    files,
  };
}

function readSkills(): Skill[] {
  let folders: string[];
  try {
    folders = readdirSync(ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && NAME.test(entry.name))
      .map((entry) => entry.name);
  } catch {
    return []; // no skills folder (a checkout without it)
  }
  if (folders.includes(RESERVED)) {
    throw new Error(
      `${SKILLS_FOLDER}/${RESERVED}: "${RESERVED}" is reserved for the ZIP of all skills; rename the skill.`,
    );
  }
  return folders
    .filter((name) => {
      try {
        return statSync(join(ROOT, name, SKILL_FILE)).isFile();
      } catch {
        return false; // a folder without SKILL.md is not a skill
      }
    })
    .sort((a, b) => a.localeCompare(b))
    .flatMap((name) => readSkill(name) ?? []);
}

/** Every published skill, by name. */
export const getSkills = cache(readSkills);

export const getSkill = (name: string): Skill | undefined =>
  getSkills().find((skill) => skill.name === name);

/** ZIP entries of a skill: its folder with SKILL.md and every other file. */
const entries = (skill: Skill): ZipEntry[] =>
  skill.files.map((file) => ({
    path: `${skill.name}/${file.path}`,
    data: file.bytes,
    modified: file.modified,
  }));

/** The ZIP of one skill, or of all of them (one folder each). */
export const skillsZip = (skills: readonly Skill[]) => zip(skills.flatMap(entries));
