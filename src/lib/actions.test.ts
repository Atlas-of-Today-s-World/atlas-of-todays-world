import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const getUser = vi.fn();
const client = { auth: { getUser } };
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn(async () => client) }));

const { affected, formAction, formObject, idAction, NOT_SIGNED_IN } = await import("./actions");

const USER = { id: "u1", email: "editor@example.org" };
const ID = "0b6a3f1e-2c4d-4e5f-8a9b-1c2d3e4f5a6b";
const signIn = (user: unknown = USER) => getUser.mockResolvedValue({ data: { user } });

beforeEach(() => {
  getUser.mockReset();
});

describe("formObject", () => {
  it("reads fields, repeated fields as arrays and skips React's internal ones", () => {
    const form = new FormData();
    form.set("name", "Sahel");
    form.append("tags", "a");
    form.append("tags", "b");
    form.set("$ACTION_ID_x", "");
    expect(formObject(form, ["tags", "empty"])).toEqual({
      name: "Sahel",
      tags: ["a", "b"],
      empty: [],
    });
  });

  it("never lets a field name reach the prototype", () => {
    const form = new FormData();
    form.set("__proto__", new File(["x"], "x.txt"));
    form.set("constructor", "x");
    form.set("prototype", "x");
    form.set("name", "ok");
    const out = formObject(form);
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(Object.keys(out)).toEqual(["name"]);
    expect(out.constructor).toBe(Object);
  });
});

describe("formAction", () => {
  const Input = z.object({ name: z.string().min(2, "Too short."), tags: z.array(z.string()) });
  const handler = vi.fn(async ({ data }: { data: z.infer<typeof Input> }) => ({
    ok: true,
    message: `Saved ${data.name} (${data.tags.join(",")}).`,
  }));
  const save = formAction(Input, handler, { arrays: ["tags"] });
  const form = (fields: Record<string, string | string[]>) => {
    const out = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      for (const item of [value].flat()) out.append(key, item);
    }
    return out;
  };

  beforeEach(() => {
    handler.mockClear();
  });

  it("returns the field errors of invalid input without asking who is signed in", async () => {
    const state = await save({ ok: false }, form({ name: "x" }));
    expect(state).toMatchObject({ ok: false, fieldErrors: { name: ["Too short."] } });
    expect(getUser).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("asks a signed-out user to sign in again", async () => {
    signIn(null);
    expect(await save({ ok: false }, form({ name: "Sahel" }))).toEqual(NOT_SIGNED_IN);
    expect(handler).not.toHaveBeenCalled();
  });

  it("runs the handler with the parsed data, the session and the form", async () => {
    signIn();
    const posted = form({ name: "Sahel", tags: ["a", "b"] });
    expect(await save({ ok: false }, posted)).toEqual({ ok: true, message: "Saved Sahel (a,b)." });
    expect(handler).toHaveBeenCalledWith({
      data: { name: "Sahel", tags: ["a", "b"] },
      supabase: client,
      user: USER,
      formData: posted,
    });
  });
});

describe("idAction", () => {
  const handler = vi.fn(async (input: { id: string }, note: string) => ({
    ok: true,
    message: `${input.id}: ${note}`,
  }));
  const remove = idAction(handler, { invalid: "Invalid thing." });

  beforeEach(() => {
    handler.mockClear();
  });

  it("rejects a value that isn't a uuid before anything else", async () => {
    expect(await remove("1; drop table", "x")).toEqual({ ok: false, error: "Invalid thing." });
    expect(await idAction(handler)("nope", "x")).toEqual({ ok: false, error: "Invalid record." });
    expect(getUser).not.toHaveBeenCalled();
  });

  it("asks a signed-out user to sign in again", async () => {
    signIn(null);
    expect(await remove(ID, "x")).toEqual(NOT_SIGNED_IN);
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes the id, the session and the further arguments", async () => {
    signIn();
    expect(await remove(ID, "closed")).toEqual({ ok: true, message: `${ID}: closed` });
    expect(handler).toHaveBeenCalledWith({ id: ID, supabase: client, user: USER }, "closed");
  });
});

describe("affected", () => {
  it("passes a write that returned rows", () => {
    expect(affected([{ id: 1 }], "No.")).toBeNull();
    expect(affected({ data: [{ id: 1 }], error: null }, "No.")).toBeNull();
  });

  it("turns a write RLS filtered out into the message", () => {
    expect(affected([], "You can't.")).toEqual({ ok: false, error: "You can't." });
    expect(affected(null, "You can't.")).toEqual({ ok: false, error: "You can't." });
    expect(affected({ data: [], error: null }, "You can't.")).toEqual({
      ok: false,
      error: "You can't.",
    });
  });

  it("maps a database error like failed()", () => {
    expect(
      affected({ data: null, error: { code: "23505", message: "duplicate key" } }, "No."),
    ).toEqual({ ok: false, error: "This record already exists." });
  });
});
