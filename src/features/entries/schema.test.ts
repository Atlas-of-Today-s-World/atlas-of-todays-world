import { describe, expect, it } from "vitest";
import { ScheduleInput } from "./schema";

const id = "00000000-0000-4000-8000-000000000001";
const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

describe("ScheduleInput", () => {
  it("přijme čas aspoň 5 minut dopředu a nejvýš za rok", () => {
    expect(ScheduleInput.safeParse({ id, publish_at: inMinutes(60) }).success).toBe(true);
    expect(ScheduleInput.safeParse({ id, publish_at: "2099-01-01T10:00:00+02:00" }).success).toBe(
      false,
    );
  });

  it("odmítne minulost, příliš brzy a nesmysl", () => {
    for (const publish_at of [inMinutes(-10), inMinutes(2), "", "zítra", "2026-10-01T10:00"]) {
      expect(ScheduleInput.safeParse({ id, publish_at }).success).toBe(false);
    }
    expect(ScheduleInput.safeParse({ id: "x", publish_at: inMinutes(60) }).success).toBe(false);
  });
});
