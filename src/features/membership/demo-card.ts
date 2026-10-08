/**
 * DEMO checkout only: format checks that imitate Stripe's test mode. Card
 * data never leaves the browser — nothing here is sent, logged or stored.
 * With real Stripe Checkout (ADR G6) the card form lives on Stripe's page and
 * this file goes away.
 */

/** Stripe's published test cards: the first succeeds, the second is declined. */
export const DEMO_CARDS = {
  success: "4242424242424242",
  declined: "4000000000000002",
} as const;

const digitsOnly = (value: string) => value.replace(/\D/g, "");

/** Luhn checksum of a card number (spaces and dashes are ignored). */
export function luhnValid(value: string): boolean {
  const digits = digitsOnly(value);
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  for (let index = 0; index < digits.length; index++) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** Expiry "MM / YY" (or "MM/YY") that is the current month or later. */
export function expiryValid(value: string, now: Date = new Date()): boolean {
  const match = /^\s*(\d{1,2})\s*\/\s*(\d{2})\s*$/.exec(value);
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;
  return year * 12 + month >= now.getFullYear() * 12 + now.getMonth() + 1;
}

const cvcValid = (value: string) => /^\d{3,4}$/.test(value.trim());

export type CardField = "number" | "expiry" | "cvc";
export type DemoPayment =
  { ok: true } | { ok: false; field: CardField; reason: "invalid" | "declined" };

type Card = { number: string; expiry: string; cvc: string };

/** Every card field that fails its format check, in form order (all shown at once). */
export function cardErrors(card: Card, now?: Date): CardField[] {
  const invalid: CardField[] = [];
  if (!luhnValid(card.number)) invalid.push("number");
  if (!expiryValid(card.expiry, now)) invalid.push("expiry");
  if (!cvcValid(card.cvc)) invalid.push("cvc");
  return invalid;
}

/** What the demo "payment" does with the entered card. */
export function demoPayment(card: Card, now?: Date): DemoPayment {
  const [field] = cardErrors(card, now);
  if (field) return { ok: false, field, reason: "invalid" };
  if (digitsOnly(card.number) === DEMO_CARDS.declined) {
    return { ok: false, field: "number", reason: "declined" };
  }
  return { ok: true };
}

/** "4242424242424242" → "4242 4242 4242 4242" while typing. */
export const formatCardNumber = (value: string) =>
  digitsOnly(value)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");

/** "1230" → "12 / 30" while typing. */
export function formatExpiry(value: string): string {
  const digits = digitsOnly(value).slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits;
}
