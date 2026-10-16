import { routes, skillFiles } from "@/config/routes";

/**
 * The project's Claude skills (`.claude/skills/<name>/SKILL.md`), published at
 * /skills so anyone can read, download and load them. Skills are written in
 * the repository and changed by pull request; the site shows what the last
 * deploy built.
 */

export interface SkillFile {
  /** Path inside the skill's folder with "/" separators (`SKILL.md`, `reference/api.md`). */
  path: string;
  bytes: Uint8Array;
  /** UTF-8 text, or null for a binary file (only offered in the ZIP). */
  text: string | null;
  modified: Date;
}

export interface Skill {
  /** Folder name, also the URL segment and the `name` Claude loads it by. */
  name: string;
  /** `title` from the frontmatter, else the body's first `# heading`, else the name. */
  title: string;
  description: string;
  /** `roles` from the frontmatter (designer, frontend…), empty when it has none. */
  roles: string[];
  /** SKILL.md without its frontmatter. */
  body: string;
  /** Every file of the folder, SKILL.md first. */
  files: SkillFile[];
}

/** Name and description of /skills (English, like the skills themselves; also in llms.txt). */
export const SKILLS_PAGE = {
  title: "Claude skills",
  description:
    "The instructions and reference files that teach Claude how the Atlas of Today's World is built — public to read, download and load into your own Claude.",
} as const;

/** The skill's main file. */
export const SKILL_FILE = "SKILL.md";

/** The folder skills live in, relative to the repository root. */
export const SKILLS_FOLDER = ".claude/skills";

const REPOSITORY = "https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world";
const BRANCH = "main";

/** A repository file on GitHub (`path` from the repository root). */
export const githubFileUrl = (path: string) =>
  `${REPOSITORY}/blob/${BRANCH}/${path.replace(/^\/+/, "")}`;

/** The skills folder on GitHub. */
export const SKILLS_ON_GITHUB = `${REPOSITORY}/tree/${BRANCH}/${SKILLS_FOLDER}`;

/** Every place a skill is reachable: its page, the raw file, the ZIP and the GitHub editor. */
export function skillLinks(name: string) {
  return {
    page: routes.skill(name),
    raw: skillFiles.raw(name),
    zip: skillFiles.zip(name),
    edit: `${REPOSITORY}/edit/${BRANCH}/${SKILLS_FOLDER}/${name}/${SKILL_FILE}`,
  };
}

/** Id of a file's section on the skill page (`reference/api.md` → `file-reference-api-md`). */
export const fileAnchor = (path: string) =>
  `file-${path
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`.slice(0, 63);

/**
 * Target of a link written in a skill. Relative links are meant for the
 * repository (the skill's folder is the base): one to another file of the
 * skill goes to that file's section on the page, anything else to the file on
 * GitHub. Absolute URLs and #anchors stay as they are (the sanitizer still
 * drops any scheme but https and mailto).
 */
export function skillLinkTarget(skill: Pick<Skill, "name" | "files">, href: string): string {
  if (!href || href.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(href)) return href;
  const [path = "", hash] = href.split("#", 2);
  const fromRoot = path.startsWith("/");
  const segments: string[] = fromRoot ? [] : [...SKILLS_FOLDER.split("/"), skill.name];
  for (const segment of path.split("/")) {
    if (segment === "..") {
      if (!segments.length) return href; // outside the repository
      segments.pop();
    } else if (segment && segment !== ".") {
      segments.push(segment);
    }
  }
  const resolved = segments.join("/");
  const own = `${SKILLS_FOLDER}/${skill.name}/`;
  if (resolved.startsWith(own)) {
    const file = resolved.slice(own.length);
    if (file === SKILL_FILE) return hash ? `#${hash}` : routes.skill(skill.name);
    if (skill.files.some((item) => item.path === file)) return `#${fileAnchor(file)}`;
  }
  return `${githubFileUrl(resolved)}${hash ? `#${hash}` : ""}`;
}

export interface RoleGroup {
  /** The role, or null for skills that name none. */
  role: string | null;
  skills: Skill[];
}

/**
 * Skills grouped by role for the index: a group per role in alphabetical
 * order (a skill with several roles is in each), then the skills without a
 * role. Without any roles at all, one group with every skill.
 */
export function groupByRole(skills: readonly Skill[]): RoleGroup[] {
  const roles = [...new Set(skills.flatMap((skill) => skill.roles))].sort((a, b) =>
    a.localeCompare(b),
  );
  const groups: RoleGroup[] = roles.map((role) => ({
    role,
    skills: skills.filter((skill) => skill.roles.includes(role)),
  }));
  const general = skills.filter((skill) => skill.roles.length === 0);
  return general.length ? [...groups, { role: null, skills: general }] : groups;
}

/** `frontend` → `Frontend`, `ux-writer` → `Ux writer`. */
export const roleLabel = (role: string) => {
  const words = role.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
