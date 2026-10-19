import { z } from "zod";
import type { Tables } from "@/lib/db/types.gen";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { htmlToText } from "@/lib/text/html";
import { blankToUndefined, checkbox, requiredText, uuid } from "@/lib/validation/common";
import { PATRON_LIMITS, PERIODS, type PatronSettings, type Period } from "./config";

/**
 * Atlas Patrons settings and FAQ: the database row ↔ the app's shape, and the
 * admin forms' Zod schemas (limits = the CHECKs of migration 20261013000160).
 */

/** Columns the public site reads (never `select *` through the anon client). */
export const PATRON_SETTINGS_COLUMNS =
  "monthly_amounts, default_monthly, other_amount_periods, other_amount_min, other_amount_max, goal_patrons, goal_monthly_eur, goal_counts_from";

export type PatronSettingsRow = Pick<
  Tables<"patron_settings">,
  | "monthly_amounts"
  | "default_monthly"
  | "other_amount_periods"
  | "other_amount_min"
  | "other_amount_max"
  | "goal_patrons"
  | "goal_monthly_eur"
  | "goal_counts_from"
>;

const isPeriod = (value: string): value is Period => (PERIODS as readonly string[]).includes(value);

/**
 * The row as the site uses it; null when it breaks a rule the database should
 * already have enforced (the caller then falls back to the previous values).
 * The one-time columns (one_time_amounts, default_one_time, default_period)
 * are no longer read: donations are monthly only.
 */
export function settingsFromRow(row: PatronSettingsRow): PatronSettings | null {
  if (!row.monthly_amounts.length || !row.monthly_amounts.includes(row.default_monthly)) {
    return null;
  }
  return {
    donation: {
      amounts: { monthly: row.monthly_amounts },
      defaultAmount: { monthly: row.default_monthly },
      otherAmountPeriods: row.other_amount_periods.filter(isPeriod),
      otherAmount: { min: row.other_amount_min, max: row.other_amount_max },
    },
    goal: {
      patrons: row.goal_patrons,
      monthlyEur: row.goal_monthly_eur,
      countsFromPatrons: row.goal_counts_from,
    },
  };
}

/** The settings as the admin form's default values (inverse of `PatronSettingsInput`). */
export function rowFromSettings({ donation, goal }: PatronSettings): PatronSettingsRow {
  return {
    monthly_amounts: [...donation.amounts.monthly],
    default_monthly: donation.defaultAmount.monthly,
    other_amount_periods: [...donation.otherAmountPeriods],
    other_amount_min: donation.otherAmount.min,
    other_amount_max: donation.otherAmount.max,
    goal_patrons: goal.patrons,
    goal_monthly_eur: goal.monthlyEur,
    goal_counts_from: goal.countsFromPatrons,
  };
}

const { amount: AMOUNT, presets: PRESETS } = PATRON_LIMITS;

const wholeNumber = (min: number, max: number) =>
  z.coerce
    .number({ message: "Enter a whole number." })
    .int("Enter a whole number.")
    .min(min, `At least ${min.toLocaleString("en")}.`)
    .max(max, `At most ${max.toLocaleString("en")}.`);

/**
 * Preset amounts typed as "5, 10, 15": whole euros 1–10,000, at most 8.
 * Saved ascending without repeats, which is how the card shows them.
 */
const amountList = z.preprocess(
  (value) =>
    typeof value === "string"
      ? value
          .split(/[\s,;]+/)
          .filter(Boolean)
          .map((part) => (/^\d+$/.test(part) ? Number(part) : Number.NaN))
      : value,
  z
    .array(
      z
        .number({ message: "Whole euros only, separated by commas." })
        .int("Whole euros only, separated by commas.")
        .min(AMOUNT.min, `Every amount at least ${AMOUNT.min} €.`)
        .max(AMOUNT.max, `Every amount at most ${AMOUNT.max.toLocaleString("en")} €.`),
    )
    .transform((list) => [...new Set(list)].sort((a, b) => a - b))
    .pipe(
      z
        .array(z.number())
        .min(1, "Offer at least one amount.")
        .max(PRESETS, `At most ${PRESETS} amounts.`),
    ),
);

/** The settings form (/admin/patrons) → the `patron_settings` row. */
export const PatronSettingsInput = z
  .object({
    monthly_amounts: amountList,
    default_monthly: wholeNumber(AMOUNT.min, AMOUNT.max),
    other_monthly: checkbox,
    other_amount_min: wholeNumber(AMOUNT.min, AMOUNT.max),
    other_amount_max: wholeNumber(AMOUNT.min, AMOUNT.max),
    goal_patrons: wholeNumber(1, PATRON_LIMITS.goalPatrons),
    goal_monthly_eur: wholeNumber(1, PATRON_LIMITS.goalMonthlyEur),
    goal_counts_from: wholeNumber(0, PATRON_LIMITS.countsFrom),
  })
  .superRefine((input, ctx) => {
    if (!input.monthly_amounts.includes(input.default_monthly)) {
      ctx.addIssue({
        code: "custom",
        path: ["default_monthly"],
        message: "Must be one of the monthly amounts.",
      });
    }
    if (input.other_amount_max < input.other_amount_min) {
      ctx.addIssue({
        code: "custom",
        path: ["other_amount_max"],
        message: "Must not be lower than the minimum.",
      });
    }
  })
  .transform(({ other_monthly, ...row }): PatronSettingsRow => ({
    ...row,
    other_amount_periods: other_monthly ? [...PERIODS] : [],
  }));

/** Longest answer, counted after sanitizing — same as the CHECK on `patron_faq.answer_html`. */
const ANSWER_MAX = 3000;

/** One FAQ question; the answer is sanitized here, before the length is checked. */
export const PatronFaqInput = z.object({
  id: z.preprocess(blankToUndefined, uuid.optional()),
  question: requiredText(300),
  answer_html: z
    .string()
    .transform((html) => sanitizeRichHtml(html).trim())
    .pipe(
      z
        .string()
        .max(ANSWER_MAX, `At most ${ANSWER_MAX.toLocaleString("en")} characters of formatted text.`)
        .refine((html) => htmlToText(html).trim().length > 0, "Please fill this in."),
    ),
  visible: checkbox,
});
