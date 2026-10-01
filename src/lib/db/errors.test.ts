import { describe, expect, it, vi } from "vitest";
import { mapDbError } from "./errors";

describe("mapDbError", () => {
  it("ukáže vlastní hlášku z triggeru", () => {
    expect(mapDbError({ code: "42501", message: "Only an admin can invite an admin." })).toBe(
      "Only an admin can invite an admin.",
    );
  });

  it("technickou hlášku RLS nahradí srozumitelnou", () => {
    expect(
      mapDbError({
        code: "42501",
        message: 'new row violates row-level security policy for table "x"',
      }),
    ).toBe("Na tuto akci nemáte oprávnění.");
  });

  it("duplicitu a porušení pravidla přeloží", () => {
    expect(
      mapDbError({ code: "23505", message: 'duplicate key value violates unique constraint "k"' }),
    ).toBe("Takový záznam už existuje.");
    expect(mapDbError({ code: "23514", message: "check constraint" })).toMatch(/nesplňuje/);
  });

  it("neznámou chybu jen zaloguje, uživateli neprozradí detail", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(mapDbError({ code: "XX000", message: "internal detail: table secret_x" })).toBe(
      "Uložení se nepovedlo. Zkuste to prosím znovu.",
    );
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
