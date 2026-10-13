/**
 * Maintenance mode — the one rule every public layout follows (no server
 * dependency, so it is unit-tested on its own). The switch is
 * feature_flags.maintenance; the wording is site content (site_notices), and an
 * empty or missing text falls back to the built-in one from the messages.
 */

export interface MaintenanceNotice {
  title: string;
  text: string;
}

/** Limits of the stored text — the same as the CHECKs on site_notices. */
export const MAINTENANCE_LIMITS = { title: 120, text: 600 } as const;

/**
 * What the public site shows instead of its pages: null while the switch is
 * off, otherwise the stored title/text with the built-in wording for any part
 * that is blank (whitespace only counts as blank).
 */
export function maintenanceNotice(
  enabled: boolean,
  stored: Partial<MaintenanceNotice> | null | undefined,
  fallback: MaintenanceNotice,
): MaintenanceNotice | null {
  if (!enabled) return null;
  return {
    title: stored?.title?.trim() || fallback.title,
    text: stored?.text?.trim() || fallback.text,
  };
}
