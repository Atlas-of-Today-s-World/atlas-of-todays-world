import { describe, expect, it, vi } from "vitest";
import type { ServerClient } from "@/lib/supabase/server";
import { staffNames } from "./staff-names";

function client(names: Record<string, string | null>) {
  const rpc = vi.fn(async (_fn: string, args: { p_profile: string }) => ({
    data: names[args.p_profile] ?? null,
    error: null,
  }));
  return { rpc, supabase: { rpc } as unknown as ServerClient };
}

describe("staffNames", () => {
  it("asks the database once per person and skips empty ids", async () => {
    const { rpc, supabase } = client({ a: "Anna", b: "bob" });
    const names = await staffNames(supabase, ["a", null, "b", "a", undefined, ""]);
    expect(names).toEqual({ a: "Anna", b: "bob" });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith("staff_name", { p_profile: "a" });
  });

  it("leaves out people the database does not name (readers, removed accounts)", async () => {
    const { supabase } = client({ a: "Anna", reader: null });
    expect(await staffNames(supabase, ["a", "reader"])).toEqual({ a: "Anna" });
  });

  it("does not call the database without people", async () => {
    const { rpc, supabase } = client({});
    expect(await staffNames(supabase, [])).toEqual({});
    expect(rpc).not.toHaveBeenCalled();
  });
});
