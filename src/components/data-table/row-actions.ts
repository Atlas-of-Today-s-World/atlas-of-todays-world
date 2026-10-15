import type { ActionState } from "@/lib/actions";

/**
 * Row actions as plain data (a Server Component page builds them, the client
 * `RowActions` draws them). Kept out of the "use client" file so pages can
 * call the helpers on the server.
 */

export type RowActionIcon =
  | "edit"
  | "view"
  | "open"
  | "approve"
  | "return"
  | "send"
  | "extend"
  | "share"
  | "archive"
  | "restore"
  | "revoke"
  | "delete"
  | "hide"
  | "show"
  | "up"
  | "down"
  | "on"
  | "off";

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
    }
  | {
      /**
       * Runs at once, without a dialog — only for small, harmless steps the
       * user undoes with the opposite button (move up / down). Anything else is
       * a confirmed "action".
       */
      kind: "instant";
      icon: RowActionIcon;
      label: string;
      action: () => Promise<ActionState>;
      disabled?: boolean;
    }
  | {
      /**
       * Confirmed in a dialog with a required note (send back with a reason…).
       * `action` is a form Server Action; it gets `fields` (the row id…) and
       * the note as `note`.
       */
      kind: "note";
      icon: RowActionIcon;
      label: string;
      action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
      fields: Record<string, string>;
      confirmTitle: string;
      confirmBody: string;
      confirmLabel?: string;
      noteLabel: string;
      noteMax: number;
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

/**
 * Hide a shown record from the site, or show a hidden one again (the record
 * stays in the admin either way). Pass the Server Action bound to the row and
 * the value it sets (`setVisible.bind(null, id, !visible)`).
 */
export const visibilityAction = (
  action: () => Promise<ActionState>,
  visible: boolean,
  what: string,
): RowAction =>
  visible
    ? confirmAction(
        "hide",
        "Hide from the site",
        action,
        `Hide ${what}?`,
        "It stays here and you can show it again any time.",
      )
    : confirmAction("show", "Show on the site", action, `Show ${what}?`, "It appears on the site.");

/**
 * Move up / down within a hand-ordered list; the first row can't go up, the
 * last can't go down. Pass Server Actions bound to the row
 * (`moveX.bind(null, id, true)`) — a Server Component can't hand a closure to the client.
 */
export const moveActions = (
  up: () => Promise<ActionState>,
  down: () => Promise<ActionState>,
  { first, last }: { first: boolean; last: boolean },
): RowAction[] => [
  { kind: "instant", icon: "up", label: "Move up", action: up, disabled: first },
  { kind: "instant", icon: "down", label: "Move down", action: down, disabled: last },
];

/** A row action that asks for a note first (e.g. send an article back with the reason). */
export const noteAction = (
  icon: RowActionIcon,
  label: string,
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>,
  fields: Record<string, string>,
  {
    title,
    body,
    noteLabel,
    noteMax,
    confirmLabel,
  }: {
    title: string;
    body: string;
    noteLabel: string;
    noteMax: number;
    confirmLabel?: string;
  },
): RowAction => ({
  kind: "note",
  icon,
  label,
  action,
  fields,
  confirmTitle: title,
  confirmBody: body,
  confirmLabel,
  noteLabel,
  noteMax,
});
