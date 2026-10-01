/**
 * Postgres/PostgREST error → message for the user (ARCHITEKTURA 4.3).
 * Custom exceptions from triggers (errcode 42501, 22023, 23505 with text) are
 * written for people, so they are shown. Other details go only to the server log.
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
      return "You don't have permission for this action.";
    case "23505":
      return "This record already exists.";
    case "23514":
      return "Some value doesn't meet the rules (length, format or address).";
    case "23503":
      return "This record is linked to other data.";
    default:
      console.error("[db]", error.code, message);
      return "Saving failed. Please try again.";
  }
}
