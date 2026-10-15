import { describe, expect, it } from "vitest";
import { SIGNED_OUT, readMe } from "./types";

describe("readMe", () => {
  it("reads a signed-in answer", () => {
    expect(readMe({ signedIn: true, email: "a@b.org", roleName: "Admin", isStaff: true })).toEqual({
      signedIn: true,
      email: "a@b.org",
      roleName: "Admin",
      isStaff: true,
    });
  });

  it("treats anything unexpected as signed out or missing", () => {
    expect(readMe(null)).toBe(SIGNED_OUT);
    expect(readMe("yes")).toBe(SIGNED_OUT);
    expect(readMe({ signedIn: "true", email: "a@b.org" })).toBe(SIGNED_OUT);
    expect(readMe({ signedIn: true, email: 42, roleName: "", isStaff: "yes" })).toEqual({
      signedIn: true,
      email: null,
      roleName: null,
      isStaff: false,
    });
  });
});
