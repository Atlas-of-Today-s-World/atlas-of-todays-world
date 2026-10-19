/**
 * Atlas Patrons — the shape of the donation options and the public goal.
 * Donations are monthly only (one-time donations were removed 2026-10-19;
 * the database still has their columns until a contract migration drops them).
 * The values live in the database (`patron_settings`, edited in
 * /admin/patrons); `FALLBACK_PATRON_SETTINGS` below is what the site showed
 * before they became editable and what it shows when the database doesn't
 * answer. Currency is always EUR (whole euros).
 */
export const PERIODS = ["monthly"] as const;
export type Period = (typeof PERIODS)[number];

/** What the donation card offers; the checkout accepts exactly the same. */
export interface DonationOptions {
  /** Preset amounts in whole euros, ascending, in the order the card shows them. */
  amounts: Record<Period, readonly number[]>;
  /** Preselected and marked "Recommended" on the card — always one of its presets. */
  defaultAmount: Record<Period, number>;
  /** Periods that also offer a free "Other amount" (whole euros, inclusive bounds). */
  otherAmountPeriods: readonly Period[];
  otherAmount: { min: number; max: number };
}

/** The current public goal ("Our Current Goal" section). */
export interface PatronGoal {
  patrons: number;
  monthlyEur: number;
  /**
   * Below this many patrons the page shows no counts ("0 / 1,000 · 0 %" puts
   * people off) — just the goal and an invitation to be among the first.
   */
  countsFromPatrons: number;
}

export interface PatronSettings {
  donation: DonationOptions;
  goal: PatronGoal;
}

/**
 * Limits of the settings — the same as the CHECKs in `patron_settings`
 * (migration 20261013000160): up to 8 presets per period, every amount
 * (preset or own) 1–10,000 €.
 */
export const PATRON_LIMITS = {
  presets: 8,
  amount: { min: 1, max: 10_000 },
  goalPatrons: 1_000_000,
  goalMonthlyEur: 10_000_000,
  countsFrom: 1_000_000,
} as const;

/** The values before /admin/patrons existed; used when the database doesn't answer. */
export const FALLBACK_PATRON_SETTINGS: PatronSettings = {
  donation: {
    amounts: { monthly: [5, 10, 15, 25, 50, 100] },
    defaultAmount: { monthly: 10 },
    otherAmountPeriods: [],
    otherAmount: { min: 1, max: 10_000 },
  },
  goal: { patrons: 1000, monthlyEur: 10_000, countsFromPatrons: 10 },
};

/*
 * The donation flow's addresses (membership, checkout, thank-you, manage) and
 * the volunteer section's anchor are in config/routes.ts with every other
 * public URL.
 */

/** Placeholder in a FAQ answer that the page replaces with the contact address. */
export const EMAIL_PLACEHOLDER = "email";
