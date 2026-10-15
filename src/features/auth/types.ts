/**
 * What `/api/me` answers — the header's account menu asks on open, so the
 * public pages themselves stay static and never read the session. Only what
 * the menu shows; nothing else about the account leaves the server this way.
 */
export interface Me {
  signedIn: boolean;
  /** The name from their own profile (shown above the e-mail), null when not set. */
  name: string | null;
  email: string | null;
  /** The role's name (shown to the team only), null for a visitor. */
  roleName: string | null;
  /** The admin opens for them (`opensAdmin`). */
  isStaff: boolean;
}

export const SIGNED_OUT: Me = {
  signedIn: false,
  name: null,
  email: null,
  roleName: null,
  isStaff: false,
};

/**
 * The answer read defensively, as from any network (no Zod in client
 * bundles): a field of the wrong type counts as missing.
 */
export function readMe(body: unknown): Me {
  if (typeof body !== "object" || body === null) return SIGNED_OUT;
  const value = body as Record<string, unknown>;
  if (value.signedIn !== true) return SIGNED_OUT;
  const text = (field: unknown) =>
    typeof field === "string" && field.trim() ? field.trim() : null;
  return {
    signedIn: true,
    name: text(value.name),
    email: text(value.email),
    roleName: text(value.roleName),
    isStaff: value.isStaff === true,
  };
}
