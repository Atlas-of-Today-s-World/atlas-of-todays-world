import { describe, expect, it } from "vitest";
import {
  fileAnchor,
  groupByRole,
  roleLabel,
  skillLinks,
  skillLinkTarget,
  type Skill,
} from "./model";
import { parseFrontmatter } from "./frontmatter";
import { getSkills } from "./queries";

const BLOB = "https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/blob/main";

const skill = (name: string, roles: string[] = [], paths: string[] = []): Skill => ({
  name,
  title: name,
  description: "",
  roles,
  body: "",
  files: ["SKILL.md", ...paths].map((path) => ({
    path,
    bytes: new Uint8Array(),
    text: "",
    modified: new Date(0),
  })),
});

describe("skillLinks", () => {
  it("builds the page, raw file, ZIP and GitHub editor addresses", () => {
    expect(skillLinks("atlas-web")).toEqual({
      page: "/skills/atlas-web",
      raw: "/skills/atlas-web/SKILL.md",
      zip: "/skills/atlas-web.zip",
      edit: "https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/edit/main/.claude/skills/atlas-web/SKILL.md",
    });
  });
});

describe("skillLinkTarget", () => {
  const web = skill("atlas-web", [], ["reference/api.md"]);

  it("keeps absolute URLs and anchors", () => {
    expect(skillLinkTarget(web, "https://claude.ai")).toBe("https://claude.ai");
    expect(skillLinkTarget(web, "mailto:a@b.cz")).toBe("mailto:a@b.cz");
    expect(skillLinkTarget(web, "#rules")).toBe("#rules");
  });

  it("sends links to the skill's own files to their place on the page", () => {
    expect(skillLinkTarget(web, "reference/api.md")).toBe(`#${fileAnchor("reference/api.md")}`);
    expect(skillLinkTarget(web, "./reference/../reference/api.md")).toBe("#file-reference-api-md");
    expect(skillLinkTarget(web, "SKILL.md")).toBe("/skills/atlas-web");
    expect(skillLinkTarget(web, "SKILL.md#rules")).toBe("#rules");
  });

  it("sends other repository paths to GitHub", () => {
    expect(skillLinkTarget(web, "../../../ARCHITEKTURA.md")).toBe(`${BLOB}/ARCHITEKTURA.md`);
    expect(skillLinkTarget(web, "/docs/architecture/x.md#y")).toBe(
      `${BLOB}/docs/architecture/x.md#y`,
    );
    expect(skillLinkTarget(web, "missing.md")).toBe(`${BLOB}/.claude/skills/atlas-web/missing.md`);
    expect(skillLinkTarget(web, "../../../../outside.md")).toBe("../../../../outside.md");
  });
});

describe("groupByRole", () => {
  it("groups by role, a skill in each of its roles, the rest last", () => {
    const a = skill("a", ["frontend", "designer"]);
    const b = skill("b", ["frontend"]);
    const c = skill("c");
    expect(groupByRole([a, b, c])).toEqual([
      { role: "designer", skills: [a] },
      { role: "frontend", skills: [a, b] },
      { role: null, skills: [c] },
    ]);
    expect(groupByRole([c])).toEqual([{ role: null, skills: [c] }]);
    expect(groupByRole([])).toEqual([]);
  });

  it("labels a role", () => {
    expect(roleLabel("frontend")).toBe("Frontend");
    expect(roleLabel("ux-writer")).toBe("Ux writer");
  });
});

describe("the repository's skills", () => {
  // The files other people write: each must load in Claude (name = folder, a description).
  it("each has a frontmatter name matching its folder and a description", () => {
    const skills = getSkills();
    expect(skills.length).toBeGreaterThan(0);
    for (const item of skills) {
      expect(item.files[0]!.path).toBe("SKILL.md");
      expect(parseFrontmatter(item.files[0]!.text ?? "").data.name, item.name).toBe(item.name);
      expect(item.description, item.name).not.toBe("");
      expect(item.title, item.name).not.toBe("");
    }
  });
});
