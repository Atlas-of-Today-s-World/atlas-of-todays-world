import { PATRONS_EMAIL } from "../config";

/** Mail link for donation questions (FAQ, manage page). */
export function PatronsEmail() {
  return (
    <a href={`mailto:${PATRONS_EMAIL}`} className="text-[var(--color-link)] underline">
      {PATRONS_EMAIL}
    </a>
  );
}
