import { describe, expect, it } from "vitest";
import { EmailCodeRequest, EmailCodeVerify } from "./schema";

describe("EmailCodeRequest", () => {
  it("e-mail znormalizuje, jazyk je výchozí angličtina", () => {
    expect(EmailCodeRequest.parse({ email: "  Ana@Example.ORG " })).toEqual({
      email: "ana@example.org",
      locale: "en",
    });
  });

  it("odmítne neplatný e-mail a neznámý jazyk", () => {
    expect(EmailCodeRequest.safeParse({ email: "ana@" }).success).toBe(false);
    expect(EmailCodeRequest.safeParse({ email: "ana@example.org", locale: "de" }).success).toBe(
      false,
    );
  });
});

describe("EmailCodeVerify", () => {
  it("kód má přesně šest číslic", () => {
    const base = { email: "ana@example.org" };
    expect(EmailCodeVerify.safeParse({ ...base, code: " 123456 " }).success).toBe(true);
    for (const code of ["12345", "1234567", "12345a", ""]) {
      expect(EmailCodeVerify.safeParse({ ...base, code }).success).toBe(false);
    }
  });
});
