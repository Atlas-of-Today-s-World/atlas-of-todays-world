import { describe, expect, it } from "vitest";
import { AccountInput } from "./schema";

const base = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "  Ada Ames ",
  phone: "",
  role_id: "publisher",
  status: "active",
  approval_global: "false",
  countries: [],
  authors: [],
};

describe("AccountInput", () => {
  it("takes the name trimmed and an empty phone as none", () => {
    const parsed = AccountInput.parse(base);
    expect(parsed.name).toBe("Ada Ames");
    expect(parsed.phone).toBeUndefined();
    expect(AccountInput.parse({ ...base, phone: "+420 123 456 789" }).phone).toBe(
      "+420 123 456 789",
    );
  });

  it("keeps the DB limits (name 120, phone 40)", () => {
    expect(AccountInput.safeParse({ ...base, name: "x".repeat(121) }).success).toBe(false);
    expect(AccountInput.safeParse({ ...base, phone: "1".repeat(41) }).success).toBe(false);
  });

  it("still needs a reason to block", () => {
    expect(AccountInput.safeParse({ ...base, status: "blocked" }).success).toBe(false);
  });
});
