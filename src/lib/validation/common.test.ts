import { afterEach, describe, expect, it, vi } from "vitest";
import { SubscribeInput } from "@/features/newsletter/schema";
import { ApplicationInput } from "@/features/volunteers/schema";
import { emailAddress, emailAddressWith } from "./common";

/** A shape that made the old `[^\s@]+\.[^\s@]{2,}` pattern backtrack quadratically. */
const hostile = (n: number) => `a@${".".repeat(n)}@`;

describe("emailAddress", () => {
  afterEach(() => vi.restoreAllMocks());

  it("accepts ordinary addresses and lowercases them", () => {
    expect(emailAddress.parse(" Ana@Example.ORG ")).toBe("ana@example.org");
    expect(emailAddress.safeParse("ana@sub.example.co.uk").success).toBe(true);
    expect(emailAddress.safeParse("ana@example").success).toBe(false);
    expect(emailAddress.safeParse("ana@@example.org").success).toBe(false);
  });

  it("rejects an over-long address without running the pattern", () => {
    const test = vi.spyOn(RegExp.prototype, "test");
    const result = emailAddressWith("invalidEmail").safeParse(`${"a".repeat(300)}@example.org`);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual(["invalidEmail"]);
    const emailPatternRuns = test.mock.contexts.filter((re) => (re as RegExp).source.includes("@"));
    expect(emailPatternRuns).toHaveLength(0);
  });

  it("answers a megabyte of hostile input at once in every public email form", () => {
    const input = hostile(1_000_000);
    const started = performance.now();
    expect(emailAddress.safeParse(input).success).toBe(false);
    expect(
      SubscribeInput.safeParse({ email: input, consent: "on" }).error?.issues[0]?.message,
    ).toBe("invalidEmail");
    expect(
      ApplicationInput.safeParse({
        name: "A",
        email: input,
        topics: "",
        message: "",
        consent: "on",
      }).error?.issues[0]?.message,
    ).toBe("invalidEmail");
    expect(performance.now() - started).toBeLessThan(500);
  });

  it("stays linear on hostile input within the length limit", () => {
    const started = performance.now();
    for (let i = 0; i < 200; i++) emailAddress.safeParse(hostile(250));
    for (let i = 0; i < 200; i++) emailAddress.safeParse(`a@${"a.".repeat(124)}!`);
    expect(performance.now() - started).toBeLessThan(500);
  });
});
