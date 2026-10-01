import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { editAction } from "@/components/data-table/row-actions";
import { optionStats } from "@/components/data-table/stats";
import { ToolbarLink } from "@/components/data-table/ToolbarLink";
import { navIcon } from "@/config/admin-nav";
import { can, getAccess } from "@/features/auth/access";
import { LOCALE_NAMES, type Locale } from "@/features/i18n/config";
import { listTranslations } from "@/features/i18n/editorial";
import { ENTITY_LABELS, TARGET_LOCALES } from "@/features/i18n/labels";
import {
  ENTITY_SECTION,
  TRANSLATABLE_ENTITIES,
  type TranslatableEntity,
} from "@/features/i18n/translatable";

export const metadata: Metadata = { title: "Translations" };

const STATE = [
  { value: "done", label: "Translated", tone: "success" as const },
  { value: "partial", label: "In progress", tone: "warning" as const },
  { value: "missing", label: "Missing", tone: "neutral" as const },
];

export default async function TranslationsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; locale?: string }>;
}) {
  const access = await getAccess();
  const entities = TRANSLATABLE_ENTITIES.filter(
    (entity) => access && can(access.permissions, ENTITY_SECTION[entity], "v"),
  );
  const [firstEntity] = entities;
  if (!access || !firstEntity) return <NoAccess />;

  const params = await searchParams;
  const entity = (entities as string[]).includes(params.kind ?? "")
    ? (params.kind as TranslatableEntity)
    : firstEntity;
  const locale = (TARGET_LOCALES as string[]).includes(params.locale ?? "")
    ? (params.locale as Locale)
    : TARGET_LOCALES[0];
  const items = await listTranslations(entity, locale);
  const done = items.filter((item) => item.total > 0 && item.done === item.total).length;
  const query = (next: { kind?: string; locale?: string }) =>
    `/admin/translations?${new URLSearchParams({ kind: entity, locale: locale, ...next })}`;

  return (
    <>
      <PageHeader
        icon={navIcon("/admin/translations")}
        title="Translations"
        lead={`Atlas texts in other languages. Anything untranslated is shown in English. Done: ${done} of ${items.length}.`}
      />
      <DataTable
        key={`${entity}-${locale}`}
        tableKey={`admin-translations-${entity}`}
        caption={`${ENTITY_LABELS[entity]} – ${LOCALE_NAMES[locale]}`}
        emptyTitle="Nothing to translate"
        initialSort={{ key: "name", dir: "asc" }}
        stats={optionStats("state", STATE)}
        toolbar={
          <>
            {entities.map((item) => (
              <ToolbarLink
                key={item}
                kind="tab"
                href={query({ kind: item })}
                active={item === entity}
              >
                {ENTITY_LABELS[item]}
              </ToolbarLink>
            ))}
            {TARGET_LOCALES.length > 1
              ? TARGET_LOCALES.map((item) => (
                  <ToolbarLink
                    key={item}
                    kind="tab"
                    href={query({ locale: item })}
                    active={item === locale}
                  >
                    {LOCALE_NAMES[item]}
                  </ToolbarLink>
                ))
              : null}
          </>
        }
        actionsWidth="48px"
        columns={[
          {
            key: "name",
            label: "Original",
            link: true,
            sortable: true,
            filter: "text",
            width: "minmax(200px, 2fr)",
          },
          {
            key: "translated",
            label: LOCALE_NAMES[locale],
            sortable: true,
            filter: "text",
            width: "minmax(200px, 2fr)",
          },
          {
            key: "state",
            label: "State",
            kind: "badge",
            options: STATE,
            sortable: true,
            filter: "select",
            width: "120px",
          },
          {
            key: "progress",
            label: "Fields",
            kind: "number",
            align: "right",
            sortable: true,
            width: "96px",
          },
        ]}
        rows={items.map((item) => {
          const href = `/admin/translations/${entity}/${encodeURIComponent(item.key)}?locale=${locale}`;
          return {
            id: item.key,
            href,
            values: {
              name: item.name,
              translated: item.translatedName,
              state:
                item.total > 0 && item.done === item.total
                  ? "done"
                  : item.done > 0
                    ? "partial"
                    : "missing",
              progress: item.total ? item.done / item.total : 0,
            },
            cells: { progress: `${item.done} / ${item.total}` },
            actions: <RowActions actions={[editAction(href, "Translate")]} />,
          };
        })}
      />
    </>
  );
}
