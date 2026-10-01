import type { ReactNode } from "react";

/** Nadpis obrazovky administrace s perexem a místem pro hlavní akci. */
export function PageHeader({
  title,
  lead,
  actions,
}: {
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="font-display text-[26px] leading-tight font-bold">{title}</h1>
        {lead ? (
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-soft)]">{lead}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
