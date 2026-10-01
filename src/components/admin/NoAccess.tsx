/** Sekce, na kterou role nemá právo (stránka je chráněná i mimo menu). */
export function NoAccess() {
  return (
    <div data-testid="section-forbidden">
      <h1 className="font-display text-[24px] font-bold">
        You don&apos;t have permission for this section
      </h1>
      <p className="mt-2 text-[14px] text-[var(--color-ink-soft)]">
        Ask a permissions administrator for access.
      </p>
    </div>
  );
}
