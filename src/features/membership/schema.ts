import { z } from "zod";
import { PERIODS, type DonationOptions } from "./config";
import type { Donation } from "./links";

const Raw = z.object({
  period: z.enum(PERIODS),
  amount: z.coerce.number().int().positive(),
});

/**
 * Presets are always allowed; any other whole amount only where "Other
 * amount" exists, within its bounds. `options` are the donation card's
 * current settings (patron_settings), so an amount the card no longer offers
 * is refused.
 */
function isAllowed({ period, amount }: Donation, options: DonationOptions): boolean {
  if (options.amounts[period].includes(amount)) return true;
  return (
    options.otherAmountPeriods.includes(period) &&
    amount >= options.otherAmount.min &&
    amount <= options.otherAmount.max
  );
}

/** Donation from query parameters (`?period=monthly&amount=10`); null when invalid. */
export function parseDonation(
  input: Record<string, unknown>,
  options: DonationOptions,
): Donation | null {
  const pick = (value: unknown) => (Array.isArray(value) ? value[0] : value);
  const parsed = Raw.safeParse({ period: pick(input.period), amount: pick(input.amount) });
  return parsed.success && isAllowed(parsed.data, options) ? parsed.data : null;
}

/**
 * Donation from the card form: the `amount` radio either holds a preset or
 * the value "other", in which case the free `other` field counts.
 */
export function donationFromForm(
  input: Record<string, unknown>,
  options: DonationOptions,
): Donation | null {
  const amount = input.amount === "other" ? input.other : input.amount;
  return parseDonation({ period: input.period, amount }, options);
}
