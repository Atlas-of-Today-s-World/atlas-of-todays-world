import { describe, expect, it } from "vitest";
import { EDITABLE_TEXTS } from "@/features/ui-texts/model";
import { UiTextsInput } from "@/features/ui-texts/schema";
import { patronsPageGroups } from "./page-texts";

describe("patronsPageGroups (Atlas Patrons in Admin → Site pages)", () => {
  const groups = patronsPageGroups();
  const fields = groups.flatMap((group) => group.fields);

  it("puts every editable patrons text in exactly one section", () => {
    const patrons = EDITABLE_TEXTS.filter((text) => text.key.startsWith("patrons."));
    expect(fields.map((field) => field.key).sort()).toEqual(patrons.map((text) => text.key).sort());
    expect(new Set(fields.map((field) => field.key)).size).toBe(fields.length);
  });

  it("leaves no section empty", () => {
    for (const group of groups) expect(group.fields.length, group.id).toBeGreaterThan(0);
  });

  it("labels the texts readably", () => {
    const label = (key: string) => fields.find((field) => field.key === key)?.label;
    expect(label("patrons.heroTitle")).toBe("Heading");
    expect(label("patrons.heroLead.1")).toBe("Hero lead 2");
    expect(label("patrons.benefits.0.text.1")).toBe("Benefits 1 › Text 2");
    expect(label("patrons.card.otherHint")).toBe("Other hint");
    expect(label("patrons.volunteer.messages.thanks")).toBe("Messages › Thanks");
  });

  it("marks the texts shown with bold", () => {
    const rich = fields.filter((field) => field.rich).map((field) => field.key);
    expect(rich).toContain("patrons.heroLead.0");
    expect(rich).toContain("patrons.goal.lead");
    expect(rich).not.toContain("patrons.heroTitle");
  });
});

describe("UiTextsInput (several texts saved at once)", () => {
  it("accepts texts that keep their placeholders", () => {
    const parsed = UiTextsInput.safeParse({
      "patrons.heroTitle": "Help Us Grow",
      "patrons.goal.pill": "{patrons} patrons, {amount} a month",
    });
    expect(parsed.success).toBe(true);
  });

  it("puts each problem under its own key", () => {
    const parsed = UiTextsInput.safeParse({
      "patrons.heroTitle": "Fine",
      "patrons.goal.pill": "No placeholders",
      "auth.signIn": "Locked",
    });
    expect(parsed.success).toBe(false);
    const paths = parsed.error?.issues.map((issue) => issue.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["patrons.goal.pill", "auth.signIn"]));
    expect(paths).not.toContain("patrons.heroTitle");
  });
});
