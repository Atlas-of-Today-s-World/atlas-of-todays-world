/** Elements that handle keys themselves: text fields, open dialogs and menus. */
const OWNS_KEYS =
  "input, textarea, select, [contenteditable='true'], [role='dialog'], [role='menu']";

/**
 * True when a key press belongs to a form field, a dialog or a menu, so page-wide
 * shortcuts (Esc closes the panel, "/" focuses the search) must leave it alone.
 */
export function belongsToField(event: KeyboardEvent): boolean {
  return event.target instanceof Element && event.target.closest(OWNS_KEYS) !== null;
}
