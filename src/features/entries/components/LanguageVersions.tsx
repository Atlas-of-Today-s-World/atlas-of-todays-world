import Link from "next/link";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { DEFAULT_LOCALE, LOCALES, LOCALE_NAMES, isLocale } from "@/features/i18n/config";
import { createTranslation } from "../actions";
import type { listLanguageVersions } from "../editorial";
import { StatusBadge } from "./StatusBadge";

/** Label of the button for creating a new language version, per target locale. */
const CREATE_LABEL: Partial<Record<string, string>> = { cs: "Create Czech version" };

/**
 * Language versions of an article (G5.3): the original and its translations with
 * links and status; on the original, a button for each language still missing.
 * A translation is a separate draft with the same approval.
 */
export function LanguageVersions({
  currentId,
  versions,
  canCreate,
}: {
  currentId: string;
  versions: Awaited<ReturnType<typeof listLanguageVersions>>;
  canCreate: boolean;
}) {
  const original = versions.find((version) => version.translation_of === null);
  const missing = LOCALES.filter(
    (locale) => locale !== DEFAULT_LOCALE && !versions.some((version) => version.locale === locale),
  );

  return (
    <div className="grid gap-3 text-[13px]">
      <ul className="grid gap-2">
        {versions.map((version) => (
          <li key={version.id} className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-[var(--color-line)] px-1.5 text-[11px] font-medium uppercase">
              {version.locale}
            </span>
            {version.id === currentId ? (
              <span className="font-medium">{version.title}</span>
            ) : (
              <Link
                href={`/admin/content/${version.id}`}
                className="text-[var(--color-link)] underline"
              >
                {version.title}
              </Link>
            )}
            <StatusBadge status={version.status} />
            {version.translation_of === null ? (
              <span className="text-[11px] text-[var(--color-ink-muted)]">original</span>
            ) : null}
          </li>
        ))}
      </ul>
      {original && canCreate
        ? missing.map((locale) => (
            <form key={locale} action={createTranslation}>
              <input type="hidden" name="entry_id" value={original.id} />
              <input type="hidden" name="locale" value={locale} />
              <SubmitButton size="sm" variant="outline">
                {CREATE_LABEL[locale] ??
                  `Create version: ${isLocale(locale) ? LOCALE_NAMES[locale] : locale}`}
              </SubmitButton>
            </form>
          ))
        : null}
      <p className="text-[11.5px] text-[var(--color-ink-muted)]">
        A translation has the same URL with a language prefix (/cs/…) and its own approval. Until it
        is published, readers see the original with a note.
      </p>
    </div>
  );
}
