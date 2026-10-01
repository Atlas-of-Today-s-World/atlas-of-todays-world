/**
 * Chyba z Postgresu/PostgREST → hláška pro uživatele (ARCHITEKTURA 4.3).
 * Vlastní výjimky z triggerů (errcode 42501, 22023, 23505 s textem) jsou psané
 * pro lidi, ty se ukážou. Ostatní detaily jdou jen do logu serveru.
 */
interface DbError {
  code?: string;
  message?: string;
}

const OWN_MESSAGE = /^[A-Z][^\n]{8,200}[.!?]$/;

export function mapDbError(error: DbError): string {
  const message = error.message ?? "";
  if (
    ["42501", "22023", "23505", "23503"].includes(error.code ?? "") &&
    OWN_MESSAGE.test(message)
  ) {
    if (!/violates|policy|permission denied|duplicate key/i.test(message)) return message;
  }
  switch (error.code) {
    case "42501":
      return "Na tuto akci nemáte oprávnění.";
    case "23505":
      return "Takový záznam už existuje.";
    case "23514":
      return "Některá hodnota nesplňuje pravidla (délka, formát nebo adresa).";
    case "23503":
      return "Záznam je propojený s jinými daty.";
    default:
      console.error("[db]", error.code, message);
      return "Uložení se nepovedlo. Zkuste to prosím znovu.";
  }
}
