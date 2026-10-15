import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { mapDbError } from "./errors";

describe("mapDbError", () => {
  it("shows a custom message from a trigger", () => {
    expect(mapDbError({ code: "42501", message: "Only an admin can invite an admin." })).toBe(
      "Only an admin can invite an admin.",
    );
  });

  it("replaces the technical RLS message with a readable one", () => {
    expect(
      mapDbError({
        code: "42501",
        message: 'new row violates row-level security policy for table "x"',
      }),
    ).toBe("You don't have permission for this action.");
  });

  it("translates a duplicate and a constraint violation", () => {
    expect(
      mapDbError({ code: "23505", message: 'duplicate key value violates unique constraint "k"' }),
    ).toBe("This record already exists.");
    expect(mapDbError({ code: "23514", message: "check constraint" })).toMatch(
      /doesn't meet the rules/,
    );
  });

  it("shows every workflow and role message of the hardening migration as written", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20261013000310_workflow_and_access_hardening.sql"),
      "utf8",
    );
    const raised = [
      ...sql.matchAll(
        /raise exception '((?:[^']|'')+)' using errcode = '(42501|22023|23505|23503)'/g,
      ),
    ].map(([, message, code]) => ({ code, message: message!.replaceAll("''", "'") }));
    expect(raised.length).toBeGreaterThan(10);
    for (const error of raised) expect(mapDbError(error)).toBe(error.message);
  });

  it("only logs an unknown error and doesn't reveal details to the user", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(mapDbError({ code: "XX000", message: "internal detail: table secret_x" })).toBe(
      "Saving failed. Please try again.",
    );
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
