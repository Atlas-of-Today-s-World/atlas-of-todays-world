import { describe, expect, it } from "vitest";
import { SECTIONS } from "@/features/auth/sections";
import { MatrixInput } from "./schema";
import { matrixFormData, matrixSections, toggleAction } from "./matrix";

describe("toggleAction", () => {
  it("adds view together with create/edit/delete", () => {
    expect(toggleAction("", "e", true)).toBe("ve");
    expect(toggleAction("v", "d", true)).toBe("vd");
  });

  it("keeps the DB order vced", () => {
    expect(toggleAction("vd", "c", true)).toBe("vcd");
  });

  it("removing view removes everything", () => {
    expect(toggleAction("vced", "v", false)).toBe("");
  });

  it("removing another action keeps view", () => {
    expect(toggleAction("vced", "c", false)).toBe("ved");
  });

  it("ignores junk in the stored string", () => {
    expect(toggleAction("vx", "e", true)).toBe("ve");
  });
});

describe("matrixFormData", () => {
  it("is exactly what saveMatrix validates", () => {
    const data = matrixFormData("editor", { news: "vce", users: "v" });
    const sections = Object.fromEntries(
      SECTIONS.map((section) => [section, data.getAll(`perm:${section}`).map(String)]),
    );
    const parsed = MatrixInput.parse({ role_id: data.get("role_id"), sections });
    expect(parsed.sections.news).toBe("vce");
    expect(parsed.sections.users).toBe("v");
    expect(parsed.sections.layers).toBe("");
  });
});

describe("matrixSections", () => {
  const sections = matrixSections();

  it("lists every permission section once", () => {
    expect(sections.map((section) => section.key)).toEqual([...SECTIONS]);
  });

  it("puts admin pages under the sections that unlock them", () => {
    const news = sections.find((section) => section.key === "news")!;
    expect(news.pages.length).toBeGreaterThan(1);
  });
});
