import type { ReactNode } from "react";

/**
 * Obal části administrace, kterou uživatel vidí, ale nesmí uložit (RLS by
 * zápis odmítl). `<fieldset disabled>` vypne všechna pole a tlačítka uvnitř
 * a nahoře řekne proč — lepší než editor, který pak při uložení selže.
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
