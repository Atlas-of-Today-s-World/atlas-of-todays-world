import type { ActionState } from "@/lib/actions";

/**
 * Row actions as plain data (a Server Component page builds them, the client
 * `RowActions` draws them). Kept out of the "use client" file so pages can
 * call the helpers on the server.
 */

export type RowActionIcon =
  "edit" | "view" | "open" | "approve" | "share" | "archive" | "restore" | "revoke" | "delete";

export type RowAction =
  | { kind: "link"; icon: RowActionIcon; label: string; href: string; newTab?: boolean }
  | {
      kind: "action";
      icon: RowActionIcon;
      label: string;
      /** Server Action bound to the row (e.g. `deleteRedirect.bind(null, id)`). */
      action: () => Promise<ActionState>;
      /** Destructive: red icon. Every action is confirmed in a dialog first. */
      danger?: boolean;
      confirmTitle: string;
      confirmBody: string;
      confirmLabel?: string;
    };

export const editAction = (href: string, label = "Edit"): RowAction => ({
  kind: "link",
  icon: "edit",
  label,
  href,
});

export const openAction = (href: string, label = "Open on the site"): RowAction => ({
  kind: "link",
  icon: "open",
  label,
  href,
  newTab: true,
});

/** Red, last in the row, confirmed with the record's name in the dialog. */
export const deleteAction = (
  action: () => Promise<ActionState>,
  what: string,
  body = "This cannot be undone.",
): RowAction => ({
  kind: "action",
  icon: "delete",
  label: "Delete",
  danger: true,
  action,
  confirmTitle: `Delete ${what}?`,
  confirmBody: body,
});

/** Confirmed, non-destructive action (approve, archive, restore…). */
export const confirmAction = (
  icon: RowActionIcon,
  label: string,
  action: () => Promise<ActionState>,
  confirmTitle: string,
  confirmBody: string,
): RowAction => ({ kind: "action", icon, label, action, confirmTitle, confirmBody });
