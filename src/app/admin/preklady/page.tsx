import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/DataTable";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { cn } from "@/lib/cn";
import { can, getAccess } from "@/features/auth/access";
import { LOCALE_NAMES, type Locale } from "@/features/i18n/config";
import { listTranslations } from "@/features/i18n/editorial";
import { ENTITY_LABELS, TARGET_LOCALES } from "@/features/i18n/schema";
import {
  ENTITY_SECTION,
  TRANSLATABLE_ENTITIES,
  type TranslatableEntity,
} from "@/features/i18n/translatable";

export const metadata: Metadata = { title: "Překlady" };

const tab = (active: boolean) =>
  cn(
    "inline-flex min-h-(--touch-min) items-center rounded-full border px-4 text-[13px]",
    active
      ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
      : "border-[var(--color-line)] hover:border-[var(--color-accent)]",
  );

export default async function TranslationsPage({
  searchParams,
}: {
  searchParams: Promise<{ druh?: string; jazyk?: string }>;
}) {
  const access = await getAccess();
  const entities = TRANSLATABLE_ENTITIES.filter(
    (entity) => access && can(access.permissions, ENTITY_SECTION[entity], "v"),
  );
  if (!access || !entities.length) return <NoAccess />;

  const params = await searchParams;
  const entity = (entities as string[]).includes(params.druh ?? "")
    ? (params.druh as TranslatableEntity)
    : entities[0];
  const locale = (TARGET_LOCALES as string[]).includes(params.jazyk ?? "")
    ? (params.jazyk as Locale)
    : TARGET_LOCALES[0];
  const items = await listTranslations(entity, locale);
  const done = items.filter((item) => item.total > 0 && item.done === item.total).length;
  const query = (next: { druh?: string; jazyk?: string }) =>
    `/admin/preklady?${new URLSearchParams({ druh: entity, jazyk: locale, ...next })}`;

  return (
    <>
      <PageHeader
        title="Překlady"
        lead={`Texty Atlasu v dalších jazycích. Co není přeložené, web ukáže anglicky. Hotovo ${done} z ${items.length}.`}
      />
      <nav aria-label="Druh obsahu" className="mb-3 flex flex-wrap gap-2">
        {entities.map((item) => (
          <Link
            key={item}
            href={query({ druh: item })}
            className={tab(item === entity)}
            aria-current={item === entity ? "page" : undefined}
          >
            {ENTITY_LABELS[item]}
          </Link>
        ))}
      </nav>
      {TARGET_LOCALES.length > 1 ? (
        <nav aria-label="Jazyk" className="mb-5 flex flex-wrap gap-2">
          {TARGET_LOCALES.map((item) => (
            <Link
              key={item}
              href={query({ jazyk: item })}
              className={tab(item === locale)}
              aria-current={item === locale ? "page" : undefined}
            >
              {LOCALE_NAMES[item]}
            </Link>
          ))}
        </nav>
      ) : null}
      <DataTable
        caption={`${ENTITY_LABELS[entity]} – ${LOCALE_NAMES[locale]}`}
        rows={items}
        rowKey={(item) => item.key}
        columns={[
          {
            key: "name",
            header: "Originál",
            cell: (item) => (
              <Link
                href={`/admin/preklady/${entity}/${encodeURIComponent(item.key)}?jazyk=${locale}`}
                className="font-medium hover:underline"
              >
                {item.name}
              </Link>
            ),
          },
          {
            key: "translated",
            header: LOCALE_NAMES[locale],
            cell: (item) => item.translatedName ?? "—",
            wide: true,
          },
          {
            key: "done",
            header: "Přeloženo",
            cell: (item) => `${item.done} / ${item.total}`,
            end: true,
          },
        ]}
      />
    </>
  );
}
