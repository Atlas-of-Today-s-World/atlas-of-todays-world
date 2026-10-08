import { describe, expect, it } from "vitest";
import { AMOUNTS, DEFAULT_AMOUNT, OTHER_AMOUNT } from "./config";
import {
  DEMO_CARDS,
  cardErrors,
  demoPayment,
  expiryValid,
  formatCardNumber,
  formatExpiry,
  luhnValid,
} from "./demo-card";
import { checkoutHref, donationFromForm, parseDonation, thankYouHref } from "./schema";

describe("parseDonation", () => {
  it("accepts every preset amount of each period", () => {
    for (const amount of AMOUNTS.monthly) {
      expect(parseDonation({ period: "monthly", amount: String(amount) })).toEqual({
        period: "monthly",
        amount,
      });
    }
    for (const amount of AMOUNTS["one-time"]) {
      expect(parseDonation({ period: "one-time", amount })).toEqual({ period: "one-time", amount });
    }
  });

  it("defaults are presets", () => {
    expect(AMOUNTS.monthly).toContain(DEFAULT_AMOUNT.monthly);
    expect(AMOUNTS["one-time"]).toContain(DEFAULT_AMOUNT["one-time"]);
  });

  it("allows a free amount only for one-time donations, within bounds", () => {
    expect(parseDonation({ period: "one-time", amount: "42" })).toEqual({
      period: "one-time",
      amount: 42,
    });
    expect(parseDonation({ period: "one-time", amount: OTHER_AMOUNT.max })).not.toBeNull();
    expect(parseDonation({ period: "one-time", amount: OTHER_AMOUNT.min })).not.toBeNull();
    expect(parseDonation({ period: "one-time", amount: OTHER_AMOUNT.max + 1 })).toBeNull();
    expect(parseDonation({ period: "one-time", amount: 0 })).toBeNull();
    expect(parseDonation({ period: "monthly", amount: 42 })).toBeNull();
  });

  it("rejects bad input", () => {
    expect(parseDonation({})).toBeNull();
    expect(parseDonation({ period: "weekly", amount: 10 })).toBeNull();
    expect(parseDonation({ period: "monthly", amount: "10.5" })).toBeNull();
    expect(parseDonation({ period: "monthly", amount: "abc" })).toBeNull();
    expect(parseDonation({ period: "one-time", amount: "-5" })).toBeNull();
  });

  it("takes the first value of repeated query parameters", () => {
    expect(parseDonation({ period: ["monthly", "one-time"], amount: ["10", "999"] })).toEqual({
      period: "monthly",
      amount: 10,
    });
  });
});

describe("donationFromForm", () => {
  it("uses the free field when 'Other amount' is chosen", () => {
    expect(donationFromForm({ period: "one-time", amount: "other", other: "75" })).toEqual({
      period: "one-time",
      amount: 75,
    });
    expect(donationFromForm({ period: "one-time", amount: "other", other: "" })).toBeNull();
    expect(donationFromForm({ period: "monthly", amount: "25", other: "75" })).toEqual({
      period: "monthly",
      amount: 25,
    });
  });

  it("builds the checkout and thank-you links", () => {
    const donation = { period: "monthly", amount: 10 } as const;
    expect(checkoutHref(donation)).toBe("/membership/checkout?period=monthly&amount=10");
    expect(thankYouHref(donation)).toBe("/membership/thank-you?period=monthly&amount=10");
  });
});

describe("demo card checks", () => {
  const now = new Date(2026, 9, 1); // October 2026

  it("validates the Luhn checksum", () => {
    expect(luhnValid(DEMO_CARDS.success)).toBe(true);
    expect(luhnValid("4242 4242 4242 4242")).toBe(true);
    expect(luhnValid(DEMO_CARDS.declined)).toBe(true);
    expect(luhnValid("4242 4242 4242 4241")).toBe(false);
    expect(luhnValid("1234")).toBe(false);
  });

  it("accepts only a future (or current) expiry", () => {
    expect(expiryValid("10 / 26", now)).toBe(true);
    expect(expiryValid("12/30", now)).toBe(true);
    expect(expiryValid("09 / 26", now)).toBe(false);
    expect(expiryValid("13 / 30", now)).toBe(false);
    expect(expiryValid("1230", now)).toBe(false);
  });

  it("succeeds with 4242…, declines 4000…0002, flags invalid fields", () => {
    const card = { expiry: "12 / 30", cvc: "123" };
    expect(demoPayment({ ...card, number: DEMO_CARDS.success }, now)).toEqual({ ok: true });
    expect(demoPayment({ ...card, number: DEMO_CARDS.declined }, now)).toEqual({
      ok: false,
      field: "number",
      reason: "declined",
    });
    expect(demoPayment({ ...card, number: "4242 4242 4242 4241" }, now)).toMatchObject({
      field: "number",
      reason: "invalid",
    });
    expect(
      demoPayment({ number: DEMO_CARDS.success, expiry: "01 / 20", cvc: "123" }, now),
    ).toMatchObject({ field: "expiry" });
    expect(
      demoPayment({ number: DEMO_CARDS.success, expiry: "12 / 30", cvc: "1" }, now),
    ).toMatchObject({ field: "cvc" });
  });

  it("lists every invalid card field at once", () => {
    expect(cardErrors({ number: "", expiry: "", cvc: "" }, now)).toEqual([
      "number",
      "expiry",
      "cvc",
    ]);
    expect(cardErrors({ number: DEMO_CARDS.success, expiry: "01 / 20", cvc: "12" }, now)).toEqual([
      "expiry",
      "cvc",
    ]);
    expect(cardErrors({ number: DEMO_CARDS.declined, expiry: "12 / 30", cvc: "123" }, now)).toEqual(
      [],
    );
  });

  it("formats input while typing", () => {
    expect(formatCardNumber("4242424242424242")).toBe("4242 4242 4242 4242");
    expect(formatExpiry("1230")).toBe("12 / 30");
    expect(formatExpiry("1")).toBe("1");
  });
});
