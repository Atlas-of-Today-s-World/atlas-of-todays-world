/**
 * Which roles only an admin gives (DB `role_needs_admin()`): shown to account
 * managers who aren't admins, so a refused save isn't a surprise. The DB decides.
 */
export function AdminOnlyRolesNote() {
  return (
    <p className="rounded-lg bg-[var(--color-line)]/30 px-3 py-2 text-[13px]">
      Only an admin gives a role that edits everyone’s articles, approves articles, or manages
      accounts, members or permissions (for example Content editor, Content approver or Permission
      admin).
    </p>
  );
}
