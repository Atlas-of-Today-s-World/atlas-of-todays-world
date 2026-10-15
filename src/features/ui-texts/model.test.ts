import { describe, expect, it } from "vitest";
import { applyOverrides, getMessages } from "@/lib/i18n/messages";
import en from "@/messages/en.json";
import {
  EDITABLE_TEXTS,
  editableText,
  MAX_TEXT_LENGTH,
  overrideProblem,
  placeholders,
  validOverrides,
} from "./model";
import { UiTextInput } from "./schema";

describe("applyOverrides (deep merge of en.json with the team's texts)", () => {
  it("replaces only the given texts and leaves en.json untouched", () => {
    const merged = applyOverrides(en, {
      "home.title": "Atlas — the world today",
      "patrons.benefits.0.title": "Build the Atlas",
      "categories.Politics & International Relations": "Politics",
    });
    expect(merged.home.title).toBe("Atlas — the world today");
    expect(merged.patrons.benefits[0]?.title).toBe("Build the Atlas");
    expect(merged.categories["Politics & International Relations"]).toBe("Politics");
    expect(merged.home.description).toBe(en.home.description);
    expect(merged.patrons.benefits[1]).toEqual(en.patrons.benefits[1]);
    // The bundled texts are not mutated (other requests keep the defaults).
    expect(en.home.title).not.toBe("Atlas — the world today");
    expect(getMessages("en").home.title).toBe(en.home.title);
  });

  it("no overrides = the same object, no copy", () => {
    expect(applyOverrides(en, {})).toBe(en);
  });

  it("never changes the shape: unknown keys, objects and the prototype are ignored", () => {
    const merged = applyOverrides(en, {
      "home.nope": "x",
      home: "x",
      "patrons.benefits": "x",
      "__proto__.polluted": "x",
      "constructor.prototype.polluted": "x",
      "home.title.length": "x",
    });
    expect(merged).toEqual(en);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("editable texts (the allowlist)", () => {
  it("lists every public text of en.json, flattened, arrays by index", () => {
    const keys = EDITABLE_TEXTS.map((text) => text.key);
    expect(keys).toContain("home.title");
    expect(keys).toContain("quiz.verdicts.perfect");
    expect(keys).toContain("patrons.benefits.0.text.1");
    expect(keys).toContain("categories.Living Conditions");
    expect(new Set(keys).size).toBe(keys.length);
    expect(editableText("home.title")?.defaultText).toBe(en.home.title);
    expect(editableText("nav.signIn")?.defaultText).toBe(en.nav.signIn);
  });

  it("keeps sign-in, the account, the invitation and markup-like defaults in the code", () => {
    for (const key of [
      "auth.title",
      "auth.email.errors.wrong_code",
      "account.delete",
      "invite.heading",
      "seo.llmsCite",
      // Menu labels: edited in Admin → Site menus, en.json is only their fallback.
      "nav.topics",
      "nav.privacy",
    ]) {
      expect(editableText(key), key).toBeUndefined();
    }
    for (const text of EDITABLE_TEXTS) {
      expect(["auth", "account", "invite"]).not.toContain(text.namespace);
    }
  });
});

describe("override validation", () => {
  it("accepts a plain text with exactly the default's placeholders", () => {
    expect(overrideProblem("home.title", "The world, today")).toBeNull();
    expect(overrideProblem("article.showTopic", "{title} — part {number}")).toBeNull();
    expect(overrideProblem("article.showTopic", "{number}/{number}: {title}")).toBeNull();
  });

  it("refuses an unknown or locked key", () => {
    expect(overrideProblem("home.nope", "x")?.field).toBe("key");
    expect(overrideProblem("auth.title", "x")?.field).toBe("key");
    expect(overrideProblem("home", "x")?.field).toBe("key");
  });

  it("placeholder parity: none missing, none added", () => {
    expect(overrideProblem("article.showTopic", "Subtopic {number}")?.message).toMatch(
      /\{number\}, \{title\}/,
    );
    expect(overrideProblem("article.showTopic", "{number} {title} {extra}")?.field).toBe("value");
    expect(overrideProblem("home.title", "Hello {name}")?.message).toMatch(/no placeholders/);
    expect(placeholders("{b} and {a} and {b}")).toEqual(["a", "b"]);
  });

  it("plain text only, not blank, at most 2000 characters", () => {
    expect(overrideProblem("home.title", "<b>Atlas</b>")?.message).toMatch(/</);
    expect(overrideProblem("home.title", "a <script>")?.field).toBe("value");
    expect(overrideProblem("home.title", "   ")?.field).toBe("value");
    expect(overrideProblem("home.title", "x".repeat(MAX_TEXT_LENGTH + 1))?.field).toBe("value");
    expect(overrideProblem("home.title", "x".repeat(MAX_TEXT_LENGTH))).toBeNull();
  });

  it("the public read keeps only rows that fit the current en.json", () => {
    expect(
      validOverrides([
        { key: "home.title", value: "OK" },
        { key: "home.removed", value: "gone" },
        { key: "auth.title", value: "locked" },
        { key: "article.showTopic", value: "placeholders changed" },
        { key: "nav.news", value: "<i>x</i>" },
      ]),
    ).toEqual({ "home.title": "OK" });
    expect(validOverrides(null)).toEqual({});
  });

  it("the admin schema applies the same rules and normalises line ends", () => {
    expect(UiTextInput.parse({ key: "home.intro", value: "One\r\nTwo" })).toEqual({
      key: "home.intro",
      value: "One\nTwo",
    });
    const issue = (input: { key: string; value: string }) =>
      UiTextInput.safeParse(input).error?.issues[0]?.path[0];
    expect(issue({ key: "home.unknown", value: "x" })).toBe("key");
    expect(issue({ key: "home.title", value: "<p>x</p>" })).toBe("value");
    expect(issue({ key: "ui.fromOrbit", value: "seen from orbit" })).toBe("value");
  });
});
