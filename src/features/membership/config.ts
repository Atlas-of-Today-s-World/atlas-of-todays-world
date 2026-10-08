/**
 * Atlas Patrons — the single definition of donation options. Used by the
 * donation card, the checkout validation (schema.ts) and the tests.
 */
export const PERIODS = ["monthly", "one-time"] as const;
export type Period = (typeof PERIODS)[number];

/** Preset amounts in whole euros, in the order the card shows them. */
export const AMOUNTS: Record<Period, readonly number[]> = {
  monthly: [5, 10, 15, 25, 50, 100],
  "one-time": [30, 50, 100],
};

export const DEFAULT_PERIOD: Period = "monthly";
export const DEFAULT_AMOUNT: Record<Period, number> = { monthly: 10, "one-time": 50 };

/** Periods that also offer a free "Other amount" (whole euros, inclusive bounds). */
export const OTHER_AMOUNT_PERIODS: readonly Period[] = ["one-time"];
export const OTHER_AMOUNT = { min: 1, max: 10_000 } as const;

/** The current public goal ("Our Current Goal" section). */
export const GOAL = { patrons: 1000, monthlyEur: 10_000 } as const;
/**
 * Below this many patrons the page shows no counts ("0 / 1,000 · 0 %" puts
 * people off) — just the goal and an invitation to be among the first.
 */
export const GOAL_COUNTS_FROM_PATRONS = 10;

export const PATRONS_EMAIL = "info@atlasoftodaysworld.org";

/** Routes of the donation flow (locale prefix is added by Link / localePath). */
export const MEMBERSHIP_PATH = "/membership";
export const CHECKOUT_PATH = "/membership/checkout";
export const THANK_YOU_PATH = "/membership/thank-you";
export const MANAGE_PATH = "/membership/manage";
/** Anchor of the volunteer editors section on the membership page. */
export const VOLUNTEER_ID = "volunteer";
