/**
 * Who made an audit_log change, for the admin audit page (review 2026-10-07, D-L5).
 *
 * write_audit() stores only the actor's account id since DB-14 (no e-mail in
 * the log itself), so `actor_email` is empty on every newer row and the "Who"
 * column used to read "system" for all of them. The e-mail is now looked up
 * from the account (under profiles RLS); an account the viewer may not see is
 * shown by a short id, so its rows still group together in the filter.
 */
export function auditActorLabel(
  actor: string | null,
  legacyEmail: string | null,
  emails: ReadonlyMap<string, string>,
): string {
  if (actor) {
    return emails.get(actor) ?? legacyEmail ?? `account ${actor.slice(0, 8)}`;
  }
  return legacyEmail ?? "system";
}

/** Splits ids into chunks small enough for one `in.(…)` filter in a URL. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
