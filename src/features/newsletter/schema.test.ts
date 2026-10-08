import { describe, expect, it } from "vitest";
import { INTEREST_TAGS, SubscribeInput } from "./schema";

const base = { email: "reader@example.org", consent: "on" };

describe("SubscribeInput", () => {
  it("keeps the picked interests, once each", () => {
    const parsed = SubscribeInput.parse({
      ...base,
      interests: ["topics", "organisation", "topics"],
    });
    expect(parsed.interests).toEqual(["topics", "organisation"]);
    expect(parsed.interests.map((interest) => INTEREST_TAGS[interest])).toEqual([
      "New topics",
      "Organisation news",
    ]);
  });

  it("needs at least one interest and rejects unknown ones", () => {
    const none = SubscribeInput.safeParse({ ...base, interests: [] });
    expect(none.success).toBe(false);
    expect(none.error?.issues[0]?.message).toBe("interests");
    expect(SubscribeInput.safeParse({ ...base, interests: ["ads"] }).success).toBe(false);
  });
});
