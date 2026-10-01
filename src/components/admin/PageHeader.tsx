import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Nadpis obrazovky administrace: dlaždice s ikonou sekce (stejnou jako v menu),
 * titulek, perex a vpravo hlavní akce („Add …").
 */
export function PageHeader({
  title,
  lead,
  actions,
  icon: Icon,
}: {
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex max-w-3xl items-start gap-3">
        {Icon ? (
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
          >
            <Icon className="size-5" />
          </span>
        ) : null}
        <div>
          <h1 className="font-display text-[24px] leading-tight font-bold">{title}</h1>
          {lead ? (
            <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--color-ink-soft)]">
              {lead}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
