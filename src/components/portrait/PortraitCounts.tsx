"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import Link from "@/components/i18n/Link";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { cn } from "@/lib/cn";

/**
 * The counts under a region's or special region's heading. The number of
 * countries opens, right in the same box, a compact list of them — each a link
 * to its profile.
 */
export function PortraitCounts({
  countries,
  population,
}: {
  countries: { slug: string; name: string }[];
  /** Already formatted for the page's language. */
  population: string;
}) {
  const t = useMessages().portrait;
  const [open, setOpen] = useState(false);
  const listId = useId();

  return (
    <div className="mt-5 border-t border-[var(--color-line)] pt-4 text-[12.5px]">
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-[var(--color-ink-muted)]">{t.countries}</dt>
          <dd>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={listId}
              aria-label={`${t.countries}: ${countries.length}`}
              onClick={() => setOpen((value) => !value)}
              disabled={!countries.length}
              className="-mx-1.5 inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 font-medium text-[var(--color-link)] transition hover:bg-[var(--color-accent-soft)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none disabled:text-[var(--color-ink)]"
            >
              {countries.length}
              {countries.length ? (
                <ChevronDown
                  aria-hidden
                  className={cn("size-4 transition-transform", open && "rotate-180")}
                />
              ) : null}
            </button>
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-ink-muted)]">{t.people}</dt>
          <dd className="font-medium text-[var(--color-ink)]">{population}</dd>
        </div>
      </dl>
      <ul id={listId} hidden={!open} className="mt-3 flex flex-wrap gap-1.5">
        {countries.map((country) => (
          <li key={country.slug}>
            <Link
              href={`/country/${country.slug}`}
              className="inline-flex min-h-7 items-center rounded-full border border-[var(--color-line)] px-2.5 text-[12px] text-[var(--color-ink-soft)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              {country.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
