import { describe, expect, it } from "vitest";
import { EmailCodeRequest, EmailCodeVerify } from "./schema";

describe("EmailCodeRequest", () => {
  it("normalizes the email; language defaults to English", () => {
    expect(EmailCodeRequest.parse({ email: "  Ana@Example.ORG " })).toEqual({
      email: "ana@example.org",
      locale: "en",
    });
  });

  it("rejects an invalid email and an unknown language", () => {
    expect(EmailCodeRequest.safeParse({ email: "ana@" }).success).toBe(false);
    expect(EmailCodeRequest.safeParse({ email: "ana@example.org", locale: "de" }).success).toBe(
      false,
    );
  });
});

describe("EmailCodeVerify", () => {
  it("code has exactly eight digits", () => {
    const base = { email: "ana@example.org" };
    expect(EmailCodeVerify.safeParse({ ...base, code: " 12345678 " }).success).toBe(true);
    for (const code of ["1234567", "123456789", "1234567a", ""]) {
      expect(EmailCodeVerify.safeParse({ ...base, code }).success).toBe(false);
    }
  });
});
