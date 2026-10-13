import { z } from "zod";
import { AMOUNTS, OTHER_AMOUNT, OTHER_AMOUNT_PERIODS, PERIODS } from "./config";
import type { Donation } from "./links";

const Raw = z.object({
  period: z.enum(PERIODS),
  amount: z.coerce.number().int().min(OTHER_AMOUNT.min).max(OTHER_AMOUNT.max),
});

/** Presets are always allowed; any other whole amount only where "Other amount" exists. */
const isAllowed = ({ period, amount }: Donation) =>
  AMOUNTS[period].includes(amount) || OTHER_AMOUNT_PERIODS.includes(period);

const DonationSchema = Raw.refine(isAllowed, { message: "Amount not offered for this period." });

/** Donation from query parameters (`?period=monthly&amount=10`); null when invalid. */
export function parseDonation(input: Record<string, unknown>): Donation | null {
  const pick = (value: unknown) => (Array.isArray(value) ? value[0] : value);
  const parsed = DonationSchema.safeParse({
    period: pick(input.period),
    amount: pick(input.amount),
  });
  return parsed.success ? parsed.data : null;
}

/**
 * Donation from the card form: the `amount` radio either holds a preset or
 * the value "other", in which case the free `other` field counts.
 */
export function donationFromForm(input: Record<string, unknown>): Donation | null {
  const amount = input.amount === "other" ? input.other : input.amount;
  return parseDonation({ period: input.period, amount });
}
