import type { ReactNode } from "react";

/**
 * Wrapper for a part of the admin the user can see but not save (RLS would
 * reject the write). `<fieldset disabled>` disables all fields and buttons inside
 * and says why at the top — better than an editor that then fails on save.
 */
export function ReadOnly({
  readOnly,
  reason,
  children,
}: {
  readOnly: boolean;
  reason: string;
  children: ReactNode;
}) {
  if (!readOnly) return <>{children}</>;
  return (
    <fieldset disabled className="min-w-0 opacity-75">
      <legend className="mb-3 rounded-lg bg-[var(--color-line)]/40 px-3 py-2 text-[12.5px] text-[var(--color-ink-soft)]">
        {reason}
      </legend>
      {children}
    </fieldset>
  );
}
