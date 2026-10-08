import { describe, expect, it, vi } from "vitest";
import { invalidCodes } from "@/lib/actions";
import { SubscribeInput } from "@/features/newsletter/schema";
import { ApplicationInput } from "@/features/volunteers/schema";

/**
 * Public forms show each error under its field (aria-describedby), so the
 * action must return the message code of every invalid field, not only the first.
 */
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn() }));

function rejected(result: { success: boolean; error?: Parameters<typeof invalidCodes>[0] }) {
  if (result.success || !result.error) throw new Error("expected a validation error");
  return invalidCodes(result.error);
}

describe("invalidCodes", () => {
  it("returns the newsletter codes per field and the first one as the error", () => {
    const state = rejected(
      SubscribeInput.safeParse({ email: "not-an-address", consent: null, interests: [] }),
    );
    expect(state.ok).toBe(false);
    expect(state.error).toBe("invalidEmail");
    expect(state.fieldErrors).toEqual({
      email: ["invalidEmail"],
      consent: ["consent"],
      interests: ["interests"],
    });
  });

  it("returns the volunteer codes only for the invalid fields", () => {
    const state = rejected(
      ApplicationInput.safeParse({
        name: " ",
        email: "someone@example.org",
        topics: "",
        message: "x".repeat(2001),
        consent: "on",
      }),
    );
    expect(state.fieldErrors).toEqual({ name: ["name"], message: ["tooLong"] });
  });
});
