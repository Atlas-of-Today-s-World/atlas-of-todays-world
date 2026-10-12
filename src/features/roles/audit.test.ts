import { describe, expect, it } from "vitest";
import { auditActorLabel, chunk } from "./audit";

const ADMIN = "0a1b2c3d-0000-4000-8000-000000000001";
const emails = new Map([[ADMIN, "admin@atlasoftodaysworld.org"]]);

describe("auditActorLabel", () => {
  it("shows the account's e-mail for a row that stores only the actor id", () => {
    expect(auditActorLabel(ADMIN, null, emails)).toBe("admin@atlasoftodaysworld.org");
  });

  it("falls back to the e-mail stored on old rows, then to a short account id", () => {
    const other = "ffffffff-0000-4000-8000-000000000009";
    expect(auditActorLabel(other, "old@example.org", emails)).toBe("old@example.org");
    expect(auditActorLabel(other, null, emails)).toBe("account ffffffff");
  });

  it("calls a change without an actor a system change", () => {
    expect(auditActorLabel(null, null, emails)).toBe("system");
  });
});

describe("chunk", () => {
  it("splits into pieces of at most the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});
