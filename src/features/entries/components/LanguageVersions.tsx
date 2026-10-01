import Link from "next/link";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { DEFAULT_LOCALE, LOCALES, LOCALE_NAMES, isLocale } from "@/features/i18n/config";
import { createTranslation } from "../actions";
import type { listLanguageVersions } from "../editorial";
import { StatusBadge } from "./StatusBadge";

/** Jak se jmenuje tlačítko pro nový jazyk (administrace je česká). */
const CREATE_LABEL: Partial<Record<string, string>> = { cs: "Vytvořit českou verzi" };

/**
 * Jazykové verze článku (G5.3): originál a jeho překlady s odkazy a stavem;
 * u originálu tlačítko pro jazyk, který ještě chybí. Překlad je samostatný
 * koncept se stejným schvalováním.
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
                href={`/admin/obsah/${version.id}`}
                className="text-[var(--color-link)] underline"
              >
                {version.title}
              </Link>
            )}
            <StatusBadge status={version.status} />
            {version.translation_of === null ? (
              <span className="text-[11px] text-[var(--color-ink-muted)]">originál</span>
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
                  `Vytvořit verzi: ${isLocale(locale) ? LOCALE_NAMES[locale] : locale}`}
              </SubmitButton>
            </form>
          ))
        : null}
      <p className="text-[11.5px] text-[var(--color-ink-muted)]">
        Překlad má stejnou adresu s jazykovou předponou (/cs/…) a vlastní schvalování. Dokud není
        zveřejněný, čtenáři vidí originál s poznámkou.
      </p>
    </div>
  );
}
