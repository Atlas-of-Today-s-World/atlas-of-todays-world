import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sanitizeRichHtml } from "@/lib/security/sanitize";

/** What the mocked database answers, per table. */
const db: Record<string, { data: unknown; error: { message: string } | null }> = {};

/** Minimal stand-in for the query builder: every call chains, awaiting resolves the table's answer. */
function query(table: string) {
  const answer = () => Promise.resolve(db[table] ?? { data: null, error: { message: "down" } });
  const chain: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      answer().then(resolve, reject),
    maybeSingle: answer,
  };
  for (const method of ["select", "eq", "order"]) chain[method] = () => chain;
  return chain;
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({ from: query }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

const { FALLBACK_PATRON_SETTINGS } = await import("./config");
const { PatronFaqInput, PatronSettingsInput, rowFromSettings, settingsFromRow } =
  await import("./settings");
const { getPatronFaq, getPatronSettings } = await import("./queries");
const { parseDonation } = await import("./schema");
const { startCheckout } = await import("./actions");

const FALLBACK_ROW = rowFromSettings(FALLBACK_PATRON_SETTINGS);

/** The settings row with the monthly 15 € preset taken out (and "Other amount" bounds 5–500). */
const EDITED_ROW = {
  ...FALLBACK_ROW,
  monthly_amounts: [5, 10, 25, 50, 100],
  other_amount_min: 5,
  other_amount_max: 500,
};

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

beforeEach(() => {
  for (const key of Object.keys(db)) delete db[key];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("settingsFromRow", () => {
  it("round-trips the settings the site had before they became editable", () => {
    expect(settingsFromRow(FALLBACK_ROW)).toEqual(FALLBACK_PATRON_SETTINGS);
  });

  it("refuses a row that breaks the rules (the caller falls back)", () => {
    expect(settingsFromRow({ ...FALLBACK_ROW, default_monthly: 12 })).toBeNull();
    expect(settingsFromRow({ ...FALLBACK_ROW, monthly_amounts: [] })).toBeNull();
  });
});

describe("getPatronSettings", () => {
  it("reads the database row", async () => {
    db.patron_settings = { data: EDITED_ROW, error: null };
    const settings = await getPatronSettings();
    expect(settings.donation.amounts.monthly).toEqual([5, 10, 25, 50, 100]);
    expect(settings.donation.otherAmount).toEqual({ min: 5, max: 500 });
  });

  it("falls back to the previous constants when the database fails or has no row", async () => {
    expect(await getPatronSettings()).toEqual(FALLBACK_PATRON_SETTINGS);
    db.patron_settings = { data: null, error: null };
    expect(await getPatronSettings()).toEqual(FALLBACK_PATRON_SETTINGS);
    db.patron_settings = { data: { ...FALLBACK_ROW, monthly_amounts: [] }, error: null };
    expect(await getPatronSettings()).toEqual(FALLBACK_PATRON_SETTINGS);
  });
});

describe("getPatronFaq", () => {
  it("maps the visible questions and leaves the section out when the database fails", async () => {
    db.patron_faq = {
      data: [{ id: "1", question: "Q?", answer_html: "<p>A {email}</p>" }],
      error: null,
    };
    expect(await getPatronFaq()).toEqual([
      { id: "1", question: "Q?", answerHtml: "<p>A {email}</p>" },
    ]);
    db.patron_faq = { data: null, error: { message: "down" } };
    expect(await getPatronFaq()).toEqual([]);
  });
});

describe("checkout validation against the settings", () => {
  const options = settingsFromRow(EDITED_ROW)!.donation;

  it("rejects an amount the card no longer offers", () => {
    expect(parseDonation({ period: "monthly", amount: "15" }, options)).toBeNull();
    expect(parseDonation({ period: "monthly", amount: "25" }, options)).toEqual({
      period: "monthly",
      amount: 25,
    });
  });

  it("takes the 'Other amount' bounds from the settings, where it is offered", () => {
    const withOther = settingsFromRow({
      ...EDITED_ROW,
      other_amount_periods: ["monthly"],
    })!.donation;
    expect(parseDonation({ period: "monthly", amount: "7" }, options)).toBeNull();
    expect(parseDonation({ period: "monthly", amount: "4" }, withOther)).toBeNull();
    expect(parseDonation({ period: "monthly", amount: "7" }, withOther)).not.toBeNull();
    expect(parseDonation({ period: "monthly", amount: "500" }, withOther)).not.toBeNull();
    expect(parseDonation({ period: "monthly", amount: "501" }, withOther)).toBeNull();
    // A preset above the free bounds is still a preset.
    expect(parseDonation({ period: "monthly", amount: "100" }, withOther)).not.toBeNull();
  });

  it("startCheckout sends a removed amount back to the membership page", async () => {
    db.patron_settings = { data: EDITED_ROW, error: null };
    await expect(
      startCheckout(form({ period: "monthly", amount: "15", locale: "en" })),
    ).rejects.toThrow("REDIRECT /membership");
    await expect(
      startCheckout(form({ period: "monthly", amount: "25", locale: "en" })),
    ).rejects.toThrow("REDIRECT /membership/checkout?period=monthly&amount=25");
    await expect(
      startCheckout(form({ period: "monthly", amount: "other", other: "501", locale: "en" })),
    ).rejects.toThrow(/REDIRECT \/membership$/);
    // One-time donations no longer exist.
    await expect(
      startCheckout(form({ period: "one-time", amount: "50", locale: "en" })),
    ).rejects.toThrow(/REDIRECT \/membership$/);
  });

  it("startCheckout still works on the previous values when the database is down", async () => {
    await expect(
      startCheckout(form({ period: "monthly", amount: "15", locale: "en" })),
    ).rejects.toThrow("REDIRECT /membership/checkout?period=monthly&amount=15");
  });
});

describe("PatronSettingsInput (admin form)", () => {
  const valid = {
    monthly_amounts: "100 10 5 15 25 50 10",
    default_monthly: "10",
    other_amount_min: "1",
    other_amount_max: "10000",
    goal_patrons: "1000",
    goal_monthly_eur: "10000",
    goal_counts_from: "10",
  };

  it("gives the database row, amounts ascending without repeats", () => {
    expect(PatronSettingsInput.parse(valid)).toEqual(FALLBACK_ROW);
  });

  it("names the field that breaks a rule (same limits as the CHECKs)", () => {
    const errors = (input: Record<string, string>) =>
      PatronSettingsInput.safeParse({ ...valid, ...input }).error?.flatten().fieldErrors ?? {};
    expect(errors({ monthly_amounts: "" })).toHaveProperty("monthly_amounts");
    expect(errors({ monthly_amounts: "1,2,3,4,5,6,7,8,10" })).toHaveProperty("monthly_amounts");
    expect(errors({ monthly_amounts: "5, 10.5" })).toHaveProperty("monthly_amounts");
    expect(errors({ monthly_amounts: "0, 10" })).toHaveProperty("monthly_amounts");
    expect(errors({ monthly_amounts: "50, 10001" })).toHaveProperty("monthly_amounts");
    expect(errors({ default_monthly: "12" })).toHaveProperty("default_monthly");
    expect(errors({ other_amount_min: "60", other_amount_max: "50" })).toHaveProperty(
      "other_amount_max",
    );
    expect(errors({ goal_patrons: "0" })).toHaveProperty("goal_patrons");
  });

  it("turns the checkbox into the periods with 'Other amount'; one-time is never saved", () => {
    expect(PatronSettingsInput.parse(valid).other_amount_periods).toEqual([]);
    expect(
      PatronSettingsInput.parse({ ...valid, other_monthly: "on" }).other_amount_periods,
    ).toEqual(["monthly"]);
    // A stale form posting the removed fields changes nothing about one-time donations.
    const parsed = PatronSettingsInput.parse({
      ...valid,
      other_one_time: "on",
      one_time_amounts: "5",
    });
    expect(parsed).not.toHaveProperty("one_time_amounts");
    expect(parsed.other_amount_periods).toEqual([]);
  });
});

describe("PatronFaqInput (admin form)", () => {
  it("sanitizes the answer before saving", () => {
    const parsed = PatronFaqInput.parse({
      question: "  Why? ",
      answer_html:
        '<p onclick="x()">Mail {email}<script>alert(1)</script> <a href="javascript:alert(1)">here</a></p><img src="https://evil.example/pixel.gif">',
      visible: "on",
    });
    expect(parsed).toEqual({
      id: undefined,
      question: "Why?",
      answer_html: '<p>Mail {email} <a rel="noopener noreferrer">here</a></p>',
      visible: true,
    });
  });

  it("counts the limit after sanitizing and refuses an empty answer", () => {
    const padded = `<p>${"a".repeat(2990)}</p><script>${"x".repeat(5000)}</script>`;
    expect(PatronFaqInput.safeParse({ question: "Q", answer_html: padded }).success).toBe(true);
    const long = `<p>${"a".repeat(2994)}</p>`;
    expect(PatronFaqInput.safeParse({ question: "Q", answer_html: long }).success).toBe(false);
    expect(PatronFaqInput.safeParse({ question: "Q", answer_html: "<p> </p>" }).success).toBe(
      false,
    );
    expect(
      PatronFaqInput.safeParse({ question: "x".repeat(301), answer_html: "<p>a</p>" }).success,
    ).toBe(false);
  });

  it("the migration seeds answers exactly as the sanitizer would save them", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/20261013000160_patron_settings.sql"),
      "utf8",
    );
    const answers = [...migration.matchAll(/'(<p>(?:[^']|'')*<\/p>)'/g)].map((match) =>
      (match[1] as string).replace(/''/g, "'"),
    );
    expect(answers).toHaveLength(3);
    for (const html of answers) {
      expect(sanitizeRichHtml(html)).toBe(html);
      expect(html.length).toBeLessThanOrEqual(3000);
    }
    expect(answers.join(" ")).toContain("Atlas of Today's World, z. s.");
  });
});
