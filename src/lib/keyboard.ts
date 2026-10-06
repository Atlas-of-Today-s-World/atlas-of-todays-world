/** Elements that handle keys themselves: text fields and open dialogs. */
const OWNS_KEYS = "input, textarea, select, [contenteditable='true'], [role='dialog']";

/**
 * True when a key press belongs to a form field or a dialog, so page-wide
 * shortcuts (Esc closes the panel, "/" focuses the search) must leave it alone.
 */
export function belongsToField(event: KeyboardEvent): boolean {
  return event.target instanceof Element && event.target.closest(OWNS_KEYS) !== null;
}
